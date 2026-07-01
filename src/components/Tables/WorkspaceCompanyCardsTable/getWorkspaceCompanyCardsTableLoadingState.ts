type GetWorkspaceCompanyCardsTableLoadingStateParams = {
    /** Whether card rows are already present in the table */
    hasCards: boolean;

    /** Whether the user is offline */
    isOffline: boolean;

    /** Whether the company cards page has loaded successfully at least once */
    pageHasOnceLoaded?: boolean;

    /** Whether the selected feed has loaded successfully at least once */
    feedHasOnceLoaded: boolean;

    /** Whether workspace-level card feeds are loading */
    areWorkspaceCardFeedsLoading: boolean;

    /** Whether the selected feed status reports loading */
    selectedFeedStatusIsLoading: boolean;

    /** Whether feeds are still hydrating from Onyx */
    isInitiallyLoadingFeeds: boolean;

    /** Whether the policy is loaded */
    isPolicyLoaded: boolean;

    /** Whether the workspace has no company card feed */
    isNoFeed: boolean;

    /** Whether lastSelectedFeed Onyx metadata is loading */
    isLastSelectedFeedLoading: boolean;

    /** Whether personal details Onyx metadata is loading */
    isPersonalDetailsLoading: boolean;

    /** Selected feed name */
    feedName?: string;
};

type WorkspaceCompanyCardsTableLoadingState = {
    isLoadingFeed: boolean;
    isLoadingPage: boolean;
    isLoading: boolean;
};

/**
 * Computes table loading flags for the Company Cards page.
 * Transient optimistic isLoading flags are gated by frontend-only hasOnceLoaded markers
 * so background refetches do not re-flash the skeleton after the first successful load.
 */
function getWorkspaceCompanyCardsTableLoadingState({
    hasCards,
    isOffline,
    pageHasOnceLoaded,
    feedHasOnceLoaded,
    areWorkspaceCardFeedsLoading,
    selectedFeedStatusIsLoading,
    isInitiallyLoadingFeeds,
    isPolicyLoaded,
    isNoFeed,
    isLastSelectedFeedLoading,
    isPersonalDetailsLoading,
    feedName,
}: GetWorkspaceCompanyCardsTableLoadingStateParams): WorkspaceCompanyCardsTableLoadingState {
    const showWorkspaceFeedsLoading = !pageHasOnceLoaded && areWorkspaceCardFeedsLoading;
    const showFeedStatusLoading = !feedHasOnceLoaded && selectedFeedStatusIsLoading;

    const isLoadingFeed =
        !hasCards &&
        ((!feedName && isInitiallyLoadingFeeds) || !isPolicyLoaded || (!isNoFeed && isLastSelectedFeedLoading) || showFeedStatusLoading);

    const isLoadingPage = !isOffline && !hasCards && (isLoadingFeed || isPersonalDetailsLoading || showWorkspaceFeedsLoading);

    return {
        isLoadingFeed,
        isLoadingPage,
        isLoading: isLoadingPage || isLoadingFeed,
    };
}

export default getWorkspaceCompanyCardsTableLoadingState;
export type {GetWorkspaceCompanyCardsTableLoadingStateParams, WorkspaceCompanyCardsTableLoadingState};
