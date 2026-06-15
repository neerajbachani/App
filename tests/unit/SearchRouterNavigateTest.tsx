import type * as NativeNavigation from '@react-navigation/native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import React, {useMemo} from 'react';
import Onyx from 'react-native-onyx';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import {OptionsListActionsContext, OptionsListStateContext} from '@components/OptionListContextProvider';
import SearchAutocompleteList from '@components/Search/SearchAutocompleteList';
import type {SearchQueryItem} from '@components/Search/SearchList/ListItem/SearchQueryListItem';
import SearchRouter from '@components/Search/SearchRouter/SearchRouter';
import type {PrivateIsArchivedMap} from '@hooks/usePrivateIsArchivedMap';
import type * as OptionsListUtilsModule from '@libs/OptionsListUtils';
import {createOptionList} from '@libs/OptionsListUtils';
import Navigation from '@navigation/Navigation';
import ComposeProviders from '@src/components/ComposeProviders';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {PersonalDetails, Report} from '@src/types/onyx';
import createCollection from '../utils/collections/createCollection';
import createPersonalDetails from '../utils/collections/personalDetails';
import createRandomPolicy from '../utils/collections/policies';
import {createRandomReport} from '../utils/collections/reports';
import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';
import wrapOnyxWithWaitForBatchedUpdates from '../utils/wrapOnyxWithWaitForBatchedUpdates';

jest.mock('lodash/debounce', () =>
    jest.fn((fn: Record<string, jest.Mock>) => {
        // eslint-disable-next-line no-param-reassign
        fn.cancel = jest.fn();
        return fn;
    }),
);

jest.mock('@src/libs/Log');

jest.mock('@src/libs/API', () => ({
    write: jest.fn(),
    makeRequestWithSideEffects: jest.fn(),
    read: jest.fn(),
}));

jest.mock('@components/Search/DeferredSearchAutocompleteList', () => {
    const module = jest.requireActual<{default: React.ComponentType}>('@components/Search/SearchAutocompleteList');
    return {
        __esModule: true,
        default: module.default,
    };
});

jest.mock('@src/libs/Navigation/Navigation', () => ({
    dismissModalWithReport: jest.fn(),
    getActiveRouteWithoutParams: jest.fn(() => ''),
    getTopmostReportId: jest.fn(),
    isNavigationReady: jest.fn(() => Promise.resolve()),
    isDisplayedInModal: jest.fn(() => false),
    navigate: jest.fn(),
    setNavigationActionToMicrotaskQueue: jest.fn((callback: () => void) => callback()),
}));

jest.mock('@src/hooks/useRootNavigationState', () => ({
    __esModule: true,
    default: () => ({contextualReportID: undefined, isSearchRouterScreen: false}),
}));

jest.mock('@hooks/useExportedToFilterOptions', () => ({
    __esModule: true,
    default: () => ({
        exportedToFilterOptions: [],
        combinedUniqueExportTemplates: [],
        connectedIntegrationNames: new Set<string>(),
    }),
}));

const mockUseFilteredOptions = jest.fn();
jest.mock('@hooks/useFilteredOptions', () => ({
    __esModule: true,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    default: (...args: unknown[]) => mockUseFilteredOptions(...args),
}));

jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual<typeof NativeNavigation>('@react-navigation/native');
    return {
        ...actualNav,
        useFocusEffect: jest.fn(),
        useIsFocused: () => true,
        useRoute: () => jest.fn(),
        usePreventRemove: () => jest.fn(),
        useNavigation: () => ({
            navigate: jest.fn(),
            addListener: () => jest.fn(),
        }),
        createNavigationContainerRef: () => ({
            addListener: () => jest.fn(),
            removeListener: () => jest.fn(),
            isReady: () => jest.fn(),
            getCurrentRoute: () => jest.fn(),
            getState: () => jest.fn(),
        }),
        useNavigationState: () => ({
            routes: [],
        }),
    };
});

jest.mock('@src/components/ConfirmedRoute.tsx');

const getMockedReports = (length = 10) =>
    createCollection<Report>(
        (item) => `${ONYXKEYS.COLLECTION.REPORT}${item.reportID}`,
        (index) => createRandomReport(index, undefined),
        length,
    );

const getMockedPersonalDetails = (length = 10) =>
    createCollection<PersonalDetails>(
        (item) => item.accountID,
        (index) => createPersonalDetails(index),
        length,
    );

const mockedReports = getMockedReports(10);
const mockedBetas = Object.values(CONST.BETAS);
const mockedPersonalDetails = getMockedPersonalDetails(10);
const EMPTY_PRIVATE_IS_ARCHIVED_MAP: PrivateIsArchivedMap = {};
const mockedOptions = createOptionList(mockedPersonalDetails, EMPTY_PRIVATE_IS_ARCHIVED_MAP, mockedReports, undefined);

const mockOnClose = jest.fn();

function SearchRouterWrapper({options = mockedOptions}: {options?: ReturnType<typeof createOptionList>}) {
    return (
        <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider]}>
            <OptionsListStateContext.Provider value={useMemo(() => ({options, areOptionsInitialized: true}), [options])}>
                <OptionsListActionsContext.Provider value={useMemo(() => ({initializeOptions: () => {}, resetOptions: () => {}}), [])}>
                    <SearchRouter onRouterClose={mockOnClose} />
                </OptionsListActionsContext.Provider>
            </OptionsListStateContext.Provider>
        </ComposeProviders>
    );
}

async function flushAllUpdates() {
    for (let i = 0; i < 10; i++) {
        await act(async () => {
            jest.advanceTimersByTime(100);
            await waitForBatchedUpdates();
        });
    }
}

describe('SearchRouter NAVIGATE regressions', () => {
    beforeAll(() => {
        Onyx.init({
            keys: ONYXKEYS,
            evictableKeys: [ONYXKEYS.COLLECTION.REPORT],
        });
    });

    beforeEach(() => {
        jest.useFakeTimers();
        global.fetch = TestHelper.getGlobalFetchMock();
        wrapOnyxWithWaitForBatchedUpdates(Onyx);
        mockUseFilteredOptions.mockReturnValue({
            options: mockedOptions,
            isLoading: false,
            loadMore: jest.fn(),
            hasMore: false,
            isLoadingMore: false,
        });
    });

    afterEach(async () => {
        await act(async () => {
            await Onyx.clear();
        });
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it('should navigate to another workspace members page via microtask queue and close the router', async () => {
        const policyA = createRandomPolicy(1, CONST.POLICY.TYPE.TEAM, 'Workspace A');
        const policyB = createRandomPolicy(2, CONST.POLICY.TYPE.TEAM, 'Workspace B');

        await waitForBatchedUpdates();
        await Onyx.multiSet({
            ...mockedReports,
            [ONYXKEYS.PERSONAL_DETAILS_LIST]: mockedPersonalDetails,
            [ONYXKEYS.BETAS]: mockedBetas,
            [`${ONYXKEYS.COLLECTION.POLICY}1`]: policyA,
            [`${ONYXKEYS.COLLECTION.POLICY}2`]: policyB,
        });

        render(<SearchRouterWrapper />);
        await flushAllUpdates();

        const textInput = screen.getByTestId('search-autocomplete-text-input');
        fireEvent.changeText(textInput, 'members');
        await flushAllUpdates();

        await waitFor(() => {
            expect(screen.getAllByText('Workspace B').length).toBeGreaterThan(0);
        });

        fireEvent.press(screen.getAllByText('Workspace B').at(0) as ReturnType<typeof screen.getAllByText>[number]);

        expect(Navigation.setNavigationActionToMicrotaskQueue).toHaveBeenCalled();
        expect(Navigation.navigate).toHaveBeenCalledWith(ROUTES.WORKSPACE_MEMBERS.getRoute('2'));
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should render NAVIGATE items from getAdditionalSections and reset focus when the query changes', async () => {
        const onListItemPress = jest.fn();
        const navigationItems: SearchQueryItem[] = [
            {
                text: 'Go to Members',
                rightText: 'Workspace B',
                keyForList: `${CONST.SEARCH.SEARCH_ROUTER_ITEM_TYPE.NAVIGATE}-workspace-2-workspace.common.members`,
                searchItemType: CONST.SEARCH.SEARCH_ROUTER_ITEM_TYPE.NAVIGATE,
                route: ROUTES.WORKSPACE_MEMBERS.getRoute('2'),
            },
        ];

        const {rerender} = render(
            <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider]}>
                <SearchAutocompleteList
                    autocompleteQueryValue=""
                    handleSearch={jest.fn()}
                    onListItemPress={onListItemPress}
                    getAdditionalSections={() => undefined}
                />
            </ComposeProviders>,
        );

        rerender(
            <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider]}>
                <SearchAutocompleteList
                    autocompleteQueryValue="members"
                    handleSearch={jest.fn()}
                    onListItemPress={onListItemPress}
                    getAdditionalSections={() => [{sectionIndex: 1, data: navigationItems}]}
                    searchQueryItems={[
                        {
                            text: 'members',
                            searchQuery: 'members',
                            keyForList: CONST.SEARCH.SEARCH_ROUTER_ITEM_TYPE.FIND_ITEM,
                            searchItemType: CONST.SEARCH.SEARCH_ROUTER_ITEM_TYPE.SEARCH,
                        },
                    ]}
                    shouldHighlightFirstItem
                />
            </ComposeProviders>,
        );

        await flushAllUpdates();

        expect(screen.getByText('Go to Members')).toBeTruthy();
        fireEvent.press(screen.getByText('Go to Members'));
        expect(onListItemPress).toHaveBeenCalledWith(
            expect.objectContaining({
                searchItemType: CONST.SEARCH.SEARCH_ROUTER_ITEM_TYPE.NAVIGATE,
                route: ROUTES.WORKSPACE_MEMBERS.getRoute('2'),
            }),
        );
    });
});
