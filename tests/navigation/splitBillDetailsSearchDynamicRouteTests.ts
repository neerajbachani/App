import createDynamicRoute from '@libs/Navigation/helpers/dynamicRoutesUtils/createDynamicRoute';
import getDynamicRouteAdaptedState from '@libs/Navigation/helpers/dynamicRoutesUtils/getDynamicRouteAdaptedState';
import stripDynamicRouteSuffixFromPath from '@libs/Navigation/helpers/dynamicRoutesUtils/stripDynamicRouteSuffixFromPath';
import findFocusedRouteWithOnyxTabGuard from '@libs/Navigation/helpers/findFocusedRouteWithOnyxTabGuard';
import getStateFromPath from '@libs/Navigation/helpers/getStateFromPath';
import type {State} from '@libs/Navigation/types';

import type {Route} from '@src/ROUTES';
import {DYNAMIC_ROUTES} from '@src/ROUTES';
import SCREENS from '@src/SCREENS';

import type {NavigationState, PartialState} from '@react-navigation/native';

const CHAT_REPORT_ID = '1';
const REPORT_ACTION_ID = '2';
const SEARCH_QUERY = 'type:chat';
const SEARCH_PATH = `search?q=${encodeURIComponent(SEARCH_QUERY)}`;

function getFocusedRoute(path: string) {
    // These URLs are composed at runtime, so they are not entries in the production Route union.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return findFocusedRouteWithOnyxTabGuard(getStateFromPath(path as Route) as State);
}

function collectRouteNames(state: PartialState<NavigationState> | undefined, names: string[] = []): string[] {
    for (const route of state?.routes ?? []) {
        names.push(route.name);
        collectRouteNames(route.state, names);
    }
    return names;
}

describe('split bill details opened from Search', () => {
    const searchUrl = createDynamicRoute(DYNAMIC_ROUTES.SPLIT_BILL_DETAILS.getRoute(REPORT_ACTION_ID, CHAT_REPORT_ID), SEARCH_PATH);

    it('resolves the Search list URL to the split details screen with the chat and the action', () => {
        const route = getFocusedRoute(`search/split/${REPORT_ACTION_ID}?q=${encodeURIComponent(SEARCH_QUERY)}&reportID=${CHAT_REPORT_ID}`);

        expect(route?.name).toBe(SCREENS.SPLIT_DETAILS.DYNAMIC_ROOT);
        expect(route?.params).toMatchObject({reportID: CHAT_REPORT_ID, reportActionID: REPORT_ACTION_ID, q: SEARCH_QUERY});
    });

    it('strips the suffix and the reportID query, leaving the filtered Search list', () => {
        expect(stripDynamicRouteSuffixFromPath(searchUrl, DYNAMIC_ROUTES.SPLIT_BILL_DETAILS.path)).toBe(SEARCH_PATH);
    });

    it('rebuilds the filtered Search list underneath the split page on refresh', () => {
        const state = getStateFromPath(searchUrl);
        const adaptedState = getDynamicRouteAdaptedState(state, searchUrl);

        expect(collectRouteNames(adaptedState)).toContain(SCREENS.SEARCH.ROOT);
        expect(getFocusedRoute(searchUrl)?.name).toBe(SCREENS.SPLIT_DETAILS.DYNAMIC_ROOT);
    });

    it('keeps a report split URL free of the reportID query', () => {
        const reportUrl = createDynamicRoute(DYNAMIC_ROUTES.SPLIT_BILL_DETAILS.getRoute(REPORT_ACTION_ID), `r/${CHAT_REPORT_ID}`);

        expect(reportUrl).toBe(`r/${CHAT_REPORT_ID}/split/${REPORT_ACTION_ID}`);
        expect(getFocusedRoute(reportUrl)?.name).toBe(SCREENS.SPLIT_DETAILS.DYNAMIC_ROOT);
        expect(getFocusedRoute(reportUrl)?.params).toMatchObject({reportID: CHAT_REPORT_ID, reportActionID: REPORT_ACTION_ID});
    });
});
