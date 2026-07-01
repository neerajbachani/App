import getWorkspacePageVBALoadingState from '@pages/workspace/getWorkspacePageVBALoadingState';

describe('getWorkspacePageVBALoadingState', () => {
    it('shows loading on first cold load when reimbursement account is loading', () => {
        expect(
            getWorkspacePageVBALoadingState({
                shouldSkipVBBACall: false,
                isReimbursementAccountLoading: true,
                workspaceViewHasOnceLoaded: false,
            }),
        ).toBe(true);
    });

    it('does not show loading on revisit when optimistic loading is true but workspace view has once loaded', () => {
        expect(
            getWorkspacePageVBALoadingState({
                shouldSkipVBBACall: false,
                isReimbursementAccountLoading: true,
                workspaceViewHasOnceLoaded: true,
            }),
        ).toBe(false);
    });

    it('does not show loading when VBA call is skipped', () => {
        expect(
            getWorkspacePageVBALoadingState({
                shouldSkipVBBACall: true,
                isReimbursementAccountLoading: true,
                workspaceViewHasOnceLoaded: false,
            }),
        ).toBe(false);
    });
});
