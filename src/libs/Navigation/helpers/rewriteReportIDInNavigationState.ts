import type {NavigationState} from '@react-navigation/native';
import {CommonActions} from '@react-navigation/native';
import Log from '@libs/Log';
import navigationRef from '@libs/Navigation/navigationRef';
import SCREENS from '@src/SCREENS';

const REPORT_ID_REWRITE_ROUTE_NAMES = new Set<string>([SCREENS.RIGHT_MODAL.SEARCH_REPORT, SCREENS.RIGHT_MODAL.EXPENSE_REPORT, SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT]);

function replaceReportIdInNavigationPath(path: string, oldReportId: string, newReportId: string): string {
    const escaped = oldReportId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const suffix = '(?=/|\\?|$)';
    const patterns: RegExp[] = [new RegExp(`(/r/)${escaped}${suffix}`, 'g'), new RegExp(`(search/view/)${escaped}${suffix}`, 'g'), new RegExp(`(search/r/)${escaped}${suffix}`, 'g')];
    let result = path;
    for (const re of patterns) {
        result = result.replace(re, (_, prefix: string) => `${prefix}${newReportId}`);
    }
    return result;
}

type RewriteReportIDInNavigationStateParams = {
    fromReportID: string;
    toReportID: string;
};

type RewrittenRouteInfo = {
    routeName: string;
    routeKey: string;
};

/**
 * Rewrites reportID (and embedded backTo URLs) on RHP routes in the navigation tree.
 * Uses per-route source/target dispatch so params update while a modal (e.g. receipt) is focused.
 */
function rewriteReportIDInNavigationState({fromReportID, toReportID}: RewriteReportIDInNavigationStateParams): number {
    const rootState = navigationRef.current?.getRootState();
    if (!rootState || !fromReportID || !toReportID || fromReportID === toReportID) {
        return 0;
    }

    const rewrittenRoutes: RewrittenRouteInfo[] = [];

    function walk(routes: NavigationState['routes'], navigatorKey?: string) {
        for (const route of routes) {
            const params = route.params as {reportID?: string; backTo?: string} | undefined;
            const routeReportID = params?.reportID?.toString();

            if (routeReportID === fromReportID && REPORT_ID_REWRITE_ROUTE_NAMES.has(route.name)) {
                const updatedParams: {reportID: string; backTo?: string} = {reportID: toReportID};
                if (typeof params?.backTo === 'string') {
                    updatedParams.backTo = replaceReportIdInNavigationPath(params.backTo, fromReportID, toReportID);
                }

                navigationRef.current?.dispatch({
                    ...CommonActions.setParams(updatedParams),
                    source: route.key,
                    ...(navigatorKey && {target: navigatorKey}),
                });
                rewrittenRoutes.push({routeName: route.name, routeKey: route.key});
            } else if (typeof params?.backTo === 'string' && params.backTo.includes(fromReportID)) {
                const updatedBackTo = replaceReportIdInNavigationPath(params.backTo, fromReportID, toReportID);
                if (updatedBackTo !== params.backTo) {
                    navigationRef.current?.dispatch({
                        ...CommonActions.setParams({backTo: updatedBackTo}),
                        source: route.key,
                        ...(navigatorKey && {target: navigatorKey}),
                    });
                    rewrittenRoutes.push({routeName: route.name, routeKey: route.key});
                }
            }

            if (route.state?.routes) {
                walk(route.state.routes as NavigationState['routes'], (route.state as NavigationState).key);
            }
        }
    }

    walk(rootState.routes, rootState.key);

    if (rewrittenRoutes.length > 0) {
        Log.info('[rewriteReportIDInNavigationState] Rewrote reportID in navigation state', false, {
            fromReportID,
            toReportID,
            rewrittenRouteCount: rewrittenRoutes.length,
            rewrittenRoutes,
        });
    }

    return rewrittenRoutes.length;
}

export {replaceReportIdInNavigationPath, rewriteReportIDInNavigationState};
