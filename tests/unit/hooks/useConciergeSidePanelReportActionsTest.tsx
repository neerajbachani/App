import {renderHook} from '@testing-library/react-native';
import useConciergeSidePanelReportActions from '@hooks/useConciergeSidePanelReportActions';
import CONST from '@src/CONST';
import type * as OnyxTypes from '@src/types/onyx';

const SESSION_START = '2025-06-01 12:00:00.000';
const BEFORE_SESSION = '2025-05-01 12:00:00.000';
const AFTER_SESSION = '2025-06-02 12:00:00.000';

const CURRENT_USER_ACCOUNT_ID = 100;
const OTHER_ACCOUNT_ID = 200;

const noopLoadOlderChats = jest.fn();

const baseReport: OnyxTypes.Report = {
    reportID: 'concierge-report',
    reportName: 'Concierge',
    chatReportID: 'concierge-report',
    ownerAccountID: CURRENT_USER_ACCOUNT_ID,
};

function createCreatedAction(created: string): OnyxTypes.ReportAction {
    return {
        reportActionID: 'created-1',
        actionName: CONST.REPORT.ACTIONS.TYPE.CREATED,
        created,
        actorAccountID: CURRENT_USER_ACCOUNT_ID,
        message: [],
        originalMessage: {},
        shouldShow: true,
        person: [],
        pendingAction: null,
        errors: {},
    };
}

function createUserCommentAction(reportActionID: string, created: string): OnyxTypes.ReportAction {
    return {
        reportActionID,
        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        created,
        actorAccountID: CURRENT_USER_ACCOUNT_ID,
        message: [{type: 'COMMENT', html: 'hi', text: 'hi'}],
        originalMessage: {},
        shouldShow: true,
        person: [],
        pendingAction: null,
        errors: {},
    };
}

function createConciergeCommentAction(reportActionID: string, created: string): OnyxTypes.ReportAction {
    return {
        reportActionID,
        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        created,
        actorAccountID: OTHER_ACCOUNT_ID,
        message: [{type: 'COMMENT', html: 'hello', text: 'hello'}],
        originalMessage: {},
        shouldShow: true,
        person: [],
        pendingAction: null,
        errors: {},
    };
}

describe('useConciergeSidePanelReportActions', () => {
    beforeEach(() => {
        noopLoadOlderChats.mockClear();
    });

    it('returns hasPreviousMessages true when hasOlderActions is true even if no pre-session actions are loaded yet', () => {
        const visibleReportActions = [createCreatedAction(BEFORE_SESSION), createConciergeCommentAction('c1', AFTER_SESSION)];

        const {result} = renderHook(() =>
            useConciergeSidePanelReportActions({
                report: baseReport,
                reportActions: visibleReportActions,
                visibleReportActions,
                isConciergeSidePanel: true,
                hasUserSentMessage: false,
                hasOlderActions: true,
                sessionStartTime: SESSION_START,
                currentUserAccountID: CURRENT_USER_ACCOUNT_ID,
                greetingText: 'Welcome',
                loadOlderChats: noopLoadOlderChats,
            }),
        );

        expect(result.current.hasPreviousMessages).toBe(true);
    });

    it('returns hasPreviousMessages false when hasOlderActions is false and no pre-session message is loaded', () => {
        const visibleReportActions = [createCreatedAction(BEFORE_SESSION), createConciergeCommentAction('c1', AFTER_SESSION)];

        const {result} = renderHook(() =>
            useConciergeSidePanelReportActions({
                report: baseReport,
                reportActions: visibleReportActions,
                visibleReportActions,
                isConciergeSidePanel: true,
                hasUserSentMessage: false,
                hasOlderActions: false,
                sessionStartTime: SESSION_START,
                currentUserAccountID: CURRENT_USER_ACCOUNT_ID,
                greetingText: 'Welcome',
                loadOlderChats: noopLoadOlderChats,
            }),
        );

        expect(result.current.hasPreviousMessages).toBe(false);
    });

    it('returns hasPreviousMessages true when a pre-session non-created action is loaded and hasOlderActions is false', () => {
        const visibleReportActions = [createCreatedAction(BEFORE_SESSION), createUserCommentAction('u1', BEFORE_SESSION), createConciergeCommentAction('c1', AFTER_SESSION)];

        const {result} = renderHook(() =>
            useConciergeSidePanelReportActions({
                report: baseReport,
                reportActions: visibleReportActions,
                visibleReportActions,
                isConciergeSidePanel: true,
                hasUserSentMessage: true,
                hasOlderActions: false,
                sessionStartTime: SESSION_START,
                currentUserAccountID: CURRENT_USER_ACCOUNT_ID,
                greetingText: 'Welcome',
                loadOlderChats: noopLoadOlderChats,
            }),
        );

        expect(result.current.hasPreviousMessages).toBe(true);
    });

    it('returns hasPreviousMessages false when not in concierge side panel', () => {
        const visibleReportActions = [createCreatedAction(BEFORE_SESSION), createUserCommentAction('u1', BEFORE_SESSION)];

        const {result} = renderHook(() =>
            useConciergeSidePanelReportActions({
                report: baseReport,
                reportActions: visibleReportActions,
                visibleReportActions,
                isConciergeSidePanel: false,
                hasUserSentMessage: true,
                hasOlderActions: true,
                sessionStartTime: SESSION_START,
                currentUserAccountID: CURRENT_USER_ACCOUNT_ID,
                greetingText: 'Welcome',
                loadOlderChats: noopLoadOlderChats,
            }),
        );

        expect(result.current.hasPreviousMessages).toBe(false);
    });
});
