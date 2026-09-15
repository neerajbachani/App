import CaretBackHeader from '@components/CaretBackHeader';

import useSafeAreaPaddings from '@hooks/useSafeAreaPaddings';
import useThemeStyles from '@hooks/useThemeStyles';
import useViewportOffsetTop from '@hooks/useViewportOffsetTop';

import {ONBOARDING_STICKY_CARET_HEADER_PORTAL} from '@libs/Navigation/AppNavigator/Navigators/OnboardingModalNavigatorContentWrapper/constants';

import {Portal} from '@gorhom/portal';
import {useIsFocused} from '@react-navigation/native';
import React, {useMemo} from 'react';
import {View} from 'react-native';

type CaretBackHeaderSlotProps = {
    onBackButtonPress?: () => void;

    shouldShowBackButton?: boolean;

    /** Must match the parent ScreenWrapper's shouldEnableMaxHeight so the sticky caret tracks the visual viewport offset on web. */
    shouldEnableMaxHeight?: boolean;
};

/**
 * Reserves the same vertical space as CaretBackHeader inside the animated screen card,
 * and portals the visible caret into the sticky header host when this screen is focused.
 */
function CaretBackHeaderSlot({onBackButtonPress, shouldShowBackButton = true, shouldEnableMaxHeight = false}: CaretBackHeaderSlotProps) {
    const styles = useThemeStyles();
    const isFocused = useIsFocused();
    const {unmodifiedPaddings} = useSafeAreaPaddings();
    const viewportOffsetTop = useViewportOffsetTop();

    const stickyCaretTopOffset = useMemo(
        () => (unmodifiedPaddings.top ?? 0) + (shouldEnableMaxHeight ? viewportOffsetTop : 0),
        [unmodifiedPaddings.top, shouldEnableMaxHeight, viewportOffsetTop],
    );

    return (
        <>
            <View style={styles.onboardingHeaderContainer} />
            {isFocused && shouldShowBackButton ? (
                <Portal hostName={ONBOARDING_STICKY_CARET_HEADER_PORTAL}>
                    <View style={[styles.pointerEventsBoxNone, styles.pAbsolute, styles.l0, styles.r0, {top: stickyCaretTopOffset, zIndex: 1, elevation: 1}]}>
                        <CaretBackHeader
                            onBackButtonPress={onBackButtonPress}
                            shouldShowBackButton
                        />
                    </View>
                </Portal>
            ) : null}
        </>
    );
}

export default CaretBackHeaderSlot;
