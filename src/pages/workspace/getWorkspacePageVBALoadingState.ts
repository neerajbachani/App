type GetWorkspacePageVBALoadingStateParams = {
    /** Whether the page should skip the VBA API call */
    shouldSkipVBBACall: boolean;

    /** Whether the reimbursement account is loading */
    isReimbursementAccountLoading: boolean;

    /** Whether the workspace view has loaded successfully at least once for this policy */
    workspaceViewHasOnceLoaded?: boolean;
};

/**
 * Whether the workspace page should show the VBA loading indicator.
 * Transient reimbursementAccount.isLoading is gated by a frontend-only hasOnceLoaded marker
 * so background refetches do not re-flash the loader after the first successful load.
 */
function getWorkspacePageVBALoadingState({
    shouldSkipVBBACall,
    isReimbursementAccountLoading,
    workspaceViewHasOnceLoaded,
}: GetWorkspacePageVBALoadingStateParams): boolean {
    return !shouldSkipVBBACall && isReimbursementAccountLoading && !workspaceViewHasOnceLoaded;
}

export default getWorkspacePageVBALoadingState;
export type {GetWorkspacePageVBALoadingStateParams};
