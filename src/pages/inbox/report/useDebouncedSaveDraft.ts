import useDebounce from '@hooks/useDebounce';

import CONST from '@src/CONST';

import type {RefObject} from 'react';

import {useRef} from 'react';

type UseDebouncedSaveDraftResult = {
    saveDraft: (...args: unknown[]) => void;
    isSavePending: RefObject<boolean>;
    cancelPendingSave: () => void;
};

/**
 * Non-generic implementation so OXC's React Compiler can memoize the hook.
 * OXC bails on type params inside hooks ("Unsupported declaration type for hoisting").
 */
function useDebouncedSaveDraftImpl(saveDraftFn: (...args: unknown[]) => void, wait = CONST.TIMING.DRAFT_SAVE_DEBOUNCE_TIME, shouldExecuteOnUnmount = false): UseDebouncedSaveDraftResult {
    const isSavePending = useRef(false);

    const debouncedSaveDraft = useDebounce(
        (...args: unknown[]) => {
            // The draft this call carries was invalidated after it was scheduled, so writing it would resurrect
            // state the caller has already discarded.
            if (!isSavePending.current) {
                return;
            }
            saveDraftFn(...args);
            isSavePending.current = false;
        },
        wait,
        {shouldExecuteOnUnmount},
    );

    const saveDraft = (...args: unknown[]) => {
        isSavePending.current = true;
        debouncedSaveDraft(...args);
    };

    // The pending flag doubles as the gate for the trailing invocation, so a pending save can be dropped without
    // reaching into the shared `useDebounce` contract that many unrelated callers depend on.
    const cancelPendingSave = () => {
        isSavePending.current = false;
    };

    return {
        saveDraft,
        isSavePending,
        cancelPendingSave,
    };
}

/**
 * Debounces a function to save a draft for a report comment or report action draft.
 * @param saveDraft - The function to save the draft. It will be called with the arguments passed to the triggerSaveDraft function.
 * @param wait - The number of milliseconds to delay.
 * @param shouldExecuteOnUnmount - Whether to execute the save draft function on unmount.
 * @returns An object containing the debounced save draft function, the is save pending ref and a way to drop a pending save.
 * @property {Function} saveDraft - Schedules a debounced save with the given arguments.
 * @property {Ref<boolean>} isSavePending - The ref to check whether the save is pending.
 * @property {Function} cancelPendingSave - Drops a save that was scheduled but has not run yet.
 */
function useDebouncedSaveDraft<SaveDraftArgs extends unknown[]>(saveDraftFn: (...args: SaveDraftArgs) => void, wait = CONST.TIMING.DRAFT_SAVE_DEBOUNCE_TIME, shouldExecuteOnUnmount = false) {
    return useDebouncedSaveDraftImpl(saveDraftFn as (...args: unknown[]) => void, wait, shouldExecuteOnUnmount) as {
        saveDraft: (...args: SaveDraftArgs) => void;
        isSavePending: RefObject<boolean>;
        cancelPendingSave: () => void;
    };
}

export default useDebouncedSaveDraft;
