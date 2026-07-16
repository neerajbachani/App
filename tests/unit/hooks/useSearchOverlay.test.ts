import {act, renderHook} from '@testing-library/react-native';

import useSearchOverlay from '@hooks/useSearchOverlay';

import CONST from '@src/CONST';

jest.mock('@components/OnyxListItemProvider', () => ({
    useSession: () => ({accountID: 1}),
}));

jest.mock('@components/Search/SearchStaticList', () => () => null);

jest.mock('@hooks/useOnyx', () => ({
    __esModule: true,
    default: () => [undefined],
}));

jest.mock('@hooks/usePolicyForMovingExpenses', () => ({
    __esModule: true,
    default: () => ({policyForMovingExpensesID: undefined}),
}));

jest.mock('@libs/deferredLayoutWrite', () => ({
    hasDeferredWrite: jest.fn(() => true),
}));

jest.mock('@libs/Navigation/Navigation', () => ({
    __esModule: true,
    default: {
        getIsFullscreenPreInsertedUnderRHP: jest.fn(() => false),
    },
}));

jest.mock('@libs/SearchQueryUtils', () => ({
    isDefaultExpensesQuery: jest.fn(() => false),
}));

jest.mock('@libs/SearchUIUtils', () => ({
    getColumnsToShow: jest.fn(() => []),
    getValidGroupBy: jest.fn(() => undefined),
    isTransactionSearchType: jest.fn(() => false),
}));

jest.mock('@react-navigation/native', () => ({
    useFocusEffect: jest.fn(),
    createNavigationContainerRef: jest.fn(() => ({
        isReady: () => false,
        current: null,
    })),
}));

jest.mock('@src/selectors/AdvancedSearchFiltersForm', () => ({
    columnsSelector: jest.fn(),
}));

describe('useSearchOverlay', () => {
    it('defers setIsSearchReady to a microtask so parent state is not updated during render', async () => {
        const {result} = renderHook(() =>
            useSearchOverlay({
                searchResults: undefined,
                queryJSON: undefined,
                shouldUseNarrowLayout: true,
                isMobileSelectionModeEnabled: false,
                currentSearchKey: CONST.SEARCH.SEARCH_KEYS.EXPENSES,
            }),
        );

        expect(result.current.isOverlayActive).toBe(true);

        // Call the ready signal without wrapping in act() first — mirrors a
        // child invoking the callback during its render. State must not flip
        // synchronously (that is what triggers React's cross-component warning).
        result.current.onSearchContentReady();
        expect(result.current.isOverlayActive).toBe(true);

        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current.isOverlayActive).toBe(false);
    });

    it('is idempotent across duplicate ready signals', async () => {
        const {result} = renderHook(() =>
            useSearchOverlay({
                searchResults: undefined,
                queryJSON: undefined,
                shouldUseNarrowLayout: true,
                isMobileSelectionModeEnabled: false,
                currentSearchKey: CONST.SEARCH.SEARCH_KEYS.EXPENSES,
            }),
        );

        result.current.onSearchContentReady();
        result.current.onSearchContentReady();

        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current.isOverlayActive).toBe(false);
    });
});
