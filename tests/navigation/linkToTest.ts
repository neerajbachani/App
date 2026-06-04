import type {NavigationContainerRef, NavigationState} from '@react-navigation/native';
import linkTo from '@libs/Navigation/helpers/linkTo';
import type {RootNavigatorParamList} from '@libs/Navigation/types';
import CONST from '@src/CONST';
import NAVIGATORS from '@src/NAVIGATORS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';

const REPORT_ID = '111';
const REPORT_ACTION_ID = '222';

function makeCurrentReportState(): NavigationState<RootNavigatorParamList> {
    return {
        type: 'stack',
        key: 'root-key',
        index: 0,
        routeNames: [NAVIGATORS.TAB_NAVIGATOR],
        stale: false,
        routes: [
            {
                key: 'tab-route-key',
                name: NAVIGATORS.TAB_NAVIGATOR,
                state: {
                    type: 'tab',
                    key: 'tab-state-key',
                    index: 0,
                    routeNames: [NAVIGATORS.REPORTS_SPLIT_NAVIGATOR],
                    stale: false,
                    routes: [
                        {
                            key: 'split-route-key',
                            name: NAVIGATORS.REPORTS_SPLIT_NAVIGATOR,
                            state: {
                                type: 'stack',
                                key: 'split-state-key',
                                index: 1,
                                routeNames: [SCREENS.INBOX, SCREENS.REPORT],
                                stale: false,
                                routes: [
                                    {key: 'inbox-key', name: SCREENS.INBOX},
                                    {
                                        key: 'report-key',
                                        name: SCREENS.REPORT,
                                        params: {reportID: REPORT_ID},
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        ],
    } as unknown as NavigationState<RootNavigatorParamList>;
}

describe('linkTo same-report report action links', () => {
    it('dispatches PUSH_PARAMS instead of pushing a duplicate Report screen', () => {
        const dispatch = jest.fn();
        const getRootState = jest.fn(() => makeCurrentReportState());

        const navigation = {
            dispatch,
            getRootState,
        } as unknown as NavigationContainerRef<RootNavigatorParamList>;

        linkTo(navigation, ROUTES.REPORT_WITH_ID.getRoute(REPORT_ID, REPORT_ACTION_ID));

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith({
            type: CONST.NAVIGATION.ACTION_TYPE.PUSH_PARAMS,
            payload: {
                params: {
                    reportID: REPORT_ID,
                    reportActionID: REPORT_ACTION_ID,
                },
            },
        });
    });

    it('does not dispatch a PUSH action for same-report report action navigation', () => {
        const dispatch = jest.fn();
        const getRootState = jest.fn(() => makeCurrentReportState());

        const navigation = {
            dispatch,
            getRootState,
        } as unknown as NavigationContainerRef<RootNavigatorParamList>;

        linkTo(navigation, ROUTES.REPORT_WITH_ID.getRoute(REPORT_ID, REPORT_ACTION_ID));

        const pushedReportScreen = dispatch.mock.calls.some(([action]) => action?.type === CONST.NAVIGATION.ACTION_TYPE.PUSH && action?.payload?.name === SCREENS.REPORT);
        expect(pushedReportScreen).toBe(false);
    });
});
