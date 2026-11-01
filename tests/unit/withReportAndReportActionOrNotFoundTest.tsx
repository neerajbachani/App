import {act, render, screen} from '@testing-library/react-native';

import OnyxListItemProvider from '@components/OnyxListItemProvider';
import Text from '@components/Text';

import {openReport} from '@libs/actions/Report';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {SplitDetailsNavigatorParamList} from '@libs/Navigation/types';

import type {WithReportAndReportActionOrNotFoundProps} from '@pages/inbox/report/withReportAndReportActionOrNotFound';
import withReportAndReportActionOrNotFound from '@pages/inbox/report/withReportAndReportActionOrNotFound';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import type {ReportAction} from '@src/types/onyx';

import React from 'react';
import Onyx from 'react-native-onyx';

import {createRandomReport} from '../utils/collections/reports';
import createMock from '../utils/createMock';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

jest.mock('@libs/actions/Report', () => ({
    ...jest.requireActual<Record<string, unknown>>('@libs/actions/Report'),
    openReport: jest.fn(),
}));
jest.mock('@components/FullscreenLoadingIndicator', () => {
    const {View} = jest.requireActual<Record<string, React.FC<Record<string, unknown>>>>('react-native');
    return () => <View testID="loading" />;
});
jest.mock('@pages/ErrorPage/NotFoundPage', () => {
    const {View} = jest.requireActual<Record<string, React.FC<Record<string, unknown>>>>('react-native');
    return () => <View testID="notFound" />;
});

const mockOpenReport = jest.mocked(openReport);

const REPORT_ID = '100';
const REPORT_ACTION_ID = '200';
const OTHER_ACTION_ID = '201';
type ScreenProps = PlatformStackScreenProps<SplitDetailsNavigatorParamList, typeof SCREENS.SPLIT_DETAILS.DYNAMIC_ROOT>;

const report = {...createRandomReport(Number(REPORT_ID), undefined), type: CONST.REPORT.TYPE.CHAT, errorFields: undefined};

function Content({reportAction}: WithReportAndReportActionOrNotFoundProps) {
    return <Text testID="content">{reportAction?.reportActionID}</Text>;
}

const WrappedContent = withReportAndReportActionOrNotFound(Content);

function renderSplitDetails() {
    render(
        <OnyxListItemProvider>
            <WrappedContent
                navigation={createMock<ScreenProps['navigation']>({})}
                route={createMock<ScreenProps['route']>({params: {reportID: REPORT_ID, reportActionID: REPORT_ACTION_ID}})}
                report={report}
                reportAction={{} as ReportAction}
                parentReport={undefined}
                parentReportAction={null}
            />
        </OnyxListItemProvider>,
    );
}

describe('withReportAndReportActionOrNotFound', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    afterEach(async () => {
        mockOpenReport.mockClear();
        await act(async () => {
            await Onyx.clear();
        });
    });

    it('fetches the linked action when the loaded page does not contain it', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, report);
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`, {
            [OTHER_ACTION_ID]: {reportActionID: OTHER_ACTION_ID, actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT, created: '2026-10-20 00:00:00.000'},
        });
        await Onyx.merge(`${ONYXKEYS.COLLECTION.RAM_ONLY_REPORT_LOADING_STATE}${REPORT_ID}`, {isLoadingInitialReportActions: false});

        renderSplitDetails();
        await waitForBatchedUpdatesWithAct();

        expect(mockOpenReport).toHaveBeenCalledWith(expect.objectContaining({reportID: REPORT_ID, reportActionID: REPORT_ACTION_ID}));
    });

    it('does not fetch when the linked action is already loaded', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, report);
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`, {
            [REPORT_ACTION_ID]: {reportActionID: REPORT_ACTION_ID, actionName: CONST.REPORT.ACTIONS.TYPE.IOU, created: '2026-10-20 00:00:00.000'},
        });

        renderSplitDetails();
        await waitForBatchedUpdatesWithAct();

        expect(mockOpenReport).not.toHaveBeenCalled();
        expect(screen.getByTestId('content')).toHaveTextContent(REPORT_ACTION_ID);
    });
});
