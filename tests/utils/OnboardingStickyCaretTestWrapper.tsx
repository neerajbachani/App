import OnboardingStickyCaretHeaderHost from '@libs/Navigation/AppNavigator/Navigators/OnboardingModalNavigatorContentWrapper/OnboardingStickyCaretHeaderHost';

import {PortalProvider} from '@gorhom/portal';
import React from 'react';
import {View} from 'react-native';

type OnboardingStickyCaretTestWrapperProps = {
    children: React.ReactNode;
};

/**
 * Mirrors production onboarding modal shell: PortalProvider + sticky caret host above the stack.
 */
function OnboardingStickyCaretTestWrapper({children}: OnboardingStickyCaretTestWrapperProps) {
    return (
        <PortalProvider>
            <View style={{flex: 1, position: 'relative'}}>
                <OnboardingStickyCaretHeaderHost />
                {children}
            </View>
        </PortalProvider>
    );
}

export default OnboardingStickyCaretTestWrapper;
