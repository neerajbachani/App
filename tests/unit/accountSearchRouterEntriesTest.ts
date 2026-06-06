import {getAccountSearchRouterEntries} from '@pages/settings/accountSearchRouterEntries';

describe('getAccountSearchRouterEntries', () => {
    it('excludes account menu items that should not appear in search router', () => {
        const entries = getAccountSearchRouterEntries({
            isAgentAccount: false,
            isCustomAgentBetaEnabled: false,
            shouldShowSubscription: true,
            shouldShowWallet: true,
        });

        const titleKeys = entries.map((entry) => entry.titleKey);
        expect(titleKeys).not.toContain('initialSettingsPage.whatIsNew');
        expect(titleKeys).not.toContain('sidebarScreen.saveTheWorld');
    });

    it('hides wallet and subscription entries for agent accounts', () => {
        const entries = getAccountSearchRouterEntries({
            isAgentAccount: true,
            isCustomAgentBetaEnabled: false,
            shouldShowSubscription: true,
            shouldShowWallet: true,
        });

        const titleKeys = entries.map((entry) => entry.titleKey);
        expect(titleKeys).not.toContain('common.wallet');
        expect(titleKeys).not.toContain('allSettingsScreen.subscription');
        expect(titleKeys).not.toContain('common.preferences');
        expect(titleKeys).not.toContain('initialSettingsPage.security');
    });
});
