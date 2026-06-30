import {act, renderHook} from '@testing-library/react-native';
import useShouldRenderOverlay from '@components/WideRHPContextProvider/useShouldRenderOverlay';
// eslint-disable-next-line no-restricted-imports
import {Animated} from 'react-native';

type HideAnimationCallback = (result: {finished: boolean}) => void;

describe('useShouldRenderOverlay', () => {
    let hideAnimationCallbacks: HideAnimationCallback[];
    let timingSpy: jest.SpyInstance;

    beforeEach(() => {
        hideAnimationCallbacks = [];
        timingSpy = jest.spyOn(Animated, 'timing').mockImplementation(() => ({
            start: (callback?: HideAnimationCallback) => {
                if (callback) {
                    hideAnimationCallbacks.push(callback);
                }
            },
            stop: jest.fn(),
            reset: jest.fn(),
        }));
    });

    afterEach(() => {
        timingSpy.mockRestore();
    });

    it('returns true synchronously when condition becomes true during an in-flight hide animation', () => {
        const overlayProgress = new Animated.Value(1);

        const {result, rerender} = renderHook(({condition}) => useShouldRenderOverlay(condition, overlayProgress), {
            initialProps: {condition: true},
        });

        expect(result.current).toBe(true);

        rerender({condition: false});
        expect(result.current).toBe(true);
        expect(hideAnimationCallbacks).toHaveLength(1);

        rerender({condition: true});
        expect(result.current).toBe(true);

        act(() => {
            hideAnimationCallbacks.at(0)?.({finished: true});
        });

        expect(result.current).toBe(true);
    });

    it('hides the overlay after the hide animation completes when condition stays false', () => {
        const overlayProgress = new Animated.Value(1);

        const {result, rerender} = renderHook(({condition}) => useShouldRenderOverlay(condition, overlayProgress), {
            initialProps: {condition: true},
        });

        rerender({condition: false});
        expect(result.current).toBe(true);

        act(() => {
            hideAnimationCallbacks.at(0)?.({finished: true});
        });

        expect(result.current).toBe(false);
    });

    it('shows the overlay immediately on first render when condition is true', () => {
        const overlayProgress = new Animated.Value(0);

        const {result} = renderHook(() => useShouldRenderOverlay(true, overlayProgress));

        expect(result.current).toBe(true);
    });
});
