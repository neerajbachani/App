/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import React from 'react';
import {View} from 'react-native';
import CONST from '@src/CONST';
import LinkedActionNotFoundGuard from '@src/pages/inbox/LinkedActionNotFoundGuard';
import type {ReportAction} from '@src/types/onyx';

const REPORT_ID = '12345';
const REPORT_ACTION_ID = '67890';
const ROUTE_KEY = 'test-route-key';
const NAVIGATOR_KEY = 'test-navigator-key';

const mockSetParams = jest.fn();
const mockGoBack = jest.fn();
const mockCleanStaleBackToParam = jest.fn();
const mockIsNavigationReady = jest.fn(() => Promise.resolve());

jest.mock('@libs/Navigation/Navigation', () => ({
    __esModule: true,
    default: {
        setParams: (...args: unknown[]) => mockSetParams(...args),
        goBack: (...args: unknown[]) => mockGoBack(...args),
        getActiveRouteWithoutParams: jest.fn(() => ''),
        isNavigationReady: () => mockIsNavigationReady(),
    },
}));

jest.mock('@src/pages/inbox/cleanStaleReportActionBackToParam', () => ({
    __esModule: true,
    default: (...args: unknown[]) => mockCleanStaleBackToParam(...args),
}));

const mockRouteParams: {reportID?: string; reportActionID?: string} = {
    reportID: REPORT_ID,
    reportActionID: REPORT_ACTION_ID,
};

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useRoute: () => ({
            key: ROUTE_KEY,
            name: 'Report',
            params: mockRouteParams,
        }),
        useNavigation: () => ({
            getState: () => ({key: NAVIGATOR_KEY}),
        }),
    };
});

jest.mock('@hooks/useCurrentUserPersonalDetails', () => ({
    __esModule: true,
    default: () => ({accountID: 1}),
}));

jest.mock('@hooks/useReportIsArchived', () => ({
    __esModule: true,
    default: () => false,
}));

jest.mock('@hooks/useResponsiveLayout', () => ({
    __esModule: true,
    default: () => ({shouldUseNarrowLayout: mockShouldUseNarrowLayout}),
}));

let mockShouldUseNarrowLayout = false;

jest.mock('@hooks/useLazyAsset', () => ({
    useMemoizedLazyIllustrations: jest.fn(() => ({ToddBehindCloud: jest.fn()})),
}));

jest.mock('@libs/actions/StatsCounter', () => jest.fn());

jest.mock('@components/HeaderWithBackButton', () => {
    const React = require('react');
    const {Pressable, Text} = require('react-native');

    function MockHeaderWithBackButton({onBackButtonPress, shouldShowBackButton}: {onBackButtonPress?: () => void; shouldShowBackButton?: boolean}) {
        if (!shouldShowBackButton) {
            return null;
        }
        return React.createElement(Pressable, {testID: 'linked-action-not-found-back', onPress: onBackButtonPress}, React.createElement(Text, null, 'Back'));
    }
    MockHeaderWithBackButton.displayName = 'HeaderWithBackButton';
    return MockHeaderWithBackButton;
});

jest.mock('@libs/ReportActionsUtils', () => ({
    ...jest.requireActual('@libs/ReportActionsUtils'),
    isReportActionVisible: () => true,
    isWhisperAction: () => false,
}));

jest.mock('@libs/ReportUtils', () => ({
    ...jest.requireActual('@libs/ReportUtils'),
    canUserPerformWriteAction: () => true,
}));

// Mock useOnyx to control linked action, report, metadata, and derived values
type UseOnyxReturn = [unknown, {status: string}];
let mockLinkedAction: ReportAction | null | undefined;
let mockIsLoadingInitialReportActions: boolean;

jest.mock('@hooks/useOnyx', () => ({
    __esModule: true,
    default: (key: string): UseOnyxReturn => {
        if (key.startsWith('reportActions_')) {
            return [mockLinkedAction, {status: 'loaded'}];
        }
        if (key.startsWith('reportLoadingState_')) {
            return [mockIsLoadingInitialReportActions, {status: 'loaded'}];
        }
        if (key.startsWith('report_')) {
            return [{reportID: '12345', type: 'chat'}, {status: 'loaded'}];
        }
        // DERIVED.VISIBLE_REPORT_ACTIONS
        return [undefined, {status: 'loaded'}];
    },
}));

function createReportAction(overrides: Partial<ReportAction> = {}): ReportAction {
    return {
        reportActionID: REPORT_ACTION_ID,
        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        reportID: REPORT_ID,
        actorAccountID: 1,
        created: '2024-01-01 00:00:00',
        message: [{text: 'test', type: 'TEXT', html: 'test'}],
        ...overrides,
    } as ReportAction;
}

function TestChildren() {
    return <View />;
}

describe('LinkedActionNotFoundGuard', () => {
    beforeEach(() => {
        mockSetParams.mockClear();
        mockGoBack.mockClear();
        mockCleanStaleBackToParam.mockClear();
        mockIsNavigationReady.mockClear();
        mockShouldUseNarrowLayout = false;
        mockRouteParams.reportID = REPORT_ID;
        mockRouteParams.reportActionID = REPORT_ACTION_ID;
        mockLinkedAction = createReportAction();
        mockIsLoadingInitialReportActions = false;
    });

    it('renders children when linked action exists', () => {
        render(
            <LinkedActionNotFoundGuard>
                <TestChildren />
            </LinkedActionNotFoundGuard>,
        );

        expect(mockSetParams).not.toHaveBeenCalled();
    });

    it('clears reportActionID when linked action is completely removed from Onyx', () => {
        // Start with action present
        const {rerender} = render(
            <LinkedActionNotFoundGuard>
                <TestChildren />
            </LinkedActionNotFoundGuard>,
        );

        expect(mockSetParams).not.toHaveBeenCalled();

        // Now remove the action (simulating REPORT_PREVIEW being nulled when moving IOU to workspace)
        act(() => {
            mockLinkedAction = null;
        });

        rerender(
            <LinkedActionNotFoundGuard>
                <TestChildren />
            </LinkedActionNotFoundGuard>,
        );

        // The cleanup effect should clear reportActionID with the route key
        expect(mockSetParams).toHaveBeenCalledWith({reportActionID: undefined}, ROUTE_KEY, NAVIGATOR_KEY);
        expect(mockCleanStaleBackToParam).toHaveBeenCalledWith(REPORT_ID, REPORT_ACTION_ID);
    });

    it('does not navigate away when action disappears but was never visible', () => {
        // Action was never visible (null from the start)
        mockLinkedAction = null;
        mockIsLoadingInitialReportActions = false;

        render(
            <LinkedActionNotFoundGuard>
                <TestChildren />
            </LinkedActionNotFoundGuard>,
        );

        // wasEverVisible is false, so the cleanup effect should NOT fire
        expect(mockSetParams).not.toHaveBeenCalled();
    });

    it('passes route.key to setParams for proper targeting inside split navigators', () => {
        const {rerender} = render(
            <LinkedActionNotFoundGuard>
                <TestChildren />
            </LinkedActionNotFoundGuard>,
        );

        // Remove the action
        act(() => {
            mockLinkedAction = null;
        });

        rerender(
            <LinkedActionNotFoundGuard>
                <TestChildren />
            </LinkedActionNotFoundGuard>,
        );

        expect(mockSetParams).toHaveBeenCalledTimes(1);
        // Verify route.key is the second argument (needed for split navigator targeting)
        expect(mockSetParams).toHaveBeenCalledWith({reportActionID: undefined}, ROUTE_KEY, NAVIGATOR_KEY);
    });

    it('renders children without guard when no reportActionID in route', () => {
        mockRouteParams.reportActionID = undefined;

        render(
            <LinkedActionNotFoundGuard>
                <TestChildren />
            </LinkedActionNotFoundGuard>,
        );

        expect(mockSetParams).not.toHaveBeenCalled();
    });

    it('does not clear params while still loading report actions', () => {
        // Action is present initially
        const {rerender} = render(
            <LinkedActionNotFoundGuard>
                <TestChildren />
            </LinkedActionNotFoundGuard>,
        );

        // Action disappears but loading is still in progress
        act(() => {
            mockLinkedAction = null;
            mockIsLoadingInitialReportActions = true;
        });

        rerender(
            <LinkedActionNotFoundGuard>
                <TestChildren />
            </LinkedActionNotFoundGuard>,
        );

        // Should not navigate away while loading — the action might come back
        expect(mockSetParams).not.toHaveBeenCalled();
    });

    it('clears reportActionID on back press when linked action not found (does not call Navigation.goBack)', () => {
        mockShouldUseNarrowLayout = true;
        mockLinkedAction = null;
        mockIsLoadingInitialReportActions = true;

        const {rerender} = render(
            <LinkedActionNotFoundGuard>
                <TestChildren />
            </LinkedActionNotFoundGuard>,
        );

        act(() => {
            mockIsLoadingInitialReportActions = false;
        });

        rerender(
            <LinkedActionNotFoundGuard>
                <TestChildren />
            </LinkedActionNotFoundGuard>,
        );

        fireEvent.press(screen.getByTestID('linked-action-not-found-back'));

        expect(mockSetParams).toHaveBeenCalledWith({reportActionID: undefined}, ROUTE_KEY, NAVIGATOR_KEY);
        expect(mockGoBack).not.toHaveBeenCalled();
    });
});
