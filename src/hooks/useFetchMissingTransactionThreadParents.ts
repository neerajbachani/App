import {getAll as getAllPersistedRequests, getOngoingRequest} from '@libs/actions/PersistedRequests';
import {WRITE_COMMANDS} from '@libs/API/types';
import Log from '@libs/Log';
import {getReportAction, isTransactionThread} from '@libs/ReportActionsUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportActions} from '@src/types/onyx';
import type PriorityMode from '@src/types/onyx/PriorityMode';
import type {AnyRequest} from '@src/types/onyx/Request';

import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';

import {useEffect, useRef} from 'react';
import Onyx from 'react-native-onyx';

import useOpenReport from './useOpenReport';

type MissingTransactionThreadParent = {
    threadReportID: string;
    parentReportID: string;
};

/**
 * An unread thread whose parent report is not in Onyx. Focus mode's OpenApp can return a transaction thread this way:
 * the comment bumps the thread, so the parent expense report looks read on its own timestamps and the server leaves it out.
 */
function isUnreadThreadWithMissingParent(thread: OnyxEntry<Report>, reports: OnyxCollection<Report>): thread is Report & {reportID: string; parentReportID: string} {
    const parentReportID = thread?.parentReportID;
    if (!thread?.reportID || !parentReportID) {
        return false;
    }
    if (reports?.[`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`]?.reportID) {
        return false;
    }
    return (thread.lastVisibleActionCreated ?? '') > (thread.lastReadTime ?? '');
}

/**
 * Unread transaction threads from the latest report changes whose parent report is missing.
 * A comment thread is not included: the LHN can show that row on its own, and only a transaction thread is hidden in favor of its parent.
 */
function getMissingTransactionThreadParents(reportUpdates: OnyxCollection<Report> | undefined, reports: OnyxCollection<Report>): MissingTransactionThreadParent[] {
    const missingParents = new Map<string, MissingTransactionThreadParent>();
    for (const thread of Object.values(reportUpdates ?? {})) {
        if (!isUnreadThreadWithMissingParent(thread, reports) || missingParents.has(thread.parentReportID)) {
            continue;
        }
        if (!isTransactionThread(getReportAction(thread.parentReportID, thread.parentReportActionID))) {
            continue;
        }
        missingParents.set(thread.parentReportID, {threadReportID: thread.reportID, parentReportID: thread.parentReportID});
    }
    return [...missingParents.values()];
}

/** True when an OpenReport for this report is queued or already in flight, so a background fetch must not replace it. */
function hasOpenReportRequest(reportID: string): boolean {
    const isOpenReportForReport = (request: AnyRequest | null | undefined) => request?.command === WRITE_COMMANDS.OPEN_REPORT && request.data?.reportID === reportID;
    return getAllPersistedRequests().some(isOpenReportForReport) || isOpenReportForReport(getOngoingRequest());
}

/**
 * In Focus mode, OpenApp asks the server to return only the reports it considers relevant. A comment on a single-expense
 * report lands on its transaction thread, so the thread comes back unread while its parent, read by its own timestamps, is
 * left out. The LHN hides that thread in favor of the parent, so until the parent is in Onyx the comment shows as the wrong
 * row or not at all. This fetches each such parent once, without marking it read. Once the parent arrives, the existing LHN
 * logic shows the expense report as unread. The hook does nothing once the server starts returning the parent itself.
 */
function useFetchMissingTransactionThreadParents(
    reportUpdates: OnyxCollection<Report> | undefined,
    reports: OnyxCollection<Report>,
    priorityMode: PriorityMode,
    isOffline: boolean,
    currentReportID: string | undefined,
) {
    const openReport = useOpenReport();
    const openReportRef = useRef(openReport);

    // Parents requested this session. Pruned once the parent arrives, so a later cache clear in the same session can fetch again.
    const requestedParentReportIDs = useRef(new Set<string>());
    // Threads already logged for a missing parent action, so a repeat pass does not log the same gap again.
    const loggedThreadReportIDs = useRef(new Set<string>());
    // Report-action subscriptions for threads whose parent action was not readable yet. OpenApp can deliver the report
    // before the action reaches the module cache the LHN reads, so the action is checked again from Onyx itself.
    const actionConnections = useRef(new Map<string, ReturnType<typeof Onyx.connectWithoutView>>());
    const reportsRef = useRef(reports);
    const priorityModeRef = useRef(priorityMode);
    const isOfflineRef = useRef(isOffline);
    const currentReportIDRef = useRef(currentReportID);
    // The report list can arrive before Focus mode has loaded (it defaults to Most recent while loading). The changes
    // from that pass are not repeated, so the first time the gate opens we look at every report, and only the delta after that.
    const wasGateOpen = useRef(false);

    useEffect(() => {
        openReportRef.current = openReport;
    }, [openReport]);

    useEffect(() => {
        const connections = actionConnections.current;
        return () => {
            for (const connection of connections.values()) {
                Onyx.disconnect(connection);
            }
            connections.clear();
        };
    }, []);

    useEffect(() => {
        reportsRef.current = reports;
        priorityModeRef.current = priorityMode;
        isOfflineRef.current = isOffline;
        currentReportIDRef.current = currentReportID;

        const parentIsLoaded = (parentReportID: string) => !!reports?.[`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`]?.reportID;

        for (const parentReportID of requestedParentReportIDs.current) {
            if (parentIsLoaded(parentReportID)) {
                requestedParentReportIDs.current.delete(parentReportID);
            }
        }
        for (const [parentReportID, connection] of actionConnections.current) {
            if (!parentIsLoaded(parentReportID)) {
                continue;
            }
            Onyx.disconnect(connection);
            actionConnections.current.delete(parentReportID);
        }

        const requestParent = (threadReportID: string, parentReportID: string) => {
            // The open report is already fetched by ReportFetchHandler, and a queued OpenReport must keep its own read-state params.
            if (
                priorityModeRef.current !== CONST.PRIORITY_MODE.GSD ||
                isOfflineRef.current ||
                reportsRef.current?.[`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`]?.reportID ||
                requestedParentReportIDs.current.has(parentReportID) ||
                parentReportID === currentReportIDRef.current ||
                hasOpenReportRequest(parentReportID)
            ) {
                return;
            }
            requestedParentReportIDs.current.add(parentReportID);
            Log.info('[LHN] Fetching missing parent of unread transaction thread', false, {threadReportID, parentReportID});
            openReportRef.current({
                reportID: parentReportID,
                shouldMarkAsRead: false,
                shouldKeepManualUnreadMarker: true,
                hasReportActions: false,
            });
        };

        // Only Focus mode asks the server to filter OpenApp, so only there can a thread arrive without its parent.
        const gateOpen = priorityMode === CONST.PRIORITY_MODE.GSD && !isOffline;
        if (!gateOpen) {
            wasGateOpen.current = false;
            return;
        }
        const scanAllReports = !wasGateOpen.current;
        wasGateOpen.current = true;
        const reportsToCheck = scanAllReports ? reports : reportUpdates;
        if (!reportsToCheck) {
            return;
        }

        for (const {threadReportID, parentReportID} of getMissingTransactionThreadParents(reportsToCheck, reports)) {
            requestParent(threadReportID, parentReportID);
        }

        for (const thread of Object.values(reportsToCheck)) {
            if (
                !isUnreadThreadWithMissingParent(thread, reports) ||
                getReportAction(thread.parentReportID, thread.parentReportActionID) ||
                actionConnections.current.has(thread.parentReportID)
            ) {
                continue;
            }
            const {reportID: threadReportID, parentReportID, parentReportActionID} = thread;
            const connection = Onyx.connectWithoutView({
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${parentReportID}`,
                callback: (actions: OnyxEntry<ReportActions>) => {
                    if (!actions) {
                        return;
                    }
                    const parentAction = parentReportActionID ? actions[parentReportActionID] : undefined;
                    if (!parentAction) {
                        if (!loggedThreadReportIDs.current.has(threadReportID)) {
                            loggedThreadReportIDs.current.add(threadReportID);
                            Log.hmmm('[LHN] Unread thread without parent, parent action not in Onyx', {
                                threadReportID,
                                parentReportID,
                                parentReportActionID,
                            });
                        }
                        return;
                    }
                    const activeConnection = actionConnections.current.get(parentReportID);
                    if (activeConnection) {
                        Onyx.disconnect(activeConnection);
                        actionConnections.current.delete(parentReportID);
                    }
                    if (!isTransactionThread(parentAction)) {
                        return;
                    }
                    requestParent(threadReportID, parentReportID);
                },
            });
            actionConnections.current.set(parentReportID, connection);
        }
    }, [reportUpdates, reports, priorityMode, isOffline, currentReportID]);
}

export default useFetchMissingTransactionThreadParents;
export {getMissingTransactionThreadParents};
export type {MissingTransactionThreadParent};
