import {act, render, screen, waitFor, within} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';

import {CurrentReportIDContextProvider} from '@hooks/useCurrentReportID';
import * as useResponsiveLayoutModule from '@hooks/useResponsiveLayout';
import type ResponsiveLayoutResult from '@hooks/useResponsiveLayout/types';

import type {OnboardingModalNavigatorParamList} from '@navigation/types';

import OnboardingEmployees from '@pages/OnboardingEmployees';
import OnboardingPurpose from '@pages/OnboardingPurpose';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import SCREENS from '@src/SCREENS';

import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import React from 'react';
import Onyx from 'react-native-onyx';

import OnboardingStickyCaretTestWrapper from '../utils/OnboardingStickyCaretTestWrapper';
import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

TestHelper.setupGlobalFetchMock();

const Stack = createStackNavigator<OnboardingModalNavigatorParamList>();

const renderOnboardingNavigatorAtEmployees = () => {
    return render(
        <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider, CurrentReportIDContextProvider]}>
            <OnboardingStickyCaretTestWrapper>
                <NavigationContainer>
                    <Stack.Navigator initialRouteName={SCREENS.ONBOARDING.EMPLOYEES}>
                        <Stack.Screen
                            name={SCREENS.ONBOARDING.EMPLOYEES}
                            component={OnboardingEmployees}
                            initialParams={{backTo: ''}}
                        />
                    </Stack.Navigator>
                </NavigationContainer>
            </OnboardingStickyCaretTestWrapper>
        </ComposeProviders>,
    );
};

const renderOnboardingNavigatorAtPurpose = () => {
    return render(
        <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider, CurrentReportIDContextProvider]}>
            <OnboardingStickyCaretTestWrapper>
                <NavigationContainer>
                    <Stack.Navigator initialRouteName={SCREENS.ONBOARDING.PURPOSE}>
                        <Stack.Screen
                            name={SCREENS.ONBOARDING.PURPOSE}
                            component={OnboardingPurpose}
                            initialParams={{backTo: ''}}
                        />
                    </Stack.Navigator>
                </NavigationContainer>
            </OnboardingStickyCaretTestWrapper>
        </ComposeProviders>,
    );
};

describe('Onboarding sticky caret header', () => {
    beforeAll(() => {
        Onyx.init({
            keys: ONYXKEYS,
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        Onyx.clear();
        jest.spyOn(useResponsiveLayoutModule, 'default').mockReturnValue({
            onboardingIsMediumOrLargerScreenWidth: false,
        } as ResponsiveLayoutResult);
    });

    it('should render exactly one back control outside the employees page when the back button is shown', async () => {
        await TestHelper.signInWithTestUser();

        await act(async () => {
            await Onyx.merge(ONYXKEYS.NVP_ONBOARDING, {
                hasCompletedGuidedSetupFlow: false,
                signupQualifier: CONST.ONBOARDING_SIGNUP_QUALIFIERS.SMB,
            });
            await Onyx.merge(ONYXKEYS.ACCOUNT, {
                hasAccessibleDomainPolicies: true,
            });
        });

        const {unmount} = renderOnboardingNavigatorAtEmployees();

        await waitForBatchedUpdatesWithAct();

        await waitFor(() => {
            const employeesScreen = screen.getByTestId('BaseOnboardingEmployees');
            const backLabel = TestHelper.translateLocal('common.back');

            expect(within(employeesScreen).queryByLabelText(backLabel)).toBeNull();
            expect(screen.getByLabelText(backLabel)).toBeOnTheScreen();
            expect(screen.getAllByLabelText(backLabel)).toHaveLength(1);
        });

        unmount();
        await waitForBatchedUpdatesWithAct();
    });

    it('should not render a back control on the purpose step', async () => {
        await TestHelper.signInWithTestUser();

        await act(async () => {
            await Onyx.merge(ONYXKEYS.NVP_ONBOARDING, {
                hasCompletedGuidedSetupFlow: false,
            });
        });

        const {unmount} = renderOnboardingNavigatorAtPurpose();

        await waitForBatchedUpdatesWithAct();

        await waitFor(() => {
            expect(screen.queryByLabelText(TestHelper.translateLocal('common.back'))).not.toBeOnTheScreen();
        });

        unmount();
        await waitForBatchedUpdatesWithAct();
    });
});
