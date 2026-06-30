import {act, renderHook} from '@testing-library/react-native';
import {BackHandler} from 'react-native';
import type {DiscardChangesConfirmation} from '@hooks/useDiscardChangesConfirmation/types';
import type UseDiscardChangesConfirmationOptions from '@hooks/useDiscardChangesConfirmation/types';
import {
    DiscardChangesEdgeGuardProvider,
    useActiveEdgeBackGuard,
} from '@hooks/useDiscardChangesConfirmation/edgeBackGuardContext';
import type {ReactNode} from 'react';
import React from 'react';

var platformState = {OS: 'ios' as 'ios' | 'android'};

jest.mock('@hooks/useDiscardChangesConfirmation/platformOS', () => ({
    __esModule: true,
    get default() {
        return platformState.OS;
    },
}));

type MockBeforeRemoveEvent = {data: {action: {type: string}}};

let mockPreventRemoveFlag: boolean | undefined;
let mockPreventRemoveCallback: ((e: MockBeforeRemoveEvent) => void) | undefined;
let mockIsFocused = true;
const mockSetOptions = jest.fn();
const mockOuterRHPNavigation = {setOptions: mockSetOptions, getParent: () => undefined};
const mockInnerStackNavigation = {setOptions: mockSetOptions, getParent: () => mockOuterRHPNavigation};
const mockTabNavigation = {setOptions: mockSetOptions, getParent: () => mockInnerStackNavigation};
const mockScreenNavigation = {getParent: () => mockTabNavigation};

const expectedGestureOptions = (gestureEnabled: boolean) => ({
    gestureEnabled,
    fullScreenGestureEnabled: gestureEnabled,
    native: {gestureEnabled, fullScreenGestureEnabled: gestureEnabled},
});

jest.mock('@react-navigation/native', () => ({
    usePreventRemove: (flag: boolean, callback: (e: MockBeforeRemoveEvent) => void) => {
        mockPreventRemoveFlag = flag;
        mockPreventRemoveCallback = callback;
    },
    useIsFocused: () => mockIsFocused,
    useNavigation: () => mockScreenNavigation,
    // The hook reads `route.name` to key its tab-switch guard
    useRoute: () => ({name: 'test-route'}),
    // Focus effects behave like plain effects in these tests — the screen is always focused
    useFocusEffect: (callback: () => undefined | (() => void)) => {
        jest.requireActual<{useEffect: (effect: () => undefined | (() => void), deps: unknown[]) => void}>('react').useEffect(callback, [callback]);
    },
}));

const mockShowConfirmModal = jest.fn();
jest.mock('@hooks/useConfirmModal', () => ({
    __esModule: true,
    default: () => ({showConfirmModal: mockShowConfirmModal}),
}));

jest.mock('@hooks/useLocalize', () => ({
    __esModule: true,
    default: () => ({translate: (key: string) => key}),
}));

jest.mock('@components/Modal/Global/ModalContext', () => ({
    ModalActions: {CONFIRM: 'CONFIRM', CLOSE: 'CLOSE'},
}));

jest.mock('@libs/Log', () => ({
    __esModule: true,
    default: {warn: jest.fn(), hmmm: jest.fn()},
}));

const mockNavigationDispatch = jest.fn();
const mockNavigationGoBack = jest.fn();
jest.mock('@libs/Navigation/navigationRef', () => ({
    __esModule: true,
    default: {
        get current() {
            return {dispatch: mockNavigationDispatch, goBack: mockNavigationGoBack};
        },
    },
}));

type DiscardHookModule = {default: (options: UseDiscardChangesConfirmationOptions) => DiscardChangesConfirmation};

const useDiscardChangesConfirmation = jest.requireActual<DiscardHookModule>('@hooks/useDiscardChangesConfirmation/index.native.ts').default;

function edgeGuardWrapper({children}: {children: ReactNode}) {
    return React.createElement(DiscardChangesEdgeGuardProvider, null, children);
}

describe('useDiscardChangesConfirmation (native)', () => {
    let backHandlerSpy: jest.SpyInstance;
    let hardwareBackCallback: (() => boolean | null | undefined) | undefined;
    const removeSubscription = jest.fn();
    let resolveModal: ((result: {action: string}) => void) | undefined;

    const renderDiscardHook = (getHasUnsavedChanges: () => boolean) => renderHook(() => useDiscardChangesConfirmation({getHasUnsavedChanges}));

    const pressHardwareBack = (): boolean | null | undefined => {
        let consumed: boolean | null | undefined;
        act(() => {
            consumed = hardwareBackCallback?.();
        });
        return consumed;
    };

    const resolveModalWith = async (action: string) => {
        await act(async () => {
            resolveModal?.({action});
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();
        platformState.OS = 'ios';
        mockPreventRemoveFlag = undefined;
        mockPreventRemoveCallback = undefined;
        mockIsFocused = true;
        hardwareBackCallback = undefined;
        resolveModal = undefined;
        backHandlerSpy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event, handler) => {
            hardwareBackCallback = handler;
            return {remove: removeSubscription};
        });
        mockShowConfirmModal.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveModal = resolve;
                }),
        );
    });

    afterEach(() => {
        backHandlerSpy.mockRestore();
    });

    describe('hardware back (tab-switch case: no removal)', () => {
        it('consumes the back press and shows the modal when the form is dirty', () => {
            renderDiscardHook(() => true);

            expect(pressHardwareBack()).toBe(true);
            expect(mockShowConfirmModal).toHaveBeenCalledTimes(1);
            expect(mockNavigationGoBack).not.toHaveBeenCalled();
        });

        it('lets the back press through when the form is clean', () => {
            renderDiscardHook(() => false);

            expect(pressHardwareBack()).toBe(false);
            expect(mockShowConfirmModal).not.toHaveBeenCalled();
        });

        it('lets the back press through after notifySaving, and prompts again once the save ends', () => {
            const {result} = renderDiscardHook(() => true);

            act(() => result.current.notifySaving());
            expect(pressHardwareBack()).toBe(false);
            expect(mockShowConfirmModal).not.toHaveBeenCalled();

            act(() => result.current.notifySaving(false));
            expect(pressHardwareBack()).toBe(true);
            expect(mockShowConfirmModal).toHaveBeenCalledTimes(1);
        });

        it('lets the back press through when the screen is not focused, even with a dirty form', () => {
            mockIsFocused = false;
            renderDiscardHook(() => true);

            expect(pressHardwareBack()).toBe(false);
            expect(mockShowConfirmModal).not.toHaveBeenCalled();
        });

        it('swallows back presses while the modal is open without stacking a second modal', () => {
            renderDiscardHook(() => true);

            pressHardwareBack();

            expect(pressHardwareBack()).toBe(true);
            expect(mockShowConfirmModal).toHaveBeenCalledTimes(1);
        });

        it('replays the back with goBack on confirm and keeps prevention armed', async () => {
            renderDiscardHook(() => true);

            pressHardwareBack();
            await resolveModalWith('CONFIRM');

            expect(mockNavigationGoBack).toHaveBeenCalledTimes(1);
            expect(mockNavigationDispatch).not.toHaveBeenCalled();
            expect(mockPreventRemoveFlag).toBe(true);
        });

        it('re-dispatches a beforeRemove fired during the goBack replay instead of re-prompting', async () => {
            renderDiscardHook(() => true);

            pressHardwareBack();

            // On the initial tab the replayed goBack pops the screen, which fires beforeRemove synchronously
            mockNavigationGoBack.mockImplementationOnce(() => {
                mockPreventRemoveCallback?.({data: {action: {type: 'POP'}}});
            });

            await resolveModalWith('CONFIRM');

            expect(mockNavigationDispatch).toHaveBeenCalledWith({type: 'POP'});
            expect(mockShowConfirmModal).toHaveBeenCalledTimes(1);
        });

        it('stays put on cancel and prompts again on the next back press', async () => {
            renderDiscardHook(() => true);
            const onCancel = jest.fn();
            renderHook(() => useDiscardChangesConfirmation({getHasUnsavedChanges: () => true, onCancel}));

            pressHardwareBack();
            await resolveModalWith('CLOSE');

            expect(onCancel).toHaveBeenCalledTimes(1);
            expect(mockNavigationGoBack).not.toHaveBeenCalled();
            expect(mockNavigationDispatch).not.toHaveBeenCalled();

            expect(pressHardwareBack()).toBe(true);
            expect(mockShowConfirmModal).toHaveBeenCalledTimes(2);
        });

        it('removes the hardware back subscription on unmount', () => {
            const {unmount} = renderDiscardHook(() => true);

            unmount();

            expect(removeSubscription).toHaveBeenCalled();
        });
    });

    describe('usePreventRemove (removal case: header back, in-app pop, iOS swipe)', () => {
        const invokeBeforeRemove = (type: string) => {
            act(() => {
                mockPreventRemoveCallback?.({data: {action: {type}}});
            });
        };

        it('arms prevention only when the form is dirty', () => {
            const {rerender} = renderHook(({dirty}: {dirty: boolean}) => useDiscardChangesConfirmation({getHasUnsavedChanges: () => dirty}), {
                initialProps: {dirty: false},
            });

            expect(mockPreventRemoveFlag).toBe(false);

            rerender({dirty: true});

            expect(mockPreventRemoveFlag).toBe(true);
        });

        it('re-arms prevention after recheckUnsavedChanges when input becomes dirty', () => {
            let isDirty = false;
            const {result, rerender} = renderHook(() => useDiscardChangesConfirmation({getHasUnsavedChanges: () => isDirty}));

            expect(mockPreventRemoveFlag).toBe(false);

            isDirty = true;
            act(() => result.current.recheckUnsavedChanges());
            rerender({});

            expect(mockPreventRemoveFlag).toBe(true);
        });

        it('shows the modal and dispatches the blocked action on confirm', async () => {
            renderDiscardHook(() => true);

            invokeBeforeRemove('POP');
            expect(mockShowConfirmModal).toHaveBeenCalledTimes(1);

            await resolveModalWith('CONFIRM');

            expect(mockNavigationDispatch).toHaveBeenCalledWith({type: 'POP'});
            expect(mockNavigationGoBack).not.toHaveBeenCalled();
        });

        it('allows and replays the action immediately when the form is clean', () => {
            renderDiscardHook(() => false);

            invokeBeforeRemove('POP');

            expect(mockShowConfirmModal).not.toHaveBeenCalled();
            expect(mockNavigationDispatch).toHaveBeenCalledWith({type: 'POP'});
        });

        it('ignores beforeRemove while the modal is already open', () => {
            renderDiscardHook(() => true);

            pressHardwareBack();
            invokeBeforeRemove('POP');

            expect(mockShowConfirmModal).toHaveBeenCalledTimes(1);
        });

        it('clears the blocked action on cancel so a later hardware-back confirm uses goBack', async () => {
            renderDiscardHook(() => true);

            invokeBeforeRemove('POP');
            await resolveModalWith('CLOSE');

            pressHardwareBack();
            await resolveModalWith('CONFIRM');

            expect(mockNavigationDispatch).not.toHaveBeenCalled();
            expect(mockNavigationGoBack).toHaveBeenCalledTimes(1);
        });
        it('does not arm preventRemove on a clean screen (iOS swipe should dismiss without native cancel/replay)', () => {
            renderDiscardHook(() => false);

            expect(mockPreventRemoveFlag).toBe(false);
        });
    });

    describe('iOS modal-stack gesture (dirty swipe-back flash)', () => {
        it('disables swipe on every ancestor stack when the form is dirty and focused', () => {
            renderDiscardHook(() => true);

            expect(mockSetOptions).toHaveBeenCalledTimes(3);
            expect(mockSetOptions).toHaveBeenCalledWith(expectedGestureOptions(false));
        });

        it('keeps swipe enabled on every ancestor stack when the form is clean', () => {
            renderDiscardHook(() => false);

            expect(mockSetOptions).toHaveBeenCalledTimes(3);
            expect(mockSetOptions).toHaveBeenCalledWith(expectedGestureOptions(true));
        });

        it('restores gesture on every ancestor stack on unmount', () => {
            const {unmount} = renderDiscardHook(() => true);

            mockSetOptions.mockClear();
            unmount();

            expect(mockSetOptions).toHaveBeenCalledTimes(3);
            expect(mockSetOptions).toHaveBeenCalledWith(expectedGestureOptions(true));
        });

        it('does not toggle gesture when the screen is not focused', () => {
            mockIsFocused = false;
            renderDiscardHook(() => true);

            expect(mockSetOptions).not.toHaveBeenCalled();
        });

        it('does not toggle gesture on Android', () => {
            platformState.OS = 'android';
            renderDiscardHook(() => true);

            expect(mockSetOptions).not.toHaveBeenCalled();
        });

        it('re-enables gesture on all ancestors when dirty state clears', () => {
            const {rerender} = renderHook(({dirty}: {dirty: boolean}) => useDiscardChangesConfirmation({getHasUnsavedChanges: () => dirty}), {
                initialProps: {dirty: true},
            });

            expect(mockSetOptions).toHaveBeenCalledTimes(3);
            expect(mockSetOptions).toHaveBeenLastCalledWith(expectedGestureOptions(false));

            mockSetOptions.mockClear();
            rerender({dirty: false});

            // Cleanup restores ancestors, then the effect re-applies enabled gesture on each ancestor.
            expect(mockSetOptions).toHaveBeenCalledTimes(6);
            expect(mockSetOptions).toHaveBeenCalledWith(expectedGestureOptions(true));
        });
    });

    describe('iOS edge back guard', () => {
        it('registers an active edge guard when the form is dirty on iOS', () => {
            const {result} = renderHook(
                () => {
                    useDiscardChangesConfirmation({getHasUnsavedChanges: () => true});
                    return useActiveEdgeBackGuard();
                },
                {wrapper: edgeGuardWrapper},
            );

            expect(result.current?.routeName).toBe('test-route');
        });

        it('does not register an active edge guard when the form is clean', () => {
            const {result} = renderHook(
                () => {
                    useDiscardChangesConfirmation({getHasUnsavedChanges: () => false});
                    return useActiveEdgeBackGuard();
                },
                {wrapper: edgeGuardWrapper},
            );

            expect(result.current).toBeUndefined();
        });

        it('shows the discard modal when the edge guard fires onEdgeBack', () => {
            const {result} = renderHook(
                () => {
                    useDiscardChangesConfirmation({getHasUnsavedChanges: () => true});
                    return useActiveEdgeBackGuard();
                },
                {wrapper: edgeGuardWrapper},
            );

            act(() => {
                result.current?.onEdgeBack();
            });

            expect(mockShowConfirmModal).toHaveBeenCalledTimes(1);
        });

        it('does not register an active edge guard on Android', () => {
            platformState.OS = 'android';
            const {result} = renderHook(
                () => {
                    useDiscardChangesConfirmation({getHasUnsavedChanges: () => true});
                    return useActiveEdgeBackGuard();
                },
                {wrapper: edgeGuardWrapper},
            );

            expect(result.current).toBeUndefined();
        });
    });
});
