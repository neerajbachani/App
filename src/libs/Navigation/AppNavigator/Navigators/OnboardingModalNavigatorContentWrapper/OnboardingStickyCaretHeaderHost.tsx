import useThemeStyles from '@hooks/useThemeStyles';

import {PortalHost} from '@gorhom/portal';
import React from 'react';
import {View} from 'react-native';

import {ONBOARDING_STICKY_CARET_HEADER_PORTAL} from './constants';

function OnboardingStickyCaretHeaderHost() {
    const styles = useThemeStyles();

    return (
        <View style={[styles.pAbsolute, styles.t0, styles.l0, styles.r0, styles.pointerEventsBoxNone]}>
            <PortalHost name={ONBOARDING_STICKY_CARET_HEADER_PORTAL} />
        </View>
    );
}

export default OnboardingStickyCaretHeaderHost;
