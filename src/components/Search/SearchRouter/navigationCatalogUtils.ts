import type {ExpensifyIconName} from '@components/Icon/ExpensifyIconLoader';
import type {LocaleContextProps} from '@components/LocaleContextProvider';
import type {SearchQueryItem} from '@components/Search/SearchList/ListItem/SearchQueryListItem';
import {buildCannedSearchQuery} from '@libs/SearchQueryUtils';
import type {SearchKey, SearchTypeMenuSection} from '@libs/SearchUIUtils';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ROUTES from '@src/ROUTES';
import type IconAsset from '@src/types/utils/IconAsset';
import {getEntryTitle} from './filterAndRankNavigationEntries';
import type {NavigationCatalogEntry} from './navigationCatalogTypes';

const TOP_LEVEL_NAVIGATION_ENTRIES: Array<{
    titleKey: TranslationPaths;
    iconName: ExpensifyIconName;
    route: string;
    keywords?: string[];
    shouldClearSearchContext?: boolean;
}> = [
    {titleKey: 'common.home', iconName: 'Home', route: ROUTES.HOME, keywords: ['dashboard']},
    {titleKey: 'common.inbox', iconName: 'Inbox', route: ROUTES.INBOX, keywords: ['chat', 'chats', 'messages']},
    {
        titleKey: 'common.spend',
        iconName: 'ReceiptMultiple',
        route: ROUTES.SEARCH_ROOT.getRoute({query: buildCannedSearchQuery()}),
        keywords: ['expenses', 'search'],
        shouldClearSearchContext: true,
    },
    {titleKey: 'common.workspaces', iconName: 'Buildings', route: ROUTES.WORKSPACES_LIST.getRoute()},
    {titleKey: 'initialSettingsPage.account', iconName: 'User', route: ROUTES.SETTINGS, keywords: ['settings']},
];

const INDEXED_SPEND_SEARCH_KEYS = new Set<SearchKey>([
    CONST.SEARCH.SEARCH_KEYS.EXPENSES,
    CONST.SEARCH.SEARCH_KEYS.REPORTS,
    CONST.SEARCH.SEARCH_KEYS.SUBMIT,
    CONST.SEARCH.SEARCH_KEYS.APPROVE,
    CONST.SEARCH.SEARCH_KEYS.PAY,
    CONST.SEARCH.SEARCH_KEYS.UNAPPROVED_CASH,
    CONST.SEARCH.SEARCH_KEYS.UNAPPROVED_CARD,
    CONST.SEARCH.SEARCH_KEYS.STATEMENTS,
    CONST.SEARCH.SEARCH_KEYS.RECONCILIATION,
    CONST.SEARCH.SEARCH_KEYS.SPEND_OVER_TIME,
    CONST.SEARCH.SEARCH_KEYS.TOP_SPENDERS,
    CONST.SEARCH.SEARCH_KEYS.TOP_CATEGORIES,
    CONST.SEARCH.SEARCH_KEYS.TOP_MERCHANTS,
]);

function getTopLevelNavigationCatalogEntries(): NavigationCatalogEntry[] {
    return TOP_LEVEL_NAVIGATION_ENTRIES.map((entry) => ({
        id: `top-level-${entry.titleKey}`,
        category: 'topLevel' as const,
        titleKey: entry.titleKey,
        iconName: entry.iconName,
        route: entry.route,
        keywords: entry.keywords,
        shouldUseGoToPrefix: true,
        shouldClearSearchContext: entry.shouldClearSearchContext,
    }));
}

function getSpendNavigationCatalogEntries(typeMenuSections: SearchTypeMenuSection[]): NavigationCatalogEntry[] {
    return typeMenuSections
        .flatMap((section) => section.menuItems)
        .filter((item) => INDEXED_SPEND_SEARCH_KEYS.has(item.key))
        .map((item) => ({
            id: `spend-${item.key}`,
            category: 'spend' as const,
            titleKey: item.translationPath,
            iconName: item.icon,
            route: ROUTES.SEARCH_ROOT.getRoute({query: item.searchQuery}),
            shouldUseGoToPrefix: true,
            shouldClearSearchContext: true,
            rightTextKey: 'common.spend' as const,
            rightIconName: 'ReceiptMultiple' as const,
        }));
}

function getSpendNavigationIconNames(typeMenuSections: SearchTypeMenuSection[]): ExpensifyIconName[] {
    return typeMenuSections
        .flatMap((section) => section.menuItems)
        .filter((item) => INDEXED_SPEND_SEARCH_KEYS.has(item.key))
        .map((item) => item.icon);
}

function navigationCatalogEntriesToSearchQueryItems(
    entries: NavigationCatalogEntry[],
    translate: LocaleContextProps['translate'],
    icons: Partial<Record<ExpensifyIconName, IconAsset>>,
): SearchQueryItem[] {
    return entries.map((entry) => {
        const destinationTitle = getEntryTitle(entry, translate);
        const rightText = entry.rightText ?? (entry.rightTextKey ? translate(entry.rightTextKey) : undefined);

        return {
            text: entry.shouldUseGoToPrefix === false ? destinationTitle : translate('search.goTo', {destination: destinationTitle}),
            singleIcon: entry.icon ?? (entry.iconName ? icons[entry.iconName] : undefined),
            shouldIconApplyFill: entry.shouldIconApplyFill,
            rightText,
            rightIcon: entry.rightIconName ? icons[entry.rightIconName] : undefined,
            rightAvatar: entry.rightAvatar,
            keyForList: `${CONST.SEARCH.SEARCH_ROUTER_ITEM_TYPE.NAVIGATE}-${entry.id}`,
            searchItemType: CONST.SEARCH.SEARCH_ROUTER_ITEM_TYPE.NAVIGATE,
            route: entry.route,
            onSelectAction: entry.onSelectAction,
        };
    });
}

function isSpendSearchRootRoute(route: string): boolean {
    return route.startsWith(`${ROUTES.SEARCH_ROOT.route}?`);
}

function shouldShowNavigationSuggestions(query: string): boolean {
    return query.trim().length >= CONST.SEARCH.NAVIGATION_SUGGESTION_MIN_QUERY_LENGTH;
}

const TOP_LEVEL_NAVIGATION_ICON_NAMES = Array.from(new Set(TOP_LEVEL_NAVIGATION_ENTRIES.map((entry) => entry.iconName)));

export {
    getSpendNavigationCatalogEntries,
    getSpendNavigationIconNames,
    getTopLevelNavigationCatalogEntries,
    INDEXED_SPEND_SEARCH_KEYS,
    isSpendSearchRootRoute,
    navigationCatalogEntriesToSearchQueryItems,
    shouldShowNavigationSuggestions,
    TOP_LEVEL_NAVIGATION_ICON_NAMES,
};
