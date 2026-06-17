import type {ExpensifyIconName} from '@components/Icon/ExpensifyIconLoader';
import type {LocaleContextProps} from '@components/LocaleContextProvider';
import type {SearchQueryItem} from '@components/Search/SearchList/ListItem/SearchQueryListItem';
import navigationRef from '@libs/Navigation/navigationRef';
import type {NavigationPartialRoute} from '@libs/Navigation/types';
import {buildCannedSearchQuery} from '@libs/SearchQueryUtils';
import type {SearchKey, SearchTypeMenuSection} from '@libs/SearchUIUtils';
import Navigation from '@navigation/Navigation';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import NAVIGATORS from '@src/NAVIGATORS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type IconAsset from '@src/types/utils/IconAsset';
import {getEntryTitle, isBareNavigationIntentQuery, normalizeForMatch} from './filterAndRankNavigationEntries';
import type {NavigationCatalogEntry} from './navigationCatalogTypes';

type WorkspaceSplitNavigatorState = {
    splitRoute: NavigationPartialRoute;
    sidebarRoute: NavigationPartialRoute;
};

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

function getPolicyIDFromWorkspaceRoute(route: string): string | undefined {
    const path = route.split('?').at(0) ?? route;
    const policyID = path.match(/^workspaces\/([^/]+)/)?.at(1);

    return policyID || undefined;
}

function findActiveWorkspaceSplitNavigator(): WorkspaceSplitNavigatorState | undefined {
    if (!navigationRef.isReady()) {
        return undefined;
    }

    const rootState = navigationRef.getRootState();
    const currentRoute = rootState?.routes.at(-1);

    if (!currentRoute) {
        return undefined;
    }

    let activeRoute: NavigationPartialRoute = currentRoute;

    if (currentRoute.name === NAVIGATORS.TAB_NAVIGATOR) {
        const tabRoutes = currentRoute.state?.routes;
        const activeTab = tabRoutes?.at(currentRoute.state?.index ?? 0);

        if (activeTab?.name === NAVIGATORS.WORKSPACE_NAVIGATOR) {
            activeRoute = (activeTab.state?.routes?.at(-1) ?? activeTab) as NavigationPartialRoute;
        } else if (activeTab) {
            activeRoute = activeTab as NavigationPartialRoute;
        }
    }

    if (activeRoute.name !== NAVIGATORS.WORKSPACE_SPLIT_NAVIGATOR) {
        return undefined;
    }

    const sidebarRoute = activeRoute.state?.routes?.at(0) as NavigationPartialRoute | undefined;

    if (!sidebarRoute || sidebarRoute.name !== SCREENS.WORKSPACE.INITIAL) {
        return undefined;
    }

    return {splitRoute: activeRoute, sidebarRoute};
}

/**
 * Workspace split navigators keep WORKSPACE.INITIAL as a persistent sidebar with its own policyID.
 * Navigating directly to a central workspace route can update the central pane while leaving the sidebar stale.
 */
function navigateToWorkspaceAwareRoute(route: string) {
    const policyID = getPolicyIDFromWorkspaceRoute(route);

    if (!policyID) {
        Navigation.navigate(route);
        return;
    }

    const workspaceSplit = findActiveWorkspaceSplitNavigator();

    if (!workspaceSplit) {
        Navigation.navigate(route);
        return;
    }

    const currentPolicyID = (workspaceSplit.sidebarRoute.params as {policyID?: string} | undefined)?.policyID;

    if (currentPolicyID !== policyID) {
        Navigation.setParams({policyID}, workspaceSplit.sidebarRoute.key, workspaceSplit.splitRoute.state?.key);
        Navigation.navigate(route, {forceReplace: true});
        return;
    }

    Navigation.navigate(route);
}

function shouldShowNavigationSuggestions(query: string): boolean {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
        return false;
    }

    if (isBareNavigationIntentQuery(normalizeForMatch(trimmedQuery))) {
        return true;
    }

    return trimmedQuery.length >= CONST.SEARCH.NAVIGATION_SUGGESTION_MIN_QUERY_LENGTH;
}

const TOP_LEVEL_NAVIGATION_ICON_NAMES = Array.from(new Set(TOP_LEVEL_NAVIGATION_ENTRIES.map((entry) => entry.iconName)));

export {
    getSpendNavigationCatalogEntries,
    getSpendNavigationIconNames,
    getTopLevelNavigationCatalogEntries,
    INDEXED_SPEND_SEARCH_KEYS,
    isSpendSearchRootRoute,
    navigateToWorkspaceAwareRoute,
    navigationCatalogEntriesToSearchQueryItems,
    shouldShowNavigationSuggestions,
    TOP_LEVEL_NAVIGATION_ICON_NAMES,
};
