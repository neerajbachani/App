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
import useSafeAreaInsets from '@hooks/useSafeAreaInsets';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';

import {canUseTouchScreen as canUseTouchScreenUtil} from '@libs/DeviceCapabilities';

import variables from '@styles/variables';

import CONST from '@src/CONST';

import type {RefObject} from 'react';
import type {LayoutChangeEvent, ListRenderItemInfo, NativeScrollEvent, NativeSyntheticEvent} from 'react-native';
import type {LegacyComposedGesture, GestureType} from 'react-native-gesture-handler';

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Keyboard, PixelRatio, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {scrollTo, useAnimatedRef, useSharedValue} from 'react-native-reanimated';

import type AttachmentCarouselViewProps from './types';

const viewabilityConfig = {
    // To facilitate paging through the attachments, we want to consider an item "viewable" when it is
    // more than 95% visible. When that happens we update the page index in the state.
    itemVisiblePercentThreshold: 95,
};

const MIN_FLING_VELOCITY = 500;

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

/** The DOM node the web list actually scrolls, where viewability's width and offset can be checked. */
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

type DeviceAwareGestureDetectorProps = {
    canUseTouchScreen: boolean;
    gesture: LegacyComposedGesture | GestureType;
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

    const pagerRef = useRef<GestureType>(null);
    const scrollRef = useAnimatedRef<Animated.FlatList<ListRenderItemInfo<Attachment>>>();

    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const modalStyles = styles.centeredModalStyles(shouldUseNarrowLayout, true);
    const {windowWidth} = useWindowDimensions();
    const insets = useSafeAreaInsets();

    // Before the list has laid out, size pages to the window minus the modal's horizontal safe-area
    // padding. After layout, the list's own width is the page width, so a page can reach 95% visible.
    const fallbackCellWidth = useMemo(
        () => PixelRatio.roundToNearestPixel(windowWidth - (modalStyles.marginHorizontal + modalStyles.borderWidth) * 2 - insets.left - insets.right),
        [insets.left, insets.right, modalStyles.borderWidth, modalStyles.marginHorizontal, windowWidth],
    );
    const [listWidth, setListWidth] = useState(0);
    const cellWidth = listWidth > 0 ? listWidth : fallbackCellWidth;

    // onViewableItemsChanged cannot change after mount, so the callback reads these instead of closing over render values.
    const pageRef = useRef(page);
    const cellWidthRef = useRef(cellWidth);
    const listWidthRef = useRef(0);
    const listScrollOffsetRef = useRef<number | null>(null);
    useEffect(() => {
        pageRef.current = page;
    }, [page]);
    useEffect(() => {
        cellWidthRef.current = cellWidth;
    }, [cellWidth]);

    /** Updates the page state when the user navigates between attachments */
    const updatePage = useCallback(
        ({viewableItems}: UpdatePageProps) => {
            if (isFullScreenRef.current) {
                return;
            }

            // Rotation updates the list width, then the page width, then the scroll offset. Viewability
            // during those gaps is the browser clamping the scroll, not a page the user chose.
            const {scrollLeft, clientWidth} = readScrollGeometry(scrollRef.current);
            const width = cellWidthRef.current;
            if (clientWidth != null && Math.abs(clientWidth - width) > 1) {
                return;
            }
            const listOffset = listScrollOffsetRef.current;
            if (listOffset != null && scrollLeft != null && Math.abs(listOffset - scrollLeft) > 1) {
                return;
            }

            // Since we can have only one item in view at a time, we can use the first item in the array
            // to get the index of the current page
            const entry = viewableItems.at(0);
            if (!entry) {
                Keyboard.dismiss();
                setActiveAttachmentID(null);
                return;
            }

            const item = entry.item as Attachment;
            if (entry.index != null && entry.index !== pageRef.current) {
                Keyboard.dismiss();
            }
            if (entry.index != null) {
                setPage(entry.index);
                setActiveAttachmentID(item.attachmentID ?? item.source);
            }

            if (onNavigate) {
                onNavigate(item);
            }
        },
        [isFullScreenRef, onNavigate, scrollRef, setPage, setActiveAttachmentID],
    );

    const handleListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        listScrollOffsetRef.current = event.nativeEvent.contentOffset.x;
    }, []);

    const handleListLayout = useCallback(
        (event: LayoutChangeEvent) => {
            const nextWidth = PixelRatio.roundToNearestPixel(event.nativeEvent.layout.width);
            if (nextWidth <= 0 || nextWidth === listWidthRef.current) {
                return;
            }
            listWidthRef.current = nextWidth;
            if (pageRef.current >= 0) {
                scrollRef.current?.scrollToOffset({offset: pageRef.current * nextWidth, animated: false});
            }
            setListWidth(nextWidth);
        },
        [scrollRef],
    );

    /** Increments or decrements the index to get another selected item */
    const cycleThroughAttachments = useCallback(
        (deltaSlide: number) => {
            if (isFullScreen) {
                return;
            }

            const nextIndex = page + deltaSlide;
            const nextItem = attachments.at(nextIndex);

            if (!nextItem || nextIndex < 0 || !scrollRef.current) {
                return;
            }

            scrollRef.current.scrollToIndex({index: nextIndex, animated: canUseTouchScreen});
        },
        [attachments, canUseTouchScreen, isFullScreen, page, scrollRef],
    );

    const extractItemKey = useCallback(
        (item: Attachment) =>
            !!item.attachmentID || (typeof item.source !== 'string' && typeof item.source !== 'number')
                ? `attachmentID-${item.attachmentID}`
                : `source-${item.source}|${item.attachmentLink}`,
        [],
    );

    /** Calculate items layout information to optimize scrolling performance */
    const getItemLayout = useCallback(
        (data: ArrayLike<Attachment> | null | undefined, index: number) => ({
            length: cellWidth,
            offset: cellWidth * index,
            index,
        }),
        [cellWidth],
    );

    const stateValue = useMemo<AttachmentCarouselPagerStateContextType>(
        () => ({
            pagerItems: [{source, index: 0, isActive: true}],
            activePage: 0,
            pagerRef,
            isPagerScrolling,
            isScrollEnabled,
        }),
        [source, isPagerScrolling, isScrollEnabled],
    );

    const actionsValue = useMemo<AttachmentCarouselPagerActionsContextType>(
        () => ({
            onTap: handleTap,
            onScaleChanged: handleScaleChange,
            onSwipeDown,
            onAttachmentError,
        }),
        [handleTap, handleScaleChange, onSwipeDown, onAttachmentError],
    );

    /** Defines how a single attachment should be rendered */
    const renderItem = useCallback(
        ({item}: ListRenderItemInfo<Attachment>) => (
            <View style={[styles.h100, {width: cellWidth}]}>
                <CarouselItem
                    item={item}
                    isFocused={activeAttachmentID === (item.attachmentID ?? item.source)}
                    onPress={canUseTouchScreen ? handleTap : undefined}
                    isModalHovered={shouldShowArrows}
                    reportID={report?.reportID}
                />
            </View>
        ),
        [activeAttachmentID, canUseTouchScreen, cellWidth, handleTap, report?.reportID, shouldShowArrows, styles.h100],
    );
    /** Pan gesture handing swiping through attachments on touch screen devices */
    const pan = useMemo(
        () =>
            Gesture.Pan()
                .enabled(canUseTouchScreen)
                .onUpdate(({translationX}) => {
                    if (!isScrollEnabled.get()) {
                        return;
                    }

                    if (translationX !== 0) {
                        isPagerScrolling.set(true);
                    }

                    scrollTo(scrollRef, page * cellWidth - translationX, 0, false);
                })
                .onEnd(({translationX, velocityX}) => {
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
                })
                .withRef(pagerRef as RefObject<GestureType | undefined>),
        [attachments.length, canUseTouchScreen, cellWidth, page, isScrollEnabled, scrollRef, isPagerScrolling],
    );

    // Scroll position is affected when window width is resized, so we readjust it on width changes
    useEffect(() => {
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
                                    onViewableItemsChanged={updatePage}
                                    onScroll={handleListScroll}
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

// OXC's React Compiler bails on this file (refs accessed during render in gesture handlers), so it
// is not memoized on web. Memoize it explicitly to keep parent-driven re-renders cheap there.
export default React.memo(AttachmentCarouselView);
