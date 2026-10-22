import {fireEvent, render, screen} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import {CurrentUserPersonalDetailsProvider} from '@components/CurrentUserPersonalDetailsProvider';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';

import {navigateToAndOpenChildReport} from '@libs/actions/Report';
import Navigation from '@libs/Navigation/Navigation';

import ReportActionItemThread from '@pages/inbox/report/ReportActionItemThread';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Report, ReportAction} from '@src/types/onyx';

import React from 'react';
import Onyx from 'react-native-onyx';

import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

jest.mock('@libs/Navigation/Navigation', () => ({
    navigate: jest.fn(),
    getActiveRoute: jest.fn(() => 'home'),
}));

jest.mock('@libs/Navigation/helpers/isSearchTopmostFullScreenRoute', () => () => false);

jest.mock('@libs/actions/Report', () => ({
    ...jest.requireActual<typeof import('@libs/actions/Report')>('@libs/actions/Report'),
    navigateToAndOpenChildReport: jest.fn(),
}));

const mockNavigate = jest.mocked(Navigation.navigate);
const mockNavigateToAndOpenChildReport = jest.mocked(navigateToAndOpenChildReport);

const CURRENT_USER_ACCOUNT_ID = 1;
const PARENT_REPORT_ID = 'concierge-report';
const TICKET_REPORT_ID = 'support-ticket-report';
const CHAT_THREAD_REPORT_ID = 'chat-thread-report';

const parentReport: Report = {
    reportID: PARENT_REPORT_ID,
    type: CONST.REPORT.TYPE.CHAT,
};

function createThreadedAction(reportActionID: string, childReportID: string, childType?: string): ReportAction {
    return {
        reportActionID,
        reportID: PARENT_REPORT_ID,
        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        actorAccountID: CURRENT_USER_ACCOUNT_ID,
        created: '2026-10-23 00:00:00.000',
        message: [{type: 'COMMENT', html: 'Need help', text: 'Need help'}],
        childReportID,
        childType,
        childVisibleActionCount: 2,
        childCommenterCount: 1,
        childOldestFourAccountIDs: String(CURRENT_USER_ACCOUNT_ID),
        childLastVisibleActionCreated: '2026-10-23 00:05:00.000',
    };
}

async function renderThread(reportAction: ReportAction) {
    render(
        <ComposeProviders components={[OnyxListItemProvider, CurrentUserPersonalDetailsProvider, LocaleContextProvider]}>
            <ReportActionItemThread
                report={parentReport}
                reportAction={reportAction}
                isHovered={false}
                isEditingInline={false}
                onSecondaryInteraction={() => undefined}
            />
        </ComposeProviders>,
    );
    await waitForBatchedUpdatesWithAct();
}

function readReport(reportID: string): Promise<Report | null | undefined> {
    return new Promise((resolve) => {
        const connection = Onyx.connectWithoutView({
            key: `${ONYXKEYS.COLLECTION.REPORT}${reportID}`,
            callback: (value) => {
                Onyx.disconnect(connection);
                resolve(value);
            },
        });
    });
}

describe('ReportActionItemThread', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        mockNavigate.mockClear();
        mockNavigateToAndOpenChildReport.mockClear();
        await Onyx.clear();
        await Onyx.merge(ONYXKEYS.SESSION, {accountID: CURRENT_USER_ACCOUNT_ID});
        await waitForBatchedUpdatesWithAct();
    });

    it('opens a support ticket without writing an optimistic chat over it', async () => {
        // Given a ticket preview whose ticket report has not been loaded
        const ticketAction = createThreadedAction('ticket-preview', TICKET_REPORT_ID, CONST.REPORT.TYPE.SUPPORT_TICKET);
        await renderThread(ticketAction);

        // When the replies row under the preview is pressed
        fireEvent.press(screen.getByLabelText('2 Replies'));
        await waitForBatchedUpdatesWithAct();

        // Then the row opens the ticket the same way the card does, and the ticket key stays empty
        expect(mockNavigate).toHaveBeenCalledWith(ROUTES.REPORT_WITH_ID.getRoute(TICKET_REPORT_ID, undefined, undefined, 'home'));
        expect(mockNavigateToAndOpenChildReport).not.toHaveBeenCalled();
        expect(await readReport(TICKET_REPORT_ID)).toBeUndefined();
    });

    it('keeps the child-report flow for a regular thread', async () => {
        // Given a normal comment whose thread report has not been loaded
        const chatAction = createThreadedAction('chat-comment', CHAT_THREAD_REPORT_ID, CONST.REPORT.TYPE.CHAT);
        await renderThread(chatAction);

        // When the replies row under the comment is pressed
        fireEvent.press(screen.getByLabelText('2 Replies'));
        await waitForBatchedUpdatesWithAct();

        // Then the row still opens the thread through the shared child-report flow
        expect(mockNavigateToAndOpenChildReport).toHaveBeenCalledTimes(1);
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
