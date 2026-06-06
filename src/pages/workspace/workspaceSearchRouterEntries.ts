import type {ExpensifyIconName} from '@components/Icon/ExpensifyIconLoader';
import type {NavigationCatalogEntry} from '@components/Search/SearchRouter/navigationCatalogTypes';
import {isAnyHRConnected} from '@libs/HRUtils';
import {canMemberRead, canPolicyAccessFeature, hasAccountingFeatureConnection, isGroupPolicy, isTimeTrackingEnabled} from '@libs/PolicyUtils';
import type {PolicyFeature} from '@libs/PolicyUtils';
import {getDefaultWorkspaceAvatar} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ROUTES from '@src/ROUTES';
import type {Policy} from '@src/types/onyx';
import type {PolicyFeatureName} from '@src/types/onyx/Policy';

type WorkspaceSearchRouterContext = {
    currentUserLogin: string | undefined;
    isRoomsBetaEnabled: boolean;
};

type WorkspacePageDescriptor = {
    titleKey: TranslationPaths;
    iconName: ExpensifyIconName;
    getRoute: (policyID: string) => string;
    requiresProtected?: boolean;
    feature?: PolicyFeatureName;
    isAvailable?: (context: WorkspaceSearchRouterContext) => boolean;
};

const WORKSPACE_PAGE_DESCRIPTORS: WorkspacePageDescriptor[] = [
    {titleKey: 'workspace.common.profile', iconName: 'Building', getRoute: (policyID) => ROUTES.WORKSPACE_OVERVIEW.getRoute(policyID)},
    {titleKey: 'workspace.common.members', iconName: 'Users', getRoute: (policyID) => ROUTES.WORKSPACE_MEMBERS.getRoute(policyID)},
    {
        titleKey: 'workspace.common.rooms',
        iconName: 'Hashtag',
        getRoute: (policyID) => ROUTES.WORKSPACE_ROOMS.getRoute(policyID),
        isAvailable: ({isRoomsBetaEnabled}) => isRoomsBetaEnabled,
    },
    {
        titleKey: 'common.reports',
        iconName: 'Document',
        getRoute: (policyID) => ROUTES.WORKSPACE_REPORTS.getRoute(policyID),
        requiresProtected: true,
    },
    {
        titleKey: 'workspace.common.accounting',
        iconName: 'Sync',
        getRoute: (policyID) => ROUTES.POLICY_ACCOUNTING.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.ARE_CONNECTIONS_ENABLED,
    },
    {
        titleKey: 'workspace.common.hr',
        iconName: 'Users',
        getRoute: (policyID) => ROUTES.WORKSPACE_HR.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.IS_HR_ENABLED,
    },
    {
        titleKey: 'workspace.common.receiptPartners',
        iconName: 'Receipt',
        getRoute: (policyID) => ROUTES.WORKSPACE_RECEIPT_PARTNERS.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.ARE_RECEIPT_PARTNERS_ENABLED,
    },
    {
        titleKey: 'workspace.common.categories',
        iconName: 'Folder',
        getRoute: (policyID) => ROUTES.WORKSPACE_CATEGORIES.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.ARE_CATEGORIES_ENABLED,
    },
    {
        titleKey: 'workspace.common.tags',
        iconName: 'Tag',
        getRoute: (policyID) => ROUTES.WORKSPACE_TAGS.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.ARE_TAGS_ENABLED,
    },
    {
        titleKey: 'workspace.common.taxes',
        iconName: 'Coins',
        getRoute: (policyID) => ROUTES.WORKSPACE_TAXES.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.ARE_TAXES_ENABLED,
    },
    {
        titleKey: 'workspace.common.workflows',
        iconName: 'Workflows',
        getRoute: (policyID) => ROUTES.WORKSPACE_WORKFLOWS.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.ARE_WORKFLOWS_ENABLED,
    },
    {
        titleKey: 'workspace.common.rules',
        iconName: 'Feed',
        getRoute: (policyID) => ROUTES.WORKSPACE_RULES.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.ARE_RULES_ENABLED,
    },
    {
        titleKey: 'workspace.common.distanceRates',
        iconName: 'Car',
        getRoute: (policyID) => ROUTES.WORKSPACE_DISTANCE_RATES.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.ARE_DISTANCE_RATES_ENABLED,
    },
    {
        titleKey: 'workspace.common.travel',
        iconName: 'LuggageWithLines',
        getRoute: (policyID) => ROUTES.WORKSPACE_TRAVEL.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.IS_TRAVEL_ENABLED,
    },
    {
        titleKey: 'workspace.common.expensifyCard',
        iconName: 'ExpensifyCard',
        getRoute: (policyID) => ROUTES.WORKSPACE_EXPENSIFY_CARD.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.ARE_EXPENSIFY_CARDS_ENABLED,
    },
    {
        titleKey: 'workspace.common.companyCards',
        iconName: 'CreditCard',
        getRoute: (policyID) => ROUTES.WORKSPACE_COMPANY_CARDS.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.ARE_COMPANY_CARDS_ENABLED,
    },
    {
        titleKey: 'common.perDiem',
        iconName: 'CalendarSolid',
        getRoute: (policyID) => ROUTES.WORKSPACE_PER_DIEM.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.ARE_PER_DIEM_RATES_ENABLED,
    },
    {
        titleKey: 'iou.time',
        iconName: 'Clock',
        getRoute: (policyID) => ROUTES.WORKSPACE_TIME_TRACKING.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.IS_TIME_TRACKING_ENABLED,
    },
    {
        titleKey: 'workspace.common.invoices',
        iconName: 'InvoiceGeneric',
        getRoute: (policyID) => ROUTES.WORKSPACE_INVOICES.getRoute(policyID),
        requiresProtected: true,
        feature: CONST.POLICY.MORE_FEATURES.ARE_INVOICES_ENABLED,
    },
    {titleKey: 'workspace.common.moreFeatures', iconName: 'Gear', getRoute: (policyID) => ROUTES.WORKSPACE_MORE_FEATURES.getRoute(policyID), requiresProtected: true},
];

const PROTECTED_POLICY_FEATURES: PolicyFeature[] = [
    CONST.POLICY.POLICY_FEATURE.REPORT_FIELDS,
    CONST.POLICY.POLICY_FEATURE.ACCOUNTING,
    CONST.POLICY.POLICY_FEATURE.CATEGORIES,
    CONST.POLICY.POLICY_FEATURE.TAGS,
    CONST.POLICY.POLICY_FEATURE.TAXES,
    CONST.POLICY.POLICY_FEATURE.WORKFLOWS,
    CONST.POLICY.POLICY_FEATURE.RULES,
    CONST.POLICY.POLICY_FEATURE.DISTANCE_RATES,
    CONST.POLICY.POLICY_FEATURE.EXPENSIFY_CARD,
    CONST.POLICY.POLICY_FEATURE.COMPANY_CARDS,
    CONST.POLICY.POLICY_FEATURE.PER_DIEM,
    CONST.POLICY.POLICY_FEATURE.MORE_FEATURES,
];

function getPolicyFeatureStates(policy: Policy) {
    return {
        [CONST.POLICY.MORE_FEATURES.ARE_DISTANCE_RATES_ENABLED]: policy.areDistanceRatesEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_WORKFLOWS_ENABLED]: policy.areWorkflowsEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_CATEGORIES_ENABLED]: policy.areCategoriesEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_TAGS_ENABLED]: policy.areTagsEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_TAXES_ENABLED]: policy.tax?.trackingEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_COMPANY_CARDS_ENABLED]: policy.areCompanyCardsEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_CONNECTIONS_ENABLED]: !!policy.areConnectionsEnabled || hasAccountingFeatureConnection(policy),
        [CONST.POLICY.MORE_FEATURES.IS_HR_ENABLED]: (policy.isHREnabled === true || isAnyHRConnected(policy)) && canPolicyAccessFeature(policy, CONST.POLICY.MORE_FEATURES.IS_HR_ENABLED),
        [CONST.POLICY.MORE_FEATURES.ARE_EXPENSIFY_CARDS_ENABLED]: policy.areExpensifyCardsEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_REPORT_FIELDS_ENABLED]: policy.areReportFieldsEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_RULES_ENABLED]: policy.areRulesEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_INVOICES_ENABLED]: policy.areInvoicesEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_PER_DIEM_RATES_ENABLED]: policy.arePerDiemRatesEnabled && canPolicyAccessFeature(policy, CONST.POLICY.MORE_FEATURES.ARE_PER_DIEM_RATES_ENABLED),
        [CONST.POLICY.MORE_FEATURES.ARE_RECEIPT_PARTNERS_ENABLED]: policy.receiptPartners?.enabled ?? false,
        [CONST.POLICY.MORE_FEATURES.IS_TRAVEL_ENABLED]: policy.isTravelEnabled,
        [CONST.POLICY.MORE_FEATURES.IS_TIME_TRACKING_ENABLED]: isTimeTrackingEnabled(policy),
    } as Record<PolicyFeatureName, boolean | undefined>;
}

function getWorkspaceSearchRouterEntries(policy: Policy, context: WorkspaceSearchRouterContext): NavigationCatalogEntry[] {
    const canReadPolicyFeature = (policyFeature: PolicyFeature) => canMemberRead(policy, context.currentUserLogin ?? '', policyFeature);
    const canReadMoreFeatures = canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.MORE_FEATURES);
    const shouldShowProtectedItems = PROTECTED_POLICY_FEATURES.some(canReadPolicyFeature);
    const featureStates = getPolicyFeatureStates(policy);
    const canEditSettings = isGroupPolicy(policy) && shouldShowProtectedItems;

    const workspaceAvatar = {
        source: policy.avatarURL ? policy.avatarURL : getDefaultWorkspaceAvatar(policy.name),
        name: policy.name ?? '',
        id: policy.id,
    };

    return WORKSPACE_PAGE_DESCRIPTORS.flatMap((descriptor) => {
        if (descriptor.requiresProtected && !canEditSettings) {
            return [];
        }

        if (descriptor.feature && !featureStates[descriptor.feature]) {
            return [];
        }

        if (descriptor.isAvailable && !descriptor.isAvailable(context)) {
            return [];
        }

        if (descriptor.titleKey === 'common.reports' && !canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.REPORT_FIELDS)) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.accounting' && !canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.ACCOUNTING)) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.categories' && !canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.CATEGORIES)) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.tags' && !canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.TAGS)) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.taxes' && !canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.TAXES)) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.workflows' && !canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.WORKFLOWS)) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.rules' && !canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.RULES)) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.distanceRates' && !canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.DISTANCE_RATES)) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.expensifyCard' && !canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.EXPENSIFY_CARD)) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.companyCards' && !canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.COMPANY_CARDS)) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.perDiem' && !canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.PER_DIEM)) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.hr' && !canReadMoreFeatures) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.receiptPartners' && !canReadMoreFeatures) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.travel' && !canReadMoreFeatures) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.invoices' && !canReadMoreFeatures) {
            return [];
        }

        if (descriptor.titleKey === 'workspace.common.moreFeatures' && !canReadMoreFeatures) {
            return [];
        }

        if (descriptor.titleKey === 'iou.time' && !canReadMoreFeatures) {
            return [];
        }

        return [
            {
                id: `workspace-${policy.id}-${descriptor.titleKey}`,
                category: 'workspace' as const,
                titleKey: descriptor.titleKey,
                iconName: descriptor.iconName,
                route: descriptor.getRoute(policy.id),
                shouldUseGoToPrefix: true,
                rightText: policy.name,
                rightAvatar: workspaceAvatar,
            },
        ];
    });
}

const WORKSPACE_SEARCH_ROUTER_ICON_NAMES = Array.from(new Set(WORKSPACE_PAGE_DESCRIPTORS.map((descriptor) => descriptor.iconName)));

export {getWorkspaceSearchRouterEntries, WORKSPACE_SEARCH_ROUTER_ICON_NAMES};
export type {WorkspaceSearchRouterContext};
