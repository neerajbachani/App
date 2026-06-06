import {useMemo} from 'react';
import type {OnyxCollection} from 'react-native-onyx';
import useOnyx from '@hooks/useOnyx';
import usePermissions from '@hooks/usePermissions';
import useSearchTypeMenuSections from '@hooks/useSearchTypeMenuSections';
import useSubscriptionPlan from '@hooks/useSubscriptionPlan';
import {shouldShowPolicy} from '@libs/PolicyUtils';
import {useIsAgentAccount} from '@libs/SessionUtils';
import {getAccountSearchRouterEntries} from '@pages/settings/accountSearchRouterEntries';
import {getWorkspaceSearchRouterEntries} from '@pages/workspace/workspaceSearchRouterEntries';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Policy} from '@src/types/onyx';
import type {NavigationCatalogEntry} from './navigationCatalogTypes';
import {getSpendNavigationCatalogEntries, getTopLevelNavigationCatalogEntries} from './navigationCatalogUtils';
import useCreateMenuSearchOptions from './useCreateMenuSearchOptions';

type UseNavigationSearchCatalogParams = {
    currentUserEmail: string | undefined;
    policies: OnyxCollection<Policy>;
};

function useNavigationSearchCatalog({currentUserEmail, policies}: UseNavigationSearchCatalogParams): NavigationCatalogEntry[] {
    const {typeMenuSections} = useSearchTypeMenuSections();
    const {isBetaEnabled} = usePermissions();
    const isRoomsBetaEnabled = isBetaEnabled(CONST.BETAS.WORKSPACE_ROOMS_PAGE);
    const isCustomAgentBetaEnabled = isBetaEnabled(CONST.BETAS.CUSTOM_AGENT);
    const isAgentAccount = useIsAgentAccount();
    const subscriptionPlan = useSubscriptionPlan();
    const [amountOwed] = useOnyx(ONYXKEYS.NVP_PRIVATE_AMOUNT_OWED);
    const createMenuEntries = useCreateMenuSearchOptions();

    return useMemo(() => {
        const topLevelEntries = getTopLevelNavigationCatalogEntries();
        const spendEntries = getSpendNavigationCatalogEntries(typeMenuSections);
        const accountEntries = getAccountSearchRouterEntries({
            isAgentAccount,
            isCustomAgentBetaEnabled,
            shouldShowSubscription: !isAgentAccount && (!!subscriptionPlan || (amountOwed ?? 0) > 0),
            shouldShowWallet: !isAgentAccount,
        });

        const workspaceEntries = Object.values(policies ?? {}).flatMap((policy) => {
            if (!policy || !shouldShowPolicy(policy, true, currentUserEmail)) {
                return [];
            }

            return getWorkspaceSearchRouterEntries(policy, {
                currentUserLogin: currentUserEmail,
                isRoomsBetaEnabled,
            });
        });

        return [...topLevelEntries, ...spendEntries, ...accountEntries, ...workspaceEntries, ...createMenuEntries];
    }, [amountOwed, createMenuEntries, currentUserEmail, isAgentAccount, isCustomAgentBetaEnabled, isRoomsBetaEnabled, policies, subscriptionPlan, typeMenuSections]);
}

export default useNavigationSearchCatalog;
