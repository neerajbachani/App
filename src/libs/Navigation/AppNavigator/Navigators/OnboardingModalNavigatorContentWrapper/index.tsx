import useThemeStyles from '@hooks/useThemeStyles';

import React from 'react';
import {View} from 'react-native';

import OnboardingStickyCaretHeaderHost from './OnboardingStickyCaretHeaderHost';

type OnboardingModalNavigatorContentWrapperProps = {
    children: React.ReactNode;
    onboardingIsMediumOrLargerScreenWidth: boolean;
};

function OnboardingModalNavigatorContentWrapper({children, onboardingIsMediumOrLargerScreenWidth}: OnboardingModalNavigatorContentWrapperProps) {
    const styles = useThemeStyles();

    return (
        <View
            onClick={(e) => e.stopPropagation()}
            style={[styles.maxHeight100Percentage, styles.overflowHidden, styles.pRelative, styles.OnboardingNavigatorInnerView(onboardingIsMediumOrLargerScreenWidth)]}
        >
            {children}
            <OnboardingStickyCaretHeaderHost />
        </View>
    );
}

export default OnboardingModalNavigatorContentWrapper;
