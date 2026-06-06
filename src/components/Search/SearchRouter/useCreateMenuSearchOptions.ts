import {Str} from 'expensify-common';
import {useCallback, useMemo, useState} from 'react';
import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import useCreateReport from '@hooks/useCreateReport';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useMappedPolicies from '@hooks/useMappedPolicies';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import usePermissions from '@hooks/usePermissions';
import usePreferredPolicy from '@hooks/usePreferredPolicy';
import {startDistanceRequest, startMoneyRequest} from '@libs/actions/IOU/MoneyRequest';
import {createNewReport, startNewChat} from '@libs/actions/Report';
import getIconForAction from '@libs/getIconForAction';
import interceptAnonymousUser from '@libs/interceptAnonymousUser';
import getCreateReportRoute, {getReportsRootRoute, navigateToCreateReportWorkspaceSelection} from '@libs/Navigation/helpers/getCreateReportRoute';
import isOnSearchMoneyRequestReportPage from '@libs/Navigation/helpers/isOnSearchMoneyRequestReportPage';
import Navigation from '@libs/Navigation/Navigation';
import {openTravelDotLink} from '@libs/openTravelDotLink';
import Permissions from '@libs/Permissions';
import {canSendInvoice as canSendInvoicePolicyUtils, getDefaultChatEnabledPolicy, isGroupPolicy, isPaidGroupPolicy, shouldShowPolicy} from '@libs/PolicyUtils';
import {generateReportID, hasViolations as hasViolationsReportUtils} from '@libs/ReportUtils';
import {clearLastSearchParams} from '@userActions/ReportNavigation';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import {primaryLoginSelector} from '@src/selectors/Account';
import {policyMapper} from '@src/selectors/Policy';
import {emailSelector, sessionEmailAndAccountIDSelector} from '@src/selectors/Session';
import {validTransactionDraftIDsSelector} from '@src/selectors/TransactionDraft';
import type * as OnyxTypes from '@src/types/onyx';
import type {NavigationCatalogEntry} from './navigationCatalogTypes';

type CreateMenuCatalogEntry = NavigationCatalogEntry & {
    titleKey: TranslationPaths;
};

function useCreateMenuSearchOptions(): NavigationCatalogEntry[] {
    const {translate} = useLocalize();
    const icons = useMemoizedLazyExpensifyIcons(['Coins', 'Receipt', 'Cash', 'Transfer', 'MoneyCircle', 'Location', 'Document', 'ChatBubble', 'InvoiceGeneric', 'Suitcase', 'NewWorkspace']);
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const {isBetaEnabled} = usePermissions();
    const isASAPSubmitBetaEnabled = isBetaEnabled(CONST.BETAS.ASAP_SUBMIT);

    const [reportID] = useState(() => generateReportID());
    const [session] = useOnyx(ONYXKEYS.SESSION, {selector: sessionEmailAndAccountIDSelector});
    const [sessionEmail] = useOnyx(ONYXKEYS.SESSION, {selector: emailSelector});
    const [allBetas] = useOnyx(ONYXKEYS.BETAS);
    const [transactionViolations] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS);
    const [draftTransactionIDs] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_DRAFT, {selector: validTransactionDraftIDsSelector});
    const [lastDistanceExpenseType] = useOnyx(ONYXKEYS.NVP_LAST_DISTANCE_EXPENSE_TYPE);
    const [activePolicyID] = useOnyx(ONYXKEYS.NVP_ACTIVE_POLICY_ID);
    const [activePolicy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${activePolicyID}`);
    const [travelSettings] = useOnyx(ONYXKEYS.NVP_TRAVEL_SETTINGS);
    const [primaryLogin] = useOnyx(ONYXKEYS.ACCOUNT, {selector: primaryLoginSelector});
    const [isLoadingApp = false] = useOnyx(ONYXKEYS.IS_LOADING_APP);
    const [allMappedPolicies] = useMappedPolicies(policyMapper);
    const {isOffline} = useNetwork();
    const {isRestrictedPolicyCreation} = usePreferredPolicy();

    const chatEnabledPaidGroupPoliciesSelector = useCallback(
        (policies: OnyxCollection<OnyxTypes.Policy>) => {
            if (!policies) {
                return CONST.EMPTY_ARRAY;
            }

            const result: OnyxTypes.Policy[] = [];
            for (const policy of Object.values(policies)) {
                if (!policy?.isPolicyExpenseChatEnabled || policy?.isJoinRequestPending || !isGroupPolicy(policy) || !shouldShowPolicy(policy, false, session?.email)) {
                    continue;
                }

                result.push(policy);

                if (result.length === 2) {
                    break;
                }
            }

            return result;
        },
        [session?.email],
    );

    const [groupPoliciesWithChatEnabled = CONST.EMPTY_ARRAY] = useOnyx(ONYXKEYS.COLLECTION.POLICY, {selector: chatEnabledPaidGroupPoliciesSelector}, [session?.email]);
    const defaultChatEnabledPolicy = getDefaultChatEnabledPolicy(groupPoliciesWithChatEnabled as Array<OnyxEntry<OnyxTypes.Policy>>, activePolicy);
    const hasViolations = hasViolationsReportUtils(undefined, transactionViolations, session?.accountID ?? CONST.DEFAULT_NUMBER_ID, session?.email ?? '');
    const isReportInSearch = isOnSearchMoneyRequestReportPage();

    const handleCreateWorkspaceReport = useCallback(
        (shouldDismissEmptyReportsConfirmation?: boolean) => {
            if (!defaultChatEnabledPolicy?.id) {
                return;
            }

            if (isReportInSearch) {
                clearLastSearchParams();
            }

            const {reportID: createdReportID} = createNewReport(
                currentUserPersonalDetails,
                hasViolations,
                isASAPSubmitBetaEnabled,
                defaultChatEnabledPolicy,
                allBetas,
                false,
                shouldDismissEmptyReportsConfirmation,
            );
            Navigation.navigate(getReportsRootRoute(), {forceReplace: isReportInSearch});
            Navigation.setNavigationActionToMicrotaskQueue(() => {
                Navigation.navigate(getCreateReportRoute({reportID: createdReportID}), {forceReplace: isReportInSearch});
            });
        },
        [allBetas, currentUserPersonalDetails, defaultChatEnabledPolicy, hasViolations, isASAPSubmitBetaEnabled, isReportInSearch],
    );

    const {createReport, isVisible: isCreateReportVisible} = useCreateReport({
        onCreateReport: handleCreateWorkspaceReport,
        groupPoliciesWithChatEnabled,
        onNavigateToWorkspaceSelection: () => navigateToCreateReportWorkspaceSelection({forceReplace: isReportInSearch}),
        shouldHandleNavigationBack: false,
    });

    const canSendInvoice = canSendInvoicePolicyUtils(allMappedPolicies as OnyxCollection<OnyxTypes.Policy>, sessionEmail);
    const isBlockedFromSpotnanaTravel = Permissions.isBetaEnabled(CONST.BETAS.PREVENT_SPOTNANA_TRAVEL, allBetas);
    const primaryContactMethod = primaryLogin ?? sessionEmail ?? '';
    const isPolicyProvisioned = activePolicy?.travelSettings?.spotnanaCompanyID ?? activePolicy?.travelSettings?.associatedTravelDomainAccountID;
    const isTravelVisible = !!activePolicy?.isTravelEnabled;
    const isTravelEnabled =
        !isBlockedFromSpotnanaTravel &&
        !!primaryContactMethod &&
        !Str.isSMSLogin(primaryContactMethod) &&
        isPaidGroupPolicy(activePolicy) &&
        (activePolicy?.travelSettings?.hasAcceptedTerms ?? (travelSettings?.hasAcceptedTerms && isPolicyProvisioned));
    const shouldShowNewWorkspaceButton =
        !isRestrictedPolicyCreation && Object.values(allMappedPolicies ?? {}).every((policy) => !shouldShowPolicy(policy as OnyxEntry<OnyxTypes.Policy>, !!isOffline, sessionEmail));
    const isNewWorkspaceVisible = !isLoadingApp && shouldShowNewWorkspaceButton;

    return useMemo(() => {
        const options: Array<CreateMenuCatalogEntry & {isVisible: boolean}> = [
            {
                id: CONST.FAB_MENU_ITEM_IDS.EXPENSE,
                category: 'create',
                titleKey: 'iou.createExpense',
                icon: getIconForAction(CONST.IOU.TYPE.CREATE, icons),
                keywords: ['expense', 'submit', 'receipt', 'scan'],
                isVisible: true,
                shouldUseGoToPrefix: false,
                onSelectAction: () => interceptAnonymousUser(() => startMoneyRequest(CONST.IOU.TYPE.CREATE, reportID, draftTransactionIDs, undefined, undefined, undefined, true)),
            },
            {
                id: CONST.FAB_MENU_ITEM_IDS.TRACK_DISTANCE,
                category: 'create',
                titleKey: 'iou.trackDistance',
                icon: icons.Location,
                keywords: ['distance', 'mileage', 'miles', 'drive'],
                isVisible: true,
                shouldUseGoToPrefix: false,
                onSelectAction: () =>
                    interceptAnonymousUser(() => startDistanceRequest(CONST.IOU.TYPE.CREATE, reportID, draftTransactionIDs, lastDistanceExpenseType, undefined, undefined, true)),
            },
            {
                id: CONST.FAB_MENU_ITEM_IDS.CREATE_REPORT,
                category: 'create',
                titleKey: 'report.newReport.createReport',
                icon: icons.Document,
                keywords: ['report'],
                isVisible: isCreateReportVisible,
                shouldUseGoToPrefix: false,
                onSelectAction: createReport,
            },
            {
                id: CONST.FAB_MENU_ITEM_IDS.NEW_CHAT,
                category: 'create',
                titleKey: 'sidebarScreen.fabNewChat',
                icon: icons.ChatBubble,
                keywords: ['chat', 'message', 'dm'],
                isVisible: true,
                shouldUseGoToPrefix: false,
                onSelectAction: () => interceptAnonymousUser(startNewChat),
            },
            {
                id: CONST.FAB_MENU_ITEM_IDS.INVOICE,
                category: 'create',
                titleKey: 'workspace.invoices.sendInvoice',
                icon: icons.InvoiceGeneric,
                keywords: ['invoice', 'bill'],
                isVisible: canSendInvoice,
                shouldUseGoToPrefix: false,
                onSelectAction: () => interceptAnonymousUser(() => startMoneyRequest(CONST.IOU.TYPE.INVOICE, reportID, draftTransactionIDs, undefined, undefined, undefined, true)),
            },
            {
                id: CONST.FAB_MENU_ITEM_IDS.TRAVEL,
                category: 'create',
                titleKey: 'travel.bookTravel',
                icon: icons.Suitcase,
                keywords: ['travel', 'trip', 'flight', 'hotel'],
                isVisible: isTravelVisible,
                shouldUseGoToPrefix: false,
                onSelectAction: () =>
                    interceptAnonymousUser(() => {
                        if (isTravelEnabled) {
                            openTravelDotLink(activePolicy?.id);
                            return;
                        }
                        Navigation.navigate(ROUTES.TRAVEL_MY_TRIPS.getRoute(activePolicy?.id));
                    }),
            },
            {
                id: CONST.FAB_MENU_ITEM_IDS.NEW_WORKSPACE,
                category: 'create',
                titleKey: 'workspace.new.newWorkspace',
                icon: icons.NewWorkspace,
                keywords: ['workspace'],
                isVisible: isNewWorkspaceVisible,
                shouldUseGoToPrefix: false,
                shouldIconApplyFill: false,
                onSelectAction: () => interceptAnonymousUser(() => Navigation.navigate(ROUTES.WORKSPACE_CONFIRMATION.getRoute(Navigation.getActiveRoute()))),
            },
        ];

        return options
            .filter((option) => option.isVisible)
            .map(({isVisible: _isVisible, ...entry}) => ({
                ...entry,
                title: translate(entry.titleKey),
            }));
    }, [
        activePolicy?.id,
        canSendInvoice,
        createReport,
        draftTransactionIDs,
        isCreateReportVisible,
        isNewWorkspaceVisible,
        isTravelEnabled,
        isTravelVisible,
        lastDistanceExpenseType,
        reportID,
        icons,
        translate,
    ]);
}

export default useCreateMenuSearchOptions;
