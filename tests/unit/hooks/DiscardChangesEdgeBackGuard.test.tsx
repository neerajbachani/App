import {act, render, renderHook, screen} from '@testing-library/react-native';
import type {ReactNode} from 'react';
import React from 'react';
import {Text} from 'react-native';
import DiscardChangesEdgeBackGuard from '@hooks/useDiscardChangesConfirmation/DiscardChangesEdgeBackGuard';
import {
    DiscardChangesEdgeGuardProvider,
    useActiveEdgeBackGuard,
    useRegisterEdgeBackGuard,
} from '@hooks/useDiscardChangesConfirmation/edgeBackGuardContext';
import variables from '@styles/variables';

var platformState = {OS: 'ios' as 'ios' | 'android'};

jest.mock('@hooks/useDiscardChangesConfirmation/platformOS', () => ({
    __esModule: true,
    get default() {
        return platformState.OS;
    },
}));

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({top: 44, bottom: 0, left: 0, right: 0}),
}));

type PanGestureMock = {
    activeOffsetX: jest.Mock;
    failOffsetY: jest.Mock;
    runOnJS: jest.Mock;
    onEnd: jest.Mock;
    triggerEnd: (event: {translationX: number; velocityX: number}) => void;
};

const mockPanGestureState: {current?: PanGestureMock} = {};

jest.mock('react-native-gesture-handler', () => {
    return {
        Gesture: {
            Pan: () => {
                let onEndCallback: ((event: {translationX: number; velocityX: number}) => void) | undefined;
                const mockPanGesture: PanGestureMock = {
                    activeOffsetX: jest.fn().mockReturnThis(),
                    failOffsetY: jest.fn().mockReturnThis(),
                    runOnJS: jest.fn().mockReturnThis(),
                    onEnd: jest.fn((callback) => {
                        onEndCallback = callback;
                        return mockPanGesture;
                    }),
                    triggerEnd: (event) => {
                        onEndCallback?.(event);
                    },
                };
                mockPanGestureState.current = mockPanGesture;
                return mockPanGesture;
            },
        },
        GestureDetector: ({children}: {children: React.ReactNode}) => children,
    };
});

function wrapper({children}: {children: ReactNode}) {
    return <DiscardChangesEdgeGuardProvider>{children}</DiscardChangesEdgeGuardProvider>;
}

function RegisteredGuard({isActive, onEdgeBack}: {isActive: boolean; onEdgeBack: () => void}) {
    useRegisterEdgeBackGuard('test-route', () => isActive, onEdgeBack);
    return <Text>child</Text>;
}

describe('DiscardChangesEdgeBackGuard', () => {
    beforeEach(() => {
        platformState.OS = 'ios';
        mockPanGestureState.current = undefined;
    });

    describe('context', () => {
        it('returns undefined when no guard is registered', () => {
            const {result} = renderHook(() => useActiveEdgeBackGuard(), {wrapper});

            expect(result.current).toBeUndefined();
        });

        it('returns the active guard when getIsActive is true', () => {
            const onEdgeBack = jest.fn();

            const {result} = renderHook(
                () => {
                    useRegisterEdgeBackGuard('route-a', () => true, onEdgeBack);
                    return useActiveEdgeBackGuard();
                },
                {wrapper},
            );

            expect(result.current?.routeName).toBe('route-a');
        });

        it('updates the active guard when activity changes', () => {
            const onEdgeBack = jest.fn();
            let isActive = false;

            const {result, rerender} = renderHook(
                () => {
                    useRegisterEdgeBackGuard('route-a', () => isActive, onEdgeBack);
                    return useActiveEdgeBackGuard();
                },
                {wrapper},
            );

            expect(result.current).toBeUndefined();

            act(() => {
                isActive = true;
                rerender({});
            });

            expect(result.current?.routeName).toBe('route-a');
        });
    });

    describe('iOS edge strip', () => {
        it('positions the edge strip below the header so header back remains tappable', () => {
            const onEdgeBack = jest.fn();

            render(
                <DiscardChangesEdgeGuardProvider>
                    <RegisteredGuard
                        isActive
                        onEdgeBack={onEdgeBack}
                    />
                    <DiscardChangesEdgeBackGuard />
                </DiscardChangesEdgeGuardProvider>,
            );

            expect(screen.getByTestId('DiscardChangesEdgeBackGuard-strip')).toHaveStyle({
                top: 44 + variables.contentHeaderHeight,
                left: 0,
                width: 32,
            });
        });

        it('calls onEdgeBack when the swipe passes the distance threshold', () => {
            const onEdgeBack = jest.fn();

            render(
                <DiscardChangesEdgeGuardProvider>
                    <RegisteredGuard
                        isActive
                        onEdgeBack={onEdgeBack}
                    />
                    <DiscardChangesEdgeBackGuard />
                </DiscardChangesEdgeGuardProvider>,
            );

            mockPanGestureState.current?.triggerEnd({translationX: 80, velocityX: 0});

            expect(onEdgeBack).toHaveBeenCalledTimes(1);
        });

        it('renders nothing on non-iOS platforms', () => {
            platformState.OS = 'android';
            const onEdgeBack = jest.fn();

            render(
                <DiscardChangesEdgeGuardProvider>
                    <RegisteredGuard
                        isActive
                        onEdgeBack={onEdgeBack}
                    />
                    <DiscardChangesEdgeBackGuard />
                </DiscardChangesEdgeGuardProvider>,
            );

            expect(mockPanGestureState.current).toBeUndefined();
        });
    });
});
