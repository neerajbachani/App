import {NavigationContainer} from '@react-navigation/native';
import {act, render, screen} from '@testing-library/react-native';
import React from 'react';
import Onyx from 'react-native-onyx';
import Navigation from '@libs/Navigation/Navigation';
import createPlatformStackNavigator from '@libs/Navigation/PlatformStackNavigation/createPlatformStackNavigator';
import type {PublicScreensParamList} from '@libs/Navigation/types';
import ValidateLoginPage from '@pages/ValidateLoginPage/index.website';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

const RootStack = createPlatformStackNavigator<PublicScreensParamList>();

const renderPage = (initialParams: PublicScreensParamList[typeof SCREENS.VALIDATE_LOGIN]) => {
    return render(
        <NavigationContainer>
            <RootStack.Navigator>
                <RootStack.Screen
                    name={SCREENS.VALIDATE_LOGIN}
                    component={ValidateLoginPage}
                    initialParams={initialParams}
                />
            </RootStack.Navigator>
        </NavigationContainer>,
    );
};

describe('ValidateLoginPage', () => {
    beforeAll(() => {
        Onyx.init({
            keys: ONYXKEYS,
        });
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        await act(async () => {
            await Onyx.clear();
        });
        await waitForBatchedUpdatesWithAct();
    });

    it('Should show not found view when the magic code is invalid and there is an exitTo param', async () => {
        await act(async () => {
            await Onyx.set(ONYXKEYS.SESSION, {
                autoAuthState: CONST.AUTO_AUTH_STATE.NOT_STARTED,
            });
        });

        renderPage({accountID: '1', validateCode: 'ABCDEF', exitTo: 'concierge'});
        await waitForBatchedUpdatesWithAct();

        expect(screen.getByTestId('validate-code-not-found')).not.toBeNull();
    });

    it('Should not show ValidateCodeModal when signed in and there is an exitTo param', async () => {
        await act(async () => {
            await Onyx.set(ONYXKEYS.SESSION, {
                authToken: 'abcd',
                autoAuthState: CONST.AUTO_AUTH_STATE.NOT_STARTED,
            });
        });

        renderPage({accountID: '1', validateCode: '123456', exitTo: 'concierge'});
        await waitForBatchedUpdatesWithAct();

        expect(screen.queryByTestId('validate-code')).toBeNull();
    });

    it('Should keep user on magic code page on link open without explicit sign in action', async () => {
        const navigateSpy = jest.spyOn(Navigation, 'navigate').mockImplementation(() => undefined);

        await act(async () => {
            await Onyx.set(ONYXKEYS.SESSION, {
                autoAuthState: CONST.AUTO_AUTH_STATE.NOT_STARTED,
            });
        });

        renderPage({accountID: '1', validateCode: '123456'});
        await waitForBatchedUpdatesWithAct();

        expect(screen.getByTestId('validate-code')).not.toBeNull();
        expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('Should show success modal when JUST_SIGNED_IN has no login in credentials', async () => {
        const navigateSpy = jest.spyOn(Navigation, 'navigate').mockImplementation(() => undefined);

        await act(async () => {
            await Onyx.multiSet({
                [ONYXKEYS.SESSION]: {
                    authToken: 'abcd',
                    autoAuthState: CONST.AUTO_AUTH_STATE.JUST_SIGNED_IN,
                },
                [ONYXKEYS.CREDENTIALS]: {
                    accountID: 1,
                    validateCode: '123456',
                },
            });
        });

        renderPage({accountID: '1', validateCode: '123456'});
        await waitForBatchedUpdatesWithAct();

        expect(navigateSpy).not.toHaveBeenCalled();
        expect(screen.getByText(/you're signed in!/i)).not.toBeNull();
    });

    it('Should redirect to Home when sign in was explicitly initiated from validate code page', async () => {
        const navigateSpy = jest.spyOn(Navigation, 'navigate').mockImplementation(() => undefined);

        await act(async () => {
            await Onyx.multiSet({
                [ONYXKEYS.SESSION]: {
                    authToken: 'abcd',
                    autoAuthState: CONST.AUTO_AUTH_STATE.JUST_SIGNED_IN,
                    validateLoginFlow: {
                        source: 'EXPLICIT_CLICK',
                        phase: 'SIGNED_IN',
                    },
                },
                [ONYXKEYS.CREDENTIALS]: {
                    accountID: 1,
                    validateCode: '123456',
                },
            });
        });

        const {unmount} = renderPage({accountID: '1', validateCode: '123456'});
        await waitForBatchedUpdatesWithAct();

        expect(navigateSpy).toHaveBeenCalledWith(ROUTES.HOME, {forceReplace: true});

        unmount();
        renderPage({accountID: '1', validateCode: '123456'});
        await waitForBatchedUpdatesWithAct();

        expect(screen.queryByText(/you're signed in!/i)).toBeNull();
        expect(screen.getByTestId('validate-code')).not.toBeNull();
    });

    it('Should show 2FA modal when auth is not complete and login is missing', async () => {
        await act(async () => {
            await Onyx.multiSet({
                [ONYXKEYS.SESSION]: {
                    autoAuthState: CONST.AUTO_AUTH_STATE.FAILED,
                },
                [ONYXKEYS.ACCOUNT]: {
                    requiresTwoFactorAuth: true,
                },
                [ONYXKEYS.CREDENTIALS]: {
                    accountID: 1,
                    validateCode: '123456',
                },
            });
        });

        renderPage({accountID: '1', validateCode: '123456'});
        await waitForBatchedUpdatesWithAct();

        expect(screen.getByText(/two-factor authentication/i)).not.toBeNull();
    });
});
