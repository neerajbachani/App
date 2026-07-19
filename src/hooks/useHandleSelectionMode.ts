import type {ListItem} from '@components/SelectionList/types';

import {turnOffMobileSelectionMode, turnOnMobileSelectionMode} from '@libs/actions/MobileSelectionMode';
import {logSelectionModeTrace} from '@libs/debug/SelectionModeTrace';

import {useIsFocused} from '@react-navigation/native';
import {useEffect, useRef} from 'react';

import useMobileSelectionMode from './useMobileSelectionMode';
import useResponsiveLayout from './useResponsiveLayout';

function useHandleSelectionMode<TItem extends ListItem>(selectedItems: readonly string[] | TItem[]) {
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {isSmallScreenWidth} = useResponsiveLayout();
    const isFocused = useIsFocused();

    const isMobileSelectionModeEnabled = useMobileSelectionMode();
    // Check if selection should be on when the modal is opened
    const wasSelectionOnRef = useRef(false);

    useEffect(() => {
        logSelectionModeTrace('useHandleSelectionMode', 'effect', {
            isSmallScreenWidth,
            isFocused,
            selectedItemsCount: selectedItems.length,
            isMobileSelectionModeEnabled,
            wasSelectionOn: wasSelectionOnRef.current,
        });

        if (!isSmallScreenWidth) {
            if (selectedItems.length === 0 && isMobileSelectionModeEnabled) {
                logSelectionModeTrace('useHandleSelectionMode', 'turnOff — desktop with no selected items');
                turnOffMobileSelectionMode();
            }
            return;
        }
        if (!isFocused) {
            logSelectionModeTrace('useHandleSelectionMode', 'skip — unfocused');
            return;
        }
        if (!wasSelectionOnRef.current && selectedItems.length > 0) {
            wasSelectionOnRef.current = true;
        }
        if (selectedItems.length > 0 && !isMobileSelectionModeEnabled) {
            logSelectionModeTrace('useHandleSelectionMode', 'turnOn — selected items while mode off');
            turnOnMobileSelectionMode();
        } else if (selectedItems.length === 0 && isMobileSelectionModeEnabled && !wasSelectionOnRef.current) {
            logSelectionModeTrace('useHandleSelectionMode', 'turnOff — focused with no items and external selection mode');
            turnOffMobileSelectionMode();
        }
    }, [isMobileSelectionModeEnabled, isSmallScreenWidth, isFocused, selectedItems.length]);

    useEffect(
        () => () => {
            logSelectionModeTrace('useHandleSelectionMode', 'unmount cleanup turnOff');
            turnOffMobileSelectionMode();
        },
        [],
    );
}

export default useHandleSelectionMode;
