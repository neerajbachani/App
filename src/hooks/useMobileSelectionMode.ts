import {turnOffMobileSelectionMode} from '@libs/actions/MobileSelectionMode';

import ONYXKEYS from '@src/ONYXKEYS';

import {useIsFocused} from '@react-navigation/native';
import {useEffect, useRef} from 'react';

import useOnyx from './useOnyx';
import usePrevious from './usePrevious';

export default function useMobileSelectionMode(onTurnOffSelectionMode = () => {}) {
    const [isSelectionModeEnabled = false] = useOnyx(ONYXKEYS.RAM_ONLY_MOBILE_SELECTION_MODE);
    const initialSelectionModeValueRef = useRef(isSelectionModeEnabled);
    const prevIsSelectionModeEnabled = usePrevious(isSelectionModeEnabled);
    const isFocused = useIsFocused();

    // If selection mode was already on when this screen first mounts, turn it off once the screen is focused. Gating on
    // focus ensures a background subscriber (e.g. a still-mounted report screen) does not turn off the selection mode
    // that another focused screen just enabled. See https://github.com/Expensify/App/issues/95132 and #47685.
    useEffect(() => {
        if (!initialSelectionModeValueRef.current || !isFocused) {
            return;
        }
        initialSelectionModeValueRef.current = false;
        turnOffMobileSelectionMode();
    }, [isFocused]);

    useEffect(() => {
        if (!prevIsSelectionModeEnabled || isSelectionModeEnabled) {
            return;
        }
        onTurnOffSelectionMode();
    }, [prevIsSelectionModeEnabled, isSelectionModeEnabled, onTurnOffSelectionMode]);

    return !!isSelectionModeEnabled;
}
