import CarouselActions from '@components/Attachments/AttachmentCarousel/CarouselActions';
import CarouselButtons from '@components/Attachments/AttachmentCarousel/CarouselButtons';
import CarouselItem from '@components/Attachments/AttachmentCarousel/CarouselItem';
import {AttachmentCarouselPagerActionsContext, AttachmentCarouselPagerStateContext} from '@components/Attachments/AttachmentCarousel/Pager/AttachmentCarouselPagerContext';
import type {AttachmentCarouselPagerActionsContextType, AttachmentCarouselPagerStateContextType} from '@components/Attachments/AttachmentCarousel/Pager/types';
import type {UpdatePageProps} from '@components/Attachments/AttachmentCarousel/types';
import useCarouselContextEvents from '@components/Attachments/AttachmentCarousel/useCarouselContextEvents';
import type {Attachment, AttachmentSource} from '@components/Attachments/types';
import BlockingView from '@components/BlockingViews/BlockingView';
import {useFullScreenState} from '@components/VideoPlayerContexts/FullScreenContextProvider';

import {useMemoizedLazyIllustrations} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';

import {canUseTouchScreen as canUseTouchScreenUtil} from '@libs/DeviceCapabilities';

import variables from '@styles/variables';

import CONST from '@src/CONST';

import type {LayoutChangeEvent, ListRenderItemInfo} from 'react-native';
import type {PanGesture} from 'react-native-gesture-handler';

import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Keyboard, PixelRatio, View} from 'react-native';
import {GestureDetector, usePanGesture} from 'react-native-gesture-handler';
import Animated, {scrollTo, useAnimatedRef, useSharedValue} from 'react-native-reanimated';

import type AttachmentCarouselViewProps from './types';

const viewabilityConfig = {
    // To facilitate paging through the attachments, we want to consider an item "viewable" when it is
    // more than 95% visible. When that happens we update the page index in the state.
    itemVisiblePercentThreshold: 95,
};

const MIN_FLING_VELOCITY = 500;

/** Sub-pixel difference between the list width and a page slot is still the same page. */
const PAGE_GEOMETRY_TOLERANCE = 1;

type ScrollNode = {
    scrollLeft?: number;
    clientWidth?: number;
    getScrollableNode?: () => ScrollNode | null;
    getNativeScrollRef?: () => ScrollNode | null;
    getScrollResponder?: () => ScrollNode | null;
};

function isScrollNode(value: unknown): value is ScrollNode {
    return value !== null && typeof value === 'object';
}

/** The DOM node the web list scrolls, where a viewability sample's width and offset can be checked. */
function readScrollGeometry(list: unknown): {scrollLeft: number | null; clientWidth: number | null} {
    if (!isScrollNode(list)) {
        return {scrollLeft: null, clientWidth: null};
    }
    const node = list.getScrollableNode?.() ?? list.getNativeScrollRef?.() ?? list.getScrollResponder?.()?.getScrollableNode?.() ?? list;
    if (!isScrollNode(node)) {
        return {scrollLeft: null, clientWidth: null};
    }
    return {
        scrollLeft: typeof node.scrollLeft === 'number' ? node.scrollLeft : null,
        clientWidth: typeof node.clientWidth === 'number' ? node.clientWidth : null,
    };
}

/**
 * Safari rotation reports a sample while the list width and the page width still disagree.
 * A 95% visible item is a real page once those widths match. The scroll offset is not checked:
 * the list moves that offset itself, and reading it rejects an arrow or swipe that already landed.
 */
function isViewablePageSettled(list: unknown, cellWidth: number): boolean {
    if (cellWidth <= 0) {
        return false;
    }
    const {clientWidth} = readScrollGeometry(list);
    if (clientWidth == null) {
        return true;
    }
    return Math.abs(clientWidth - cellWidth) <= PAGE_GEOMETRY_TOLERANCE;
}

type DeviceAwareGestureDetectorProps = {
    canUseTouchScreen: boolean;
    gesture: PanGesture;
    children: React.ReactNode;
};

function DeviceAwareGestureDetector({canUseTouchScreen, gesture, children}: DeviceAwareGestureDetectorProps) {
    // Don't render GestureDetector on non-touchable devices to prevent unexpected pointer event capture.
    // This issue is left out on touchable devices since finger touch works fine.
    // See: https://github.com/Expensify/App/issues/51246
    return canUseTouchScreen ? <GestureDetector gesture={gesture}>{children}</GestureDetector> : children;
}

function AttachmentCarouselView({
    page,
    attachments,
    shouldShowArrows,
    source,
    report,
    autoHideArrows,
    cancelAutoHideArrow,
    setShouldShowArrows,
    onAttachmentError,
    onNavigate,
    onSwipeDown,
    setPage,
    attachmentID,
}: AttachmentCarouselViewProps) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const illustrations = useMemoizedLazyIllustrations(['ToddBehindCloud']);
    const canUseTouchScreen = canUseTouchScreenUtil();
    const {isFullScreen, isFullScreenRef} = useFullScreenState();
    const isPagerScrolling = useSharedValue(false);
    const {handleTap, handleScaleChange, isScrollEnabled} = useCarouselContextEvents(setShouldShowArrows);

    const [activeAttachmentID, setActiveAttachmentID] = useState<AttachmentSource | null>(attachmentID ?? source);

    const scrollRef = useAnimatedRef<Animated.FlatList<Attachment>>();

    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const modalStyles = styles.centeredModalStyles(shouldUseNarrowLayout, true);
    const {windowWidth} = useWindowDimensions();

    const fallbackCellWidth = PixelRatio.roundToNearestPixel(windowWidth - (modalStyles.marginHorizontal + modalStyles.borderWidth) * 2);
    const [listWidth, setListWidth] = useState(0);
    // windowWidth ignores Safari's landscape safe area, so a page sized from it is wider than the list and never reaches 95% visible.
    const cellWidth = listWidth > 0 ? listWidth : fallbackCellWidth;

    const pageRef = useRef(page);
    const cellWidthRef = useRef(cellWidth);
    const setPageRef = useRef(setPage);
    const onNavigateRef = useRef(onNavigate);
    useEffect(() => {
        pageRef.current = page;
        cellWidthRef.current = cellWidth;
        setPageRef.current = setPage;
        onNavigateRef.current = onNavigate;
    }, [cellWidth, onNavigate, page, setPage]);

    // FlatList keeps the first onViewableItemsChanged, so the callback reads the refs above.
    const [onViewableItemsChanged] = useState(() => ({viewableItems}: UpdatePageProps) => {
        if (isFullScreenRef.current) {
            return;
        }

        const entry = viewableItems.at(0);
        const index = entry?.index;
        // An empty or same-page sample is a layout pass. Clearing focus here unmounts the password form.
        if (!entry || index == null || index === pageRef.current) {
            return;
        }
        if (!isViewablePageSettled(scrollRef.current, cellWidthRef.current)) {
            return;
        }

        Keyboard.dismiss();
        pageRef.current = index;
        setPageRef.current(index);
        setActiveAttachmentID(entry.item.attachmentID ?? entry.item.source);
        onNavigateRef.current?.(entry.item);
    });

    const handleListLayout = (event: LayoutChangeEvent) => {
        const nextWidth = PixelRatio.roundToNearestPixel(event.nativeEvent.layout.width);
        if (nextWidth <= 0 || nextWidth === listWidth) {
            return;
        }

        // Correct the offset before the width state update paints pages at the new size.
        cellWidthRef.current = nextWidth;
        if (page >= 0) {
            scrollRef.current?.scrollToOffset({offset: page * nextWidth, animated: false});
        }
        setListWidth(nextWidth);
    };

    /** Increments or decrements the index to get another selected item, returning whether the carousel moved */
    const cycleThroughAttachments = (deltaSlide: number) => {
        if (isFullScreen) {
            return false;
        }

        const nextIndex = page + deltaSlide;
        const nextItem = attachments.at(nextIndex);

        if (!nextItem || nextIndex < 0 || !scrollRef.current) {
            return false;
        }

        scrollRef.current.scrollToIndex({index: nextIndex, animated: canUseTouchScreen});
        return true;
    };

    const extractItemKey = (item: Attachment) =>
        !!item.attachmentID || (typeof item.source !== 'string' && typeof item.source !== 'number') ? `attachmentID-${item.attachmentID}` : `source-${item.source}|${item.attachmentLink}`;

    /** Calculate items layout information to optimize scrolling performance */
    const getItemLayout = (data: ArrayLike<Attachment> | null | undefined, index: number) => ({
        length: cellWidth,
        offset: cellWidth * index,
        index,
    });

    /** Pan gesture handling swiping through attachments on touch screen devices */
    const pan = usePanGesture({
        enabled: canUseTouchScreen,
        onUpdate: ({translationX}) => {
            if (!isScrollEnabled.get()) {
                return;
            }

            if (translationX !== 0) {
                isPagerScrolling.set(true);
            }

            scrollTo(scrollRef, page * cellWidth - translationX, 0, false);
        },
        onDeactivate: ({translationX, velocityX}) => {
            if (!isScrollEnabled.get()) {
                return;
            }

            let newIndex;
            if (velocityX > MIN_FLING_VELOCITY) {
                // User flung to the right
                newIndex = Math.max(0, page - 1);
            } else if (velocityX < -MIN_FLING_VELOCITY) {
                // User flung to the left
                newIndex = Math.min(attachments.length - 1, page + 1);
            } else {
                // snap scroll position to the nearest cell (making sure it's within the bounds of the list)
                const delta = Math.round(-translationX / cellWidth);
                newIndex = Math.min(attachments.length - 1, Math.max(0, page + delta));
            }

            isPagerScrolling.set(false);
            scrollTo(scrollRef, newIndex * cellWidth, 0, true);
        },
    });

    const stateValue: AttachmentCarouselPagerStateContextType = {
        pagerItems: [{source, index: 0, isActive: true}],
        activePage: 0,
        pagerRef: scrollRef,
        pagerGesture: pan,
        isPagerScrolling,
        isScrollEnabled,
    };

    const actionsValue: AttachmentCarouselPagerActionsContextType = {
        onTap: handleTap,
        onScaleChanged: handleScaleChange,
        onSwipeDown,
        onAttachmentError,
    };

    /** Defines how a single attachment should be rendered */
    const renderItem = ({item}: ListRenderItemInfo<Attachment>) => (
        <View style={[styles.h100, {width: cellWidth}]}>
            <CarouselItem
                item={item}
                isFocused={activeAttachmentID === (item.attachmentID ?? item.source)}
                onPress={canUseTouchScreen ? handleTap : undefined}
                isModalHovered={shouldShowArrows}
                reportID={report?.reportID}
            />
        </View>
    );

    // A width change leaves the old pixel offset in place. Realign before paint, or viewability reads that offset as another attachment.
    useLayoutEffect(() => {
        if (attachments.length === 0 || scrollRef.current == null) {
            return;
        }

        scrollRef.current.scrollToIndex({index: page, animated: false});
        // The hook is not supposed to run on page change, so we keep the page out of the dependencies
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cellWidth]);

    return (
        <View
            style={[styles.flex1, styles.attachmentCarouselContainer]}
            onMouseEnter={() => !canUseTouchScreen && setShouldShowArrows(true)}
            onMouseLeave={() => !canUseTouchScreen && setShouldShowArrows(false)}
        >
            {page === -1 ? (
                <BlockingView
                    icon={illustrations.ToddBehindCloud}
                    iconWidth={variables.modalTopIconWidth}
                    iconHeight={variables.modalTopIconHeight}
                    title={translate('notFound.notHere')}
                />
            ) : (
                <>
                    <CarouselButtons
                        page={page}
                        attachments={attachments}
                        shouldShowArrows={shouldShowArrows}
                        onBack={() => cycleThroughAttachments(-1)}
                        onForward={() => cycleThroughAttachments(1)}
                        autoHideArrow={autoHideArrows}
                        cancelAutoHideArrow={cancelAutoHideArrow}
                    />
                    <AttachmentCarouselPagerStateContext.Provider value={stateValue}>
                        <AttachmentCarouselPagerActionsContext.Provider value={actionsValue}>
                            <DeviceAwareGestureDetector
                                canUseTouchScreen={canUseTouchScreen}
                                gesture={pan}
                            >
                                <Animated.FlatList
                                    keyboardShouldPersistTaps="handled"
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    // scrolling is controlled by the pan gesture
                                    scrollEnabled={false}
                                    ref={scrollRef}
                                    initialScrollIndex={page}
                                    initialNumToRender={3}
                                    windowSize={5}
                                    maxToRenderPerBatch={CONST.MAX_TO_RENDER_PER_BATCH.CAROUSEL}
                                    data={attachments}
                                    renderItem={renderItem}
                                    getItemLayout={getItemLayout}
                                    keyExtractor={extractItemKey}
                                    viewabilityConfig={viewabilityConfig}
                                    onViewableItemsChanged={onViewableItemsChanged}
                                    onLayout={handleListLayout}
                                />
                            </DeviceAwareGestureDetector>
                        </AttachmentCarouselPagerActionsContext.Provider>
                    </AttachmentCarouselPagerStateContext.Provider>
                    <CarouselActions onCycleThroughAttachments={cycleThroughAttachments} />
                </>
            )}
        </View>
    );
}

export default AttachmentCarouselView;
