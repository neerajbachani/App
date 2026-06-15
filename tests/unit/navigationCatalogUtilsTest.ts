import type {NavigationCatalogEntry} from '@components/Search/SearchRouter/navigationCatalogTypes';
import {isSpendSearchRootRoute, navigationCatalogEntriesToSearchQueryItems, shouldShowNavigationSuggestions} from '@components/Search/SearchRouter/navigationCatalogUtils';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';

const translate = ((key: string, params?: {destination?: string}) => {
    if (key === 'search.goTo' && params?.destination) {
        return `Go to ${params.destination}`;
    }

    const translations: Record<string, string> = {
        'common.spend': 'Spend',
        'initialSettingsPage.account': 'Account',
        'workspace.common.members': 'Members',
    };

    return translations[key] ?? key;
}) as NavigationCatalogEntry extends never ? never : typeof translate;

describe('navigationCatalogEntriesToSearchQueryItems', () => {
    it('renders go-to rows for navigation destinations', () => {
        const entries: NavigationCatalogEntry[] = [
            {
                id: 'account-security',
                category: 'account',
                titleKey: 'initialSettingsPage.security',
                iconName: 'Lock',
                route: ROUTES.SETTINGS_SECURITY,
                shouldUseGoToPrefix: true,
                rightTextKey: 'initialSettingsPage.account',
                rightIconName: 'User',
            },
        ];

        const [item] = navigationCatalogEntriesToSearchQueryItems(entries, translate, {Lock: 'lock-icon', User: 'user-icon'});
        expect(item.text).toBe('Go to initialSettingsPage.security');
        expect(item.searchItemType).toBe(CONST.SEARCH.SEARCH_ROUTER_ITEM_TYPE.NAVIGATE);
        expect(item.rightText).toBe('Account');
        expect(item.rightIcon).toBe('user-icon');
    });

    it('renders create rows without the go-to prefix', () => {
        const entries: NavigationCatalogEntry[] = [
            {
                id: 'create-expense',
                category: 'create',
                title: 'Create expense',
                shouldUseGoToPrefix: false,
            },
        ];

        const [item] = navigationCatalogEntriesToSearchQueryItems(entries, translate, {});
        expect(item.text).toBe('Create expense');
    });
});

describe('shouldShowNavigationSuggestions', () => {
    it('shows navigation suggestions at 3 characters and above', () => {
        expect(shouldShowNavigationSuggestions('top')).toBe(true);
        expect(shouldShowNavigationSuggestions('pay')).toBe(true);
        expect(shouldShowNavigationSuggestions('spend')).toBe(true);
    });

    it('shows navigation suggestions for bare go and go to navigation intent', () => {
        expect(shouldShowNavigationSuggestions('go')).toBe(true);
        expect(shouldShowNavigationSuggestions('go to')).toBe(true);
        expect(shouldShowNavigationSuggestions('  GO TO  ')).toBe(true);
    });

    it('hides navigation suggestions below 3 characters unless go navigation intent', () => {
        expect(shouldShowNavigationSuggestions('')).toBe(false);
        expect(shouldShowNavigationSuggestions('  ')).toBe(false);
        expect(shouldShowNavigationSuggestions(' hr')).toBe(false);
        expect(shouldShowNavigationSuggestions('to')).toBe(false);
    });
});

describe('isSpendSearchRootRoute', () => {
    it('detects spend search root routes', () => {
        expect(isSpendSearchRootRoute(ROUTES.SEARCH_ROOT.getRoute({query: 'type:expense'}))).toBe(true);
        expect(isSpendSearchRootRoute(ROUTES.SETTINGS)).toBe(false);
    });
});
