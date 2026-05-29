import {useEffect, useMemo, useRef} from 'react';
import type {OnyxCollection} from 'react-native-onyx';
import {getConciergeSessionUserMessageEvidence, hasConciergeSessionUserMessage} from '@libs/ConciergeSidePanelUtils';
import Log from '@libs/Log';
import {getAllNonDeletedTransactions} from '@libs/MoneyRequestReportUtils';
import {
    getMentionWhisperParentActionID,
    getOriginalMessage,
    isActionableMentionWhisper,
    isActionableReportMentionWhisper,
    isDeletedParentAction,
    isIOUActionMatchingTransactionList,
    isReportActionVisible,
} from '@libs/ReportActionsUtils';
import {isConciergeChatReport} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportAction, ReportActions} from '@src/types/onyx';
import useConciergeSidePanelReportActions from './useConciergeSidePanelReportActions';
import useCurrentUserPersonalDetails from './useCurrentUserPersonalDetails';
import useIsInSidePanel from './useIsInSidePanel';
import useLocalize from './useLocalize';
import useNetwork from './useNetwork';
import useOnyx from './useOnyx';
import useSidePanelState from './useSidePanelState';
import useTransactionsAndViolationsForReport from './useTransactionsAndViolationsForReport';

type UseReportActionsVisibilityParams = {
    reportID: string | undefined;
    reportActions: ReportAction[];
    allReportActions: ReportAction[];
    fullCachedReportActions: ReportAction[];
    canPerformWriteAction: boolean;
    hasOlderActions: boolean;
    loadOlderChats: (force?: boolean) => void;
};

type UseReportActionsVisibilityResult = {
    sortedReportActions: ReportAction[];
    sortedVisibleReportActions: ReportAction[];
    isConciergeSidePanel: boolean;
    showConciergeSidePanelWelcome: boolean;
    showFullHistory: boolean;
    hasPreviousMessages: boolean;
    handleShowPreviousMessages: () => void;
};

function useReportActionsVisibility({
    reportID,
    reportActions,
    allReportActions,
    fullCachedReportActions,
    canPerformWriteAction,
    hasOlderActions,
    loadOlderChats,
}: UseReportActionsVisibilityParams): UseReportActionsVisibilityResult {
    const {isOffline} = useNetwork();
    const {translate} = useLocalize();
    const {accountID: currentUserAccountID} = useCurrentUserPersonalDetails();

    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [conciergeReportID] = useOnyx(ONYXKEYS.CONCIERGE_REPORT_ID);
    const [visibleReportActionsData] = useOnyx(ONYXKEYS.DERIVED.VISIBLE_REPORT_ACTIONS);
    const [allReportActionsCollection] = useOnyx(ONYXKEYS.COLLECTION.REPORT_ACTIONS);

    const isInSidePanel = useIsInSidePanel();
    const isConciergeSidePanel = isInSidePanel && isConciergeChatReport(report, conciergeReportID);

    const {sessionStartTime} = useSidePanelState();

    const hasUserSentMessage = isConciergeSidePanel && sessionStartTime ? hasConciergeSessionUserMessage(allReportActions, sessionStartTime, currentUserAccountID) : false;

    const prevHasUserSentMessageRef = useRef<boolean | undefined>(undefined);
    useEffect(() => {
        if (!isConciergeSidePanel || !sessionStartTime || !reportID) {
            prevHasUserSentMessageRef.current = undefined;
            return;
        }

        if (prevHasUserSentMessageRef.current === hasUserSentMessage) {
            return;
        }

        const evidence = getConciergeSessionUserMessageEvidence(allReportActions, sessionStartTime, currentUserAccountID);
        Log.hmmm('[ConciergeSidePanel] hasUserSentMessage transition', {
            reportID,
            prev: prevHasUserSentMessageRef.current,
            next: hasUserSentMessage,
            sessionStartTime,
            matchingActionCount: evidence.matchingActionIDs.length,
            pendingAddActionCount: evidence.pendingAddActionIDs.length,
            matchingActionIDs: evidence.matchingActionIDs.slice(0, 5),
            pendingAddActionIDs: evidence.pendingAddActionIDs.slice(0, 5),
        });
        prevHasUserSentMessageRef.current = hasUserSentMessage;
    }, [allReportActions, hasUserSentMessage, isConciergeSidePanel, reportID, sessionStartTime, currentUserAccountID]);

    const {transactions: reportTransactions, isLoaded: areTransactionsLoaded} = useTransactionsAndViolationsForReport(reportID);
    // When transactions haven't loaded yet, pass undefined to skip IOU filtering entirely
    // (undefined = "don't filter" in isIOUActionMatchingTransactionList).
    // Once loaded, filter normally — even if transactions is empty (genuinely no transactions).
    const reportTransactionIDs = areTransactionsLoaded ? getAllNonDeletedTransactions(reportTransactions, allReportActions ?? []).map((transaction) => transaction.transactionID) : undefined;

    const localActionsForReport = useMemo(
        () =>
            fullCachedReportActions.reduce<ReportActions>((acc, action) => {
                if (action?.reportActionID) {
                    acc[action.reportActionID] = action;
                }
                return acc;
            }, {}),
        [fullCachedReportActions],
    );

    const crossCollectionActionsByID = useMemo(() => {
        const actionsByID: ReportActions = {};
        const reportActionsCollections = allReportActionsCollection as OnyxCollection<ReportActions> | undefined;

        for (const reportActions of Object.values(reportActionsCollections ?? {})) {
            if (!reportActions) {
                continue;
            }

            for (const [actionID, action] of Object.entries(reportActions)) {
                if (action?.reportActionID) {
                    actionsByID[action.reportActionID] = action;
                } else if (action) {
                    actionsByID[actionID] = action;
                }
            }
        }

        return actionsByID;
    }, [allReportActionsCollection]);

    const mergedActionsForReport = useMemo(
        () => ({
            ...crossCollectionActionsByID,
            ...localActionsForReport,
        }),
        [crossCollectionActionsByID, localActionsForReport],
    );

    useEffect(() => {
        reportActions.forEach((reportAction) => {
            if (!isActionableMentionWhisper(reportAction) && !isActionableReportMentionWhisper(reportAction)) {
                return;
            }

            const originalMessage = getOriginalMessage(reportAction) as {deleted?: string | null; parentReportActionID?: string} | undefined;
            if (!originalMessage?.deleted) {
                return;
            }

            const parentReportActionID = getMentionWhisperParentActionID(reportAction);
            Log.info('[MentionWhisperParentContext]', false, {
                reportID,
                reportActionID: reportAction.reportActionID,
                parentReportActionID: parentReportActionID ?? null,
                localMapActionCount: Object.keys(localActionsForReport).length,
                crossCollectionMapActionCount: Object.keys(crossCollectionActionsByID).length,
                mergedMapActionCount: Object.keys(mergedActionsForReport).length,
                hasParentInLocalMap: !!(parentReportActionID && localActionsForReport[parentReportActionID]),
                hasParentInMergedMap: !!(parentReportActionID && mergedActionsForReport[parentReportActionID]),
            });
        });
    }, [crossCollectionActionsByID, localActionsForReport, mergedActionsForReport, reportActions, reportID]);

    const visibleReportActions = reportActions.filter((reportAction) => {
        const passesOfflineCheck = isOffline || isDeletedParentAction(reportAction) || reportAction.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE || reportAction.errors;

        if (!passesOfflineCheck) {
            return false;
        }

        const actionReportID = reportAction.reportID ?? reportID;
        if (!isReportActionVisible(reportAction, actionReportID, canPerformWriteAction, visibleReportActionsData, mergedActionsForReport)) {
            return false;
        }

        if (!isIOUActionMatchingTransactionList(reportAction, reportTransactionIDs)) {
            return false;
        }

        return true;
    });

    const {filteredVisibleActions, filteredReportActions, showConciergeSidePanelWelcome, showFullHistory, hasPreviousMessages, handleShowPreviousMessages} =
        useConciergeSidePanelReportActions({
            report,
            reportActions,
            visibleReportActions,
            isConciergeSidePanel,
            hasUserSentMessage,
            hasOlderActions,
            sessionStartTime,
            currentUserAccountID,
            greetingText: translate('common.concierge.sidePanelGreeting'),
            loadOlderChats,
        });

    return {
        sortedReportActions: filteredReportActions,
        sortedVisibleReportActions: filteredVisibleActions,
        isConciergeSidePanel,
        showConciergeSidePanelWelcome,
        showFullHistory,
        hasPreviousMessages,
        handleShowPreviousMessages,
    };
}

export default useReportActionsVisibility;
