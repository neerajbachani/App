/** Exercises the web carousel's explicit navigation, focus, arrow bounds and shared gesture ref through its real component. */
import {act, render, screen} from '@testing-library/react-native';

import type AttachmentCarouselViewComponent from '@components/Attachments/AttachmentCarousel/AttachmentCarouselView/index';
import type AttachmentCarouselViewProps from '@components/Attachments/AttachmentCarousel/AttachmentCarouselView/types';
import CarouselButtons from '@components/Attachments/AttachmentCarousel/CarouselButtons';
import CarouselItem from '@components/Attachments/AttachmentCarousel/CarouselItem';
import {AttachmentCarouselPagerStateContext} from '@components/Attachments/AttachmentCarousel/Pager/AttachmentCarouselPagerContext';
import type {AttachmentCarouselPagerStateContextType} from '@components/Attachments/AttachmentCarousel/Pager/types';
import type {Attachment, AttachmentSource} from '@components/Attachments/types';
import Text from '@components/Text';
import {useFullScreenState} from '@components/VideoPlayerContexts/FullScreenContextProvider';

import {canUseTouchScreen} from '@libs/DeviceCapabilities';

import type {FlatListProps, FlatList, LayoutChangeEvent, ListRenderItemInfo} from 'react-native';
// eslint-disable-next-line no-restricted-imports -- This type-only import describes the real Gesture Handler module retained by the mock.
import type * as GestureHandler from 'react-native-gesture-handler';
import type * as Reanimated from 'react-native-reanimated';

import React, {useContext} from 'react';
import {Keyboard} from 'react-native';
import {GestureDetector} from 'react-native-gesture-handler';

import createMock from '../utils/createMock';

jest.mock('@components/Attachments/AttachmentCarousel/CarouselButtons', () => jest.fn(() => null));
jest.mock('@components/Attachments/AttachmentCarousel/CarouselActions', () => jest.fn(() => null));
jest.mock('@components/Attachments/AttachmentCarousel/CarouselItem', () => jest.fn(() => null));
jest.mock('@components/VideoPlayerContexts/FullScreenContextProvider', () => ({useFullScreenState: jest.fn()}));
jest.mock('@libs/DeviceCapabilities', () => ({canUseTouchScreen: jest.fn()}));
jest.mock('@hooks/useResponsiveLayout');
jest.mock('@hooks/useLocalize', () => jest.fn(() => ({translate: (key: string) => key})));
jest.mock('react-native-gesture-handler', () => ({
    ...jest.requireActual<typeof GestureHandler>('react-native-gesture-handler'),
    GestureDetector: jest.fn(({children}: React.ComponentProps<typeof GestureDetector>) => children),
}));

const AttachmentCarouselView = jest.requireActual<{default: typeof AttachmentCarouselViewComponent}>(
    '../../src/components/Attachments/AttachmentCarousel/AttachmentCarouselView/index.tsx',
).default;

const mockScrollToIndex = jest.fn();
const mockScrollToOffset = jest.fn();
const mockScrollRef = Object.assign(jest.fn(), {
    current: createMock<FlatList<Attachment>>({scrollToIndex: mockScrollToIndex, scrollToOffset: mockScrollToOffset}),
});
let pagerState: AttachmentCarouselPagerStateContextType | null = null;
const mockFlatList = jest.fn(({data, renderItem}: FlatListProps<Attachment>) => {
    pagerState = useContext(AttachmentCarouselPagerStateContext);
    return (
        <>
            {Array.from(data ?? []).map((item, index) => (
                <React.Fragment key={item.attachmentID ?? index.toString()}>{renderItem?.(createMock<ListRenderItemInfo<Attachment>>({item, index}))}</React.Fragment>
            ))}
        </>
    );
});
jest.mock('react-native-reanimated', () => {
    const animated = jest.requireActual<typeof Reanimated>('react-native-reanimated/mock');
    return {
        ...animated,
        default: {...animated.default, FlatList: (props: FlatListProps<Attachment>) => mockFlatList(props)},
        useAnimatedRef: () => mockScrollRef,
    };
});

type PanEndEvent = {translationX: number; velocityX: number};

function isPanEnd(value: unknown): value is (event: PanEndEvent) => void {
    return typeof value === 'function';
}

function createOnNavigateMock() {
    return jest.fn<ReturnType<NonNullable<AttachmentCarouselViewProps['onNavigate']>>, Parameters<NonNullable<AttachmentCarouselViewProps['onNavigate']>>>();
}

function createSvgAttachmentSourceMock() {
    return jest.fn<ReturnType<Extract<AttachmentSource, React.FunctionComponent>>, Parameters<Extract<AttachmentSource, React.FunctionComponent>>>(() => null);
}

function renderCarousel(overrides: Partial<AttachmentCarouselViewProps> = {}) {
    const props: AttachmentCarouselViewProps = {
        page: 0,
        attachments: [{source: 'first.png'}, {source: 'second.png'}],
        source: 'first.png',
        shouldShowArrows: true,
        autoHideArrows: jest.fn(),
        cancelAutoHideArrow: jest.fn(),
        setShouldShowArrows: jest.fn(),
        setPage: jest.fn(),
        onNavigate: jest.fn(),
        ...overrides,
    };
    const view = render(<AttachmentCarouselView {...props} />);
    return {props, ...view};
}

function listProps() {
    const props = mockFlatList.mock.calls.at(-1)?.[0];
    if (!props?.onLayout) {
        throw new Error('Expected the web FlatList layout callback');
    }
    return props;
}

function layoutList(width: number) {
    act(() => {
        listProps().onLayout?.(createMock<LayoutChangeEvent>({nativeEvent: {layout: {x: 0, y: 0, width, height: 1}}}));
    });
}

function arrowButtons() {
    const buttons = jest.mocked(CarouselButtons).mock.calls.at(-1)?.[0];
    if (!buttons) {
        throw new Error('Expected carousel arrow controls');
    }
    return buttons;
}

async function endPan(event: PanEndEvent) {
    const onDeactivate = pagerState?.pagerGesture?.config.onDeactivate;
    if (!isPanEnd(onDeactivate)) {
        throw new Error('Expected the pan end callback');
    }
    await act(async () => {
        onDeactivate(event);
    });
}

describe('AttachmentCarouselView web', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        pagerState = null;
        jest.mocked(canUseTouchScreen).mockReturnValue(true);
        jest.mocked(useFullScreenState).mockReturnValue(createMock<ReturnType<typeof useFullScreenState>>({isFullScreen: false, isFullScreenRef: {current: false}}));
        jest.mocked(CarouselItem).mockImplementation(({item, isFocused}) => {
            const sourceLabel = typeof item.source === 'object' ? JSON.stringify(item.source) : String(item.source);
            return <Text>{`${item.attachmentID ?? sourceLabel}:${String(isFocused)}`}</Text>;
        });
    });

    it('focuses the attachment at the page index', () => {
        // Given a carousel opened on the second attachment
        const {props, rerender} = renderCarousel({page: 1});

        // Then focus follows that page and opening it is not navigation
        expect(screen.getByText('second.png:true')).toBeOnTheScreen();
        expect(screen.getByText('first.png:false')).toBeOnTheScreen();
        expect(props.setPage).not.toHaveBeenCalled();
        expect(props.onNavigate).not.toHaveBeenCalled();

        // When the parent selects the first attachment
        rerender(
            <AttachmentCarouselView
                {...props}
                page={0}
            />,
        );

        // Then focus follows the new page
        expect(screen.getByText('first.png:true')).toBeOnTheScreen();
        expect(screen.getByText('second.png:false')).toBeOnTheScreen();
    });

    it('does not invoke a function source while focusing the current page', () => {
        // Given an SVG source identified by its attachment id
        const source = createSvgAttachmentSourceMock();
        const attachment: Attachment = {source, attachmentID: 'svg'};

        // When that attachment is the selected page
        renderCarousel({attachments: [attachment], source, attachmentID: attachment.attachmentID});

        // Then the source stays a component and the page is focused
        expect(source).not.toHaveBeenCalled();
        expect(screen.getByText('svg:true')).toBeOnTheScreen();
    });

    it('sets the page and navigates when an arrow moves to another attachment', () => {
        // Given a touch carousel on the first attachment
        const dismiss = jest.spyOn(Keyboard, 'dismiss');
        const onNavigate = createOnNavigateMock();
        const {props, rerender} = renderCarousel({onNavigate});
        mockScrollToIndex.mockClear();

        // When the user moves forward
        act(() => arrowButtons().onForward());

        // Then the arrow selects that page, closes the keyboard, and scrolls to it
        expect(dismiss).toHaveBeenCalledTimes(1);
        expect(props.setPage).toHaveBeenCalledWith(1);
        expect(onNavigate).toHaveBeenCalledWith(props.attachments.at(1));
        expect(mockScrollToIndex).toHaveBeenCalledWith({index: 1, animated: true});

        // When the parent applies that page and the user moves back
        rerender(
            <AttachmentCarouselView
                {...props}
                page={1}
            />,
        );
        mockScrollToIndex.mockClear();
        dismiss.mockClear();
        act(() => arrowButtons().onBack());

        // Then the previous attachment is selected the same way
        expect(dismiss).toHaveBeenCalledTimes(1);
        expect(props.setPage).toHaveBeenCalledWith(0);
        expect(onNavigate).toHaveBeenCalledWith(props.attachments.at(0));
        expect(mockScrollToIndex).toHaveBeenCalledWith({index: 0, animated: true});
        dismiss.mockRestore();
    });

    it('enforces arrow bounds and bypasses the detector on a mouse device', () => {
        // Given a non-touch device at the first page
        jest.mocked(canUseTouchScreen).mockReturnValue(false);
        const {props, rerender} = renderCarousel();
        mockScrollToIndex.mockClear();

        // When the user cycles backward then forward and tries to pass the last page
        act(() => arrowButtons().onBack());
        expect(mockScrollToIndex).not.toHaveBeenCalled();
        expect(props.setPage).not.toHaveBeenCalled();
        act(() => arrowButtons().onForward());
        expect(mockScrollToIndex).toHaveBeenCalledWith({index: 1, animated: false});
        rerender(
            <AttachmentCarouselView
                {...props}
                page={1}
            />,
        );
        mockScrollToIndex.mockClear();
        act(() => arrowButtons().onForward());

        // Then out-of-range navigation does not scroll and pointer capture has no gesture detector
        expect(mockScrollToIndex).not.toHaveBeenCalled();
        expect(props.setPage).not.toHaveBeenCalledWith(2);
        expect(GestureDetector).not.toHaveBeenCalled();
    });

    it('leaves the page alone while media is fullscreen', () => {
        // Given fullscreen playback
        jest.mocked(useFullScreenState).mockReturnValue(createMock<ReturnType<typeof useFullScreenState>>({isFullScreen: true, isFullScreenRef: {current: true}}));
        const dismiss = jest.spyOn(Keyboard, 'dismiss');
        const {props} = renderCarousel();
        mockScrollToIndex.mockClear();

        // When an arrow or a fling asks for the next attachment
        act(() => arrowButtons().onForward());

        // Then the carousel does not navigate
        expect(dismiss).not.toHaveBeenCalled();
        expect(props.setPage).not.toHaveBeenCalled();
        expect(props.onNavigate).not.toHaveBeenCalled();
        expect(mockScrollToIndex).not.toHaveBeenCalled();
        expect(screen.getByText('first.png:true')).toBeOnTheScreen();
        dismiss.mockRestore();
    });

    it('realigns to the selected page when the list width changes', () => {
        // Given a carousel on the last of several attachments
        const dismiss = jest.spyOn(Keyboard, 'dismiss');
        const attachments: Attachment[] = Array.from({length: 7}, (_, index) => ({source: `file-${index}.png`}));
        const {props} = renderCarousel({page: 6, attachments, source: 'file-6.png'});
        layoutList(400);
        mockScrollToIndex.mockClear();

        // When rotation reports a new list width
        layoutList(750);

        // Then the list scrolls to the selected page and does not treat that as navigation
        expect(mockScrollToIndex).toHaveBeenCalledWith({index: 6, animated: false});
        expect(props.setPage).not.toHaveBeenCalled();
        expect(props.onNavigate).not.toHaveBeenCalled();
        expect(dismiss).not.toHaveBeenCalled();
        expect(screen.getByText('file-6.png:true')).toBeOnTheScreen();
        dismiss.mockRestore();
    });

    it('realigns when the parent replaces the attachment list and the selected page', () => {
        // Given a carousel on the first attachment
        const dismiss = jest.spyOn(Keyboard, 'dismiss');
        const {props, rerender} = renderCarousel();
        mockScrollToIndex.mockClear();
        const attachments: Attachment[] = Array.from({length: 7}, (_, index) => ({source: `file-${index}.png`}));

        // When the parent opens a later attachment in a new list
        rerender(
            <AttachmentCarouselView
                {...props}
                page={6}
                attachments={attachments}
                source="file-6.png"
            />,
        );

        // Then the list follows that page without dismissing the keyboard
        expect(mockScrollToIndex).toHaveBeenCalledWith({index: 6, animated: false});
        expect(props.setPage).not.toHaveBeenCalled();
        expect(dismiss).not.toHaveBeenCalled();
        expect(screen.getByText('file-6.png:true')).toBeOnTheScreen();

        // When the parent selects a different attachment without changing how many there are
        mockScrollToIndex.mockClear();
        rerender(
            <AttachmentCarouselView
                {...props}
                page={1}
                attachments={[{source: 'left.png'}, {source: 'right.png'}]}
                source="right.png"
            />,
        );

        // Then the list still follows that page
        expect(mockScrollToIndex).toHaveBeenCalledWith({index: 1, animated: false});
        expect(props.setPage).not.toHaveBeenCalled();
        expect(screen.getByText('right.png:true')).toBeOnTheScreen();
        dismiss.mockRestore();
    });

    it('sets the page and navigates when a pan ends on another attachment', async () => {
        // Given a touch carousel on the first attachment
        const dismiss = jest.spyOn(Keyboard, 'dismiss');
        const onNavigate = createOnNavigateMock();
        const {props} = renderCarousel({onNavigate});

        // When the user flings to the next attachment
        await endPan({translationX: -40, velocityX: -600});

        // Then the pan selects that page and closes the keyboard
        expect(dismiss).toHaveBeenCalledTimes(1);
        expect(props.setPage).toHaveBeenCalledWith(1);
        expect(onNavigate).toHaveBeenCalledWith(props.attachments.at(1));
        expect(screen.getByText('first.png:true')).toBeOnTheScreen();
        dismiss.mockRestore();
    });

    it('does not navigate when a pan ends on the current page', async () => {
        // Given a touch carousel on the first attachment
        const dismiss = jest.spyOn(Keyboard, 'dismiss');
        const {props} = renderCarousel();

        // When the pan snaps back to the current page
        await endPan({translationX: 10, velocityX: 0});

        // Then the keyboard stays open and the page stays put
        expect(dismiss).not.toHaveBeenCalled();
        expect(props.setPage).not.toHaveBeenCalled();
        expect(props.onNavigate).not.toHaveBeenCalled();
        expect(screen.getByText('first.png:true')).toBeOnTheScreen();
        dismiss.mockRestore();
    });

    it('shares the real pan gesture and the list ref with pager consumers and retains them on rerender', () => {
        // Given the production gesture passed to the detector, with only detector rendering replaced
        const {props, rerender} = renderCarousel();
        const detectorProps = jest.mocked(GestureDetector).mock.calls.at(-1)?.[0];
        expect(detectorProps).toBeDefined();
        const gesture = pagerState?.pagerGesture;
        if (!detectorProps || !pagerState || !gesture) {
            throw new Error('Expected the real detector gesture and pager context');
        }

        // Then pager consumers receive the exact enabled pan gesture given to the detector, and the list ref
        expect(detectorProps.gesture).toBe(gesture);
        expect(gesture.type).toBe('PanGestureHandler');
        expect(gesture.config.enabled).toBe(true);
        expect(pagerState.pagerRef).toBe(mockScrollRef);
        const handlerTag = gesture.handlerTag;

        // When the carousel rerenders with unrelated props
        rerender(
            <AttachmentCarouselView
                {...props}
                shouldShowArrows={false}
            />,
        );

        // Then the provider keeps the same list ref and the gesture keeps its native handler identity
        expect(pagerState.pagerRef).toBe(mockScrollRef);
        expect(pagerState.pagerGesture?.handlerTag).toBe(handlerTag);
        expect(jest.mocked(GestureDetector).mock.calls.at(-1)?.[0].gesture).toBe(pagerState.pagerGesture);
    });
});
