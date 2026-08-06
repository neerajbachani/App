import variables from '@styles/variables';

import type {LayoutChangeEvent} from 'react-native';

import {useCallback, useState} from 'react';

type UseAvailableInputHeightResult = {
    /** onLayout handler for the flex1 wrapper that claims leftover panel space. */
    onLayout: (event: LayoutChangeEvent) => void;

    /**
     * Growth ceiling for TextInput.autoGrowHeight.
     * Falls back to the shared compact default until the first layout pass,
     * because BaseTextInput coerces a missing/0 max to clamp(h, 52, 0) === 52.
     */
    maxAutoGrowHeight: number;
};

/**
 * Measures a parent-sized (flex1) wrapper and returns that height as maxAutoGrowHeight
 * so RHP text inputs can grow to fill available space instead of a fixed pixel cap.
 */
export default function useAvailableInputHeight(): UseAvailableInputHeightResult {
    const [availableHeight, setAvailableHeight] = useState(0);

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        const {height} = event.nativeEvent.layout;
        if (height <= 0) {
            return;
        }
        setAvailableHeight((prevHeight) => (prevHeight === height ? prevHeight : height));
    }, []);

    return {
        onLayout,
        maxAutoGrowHeight: availableHeight || variables.textInputAutoGrowMaxHeight,
    };
}
