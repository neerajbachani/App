import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import React, {useEffect, useMemo, useRef} from 'react';
import {StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import variables from '@styles/variables';
import {useActiveEdgeBackGuard} from './edgeBackGuardContext';
import platformOS from './platformOS';

const EDGE_STRIP_WIDTH = 32;
const SWIPE_DISTANCE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 500;

function DiscardChangesEdgeBackGuard() {
    const activeGuard = useActiveEdgeBackGuard();
    const insets = useSafeAreaInsets();
    const onEdgeBackRef = useRef(activeGuard?.onEdgeBack);
    const edgeStripTop = insets.top + variables.contentHeaderHeight;

    useEffect(() => {
        onEdgeBackRef.current = activeGuard?.onEdgeBack;
    }, [activeGuard]);

    const panGesture = useMemo(() => {
        if (platformOS !== 'ios' || !activeGuard) {
            return undefined;
        }

        return Gesture.Pan()
            .activeOffsetX(10)
            .failOffsetY([-15, 15])
            .runOnJS(true)
            .onEnd(({translationX, velocityX}) => {
                if (translationX > SWIPE_DISTANCE_THRESHOLD || velocityX > SWIPE_VELOCITY_THRESHOLD) {
                    onEdgeBackRef.current?.();
                }
            });
    }, [activeGuard]);

    if (platformOS !== 'ios' || !activeGuard || !panGesture) {
        return null;
    }

    return (
        <GestureDetector gesture={panGesture}>
            <View
                testID="DiscardChangesEdgeBackGuard-strip"
                style={[styles.edgeStrip, {top: edgeStripTop}]}
            />
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    edgeStrip: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: EDGE_STRIP_WIDTH,
        zIndex: 10,
    },
});

export default DiscardChangesEdgeBackGuard;
