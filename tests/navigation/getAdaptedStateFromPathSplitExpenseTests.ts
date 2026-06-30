import type {NavigationState, PartialState} from '@react-navigation/native';
import getAdaptedStateFromPath, {enrichOnyxTabHostRouteForFullScreenMatching} from '@libs/Navigation/helpers/getAdaptedStateFromPath';
import getMatchingNewRoute from '@libs/Navigation/helpers/getMatchingNewRoute';
import getStateFromPath from '@libs/Navigation/helpers/getStateFromPath';
import CONST from '@src/CONST';
import NAVIGATORS from '@src/NAVIGATORS';
import SCREENS from '@src/SCREENS';

jest.mock('@libs/Navigation/helpers/getStateFromPath', () => jest.fn());
jest.mock('@libs/Navigation/helpers/getMatchingNewRoute', () => jest.fn());
jest.mock('@libs/ReportUtils', () => ({
    getReportOrDraftReport: jest.fn(),
}));

const mockGetStateFromPath = jest.mocked(getStateFromPath);
const mockGetMatchingNewRoute = jest.mocked(getMatchingNewRoute);

const REPORT_ID = '999';
const EXPENSE_REPORT_ID = '111';
const TRANSACTION_ID = '222';
const BACK_TO_PATH = `/r/${REPORT_ID}`;

const EXPENSE_DETAIL_FULL_SCREEN_STATE: PartialState<NavigationState> = {
    routes: [
        {
            name: NAVIGATORS.REPORTS_SPLIT_NAVIGATOR,
            state: {
                routes: [{name: SCREENS.INBOX}, {name: SCREENS.REPORT, params: {reportID: REPORT_ID}}],
                index: 1,
            },
        },
    ],
    index: 0,
};

function buildSplitExpenseTabRoutes(activeTabName: string, backTo: string, path: string) {
    const tabNames = Object.values(CONST.TAB.SPLIT);

    return tabNames.map((tabName) => {
        if (tabName === activeTabName) {
            return {
                name: tabName,
                params: {backTo},
                path,
            };
        }

        return {name: tabName};
    });
}

function buildSplitExpenseRHPState({
    splitScreenName,
    activeTabName,
    tabIndex,
    backTo,
    path,
}: {
    splitScreenName: string;
    activeTabName: string;
    tabIndex: number;
    backTo: string;
    path: string;
}): PartialState<NavigationState> {
    return {
        routes: [
            {
                name: NAVIGATORS.RIGHT_MODAL_NAVIGATOR,
                state: {
                    routes: [
                        {
                            name: SCREENS.RIGHT_MODAL.MONEY_REQUEST,
                            state: {
                                routes: [
                                    {
                                        name: splitScreenName,
                                        params: {
                                            reportID: EXPENSE_REPORT_ID,
                                            transactionID: TRANSACTION_ID,
                                            splitExpenseTransactionID: '0',
                                        },
                                        state: {
                                            routes: buildSplitExpenseTabRoutes(activeTabName, backTo, path),
                                            index: tabIndex,
                                        },
                                    },
                                ],
                                index: 0,
                            },
                        },
                    ],
                    index: 0,
                },
            },
        ],
        index: 0,
    };
}

function getRootRouteNames(state: ReturnType<typeof getAdaptedStateFromPath>) {
    return state?.routes.map((route) => route.name);
}

const EXPENSE_RHP_BACK_TO = `/e/${EXPENSE_REPORT_ID}?backTo=${encodeURIComponent(BACK_TO_PATH)}`;

const EXPENSE_RHP_STATE: PartialState<NavigationState> = {
    routes: [
        {
            name: NAVIGATORS.RIGHT_MODAL_NAVIGATOR,
            state: {
                routes: [
                    {
                        name: SCREENS.RIGHT_MODAL.EXPENSE_REPORT,
                        params: {
                            reportID: EXPENSE_REPORT_ID,
                            backTo: BACK_TO_PATH,
                        },
                    },
                ],
                index: 0,
            },
        },
    ],
    index: 0,
};

function getRightModalStackRouteNames(state: ReturnType<typeof getAdaptedStateFromPath>) {
    const rightModal = state?.routes.find((route) => route.name === NAVIGATORS.RIGHT_MODAL_NAVIGATOR);
    return rightModal?.state?.routes?.map((route) => route.name);
}

function mockSplitExpenseStateFromPath(requestedPath: string, splitState: PartialState<NavigationState>) {
    if (requestedPath === BACK_TO_PATH) {
        return EXPENSE_DETAIL_FULL_SCREEN_STATE;
    }

    if (requestedPath === EXPENSE_RHP_BACK_TO || requestedPath === `/e/${EXPENSE_REPORT_ID}?backTo=%2Fr%2F${REPORT_ID}`) {
        return EXPENSE_RHP_STATE;
    }

    if (requestedPath.includes('/create/split-expense/overview/')) {
        return splitState;
    }

    return undefined;
}

function getReportsSplitNavigatorRoute(state: ReturnType<typeof getAdaptedStateFromPath>) {
    const firstRoute = state?.routes.at(0);
    if (firstRoute?.name === NAVIGATORS.TAB_NAVIGATOR) {
        return firstRoute.state?.routes?.find((route) => route.name === NAVIGATORS.REPORTS_SPLIT_NAVIGATOR);
    }

    if (firstRoute?.name === NAVIGATORS.REPORTS_SPLIT_NAVIGATOR) {
        return firstRoute;
    }

    return undefined;
}

describe('getAdaptedStateFromPath - stacked RHP refresh (split expense)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetMatchingNewRoute.mockReturnValue(undefined);
        mockGetStateFromPath.mockImplementation((path: string) => {
            if (path === BACK_TO_PATH) {
                return EXPENSE_DETAIL_FULL_SCREEN_STATE;
            }

            return undefined;
        });
    });

    it.each([
        [
            'amount tab',
            SCREENS.MONEY_REQUEST.SPLIT_EXPENSE,
            CONST.TAB.SPLIT.AMOUNT,
            0,
            `/create/split-expense/overview/${EXPENSE_REPORT_ID}/${TRANSACTION_ID}/0/${CONST.TAB.SPLIT.AMOUNT}?backTo=${encodeURIComponent(BACK_TO_PATH)}`,
        ],
        [
            'percentage tab',
            SCREENS.MONEY_REQUEST.SPLIT_EXPENSE,
            CONST.TAB.SPLIT.PERCENTAGE,
            1,
            `/create/split-expense/overview/${EXPENSE_REPORT_ID}/${TRANSACTION_ID}/0/${CONST.TAB.SPLIT.PERCENTAGE}?backTo=${encodeURIComponent(BACK_TO_PATH)}`,
        ],
        [
            'date tab',
            SCREENS.MONEY_REQUEST.SPLIT_EXPENSE,
            CONST.TAB.SPLIT.DATE,
            2,
            `/create/split-expense/overview/${EXPENSE_REPORT_ID}/${TRANSACTION_ID}/0/${CONST.TAB.SPLIT.DATE}?backTo=${encodeURIComponent(BACK_TO_PATH)}`,
        ],
    ])('restores expense detail background after refresh on %s', (_label, splitScreenName, activeTabName, tabIndex, path) => {
        mockGetStateFromPath.mockImplementation((requestedPath: string) => {
            if (requestedPath === BACK_TO_PATH) {
                return EXPENSE_DETAIL_FULL_SCREEN_STATE;
            }

            if (requestedPath === path) {
                return buildSplitExpenseRHPState({
                    splitScreenName,
                    activeTabName,
                    tabIndex,
                    backTo: BACK_TO_PATH,
                    path,
                });
            }

            return undefined;
        });

        const result = getAdaptedStateFromPath(path, undefined, false);

        expect(getRootRouteNames(result)).toEqual([NAVIGATORS.REPORTS_SPLIT_NAVIGATOR, NAVIGATORS.RIGHT_MODAL_NAVIGATOR]);

        const reportsSplitRoute = getReportsSplitNavigatorRoute(result);
        const reportRoute = reportsSplitRoute?.state?.routes?.at(1);

        expect(reportRoute?.name).toBe(SCREENS.REPORT);
        expect(reportRoute?.params).toEqual({reportID: REPORT_ID});
    });

    it('restores search fullscreen background after refresh on split expense search percentage tab', () => {
        const searchBackTo = '/search?q=type:expense';
        const path = `/create/split-expense/overview/${EXPENSE_REPORT_ID}/${TRANSACTION_ID}/0/search/${encodeURIComponent(searchBackTo)}/${CONST.TAB.SPLIT.PERCENTAGE}`;

        mockGetStateFromPath.mockImplementation((requestedPath: string) => {
            if (requestedPath === searchBackTo) {
                return {
                    routes: [{name: NAVIGATORS.SEARCH_FULLSCREEN_NAVIGATOR, state: {routes: [{name: SCREENS.SEARCH.ROOT, params: {q: 'type:expense'}}], index: 0}}],
                    index: 0,
                };
            }

            if (requestedPath === path) {
                return buildSplitExpenseRHPState({
                    splitScreenName: SCREENS.MONEY_REQUEST.SPLIT_EXPENSE_SEARCH,
                    activeTabName: CONST.TAB.SPLIT.PERCENTAGE,
                    tabIndex: 1,
                    backTo: searchBackTo,
                    path,
                });
            }

            return undefined;
        });

        const result = getAdaptedStateFromPath(path, undefined, false);

        expect(getRootRouteNames(result)).toEqual([NAVIGATORS.SEARCH_FULLSCREEN_NAVIGATOR, NAVIGATORS.RIGHT_MODAL_NAVIGATOR]);

        const searchRoute = result?.routes.at(0);

        expect(searchRoute?.state?.routes?.at(0)?.name).toBe(SCREENS.SEARCH.ROOT);
        expect(searchRoute?.state?.routes?.at(0)?.params).toEqual({q: 'type:expense'});
    });

    it('restores expense RHP layer beneath split modal when backTo points at /e/ expense detail (path-segment URL)', () => {
        const backTo = EXPENSE_RHP_BACK_TO;
        const path = `/create/split-expense/overview/${EXPENSE_REPORT_ID}/${TRANSACTION_ID}/0/${encodeURIComponent(backTo)}/${CONST.TAB.SPLIT.AMOUNT}`;
        const splitState: PartialState<NavigationState> = {
            routes: [
                {
                    name: NAVIGATORS.RIGHT_MODAL_NAVIGATOR,
                    state: {
                        routes: [
                            {
                                name: SCREENS.RIGHT_MODAL.MONEY_REQUEST,
                                state: {
                                    routes: [
                                        {
                                            name: SCREENS.MONEY_REQUEST.SPLIT_EXPENSE,
                                            params: {
                                                reportID: EXPENSE_REPORT_ID,
                                                transactionID: TRANSACTION_ID,
                                                splitExpenseTransactionID: '0',
                                                backTo,
                                            },
                                            state: {
                                                routes: [{name: CONST.TAB.SPLIT.AMOUNT, path}],
                                                index: 0,
                                            },
                                        },
                                    ],
                                    index: 0,
                                },
                            },
                        ],
                        index: 0,
                    },
                },
            ],
            index: 0,
        };

        mockGetStateFromPath.mockImplementation((requestedPath: string) => mockSplitExpenseStateFromPath(requestedPath, splitState));

        const result = getAdaptedStateFromPath(path, undefined, false);

        expect(getRightModalStackRouteNames(result)).toEqual([SCREENS.RIGHT_MODAL.EXPENSE_REPORT, SCREENS.RIGHT_MODAL.MONEY_REQUEST]);

        const reportsSplitRoute = getReportsSplitNavigatorRoute(result);
        expect(reportsSplitRoute?.state?.routes?.at(1)?.params).toEqual({reportID: REPORT_ID});
    });

    it('restores expense RHP layer beneath merge transaction modal when backTo points at expense detail', () => {
        const backTo = EXPENSE_RHP_BACK_TO;
        const path = `/merge/${TRANSACTION_ID}?backTo=${encodeURIComponent(backTo)}`;
        const mergeState: PartialState<NavigationState> = {
            routes: [
                {
                    name: NAVIGATORS.RIGHT_MODAL_NAVIGATOR,
                    state: {
                        routes: [
                            {
                                name: SCREENS.RIGHT_MODAL.MERGE_TRANSACTION,
                                state: {
                                    routes: [
                                        {
                                            name: SCREENS.MERGE_TRANSACTION.LIST_PAGE,
                                            params: {
                                                transactionID: TRANSACTION_ID,
                                                backTo,
                                            },
                                            path,
                                        },
                                    ],
                                    index: 0,
                                },
                            },
                        ],
                        index: 0,
                    },
                },
            ],
            index: 0,
        };

        mockGetStateFromPath.mockImplementation((requestedPath: string) => {
            if (requestedPath === BACK_TO_PATH) {
                return EXPENSE_DETAIL_FULL_SCREEN_STATE;
            }

            if (requestedPath === EXPENSE_RHP_BACK_TO || requestedPath === `/e/${EXPENSE_REPORT_ID}?backTo=%2Fr%2F${REPORT_ID}`) {
                return EXPENSE_RHP_STATE;
            }

            if (requestedPath === path || requestedPath.includes('/merge/')) {
                return mergeState;
            }

            return undefined;
        });

        const result = getAdaptedStateFromPath(path, undefined, false);

        expect(getRightModalStackRouteNames(result)).toEqual([SCREENS.RIGHT_MODAL.EXPENSE_REPORT, SCREENS.RIGHT_MODAL.MERGE_TRANSACTION]);

        const reportsSplitRoute = getReportsSplitNavigatorRoute(result);
        expect(reportsSplitRoute?.state?.routes?.at(1)?.params).toEqual({reportID: REPORT_ID});
    });
});

describe('enrichOnyxTabHostRouteForFullScreenMatching', () => {
    it('copies backTo and path from the focused split tab leaf onto the parent route', () => {
        const path = `/create/split-expense/overview/${EXPENSE_REPORT_ID}/${TRANSACTION_ID}/0/${CONST.TAB.SPLIT.PERCENTAGE}?backTo=${encodeURIComponent(BACK_TO_PATH)}`;
        const parentRoute = {
            name: SCREENS.MONEY_REQUEST.SPLIT_EXPENSE,
            params: {
                reportID: EXPENSE_REPORT_ID,
                transactionID: TRANSACTION_ID,
                splitExpenseTransactionID: '0',
            },
            state: {
                routes: buildSplitExpenseTabRoutes(CONST.TAB.SPLIT.PERCENTAGE, BACK_TO_PATH, path),
                index: 1,
            },
        };

        const enrichedRoute = enrichOnyxTabHostRouteForFullScreenMatching(parentRoute);

        expect(enrichedRoute.params).toEqual({
            reportID: EXPENSE_REPORT_ID,
            transactionID: TRANSACTION_ID,
            splitExpenseTransactionID: '0',
            backTo: BACK_TO_PATH,
        });
        expect(enrichedRoute.path).toBe(path);
    });

    it('leaves parent route unchanged when it already carries backTo', () => {
        const parentRoute = {
            name: SCREENS.MONEY_REQUEST.SPLIT_EXPENSE,
            params: {
                reportID: EXPENSE_REPORT_ID,
                transactionID: TRANSACTION_ID,
                splitExpenseTransactionID: '0',
                backTo: BACK_TO_PATH,
            },
            path: `/create/split-expense/overview/${EXPENSE_REPORT_ID}/${TRANSACTION_ID}/0?backTo=${encodeURIComponent(BACK_TO_PATH)}`,
            state: {
                routes: [{name: CONST.TAB.SPLIT.AMOUNT}],
                index: 0,
            },
        };

        expect(enrichOnyxTabHostRouteForFullScreenMatching(parentRoute)).toBe(parentRoute);
    });
});
