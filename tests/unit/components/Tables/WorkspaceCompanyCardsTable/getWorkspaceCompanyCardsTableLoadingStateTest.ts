import getWorkspaceCompanyCardsTableLoadingState from '@components/Tables/WorkspaceCompanyCardsTable/getWorkspaceCompanyCardsTableLoadingState';

describe('getWorkspaceCompanyCardsTableLoadingState', () => {
    const baseParams = {
        hasCards: false,
        isOffline: false,
        pageHasOnceLoaded: false,
        feedHasOnceLoaded: false,
        areWorkspaceCardFeedsLoading: false,
        selectedFeedStatusIsLoading: false,
        isInitiallyLoadingFeeds: false,
        isPolicyLoaded: true,
        isNoFeed: false,
        isLastSelectedFeedLoading: false,
        isPersonalDetailsLoading: false,
        feedName: 'oauth.chase.com',
    };

    it('shows loading on first cold load when workspace feeds are loading', () => {
        const loadingState = getWorkspaceCompanyCardsTableLoadingState({
            ...baseParams,
            areWorkspaceCardFeedsLoading: true,
        });

        expect(loadingState.isLoading).toBe(true);
        expect(loadingState.isLoadingPage).toBe(true);
    });

    it('does not show loading on revisit when optimistic workspace loading is true but page has once loaded', () => {
        const loadingState = getWorkspaceCompanyCardsTableLoadingState({
            ...baseParams,
            pageHasOnceLoaded: true,
            areWorkspaceCardFeedsLoading: true,
        });

        expect(loadingState.isLoading).toBe(false);
        expect(loadingState.isLoadingPage).toBe(false);
    });

    it('does not show loading on revisit when optimistic feed loading is true but feed has once loaded', () => {
        const loadingState = getWorkspaceCompanyCardsTableLoadingState({
            ...baseParams,
            feedHasOnceLoaded: true,
            selectedFeedStatusIsLoading: true,
        });

        expect(loadingState.isLoading).toBe(false);
        expect(loadingState.isLoadingFeed).toBe(false);
    });

    it('does not show loading when cards are already cached', () => {
        const loadingState = getWorkspaceCompanyCardsTableLoadingState({
            ...baseParams,
            hasCards: true,
            areWorkspaceCardFeedsLoading: true,
            selectedFeedStatusIsLoading: true,
        });

        expect(loadingState.isLoading).toBe(false);
        expect(loadingState.isLoadingFeed).toBe(false);
        expect(loadingState.isLoadingPage).toBe(false);
    });
});
