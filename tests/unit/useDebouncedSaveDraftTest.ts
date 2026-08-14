import {act, renderHook} from '@testing-library/react-native';

import useDebouncedSaveDraft from '@pages/inbox/report/useDebouncedSaveDraft';

import CONST from '@src/CONST';

describe('useDebouncedSaveDraft', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('writes the draft once the debounce elapses', () => {
        const saveDraftFn = jest.fn();
        const {result} = renderHook(() => useDebouncedSaveDraft(saveDraftFn));

        act(() => {
            result.current.saveDraft('draft');
        });
        expect(result.current.isSavePending.current).toBe(true);

        act(() => {
            jest.advanceTimersByTime(CONST.TIMING.DRAFT_SAVE_DEBOUNCE_TIME + 1);
        });

        expect(saveDraftFn).toHaveBeenCalledWith('draft');
        expect(result.current.isSavePending.current).toBe(false);
    });

    it('drops a scheduled draft save that is cancelled before it runs', () => {
        const saveDraftFn = jest.fn();
        const {result} = renderHook(() => useDebouncedSaveDraft(saveDraftFn));

        act(() => {
            result.current.saveDraft('draft');
            result.current.cancelPendingSave();
        });

        act(() => {
            jest.advanceTimersByTime(CONST.TIMING.DRAFT_SAVE_DEBOUNCE_TIME + 1);
        });

        expect(saveDraftFn).not.toHaveBeenCalled();
        expect(result.current.isSavePending.current).toBe(false);
    });

    it('writes a draft that is scheduled after a cancellation', () => {
        const saveDraftFn = jest.fn();
        const {result} = renderHook(() => useDebouncedSaveDraft(saveDraftFn));

        act(() => {
            result.current.saveDraft('cancelled draft');
            result.current.cancelPendingSave();
            result.current.saveDraft('newer draft');
        });

        act(() => {
            jest.advanceTimersByTime(CONST.TIMING.DRAFT_SAVE_DEBOUNCE_TIME + 1);
        });

        expect(saveDraftFn).toHaveBeenCalledTimes(1);
        expect(saveDraftFn).toHaveBeenCalledWith('newer draft');
    });
});
