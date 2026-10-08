import {fireEvent, render, screen} from '@testing-library/react-native';

import {openApp} from '@libs/actions/App';
import {closeReactNativeApp, setShouldReturnToOldDotAfter2FA} from '@libs/actions/HybridApp';
import {clearTwoFactorAuthData} from '@libs/actions/TwoFactorAuthActions';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackRouteProp, PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {TwoFactorAuthNavigatorParamList} from '@libs/Navigation/types';

import DynamicSuccessPage from '@pages/settings/Security/TwoFactorAuth/DynamicSuccessPage';

import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';

import React from 'react';
import Onyx from 'react-native-onyx';

import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

jest.mock('@src/CONFIG', () => {
    const actualConfig = jest.requireActual<{default: Record<string, unknown>}>('@src/CONFIG').default;
    return {
        __esModule: true,
        default: {...actualConfig, IS_HYBRID_APP: true},
    };
});

jest.mock('@hooks/useEnvironment', () => () => ({environmentURL: 'https://new.expensify.com'}));
jest.mock('@hooks/useDynamicBackPath', () => () => 'settings/security');
jest.mock('@hooks/useDynamicForwardPath', () => () => undefined);
jest.mock('@libs/Navigation/helpers/getStateFromPath', () => () => ({
    index: 0,
    routes: [{name: 'Settings_Security'}],
}));
jest.mock('@libs/actions/App', () => ({
    openApp: jest.fn(() => Promise.resolve()),
}));
jest.mock('@libs/actions/HybridApp', () => ({
    closeReactNativeApp: jest.fn(),
    setShouldReturnToOldDotAfter2FA: jest.fn(() => Promise.resolve()),
}));
jest.mock('@libs/actions/TwoFactorAuthActions', () => ({
    clearTwoFactorAuthData: jest.fn(),
    quitAndNavigateBack: jest.fn(),
}));
jest.mock('@libs/Navigation/Navigation', () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    revealRouteBeforeDismissingModal: jest.fn(),
}));

jest.mock('@pages/settings/Security/TwoFactorAuth/SuccessPageBase', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest mock factories can only load react through require
    const ReactModule = require('react');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest mock factories can only load react-native through require
    const {Pressable, Text} = require('react-native');
    function MockSuccessPageBase({onButtonPress}: {onButtonPress: () => void}) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- createElement comes from the required react module
        return ReactModule.createElement(Pressable, {onPress: onButtonPress, accessibilityRole: 'button'}, ReactModule.createElement(Text, null, 'Got it'));
    }
    return MockSuccessPageBase;
});

const mockedOpenApp = jest.mocked(openApp);
const mockedClose = jest.mocked(closeReactNativeApp);
const mockedSetFlag = jest.mocked(setShouldReturnToOldDotAfter2FA);
const mockedClearData = jest.mocked(clearTwoFactorAuthData);
const mockedNavigate = jest.mocked(Navigation.navigate);

type DynamicSuccessRoute = PlatformStackRouteProp<TwoFactorAuthNavigatorParamList, typeof SCREENS.TWO_FACTOR_AUTH.DYNAMIC_SUCCESS>;
type DynamicSuccessNavigation = PlatformStackScreenProps<TwoFactorAuthNavigatorParamList, typeof SCREENS.TWO_FACTOR_AUTH.DYNAMIC_SUCCESS>['navigation'];

const route: DynamicSuccessRoute = {key: 'success', name: SCREENS.TWO_FACTOR_AUTH.DYNAMIC_SUCCESS, params: {}};

function renderPage() {
    return render(
        <DynamicSuccessPage
            route={route}
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- DynamicSuccessPage only reads route; navigation is a required screen prop this test never exercises
            navigation={{} as DynamicSuccessNavigation}
        />,
    );
}

describe('DynamicSuccessPage', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    async function pressGotIt() {
        renderPage();
        await waitForBatchedUpdates();
        fireEvent.press(screen.getByText('Got it'));
    }

    it('returns a held Classic user to OldDot when nvp_tryNewDot is missing', async () => {
        await Onyx.merge(ONYXKEYS.HYBRID_APP, {shouldReturnToOldDotAfter2FA: true});
        await Onyx.merge(ONYXKEYS.ACCOUNT, {requiresTwoFactorAuth: true});
        await Onyx.merge(ONYXKEYS.NVP_ONBOARDING, {hasCompletedGuidedSetupFlow: true});
        await waitForBatchedUpdates();

        await pressGotIt();

        expect(mockedSetFlag).toHaveBeenCalledWith(false);
        expect(mockedClearData).toHaveBeenCalledWith(true);
        expect(mockedClose).toHaveBeenCalledWith({shouldSetNVP: false, isTrackingGPS: false});
        expect(mockedOpenApp).not.toHaveBeenCalled();
        expect(mockedNavigate).not.toHaveBeenCalled();
        expect(mockedSetFlag.mock.invocationCallOrder.at(0)).toBeLessThan(mockedClearData.mock.invocationCallOrder.at(0) ?? Number.MAX_SAFE_INTEGER);
        expect(mockedClearData.mock.invocationCallOrder.at(0)).toBeLessThan(mockedClose.mock.invocationCallOrder.at(0) ?? Number.MAX_SAFE_INTEGER);
    });

    it('fires the deferred openApp before closing when the held user is still in guided setup', async () => {
        await Onyx.merge(ONYXKEYS.HYBRID_APP, {shouldReturnToOldDotAfter2FA: true});
        await Onyx.merge(ONYXKEYS.ACCOUNT, {requiresTwoFactorAuth: true, twoFactorAuthSetupInProgress: true, needsTwoFactorAuthSetup: false});
        await Onyx.merge(ONYXKEYS.NVP_ONBOARDING, {hasCompletedGuidedSetupFlow: false});
        await waitForBatchedUpdates();

        await pressGotIt();

        expect(mockedOpenApp).toHaveBeenCalled();
        expect(mockedClose).toHaveBeenCalled();
        expect(mockedClearData.mock.invocationCallOrder.at(0)).toBeLessThan(mockedOpenApp.mock.invocationCallOrder.at(0) ?? Number.MAX_SAFE_INTEGER);
        expect(mockedOpenApp.mock.invocationCallOrder.at(0)).toBeLessThan(mockedClose.mock.invocationCallOrder.at(0) ?? Number.MAX_SAFE_INTEGER);
    });

    it('keeps a locked account and a NewDot user on the Enabled page', async () => {
        await Onyx.merge(ONYXKEYS.HYBRID_APP, {shouldReturnToOldDotAfter2FA: false});
        await Onyx.merge(ONYXKEYS.NVP_TRY_NEW_DOT, {isLockedToNewApp: true});
        await Onyx.merge(ONYXKEYS.ACCOUNT, {requiresTwoFactorAuth: true});
        await Onyx.merge(ONYXKEYS.NVP_ONBOARDING, {hasCompletedGuidedSetupFlow: true});
        await waitForBatchedUpdates();

        await pressGotIt();

        expect(mockedClose).not.toHaveBeenCalled();
        expect(mockedNavigate).toHaveBeenCalledWith(ROUTES.SETTINGS_2FA_ENABLED, {forceReplace: true});

        jest.clearAllMocks();
        await Onyx.merge(ONYXKEYS.NVP_TRY_NEW_DOT, {
            isLockedToNewApp: false,
            classicRedirect: {dismissed: false, timestamp: new Date(), completedHybridAppOnboarding: true},
        });
        await waitForBatchedUpdates();

        await pressGotIt();

        expect(mockedClose).not.toHaveBeenCalled();
        expect(mockedNavigate).toHaveBeenCalledWith(ROUTES.SETTINGS_2FA_ENABLED, {forceReplace: true});
    });
});
