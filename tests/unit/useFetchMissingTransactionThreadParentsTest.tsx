import {act, renderHook} from '@testing-library/react-native';

import useFetchMissingTransactionThreadParents from '@hooks/useFetchMissingTransactionThreadParents';

import {getAll as getAllPersistedRequests, getOngoingRequest} from '@libs/actions/PersistedRequests';
import type * as PersistedRequestsModule from '@libs/actions/PersistedRequests';
import {WRITE_COMMANDS} from '@libs/API/types';
import Log from '@libs/Log';

import {openReport} from '@userActions/Report';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportAction} from '@src/types/onyx';
import type PriorityMode from '@src/types/onyx/PriorityMode';

import type {OnyxCollection} from 'react-native-onyx';

import Onyx from 'react-native-onyx';

import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

jest.mock('@userActions/Report', () => ({
    openReport: jest.fn(),
}));

jest.mock('@libs/actions/PersistedRequests', () => {
    const actual = jest.requireActual<typeof PersistedRequestsModule>('@libs/actions/PersistedRequests');
    return {
        ...actual,
        getAll: jest.fn(() => actual.getAll()),
        getOngoingRequest: jest.fn(() => actual.getOngoingRequest()),
    };
});

const CURRENT_USER_ACCOUNT_ID = 5;
const EXPENSE_REPORT_ID = '1';
const THREAD_REPORT_ID = '2';
const PARENT_ACTION_ID = '100';

const expenseReportKey = `${ONYXKEYS.COLLECTION.REPORT}${EXPENSE_REPORT_ID}` as const;
const threadReportKey = `${ONYXKEYS.COLLECTION.REPORT}${THREAD_REPORT_ID}` as const;
const parentActionsKey = `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${EXPENSE_REPORT_ID}` as const;

// The parent's IOU action, as a Focus-mode OpenApp returns it alongside the thread it points to.
const iouAction: ReportAction = {
    reportActionID: PARENT_ACTION_ID,
    actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
    message: {IOUTransactionID: '1', type: CONST.IOU.REPORT_ACTION_TYPE.CREATE, amount: 1000, currency: CONST.CURRENCY.USD, html: '10.00 expense', text: '10.00 expense'},
    childReportID: THREAD_REPORT_ID,
    actorAccountID: CURRENT_USER_ACCOUNT_ID,
    created: '2025-01-20 11:00:00.000',
};

const commentAction: ReportAction = {
    reportActionID: PARENT_ACTION_ID,
    actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
    message: [{type: 'COMMENT', html: 'Hello', text: 'Hello'}],
    childReportID: THREAD_REPORT_ID,
    actorAccountID: 18921695,
    created: '2025-01-20 11:00:00.000',
};

// The transaction thread as a Focus-mode OpenApp returns it after Clear cache and restart: unread, parent not loaded.
const unreadThread: Report = {
    reportID: THREAD_REPORT_ID,
    type: CONST.REPORT.TYPE.CHAT,
    parentReportID: EXPENSE_REPORT_ID,
    parentReportActionID: PARENT_ACTION_ID,
    participants: {[CURRENT_USER_ACCOUNT_ID]: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN}},
    lastReadTime: '2025-01-20 12:00:00.000',
    lastVisibleActionCreated: '2025-01-20 13:00:00.000',
    lastActorAccountID: 18921695,
};

const expenseReport: Report = {
    reportID: EXPENSE_REPORT_ID,
    type: CONST.REPORT.TYPE.EXPENSE,
    transactionCount: 1,
    lastReadTime: '2025-01-20 12:00:00.000',
    lastVisibleActionCreated: '2025-01-20 11:00:00.000',
    lastActorAccountID: CURRENT_USER_ACCOUNT_ID,
};

type HookProps = {
    reportUpdates: OnyxCollection<Report> | undefined;
    reports: OnyxCollection<Report>;
    priorityMode: PriorityMode;
    isOffline: boolean;
    currentReportID: string | undefined;
};

const focusProps = (reports: OnyxCollection<Report>, overrides: Partial<HookProps> = {}): HookProps => ({
    reportUpdates: reports,
    reports,
    priorityMode: CONST.PRIORITY_MODE.GSD,
    isOffline: false,
    currentReportID: undefined,
    ...overrides,
});

function renderFetch(props: HookProps) {
    return renderHook(
        (hookProps: HookProps) => useFetchMissingTransactionThreadParents(hookProps.reportUpdates, hookProps.reports, hookProps.priorityMode, hookProps.isOffline, hookProps.currentReportID),
        {
            initialProps: props,
        },
    );
}

describe('useFetchMissingTransactionThreadParents', () => {
    let logHmmm: jest.SpiedFunction<typeof Log.hmmm>;

    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.mocked(getAllPersistedRequests).mockReturnValue([]);
        jest.mocked(getOngoingRequest).mockReturnValue(null);
        jest.spyOn(Log, 'info').mockImplementation(() => {});
        logHmmm = jest.spyOn(Log, 'hmmm').mockImplementation(() => {});
        await act(async () => {
            await Onyx.clear();
            await Onyx.set(ONYXKEYS.SESSION, {accountID: CURRENT_USER_ACCOUNT_ID, email: 'test@example.com'});
            await Onyx.set(parentActionsKey, {[PARENT_ACTION_ID]: iouAction});
        });
        await waitForBatchedUpdatesWithAct();
    });

    it('fetches the missing parent of an unread transaction thread once, without marking it read', async () => {
        // Given the Onyx state a Focus-mode OpenApp leaves after Clear cache and restart: the unread transaction thread and the
        // parent's IOU action are present, but the read expense report itself is not
        const {rerender} = renderFetch(focusProps({[threadReportKey]: unreadThread}));
        await waitForBatchedUpdatesWithAct();

        // Then the expense report is fetched without touching the user's read state
        expect(openReport).toHaveBeenCalledTimes(1);
        expect(openReport).toHaveBeenCalledWith(expect.objectContaining({reportID: EXPENSE_REPORT_ID, shouldMarkAsRead: false, shouldKeepManualUnreadMarker: true, hasReportActions: false}));

        // When the thread changes again before the parent arrives, e.g. another comment lands on it
        const threadWithNewerComment: Report = {...unreadThread, lastVisibleActionCreated: '2025-01-20 14:00:00.000'};
        rerender(focusProps({[threadReportKey]: threadWithNewerComment}));
        await waitForBatchedUpdatesWithAct();

        // Then the parent is not requested a second time
        expect(openReport).toHaveBeenCalledTimes(1);
    });

    it('fetches again after the parent arrived and a later cache clear removed it', async () => {
        const {rerender} = renderFetch(focusProps({[threadReportKey]: unreadThread}));
        await waitForBatchedUpdatesWithAct();
        expect(openReport).toHaveBeenCalledTimes(1);

        // When the parent lands, the request is forgotten, and a cache clear then drops the parent again
        rerender(focusProps({[threadReportKey]: unreadThread, [expenseReportKey]: expenseReport}));
        await waitForBatchedUpdatesWithAct();
        const threadAfterRestart: Report = {...unreadThread, lastVisibleActionCreated: '2025-01-20 15:00:00.000'};
        rerender(focusProps({[threadReportKey]: threadAfterRestart}));
        await waitForBatchedUpdatesWithAct();

        // Then the parent is fetched once more, since the first response is gone
        expect(openReport).toHaveBeenCalledTimes(2);
    });

    it('does not fetch a parent that is already in Onyx', async () => {
        renderFetch(focusProps({[threadReportKey]: unreadThread, [expenseReportKey]: expenseReport}));
        await waitForBatchedUpdatesWithAct();

        expect(openReport).not.toHaveBeenCalled();
    });

    it('does not fetch the parent of a comment thread', async () => {
        await act(async () => {
            await Onyx.set(parentActionsKey, {[PARENT_ACTION_ID]: commentAction});
        });
        await waitForBatchedUpdatesWithAct();

        renderFetch(focusProps({[threadReportKey]: unreadThread}));
        await waitForBatchedUpdatesWithAct();

        expect(openReport).not.toHaveBeenCalled();
        expect(logHmmm).not.toHaveBeenCalled();
    });

    it('does not fetch the parent of a read transaction thread', async () => {
        const readThread: Report = {...unreadThread, lastVisibleActionCreated: '2025-01-20 11:30:00.000'};
        renderFetch(focusProps({[threadReportKey]: readThread}));
        await waitForBatchedUpdatesWithAct();

        expect(openReport).not.toHaveBeenCalled();
    });

    it('scans reports that loaded before Focus mode did, even when nothing changes afterwards', async () => {
        // Given the report list arrives while priority mode is still the loading default, so that pass is ignored
        const reports = {[threadReportKey]: unreadThread};
        const {rerender} = renderFetch(focusProps(reports, {priorityMode: CONST.PRIORITY_MODE.DEFAULT}));
        await waitForBatchedUpdatesWithAct();
        expect(openReport).not.toHaveBeenCalled();

        // When Focus mode hydrates and no report changes again
        rerender(focusProps(reports, {reportUpdates: undefined}));
        await waitForBatchedUpdatesWithAct();

        // Then the thread that was already loaded is still found, and its parent is fetched once
        expect(openReport).toHaveBeenCalledTimes(1);
        expect(openReport).toHaveBeenCalledWith(expect.objectContaining({reportID: EXPENSE_REPORT_ID, shouldMarkAsRead: false}));
    });

    it('does nothing outside Focus mode, and fetches once Focus mode is on', async () => {
        const {rerender} = renderFetch(focusProps({[threadReportKey]: unreadThread}, {priorityMode: CONST.PRIORITY_MODE.DEFAULT}));
        await waitForBatchedUpdatesWithAct();

        expect(openReport).not.toHaveBeenCalled();

        rerender(focusProps({[threadReportKey]: unreadThread}));
        await waitForBatchedUpdatesWithAct();

        expect(openReport).toHaveBeenCalledTimes(1);
    });

    it('waits until the app is online', async () => {
        const {rerender} = renderFetch(focusProps({[threadReportKey]: unreadThread}, {isOffline: true}));
        await waitForBatchedUpdatesWithAct();

        expect(openReport).not.toHaveBeenCalled();

        rerender(focusProps({[threadReportKey]: unreadThread}, {isOffline: false}));
        await waitForBatchedUpdatesWithAct();

        expect(openReport).toHaveBeenCalledTimes(1);
    });

    it('does not fetch the report the user already has open', async () => {
        renderFetch(focusProps({[threadReportKey]: unreadThread}, {currentReportID: EXPENSE_REPORT_ID}));
        await waitForBatchedUpdatesWithAct();

        expect(openReport).not.toHaveBeenCalled();
    });

    it.each([
        ['queued', () => jest.mocked(getAllPersistedRequests).mockReturnValue([{command: WRITE_COMMANDS.OPEN_REPORT, data: {reportID: EXPENSE_REPORT_ID}}])],
        ['in flight', () => jest.mocked(getOngoingRequest).mockReturnValue({command: WRITE_COMMANDS.OPEN_REPORT, data: {reportID: EXPENSE_REPORT_ID}})],
    ])('does not replace an OpenReport that is already %s', async (_label, mockRequest) => {
        mockRequest();
        renderFetch(focusProps({[threadReportKey]: unreadThread}));
        await waitForBatchedUpdatesWithAct();

        expect(openReport).not.toHaveBeenCalled();
    });

    it('logs and does not fetch when the parent action is not in Onyx, then fetches once the action arrives', async () => {
        await act(async () => {
            await Onyx.set(parentActionsKey, {});
        });
        await waitForBatchedUpdatesWithAct();

        const {rerender} = renderFetch(focusProps({[threadReportKey]: unreadThread}));
        await waitForBatchedUpdatesWithAct();

        expect(openReport).not.toHaveBeenCalled();
        expect(logHmmm).toHaveBeenCalledWith(
            '[LHN] Unread thread without parent, parent action not in Onyx',
            expect.objectContaining({threadReportID: THREAD_REPORT_ID, parentReportID: EXPENSE_REPORT_ID, parentReportActionID: PARENT_ACTION_ID}),
        );

        await act(async () => {
            await Onyx.set(parentActionsKey, {[PARENT_ACTION_ID]: iouAction});
        });
        await waitForBatchedUpdatesWithAct();
        const threadWithNewerComment: Report = {...unreadThread, lastVisibleActionCreated: '2025-01-20 14:00:00.000'};
        rerender(focusProps({[threadReportKey]: threadWithNewerComment}));
        await waitForBatchedUpdatesWithAct();

        expect(openReport).toHaveBeenCalledTimes(1);
    });
});
