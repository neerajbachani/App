import NAVIGATION_CATALOG_CATEGORY_ORDER, {type NavigationCatalogEntry} from './navigationCatalogTypes';

type LocalizedTranslate = (key: NavigationCatalogEntry['titleKey']) => string;

function normalizeForMatch(text: string): string {
    return text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
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

function filterAndRankNavigationEntries(query: string, catalog: NavigationCatalogEntry[], translate: LocalizedTranslate, maxResults: number): NavigationCatalogEntry[] {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
        return [];
    }

    return catalog
        .map((entry) => ({
            entry,
            score: getMatchScore(trimmedQuery, getSearchableText(entry, translate)),
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

export {filterAndRankNavigationEntries, getEntryTitle, getMatchScore, getSearchableText, normalizeForMatch};
export type {LocalizedTranslate};
