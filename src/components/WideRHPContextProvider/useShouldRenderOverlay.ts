import {useEffect, useRef, useState} from 'react';
// We use Animated for all functionality related to wide RHP to make it easier
// to interact with react-navigation components (e.g., CardContainer, interpolator), which also use Animated.
// eslint-disable-next-line no-restricted-imports
import {Animated} from 'react-native';

const OVERLAY_TIMING_DURATION = 300;

function useShouldRenderOverlay(condition: boolean, overlayProgress: Animated.Value) {
    const [shouldRenderOverlay, setShouldRenderOverlay] = useState(condition);
    const conditionRef = useRef(condition);
    const hideAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        conditionRef.current = condition;

        if (condition) {
            hideAnimationRef.current?.stop();
            hideAnimationRef.current = null;
            setShouldRenderOverlay(true);
            // Show immediately so stacked RHP overlays are correct after refresh without waiting for animation.
            overlayProgress.setValue(1);
            return;
        }

        hideAnimationRef.current?.stop();
        const hideAnimation = Animated.timing(overlayProgress, {
            toValue: 0,
            duration: OVERLAY_TIMING_DURATION,
            useNativeDriver: false,
        });

        hideAnimationRef.current = hideAnimation;
        hideAnimation.start(({finished}) => {
            if (!finished || conditionRef.current) {
                return;
            }
            setShouldRenderOverlay(false);
        });

        return () => {
            hideAnimationRef.current?.stop();
            hideAnimationRef.current = null;
        };
    }, [condition, overlayProgress]);

    // Show synchronously when condition is true; keep mounted during hide animation when condition is false.
    return condition || shouldRenderOverlay;
}

export default useShouldRenderOverlay;
