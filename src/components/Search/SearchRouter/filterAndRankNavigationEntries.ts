import NAVIGATION_CATALOG_CATEGORY_ORDER, {type NavigationCatalogEntry} from './navigationCatalogTypes';

type LocalizedTranslate = (key: NavigationCatalogEntry['titleKey']) => string;

const GO_TO_NAVIGATION_INTENT_PREFIX = 'go to';
const GO_NAVIGATION_INTENT_PREFIX = 'go';

function normalizeForMatch(text: string): string {
    return text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
}

function stripNavigationIntentPrefix(normalizedQuery: string): {remainder: string; wasNavigationIntent: boolean} {
    let remainder = normalizedQuery.trim();
    let wasNavigationIntent = false;

    if (remainder.startsWith(GO_TO_NAVIGATION_INTENT_PREFIX)) {
        wasNavigationIntent = true;
        remainder = remainder.slice(GO_TO_NAVIGATION_INTENT_PREFIX.length).trim();
        return {remainder, wasNavigationIntent};
    }

    if (remainder === GO_NAVIGATION_INTENT_PREFIX || remainder.startsWith(`${GO_NAVIGATION_INTENT_PREFIX} `)) {
        wasNavigationIntent = true;
        remainder = remainder === GO_NAVIGATION_INTENT_PREFIX ? '' : remainder.slice(GO_NAVIGATION_INTENT_PREFIX.length).trim();
    }

    return {remainder, wasNavigationIntent};
}

function isBareNavigationIntentQuery(normalizedQuery: string): boolean {
    const {remainder, wasNavigationIntent} = stripNavigationIntentPrefix(normalizedQuery);
    return wasNavigationIntent && remainder === '';
}

function getEntryTitle(entry: NavigationCatalogEntry, translate: LocalizedTranslate): string {
    if (entry.title) {
        return entry.title;
    }

    if (entry.titleKey) {
        return translate(entry.titleKey);
    }

    return '';
}

function getSearchableText(entry: NavigationCatalogEntry, translate: LocalizedTranslate): string {
    const title = getEntryTitle(entry, translate);
    return [title, ...(entry.keywords ?? [])].join(' ');
}

function getMatchScore(query: string, searchableText: string): number {
    const normalizedQuery = normalizeForMatch(query.trim());
    const normalizedText = normalizeForMatch(searchableText);

    if (!normalizedQuery || !normalizedText.includes(normalizedQuery)) {
        return 0;
    }

    if (normalizedText.startsWith(normalizedQuery)) {
        return 3;
    }

    const words = normalizedText.split(/\s+/);
    if (words.some((word) => word.startsWith(normalizedQuery))) {
        return 2;
    }

    return 1;
}

function sortNavigationCatalogByCategoryAndTitle(catalog: NavigationCatalogEntry[], translate: LocalizedTranslate): NavigationCatalogEntry[] {
    return [...catalog].sort((left, right) => {
        const leftCategoryOrder = NAVIGATION_CATALOG_CATEGORY_ORDER[left.category];
        const rightCategoryOrder = NAVIGATION_CATALOG_CATEGORY_ORDER[right.category];

        if (leftCategoryOrder !== rightCategoryOrder) {
            return leftCategoryOrder - rightCategoryOrder;
        }

        return getEntryTitle(left, translate).localeCompare(getEntryTitle(right, translate));
    });
}

function getCappedNavigationCatalog(catalog: NavigationCatalogEntry[], translate: LocalizedTranslate, maxResults: number): NavigationCatalogEntry[] {
    return sortNavigationCatalogByCategoryAndTitle(catalog, translate).slice(0, maxResults);
}

function filterAndRankNavigationEntries(query: string, catalog: NavigationCatalogEntry[], translate: LocalizedTranslate, maxResults: number): NavigationCatalogEntry[] {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
        return [];
    }

    const normalizedQuery = normalizeForMatch(trimmedQuery);

    if (isBareNavigationIntentQuery(normalizedQuery)) {
        return getCappedNavigationCatalog(catalog, translate, maxResults);
    }

    const {remainder, wasNavigationIntent} = stripNavigationIntentPrefix(normalizedQuery);
    const effectiveQuery = wasNavigationIntent ? remainder : normalizedQuery;

    if (!effectiveQuery) {
        return [];
    }

    return catalog
        .map((entry) => ({
            entry,
            score: getMatchScore(effectiveQuery, getSearchableText(entry, translate)),
        }))
        .filter(({score}) => score > 0)
        .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            const leftCategoryOrder = NAVIGATION_CATALOG_CATEGORY_ORDER[left.entry.category];
            const rightCategoryOrder = NAVIGATION_CATALOG_CATEGORY_ORDER[right.entry.category];

            if (leftCategoryOrder !== rightCategoryOrder) {
                return leftCategoryOrder - rightCategoryOrder;
            }

            return getEntryTitle(left.entry, translate).localeCompare(getEntryTitle(right.entry, translate));
        })
        .slice(0, maxResults)
        .map(({entry}) => entry);
}

export {
    filterAndRankNavigationEntries,
    getCappedNavigationCatalog,
    getEntryTitle,
    getMatchScore,
    getSearchableText,
    isBareNavigationIntentQuery,
    normalizeForMatch,
    stripNavigationIntentPrefix,
};
export type {LocalizedTranslate};
