import {filterAndRankNavigationEntries, getMatchScore} from '@components/Search/SearchRouter/filterAndRankNavigationEntries';
import type {NavigationCatalogEntry} from '@components/Search/SearchRouter/navigationCatalogTypes';
import CONST from '@src/CONST';

const translate = (key: NavigationCatalogEntry['titleKey']) => {
    const translations: Record<string, string> = {
        'common.home': 'Home',
        'workspace.common.members': 'Members',
        'workspace.common.categories': 'Categories',
        'iou.createExpense': 'Create expense',
    };

    return translations[key ?? ''] ?? key ?? '';
};

describe('filterAndRankNavigationEntries', () => {
    const catalog: NavigationCatalogEntry[] = [
        {
            id: 'top-level-common.home',
            category: 'topLevel',
            titleKey: 'common.home',
        },
        {
            id: 'workspace-1-workspace.common.members',
            category: 'workspace',
            titleKey: 'workspace.common.members',
            rightText: 'Workspace A',
        },
        {
            id: 'workspace-2-workspace.common.members',
            category: 'workspace',
            titleKey: 'workspace.common.members',
            rightText: 'Workspace B',
        },
        {
            id: 'workspace-1-workspace.common.categories',
            category: 'workspace',
            titleKey: 'workspace.common.categories',
            rightText: 'Workspace A',
        },
        {
            id: 'create-expense',
            category: 'create',
            title: 'Create expense',
            shouldUseGoToPrefix: false,
            keywords: ['expense'],
        },
    ];

    it('returns no matches for short or empty queries', () => {
        expect(filterAndRankNavigationEntries('', catalog, translate, CONST.SEARCH.MAX_NAVIGATION_SUGGESTIONS)).toEqual([]);
        expect(filterAndRankNavigationEntries('   ', catalog, translate, CONST.SEARCH.MAX_NAVIGATION_SUGGESTIONS)).toEqual([]);
    });

    it('prioritizes prefix matches over substring matches', () => {
        const results = filterAndRankNavigationEntries('mem', catalog, translate, CONST.SEARCH.MAX_NAVIGATION_SUGGESTIONS);
        expect(results.at(0)?.titleKey).toBe('workspace.common.members');
    });

    it('ranks top-level destinations before workspace duplicates at equal score', () => {
        const results = filterAndRankNavigationEntries('ho', catalog, translate, CONST.SEARCH.MAX_NAVIGATION_SUGGESTIONS);
        expect(results.at(0)?.category).toBe('topLevel');
    });

    it('caps the number of returned navigation rows', () => {
        const results = filterAndRankNavigationEntries('workspace', catalog, translate, 2);
        expect(results).toHaveLength(2);
    });

    it('matches create-menu keywords', () => {
        const results = filterAndRankNavigationEntries('expense', catalog, translate, CONST.SEARCH.MAX_NAVIGATION_SUGGESTIONS);
        expect(results.some((entry) => entry.id === 'create-expense')).toBe(true);
    });
});

describe('getMatchScore', () => {
    it('scores prefix matches highest', () => {
        expect(getMatchScore('mem', 'Members')).toBe(3);
    });

    it('scores word-boundary matches above plain substrings', () => {
        expect(getMatchScore('cat', 'Top categories')).toBe(2);
    });

    it('returns zero when there is no match', () => {
        expect(getMatchScore('zzz', 'Members')).toBe(0);
    });
});
