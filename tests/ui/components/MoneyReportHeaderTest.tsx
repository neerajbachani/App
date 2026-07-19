import {render} from '@testing-library/react-native';

import MoneyReportHeader from '@components/MoneyReportHeader';

import useMobileSelectionMode from '@hooks/useMobileSelectionMode';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useTransactionsAndViolationsForReport from '@hooks/useTransactionsAndViolationsForReport';

import {turnOffMobileSelectionMode} from '@libs/actions/MobileSelectionMode';

import type {Transaction} from '@src/types/onyx';

import {useIsFocused} from '@react-navigation/native';
import React from 'react';

// Regression coverage for https://github.com/Expensify/App/issues/95132. A MoneyReportHeader that stays mounted in the
// navigation stack must not turn off the global mobile selection mode while it is unfocused, otherwise selection mode
// enabled by another screen (e.g. Expense rules opened from the report) is immediately cancelled.

jest.mock('@react-navigation/native', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const actualNavigation = jest.requireActual('@react-navigation/native');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
        ...actualNavigation,
        __esModule: true,
        useRoute: jest.fn(() => ({name: 'Report', params: {}})),
        useIsFocused: jest.fn(() => true),
    };
});

jest.mock('@hooks/useMobileSelectionMode', () => ({__esModule: true, default: jest.fn(() => true)}));
jest.mock('@hooks/useResponsiveLayout', () => ({
    __esModule: true,
    default: jest.fn(() => ({shouldUseNarrowLayout: true, isSmallScreenWidth: true, isMediumScreenWidth: false, isInLandscapeMode: false})),
}));
jest.mock('@hooks/useResponsiveLayoutOnWideRHP', () => ({
    __esModule: true,
    default: jest.fn(() => ({isWideRHPDisplayedOnWideLayout: false, isSuperWideRHPDisplayedOnWideLayout: false})),
}));
jest.mock('@hooks/useNetwork', () => ({__esModule: true, default: jest.fn(() => ({isOffline: false}))}));
jest.mock('@hooks/useTransactionsAndViolationsForReport', () => ({__esModule: true, default: jest.fn(() => ({transactions: {}, violations: {}}))}));
jest.mock('@hooks/useReportPrimaryAction', () => ({__esModule: true, default: jest.fn(() => '')}));
jest.mock('@hooks/useThemeStyles', () => ({__esModule: true, default: jest.fn(() => ({}))}));
jest.mock('@hooks/useLocalize', () => ({__esModule: true, default: jest.fn(() => ({translate: (key: string) => key}))}));
jest.mock('@hooks/useOnyx', () => ({__esModule: true, default: jest.fn(() => [undefined, {status: 'loaded'}])}));

jest.mock('@libs/actions/MobileSelectionMode', () => ({
    __esModule: true,
    turnOffMobileSelectionMode: jest.fn(),
    turnOnMobileSelectionMode: jest.fn(),
}));

jest.mock('@components/MoneyReportHeaderModals', () => ({__esModule: true, default: ({children}: {children: React.ReactNode}) => children}));
jest.mock('@components/PaymentAnimationsContext', () => ({__esModule: true, PaymentAnimationsProvider: ({children}: {children: React.ReactNode}) => children}));
jest.mock('@components/HeaderWithBackButton', () => ({__esModule: true, default: () => null}));
jest.mock('@components/HeaderLoadingBar', () => ({__esModule: true, default: () => null}));
jest.mock('@components/MoneyReportHeaderActions', () => ({__esModule: true, default: () => null}));
jest.mock('@components/MoneyReportHeaderMoreContent', () => ({__esModule: true, default: () => null}));
jest.mock('@components/MoneyRequestReportView/MoneyRequestReportNavigation', () => ({__esModule: true, default: () => null}));
jest.mock('@components/MoneyRequestReportView/MoneyRequestReportTransactionsNavigation', () => ({__esModule: true, default: () => null}));
jest.mock('@components/Search/SearchContext', () => ({__esModule: true, useSearchSelectionActions: jest.fn(() => ({clearSelectedTransactions: jest.fn()}))}));

const mockedUseIsFocused = jest.mocked(useIsFocused);
const mockedUseMobileSelectionMode = jest.mocked(useMobileSelectionMode);
const mockedUseTransactions = jest.mocked(useTransactionsAndViolationsForReport);
const mockedTurnOffMobileSelectionMode = jest.mocked(turnOffMobileSelectionMode);

function mockSingleTransaction() {
    mockedUseTransactions.mockReturnValue({
        transactions: {transaction1: {transactionID: 'transaction1'} as Transaction},
        violations: {},
    } as ReturnType<typeof useTransactionsAndViolationsForReport>);
}

describe('MoneyReportHeader mobile selection mode', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedUseMobileSelectionMode.mockReturnValue(true);
        jest.mocked(useResponsiveLayout).mockReturnValue({
            shouldUseNarrowLayout: true,
            isSmallScreenWidth: true,
            isMediumScreenWidth: false,
            isInLandscapeMode: false,
        } as ReturnType<typeof useResponsiveLayout>);
        mockSingleTransaction();
    });

    it('does not turn off selection mode when the header is not focused', () => {
        mockedUseIsFocused.mockReturnValue(false);

        render(
            <MoneyReportHeader
                reportID="1001"
                onBackButtonPress={jest.fn()}
            />,
        );

        expect(mockedTurnOffMobileSelectionMode).not.toHaveBeenCalled();
    });

    it('turns off selection mode for a single-transaction report when the header is focused', () => {
        mockedUseIsFocused.mockReturnValue(true);

        render(
            <MoneyReportHeader
                reportID="1001"
                onBackButtonPress={jest.fn()}
            />,
        );

        expect(mockedTurnOffMobileSelectionMode).toHaveBeenCalled();
    });
});
