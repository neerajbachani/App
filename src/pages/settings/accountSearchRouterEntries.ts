import type {ExpensifyIconName} from '@components/Icon/ExpensifyIconLoader';
import type {NavigationCatalogEntry} from '@components/Search/SearchRouter/navigationCatalogTypes';
import type {TranslationPaths} from '@src/languages/types';
import ROUTES from '@src/ROUTES';

type AccountSearchRouterEntryDescriptor = {
    titleKey: TranslationPaths;
    iconName: ExpensifyIconName;
    route: string;
    keywords?: string[];
    excludeFromSearchRouter?: boolean;
};

const ACCOUNT_SEARCH_ROUTER_ENTRY_DESCRIPTORS: AccountSearchRouterEntryDescriptor[] = [
    {titleKey: 'common.profile', iconName: 'Profile', route: ROUTES.SETTINGS_PROFILE.getRoute()},
    {titleKey: 'common.wallet', iconName: 'Wallet', route: ROUTES.SETTINGS_WALLET},
    {titleKey: 'expenseRulesPage.title', iconName: 'Bolt', route: ROUTES.SETTINGS_RULES},
    {titleKey: 'common.preferences', iconName: 'Gear', route: ROUTES.SETTINGS_PREFERENCES},
    {titleKey: 'delegate.copilot', iconName: 'Users', route: ROUTES.SETTINGS_COPILOT, keywords: ['delegate']},
    {titleKey: 'initialSettingsPage.security', iconName: 'Lock', route: ROUTES.SETTINGS_SECURITY, keywords: ['password', '2fa', 'logout', 'sign out']},
    {titleKey: 'agentsPage.title', iconName: 'Bot', route: ROUTES.SETTINGS_AGENTS, keywords: ['agent']},
    {titleKey: 'allSettingsScreen.subscription', iconName: 'CreditCard', route: ROUTES.SETTINGS_SUBSCRIPTION.getRoute(), keywords: ['billing']},
    {titleKey: 'initialSettingsPage.help', iconName: 'QuestionMark', route: ROUTES.SETTINGS_HELP},
    {titleKey: 'initialSettingsPage.about', iconName: 'Info', route: ROUTES.SETTINGS_ABOUT},
    {titleKey: 'initialSettingsPage.aboutPage.troubleshoot', iconName: 'Lightbulb', route: ROUTES.SETTINGS_TROUBLESHOOT},
    {titleKey: 'initialSettingsPage.whatIsNew', iconName: 'TreasureChest', route: '', excludeFromSearchRouter: true},
    {titleKey: 'sidebarScreen.saveTheWorld', iconName: 'Heart', route: ROUTES.SETTINGS_SAVE_THE_WORLD, excludeFromSearchRouter: true},
];

type AccountSearchRouterVisibility = {
    isAgentAccount: boolean;
    isCustomAgentBetaEnabled: boolean;
    shouldShowSubscription: boolean;
    shouldShowWallet: boolean;
};

function getAccountSearchRouterEntries(visibility: AccountSearchRouterVisibility): NavigationCatalogEntry[] {
    return ACCOUNT_SEARCH_ROUTER_ENTRY_DESCRIPTORS.flatMap((descriptor) => {
        if (descriptor.excludeFromSearchRouter) {
            return [];
        }

        if (descriptor.titleKey === 'common.wallet' && !visibility.shouldShowWallet) {
            return [];
        }

        if (descriptor.titleKey === 'common.preferences' && visibility.isAgentAccount) {
            return [];
        }

        if (descriptor.titleKey === 'initialSettingsPage.security' && visibility.isAgentAccount) {
            return [];
        }

        if (descriptor.titleKey === 'allSettingsScreen.subscription' && !visibility.shouldShowSubscription) {
            return [];
        }

        if (descriptor.titleKey === 'agentsPage.title' && (!visibility.isCustomAgentBetaEnabled || visibility.isAgentAccount)) {
            return [];
        }

        return [
            {
                id: `account-${descriptor.titleKey}`,
                category: 'account' as const,
                titleKey: descriptor.titleKey,
                iconName: descriptor.iconName,
                route: descriptor.route,
                keywords: descriptor.keywords,
                shouldUseGoToPrefix: true,
                rightTextKey: 'initialSettingsPage.account',
                rightIconName: 'User',
            },
        ];
    });
}

const ACCOUNT_SEARCH_ROUTER_ICON_NAMES = Array.from(new Set(ACCOUNT_SEARCH_ROUTER_ENTRY_DESCRIPTORS.map((descriptor) => descriptor.iconName)));

export {ACCOUNT_SEARCH_ROUTER_ICON_NAMES, getAccountSearchRouterEntries};
export type {AccountSearchRouterVisibility};
