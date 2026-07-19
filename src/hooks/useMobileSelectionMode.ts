import {logSelectionModeTrace} from '@libs/debug/SelectionModeTrace';

import ONYXKEYS from '@src/ONYXKEYS';

import {useEffect} from 'react';

import useOnyx from './useOnyx';
import usePrevious from './usePrevious';

export default function useMobileSelectionMode(onTurnOffSelectionMode = () => {}) {
    const [isSelectionModeEnabled = false] = useOnyx(ONYXKEYS.RAM_ONLY_MOBILE_SELECTION_MODE);
    const prevIsSelectionModeEnabled = usePrevious(isSelectionModeEnabled);

    useEffect(() => {
        if (!prevIsSelectionModeEnabled || isSelectionModeEnabled) {
            return;
        }
        logSelectionModeTrace('useMobileSelectionMode', 'selection mode turned off callback', {isSelectionModeEnabled});
        onTurnOffSelectionMode();
    }, [prevIsSelectionModeEnabled, isSelectionModeEnabled, onTurnOffSelectionMode]);

    return !!isSelectionModeEnabled;
}
