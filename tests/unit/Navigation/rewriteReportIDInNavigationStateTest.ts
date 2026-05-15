import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {CommonActions} from '@react-navigation/native';
import {replaceReportIdInNavigationPath, rewriteReportIDInNavigationState} from '@libs/Navigation/helpers/rewriteReportIDInNavigationState';
import SCREENS from '@src/SCREENS';

const mockDispatch = jest.fn();

jest.mock('@libs/Navigation/navigationRef', () => ({
    __esModule: true,
    default: {
        current: {
            getRootState: jest.fn(),
            dispatch: (...args: unknown[]) => mockDispatch(...args),
        },
    },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const navigationRef = require('@libs/Navigation/navigationRef').default as {
    current: {
        getRootState: jest.Mock;
        dispatch: jest.Mock;
    };
};

describe('replaceReportIdInNavigationPath', () => {
    it('replaces report IDs in /r/, search/view/, and search/r/ paths', () => {
        expect(replaceReportIdInNavigationPath('/r/111/transaction/abc', '111', '222')).toBe('/r/222/transaction/abc');
        expect(replaceReportIdInNavigationPath('search/view/111', '111', '222')).toBe('search/view/222');
        expect(replaceReportIdInNavigationPath('search/r/111/details', '111', '222')).toBe('search/r/222/details');
    });
});

describe('rewriteReportIDInNavigationState', () => {
    beforeEach(() => {
        mockDispatch.mockClear();
    });

    it('returns 0 when navigation state is missing', () => {
        navigationRef.current.getRootState.mockReturnValue(undefined);
        expect(rewriteReportIDInNavigationState({fromReportID: '1', toReportID: '2'})).toBe(0);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('dispatches setParams for matching RHP routes and rewrites backTo', () => {
        navigationRef.current.getRootState.mockReturnValue({
            key: 'root',
            routes: [
                {
                    key: 'rhp-route',
                    name: SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT,
                    params: {
                        reportID: '111',
                        backTo: '/r/111/transaction/tx1',
                    },
                },
            ],
        });

        expect(rewriteReportIDInNavigationState({fromReportID: '111', toReportID: '222'})).toBe(1);

        expect(mockDispatch).toHaveBeenCalledWith({
            ...CommonActions.setParams({
                reportID: '222',
                backTo: '/r/222/transaction/tx1',
            }),
            source: 'rhp-route',
            target: 'root',
        });
    });

    it('walks nested navigators', () => {
        navigationRef.current.getRootState.mockReturnValue({
            key: 'root',
            routes: [
                {
                    key: 'parent',
                    name: 'Parent',
                    state: {
                        key: 'child-nav',
                        routes: [
                            {
                                key: 'nested-rhp',
                                name: SCREENS.RIGHT_MODAL.SEARCH_REPORT,
                                params: {reportID: '111'},
                            },
                        ],
                    },
                },
            ],
        });

        expect(rewriteReportIDInNavigationState({fromReportID: '111', toReportID: '222'})).toBe(1);

        expect(mockDispatch).toHaveBeenCalledWith({
            ...CommonActions.setParams({reportID: '222'}),
            source: 'nested-rhp',
            target: 'child-nav',
        });
    });
});
