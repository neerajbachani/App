import {CurrentUserPersonalDetailsProvider} from '@components/CurrentUserPersonalDetailsProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';

import {CurrentReportIDContextProvider} from '@hooks/useCurrentReportID';
import {SidebarOrderedReportsContextProvider, useSidebarOrderedReports} from '@hooks/useSidebarOrderedReports';

import CONST from '@src/CONST';
import IntlStore from '@src/languages/IntlStore';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportAttributesDerivedValue} from '@src/types/onyx';

import React from 'react';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import Onyx from 'react-native-onyx';

const CURRENT_USER_ACCOUNT_ID = 5;
const CURRENT_USER_LOGIN = 'test@example.com';

function createUnreadChat(index: number): Report {
    const reportID = String(index);
    return {
        reportID,
        type: CONST.REPORT.TYPE.CHAT,
        reportName: `Unread chat ${reportID}`,
        lastMessageText: 'hello',
        lastVisibleActionCreated: '2025-01-20 12:30:03.784',
        isPinned: false,
        isOwnPolicyExpenseChat: false,
        participants: {
            [CURRENT_USER_ACCOUNT_ID]: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            18921695: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
        },
    } as Report;
}

function Probe({idsRef}: {idsRef: {current: string[]}}) {
    const {orderedReportIDs} = useSidebarOrderedReports();
    idsRef.current = orderedReportIDs;
    return null;
}

describe('useSidebarOrderedReports update depth', () => {
    beforeAll(async () => {
        jest.useRealTimers();
        Onyx.init({keys: ONYXKEYS});
        IntlStore.load(CONST.LOCALES.EN);
        await act(async () => {
            await Onyx.set(ONYXKEYS.SESSION, {accountID: CURRENT_USER_ACCOUNT_ID, email: CURRENT_USER_LOGIN});
        });
    });

    it('keeps the sidebar mounted through a microtask burst of unread-chat updates', async () => {
        const depthErrors: string[] = [];
        jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
            const message = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
            if (/Maximum update depth exceeded|Minified React error #185/.test(message)) {
                depthErrors.push(message);
            }
        });

        const reports: Record<string, Report> = {};
        for (let index = 1; index <= 8; index++) {
            const report = createUnreadChat(index);
            reports[`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`] = report;
        }
        const attributes: ReportAttributesDerivedValue = {
            reports: Object.fromEntries(
                Object.values(reports).map((report) => [
                    report.reportID,
                    {reportName: report.reportName, isEmpty: false, brickRoadStatus: undefined, requiresAttention: false, reportErrors: {}},
                ]),
            ),
        };

        await act(async () => {
            await Onyx.multiSet({
                [ONYXKEYS.SESSION]: {accountID: CURRENT_USER_ACCOUNT_ID, email: CURRENT_USER_LOGIN},
                [ONYXKEYS.NVP_PRIORITY_MODE]: CONST.PRIORITY_MODE.DEFAULT,
                [ONYXKEYS.BETAS]: [],
                [ONYXKEYS.DERIVED.REPORT_ATTRIBUTES]: attributes,
                [ONYXKEYS.DERIVED.GUIDE_ACCOUNT_IDS]: [],
                [ONYXKEYS.PERSONAL_DETAILS_LIST]: {[CURRENT_USER_ACCOUNT_ID]: {accountID: CURRENT_USER_ACCOUNT_ID, login: CURRENT_USER_LOGIN}},
                ...reports,
            });
        });

        const idsRef = {current: [] as string[]};
        const container = document.createElement('div');
        document.body.appendChild(container);
        let root: Root | undefined;
        await act(async () => {
            root = createRoot(container, {
                onUncaughtError: (error) => {
                    depthErrors.push(error instanceof Error ? error.message : String(error));
                },
            });
            root.render(
                <OnyxListItemProvider>
                    <CurrentUserPersonalDetailsProvider>
                        <CurrentReportIDContextProvider>
                            <SidebarOrderedReportsContextProvider>
                                <Probe idsRef={idsRef} />
                            </SidebarOrderedReportsContextProvider>
                        </CurrentReportIDContextProvider>
                    </CurrentUserPersonalDetailsProvider>
                </OnyxListItemProvider>,
            );
        });

        window.history.pushState({}, '', '/search');
        let chain = Promise.resolve();
        for (let index = 0; index < 120; index++) {
            chain = chain.then(() => {
                void Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}1`, {
                    lastVisibleActionCreated: `2026-10-13 23:52:${String(26 + (index % 30)).padStart(2, '0')}.${String(index).padStart(3, '0')}`,
                });
            });
        }
        await act(async () => {
            await chain;
            await new Promise((resolve) => {
                setTimeout(resolve, 50);
            });
        });

        expect(depthErrors).toEqual([]);
        expect(idsRef.current).toHaveLength(8);
        expect(idsRef.current).toEqual(expect.arrayContaining(['1', '2', '3', '4', '5', '6', '7', '8']));

        await act(async () => {
            root?.unmount();
        });
        container.remove();
        jest.restoreAllMocks();
    }, 60000);
});
