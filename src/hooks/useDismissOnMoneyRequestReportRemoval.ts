import {useIsFocused} from '@react-navigation/native';
import {useEffect, useRef} from 'react';
import Log from '@libs/Log';
import {rewriteReportIDInNavigationState} from '@libs/Navigation/helpers/rewriteReportIDInNavigationState';
import {isMoneyRequestReport} from '@libs/ReportUtils';
import Navigation from '@navigation/Navigation';
import ONYXKEYS from '@src/ONYXKEYS';
import useOnyx from './useOnyx';
import usePrevious from './usePrevious';

type PendingRemovalLatch = {
    preexistingReportID?: string;
};

function tryRewriteMergedMoneyRequestReport(reportIDFromRoute: string | undefined, preexistingReportID: string | undefined): number {
    if (!reportIDFromRoute || !preexistingReportID) {
        return 0;
    }
    return rewriteReportIDInNavigationState({
        fromReportID: reportIDFromRoute,
        toReportID: preexistingReportID,
    });
}

/**
 * Dismisses the modal when a money request report is removed (e.g. deleted or merged).
 * Skips dismissal during route changes — the new report's data may not be loaded yet,
 * so the absent `report` should not be interpreted as removal.
 * If removal happens while the screen is blurred (e.g. receipt modal on top), latches and rewrites or dismisses once focused or after the receipt closes.
 */
function useDismissOnMoneyRequestReportRemoval(reportIDFromRoute: string | undefined) {
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportIDFromRoute}`);
    const prevReport = usePrevious(report);
    const prevReportIDFromRoute = usePrevious(reportIDFromRoute);
    const isFocused = useIsFocused();
    const firstRenderRef = useRef(true);
    const pendingRemovalLatchRef = useRef<PendingRemovalLatch | null>(null);
    const activeRoute = Navigation.getActiveRoute();
    const prevActiveRoute = usePrevious(activeRoute);
    const leftReceiptModal = !!prevActiveRoute?.includes('/receipt/') && !activeRoute.includes('/receipt/');

    useEffect(() => {
        if (prevReportIDFromRoute !== reportIDFromRoute) {
            pendingRemovalLatchRef.current = null;
        }
    }, [prevReportIDFromRoute, reportIDFromRoute]);

    useEffect(() => {
        if (firstRenderRef.current) {
            firstRenderRef.current = false;
            return;
        }

        if (prevReportIDFromRoute !== reportIDFromRoute) {
            return;
        }

        const isRemovalExpectedForReportType = !report && isMoneyRequestReport(prevReport);

        if (!isRemovalExpectedForReportType) {
            return;
        }

        const preexistingReportID = prevReport?.preexistingReportID;
        const isMergeIntoPreexisting = !!preexistingReportID;

        if (isMergeIntoPreexisting) {
            if (!isFocused) {
                pendingRemovalLatchRef.current = {preexistingReportID};
                const rewrittenRouteCount = tryRewriteMergedMoneyRequestReport(reportIDFromRoute, preexistingReportID);
                Log.info('[useDismissOnMoneyRequestReportRemoval] Money request merged while unfocused; latched for rewrite flush', false, {
                    reportIDFromRoute,
                    preexistingReportID,
                    rewrittenRouteCount,
                });
                return;
            }

            const rewrittenRouteCount = tryRewriteMergedMoneyRequestReport(reportIDFromRoute, preexistingReportID);
            Log.info('[useDismissOnMoneyRequestReportRemoval] Money request merged while focused; rewrote navigation instead of dismiss', false, {
                reportIDFromRoute,
                preexistingReportID,
                rewrittenRouteCount,
            });
            return;
        }

        if (!isFocused) {
            pendingRemovalLatchRef.current = {};
            Log.info('[useDismissOnMoneyRequestReportRemoval] Money request removed while unfocused; latched pending dismissal', false, {
                reportIDFromRoute,
            });
            return;
        }

        pendingRemovalLatchRef.current = null;
        Log.info('[useDismissOnMoneyRequestReportRemoval] Money request removed while focused; dismissing modal', false, {
            reportIDFromRoute,
        });
        Navigation.dismissModal();
    }, [report, isFocused, prevReport, prevReportIDFromRoute, reportIDFromRoute]);

    useEffect(() => {
        const latch = pendingRemovalLatchRef.current;
        if (!latch || report) {
            return;
        }
        if (prevReportIDFromRoute !== reportIDFromRoute) {
            return;
        }

        const shouldFlush = isFocused || leftReceiptModal;
        if (!shouldFlush) {
            return;
        }

        pendingRemovalLatchRef.current = null;

        if (latch.preexistingReportID) {
            const rewrittenRouteCount = tryRewriteMergedMoneyRequestReport(reportIDFromRoute, latch.preexistingReportID);
            Log.info('[useDismissOnMoneyRequestReportRemoval] Flushed latched merge rewrite after focus or receipt close', false, {
                reportIDFromRoute,
                preexistingReportID: latch.preexistingReportID,
                rewrittenRouteCount,
                isFocused,
                leftReceiptModal,
            });
            return;
        }

        Log.info('[useDismissOnMoneyRequestReportRemoval] Flushing latched dismissal after focus or receipt close', false, {
            reportIDFromRoute,
            isFocused,
            leftReceiptModal,
        });
        Navigation.dismissModal();
    }, [isFocused, leftReceiptModal, report, reportIDFromRoute, prevReportIDFromRoute]);
}

export default useDismissOnMoneyRequestReportRemoval;
