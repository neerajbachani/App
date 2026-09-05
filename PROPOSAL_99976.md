## Proposal

### Please re-state the problem that we are trying to solve in this issue.

With Debug mode enabled and an account-level indicator lit (e.g. a broken payment card), the debug banner at the bottom of the Workspaces tab covers content underneath it on wide layouts. On the Workspaces list, scrolling to the end leaves the last workspace row partially hidden and unreachable. On the Domains list — flagged separately by @suneox — the same banner uses the wrong width, wraps to two lines in the bottom-left gutter, and appears clipped against the viewport edge. The banner should never overlap list content; the last row on both roots must stay fully visible and clickable.

### What is the root cause of that problem?

The overlap is not payment-specific. Any status that `getSettingsMessage` maps to a debug string reproduces the same placement path. A broken card is just one way to light the indicator.

The structural cause is that `DebugTabView` reconstructs its own geometry by hand — left offset from the nav rail, right edge from `windowWidth`, and a one-screen whitelist to choose full-width vs sidebar-width — then paints that box as an absolutely positioned overlay the page underneath never reserves space for.

**1. Vertical — the reported Workspaces overlap**

On wide layouts the banner is taken out of flow with `styles.pAbsolute`, pinned to `bottom: 0`, and raised above page content:

App/src/components/Navigation/DebugTabView.tsx
Lines 221 to 237 in 5c08345e734
```
     let positionStyle: {bottom?: number; top?: number; left: number; right?: number; width?: number};
     const verticalAnchor = selectedTab === NAVIGATION_TABS.SETTINGS && !shouldUseNarrowLayout ? {top: 0} : {bottom: 0};
     if (shouldUseNarrowLayout) {
         positionStyle = {bottom: 0, left: 0, right: 0};
     } else if (isOnFullWidthTabRoot) {
         positionStyle = {...verticalAnchor, left: variables.navigationTabBarSize, width: windowWidth - variables.navigationTabBarSize};
     } else {
         positionStyle = {...verticalAnchor, left: variables.navigationTabBarSize, width: variables.sideBarWithLHBWidth - variables.cropBorderWidth};
     }

     // pAbsolute is only applied on wide layouts. On narrow layout the bar is placed by its parent
     // (above the bottom tab bar), so detaching it with absolute positioning breaks both the FAB
     // and the DebugTabView's own placement.
     return (
         <View
             testID="DebugTabViewContainer"
             style={[shouldUseNarrowLayout ? positionStyle : {...styles.pAbsolute, ...positionStyle}]}
```
https://github.com/Expensify/App/blob/5c08345e734e7204e2d73bfa49a04ca94793c0d8/src/components/Navigation/DebugTabView.tsx#L221-L237

App/src/libs/Navigation/AppNavigator/Navigators/TabNavigatorBar.tsx
Lines 87 to 94 in 5c08345e734
```
    // When the screen is not blocking the view, we need to raise the tab bar above the screen content so the DebugTabView is visible.
    return (
        <View
            style={[styles.tabNavigatorBarContainer, !isBlockingViewVisible && {zIndex: 1}]}
            pointerEvents="box-none"
        >
            <NavigationTabBar selectedTab={selectedTab} />
        </View>
    );
```
https://github.com/Expensify/App/blob/5c08345e734e7204e2d73bfa49a04ca94793c0d8/src/libs/Navigation/AppNavigator/Navigators/TabNavigatorBar.tsx#L87-L94

Neither `WorkspacesListPage` nor the shared `WorkspaceListLayout` column reserves the banner's height — the flex column runs to the viewport bottom and ends with the in-flow offline indicator only:

App/src/components/WorkspaceListLayout.tsx
Lines 115 to 126 in 5c08345e734
```
            <View style={[styles.flex1, styles.flexRow]}>
                <View style={[styles.flex1]}>
                    <TopBarWithLoadingBar
                        shouldDisplayHelpButton
                        breadcrumbLabel={activeTabLabel}
                    >
                        {!scrollHeaderWithTable && <View style={[styles.pr3]}>{!shouldDisplayButtonsInSeparateLine && headerButton}</View>}
                    </TopBarWithLoadingBar>

                    {content}
                    {!shouldUseNarrowLayout && <OfflineIndicator style={styles.pl5} />}
                </View>
            </View>
```
https://github.com/Expensify/App/blob/5c08345e734e7204e2d73bfa49a04ca94793c0d8/src/components/WorkspaceListLayout.tsx#L115-L126

The table underneath only reserves `styles.pb4` (16px) plus safe area — it has no knowledge of the overlay:

App/src/components/Table/TableBody.tsx
Lines 144 to 148 in 5c08345e734
```
    const tableBodyContentContainerStyle = useBottomSafeSafeAreaPaddingStyle({
        addBottomSafeAreaPadding: true,
        addOfflineIndicatorBottomSafeAreaPadding: true,
        style: shouldUseNarrowTableLayout ? styles.pb20 : styles.pb4,
    });
```
https://github.com/Expensify/App/blob/5c08345e734e7204e2d73bfa49a04ca94793c0d8/src/components/Table/TableBody.tsx#L144-L148

At maximum scroll the last row's bottom sits ~16px above the viewport bottom while the banner occupies 64px (`styles.p3` = 12 top + 12 bottom around a 40px `componentSizeNormal` button). Roughly 48px of the last 56px row sits behind the bar with no scroll left to recover it. This regression started when PR #89893 moved the wide-layout banner out of flow so it would not push tab content; the Workspaces list never established a matching layout contract.

Narrow layouts are unaffected because the banner renders in flow above the bottom tab bar there, which matches why only desktop Chrome/Safari are checked on the report.

**2. Horizontal — Domains (@suneox's comment)**

The full-width predicate is scoped to exactly one screen:

App/src/components/Navigation/DebugTabView.tsx
Lines 154 to 163 in 5c08345e734
```
    const isOnFullWidthTabRoot = useRootNavigationState((rootState) => {
        const activeRoute = getActiveTabRoute(rootState);
        if (!activeRoute) {
            return false;
        }
        const focusedLeaf = getFocusedLeafScreenName(activeRoute.state) ?? activeRoute.name;
        // Scoped to WORKSPACES_LIST — the only full-width tab root among the three tabs
        // (Inbox/Settings/Workspaces) gated by the tab filter further below.
        return focusedLeaf === SCREENS.WORKSPACES_LIST;
    });
```
https://github.com/Expensify/App/blob/5c08345e734e7204e2d73bfa49a04ca94793c0d8/src/components/Navigation/DebugTabView.tsx#L154-L163

`SCREENS.DOMAINS_LIST` is a second full-width root of the same Workspaces tab — same `WorkspaceNavigator`, same `WorkspaceListLayout` — but it is missing from that whitelist. Domains therefore falls into the `else` branch and gets sidebar-width geometry (`sideBarWithLHBWidth - cropBorderWidth` = 319px) intended for the Inbox LHN and workspace LHB. Domains has no sidebar, so a 319px box lands in the bottom-left content gutter and the message wraps to two lines.

I verified this against @suneox's screenshot by pixel-measuring against the code's own constants (scale from the 20px `lh20` line pitch): bar left edge at 72, width ≈319, height ≈64, bottom flush with the viewport — exactly the `else`-branch numbers.

Note: several posted proposals claim the Domains bar is *taller* than the Workspaces bar because it wraps, so a 64px constant under-reserves. It is not taller. Inner height is `max(Button 40, 2 lines × 20 = 40)` = 40, plus 12 + 12 = **64 on both roots**. Wrapping only adds height at three or more lines.

**3. Horizontal — side panel (Concierge open)**

The tab navigator card is registered as `fullScreenTabPage` with `applySidePanelOffset: true`:

App/src/libs/Navigation/AppNavigator/useRootNavigatorScreenOptions.ts
Lines 112 to 119 in 5c08345e734
```
        fullScreenTabPage: {
            ...commonScreenOptions,
            // We need to turn off animation for the full screen to avoid delay when closing screens.
            animation: Animations.NONE,
            web: {
                cardStyleInterpolator: (props: StackCardInterpolationProps) => modalCardStyleInterpolator({props, enter: {kind: 'none'}, applySidePanelOffset: true}),
                cardStyle: shouldUseNarrowLayout ? StyleUtils.getStyleWithEnvSafeAreaPadding(StyleUtils.getNavigationModalCardStyle()) : {...themeStyles.h100, width: '100%'},
            },
        },
```
https://github.com/Expensify/App/blob/5c08345e734e7204e2d73bfa49a04ca94793c0d8/src/libs/Navigation/AppNavigator/useRootNavigatorScreenOptions.ts#L112-L119

which sets `cardStyle.paddingRight = sidePanelOffset` (375px):

App/src/libs/Navigation/AppNavigator/useModalCardStyleInterpolator.ts
Lines 45 to 49 in 5c08345e734
```
        const cardStyle = StyleUtils.getCardStyles(screen.width);

        if (applySidePanelOffset) {
            cardStyle.paddingRight = sidePanelOffset.current;
        }
```
https://github.com/Expensify/App/blob/5c08345e734e7204e2d73bfa49a04ca94793c0d8/src/libs/Navigation/AppNavigator/useModalCardStyleInterpolator.ts#L45-L49

`useWindowDimensions` is not side-panel aware, so on `WORKSPACES_LIST` with Concierge open — the state in @suneox's screenshot — `width: windowWidth - navigationTabBarSize` overruns the tab card's content box by 375px and runs under the fixed side panel.

### What changes do you think we should make in order to solve the problem?

Fix the geometry first, then reserve a deterministic 64px in the shared layout. Once both Workspaces and Domains use the full-width branch, the minimum wide-layout bar is `801 − 72 = 729px`, leaving ample room for a single-line message. The reservation is then exact and race-free — no context, no `onLayout`, no first-frame gap.

**Change 1 — `DebugTabView.tsx`: correct geometry**

Replace the single-screen whitelist with a set covering both tab roots, and subtract the side panel offset from the full-width width:

```diff
+const FULL_WIDTH_TAB_ROOT_SCREENS = new Set([SCREENS.WORKSPACES_LIST, SCREENS.DOMAINS_LIST]);

     const isOnFullWidthTabRoot = useRootNavigationState((rootState) => {
         ...
-        return focusedLeaf === SCREENS.WORKSPACES_LIST;
+        return FULL_WIDTH_TAB_ROOT_SCREENS.has(focusedLeaf);
     });

+    const {shouldHideSidePanel} = useSidePanelDisplayStatus();
+    const {isExtraLargeScreenWidth} = useResponsiveLayout();
+    const sidePanelOffset = isExtraLargeScreenWidth && !shouldHideSidePanel ? variables.sidePanelWidth : 0;

     ...
     } else if (isOnFullWidthTabRoot) {
-        positionStyle = {...verticalAnchor, left: variables.navigationTabBarSize, width: windowWidth - variables.navigationTabBarSize};
+        positionStyle = {...verticalAnchor, left: variables.navigationTabBarSize, width: windowWidth - variables.navigationTabBarSize - sidePanelOffset};
     }
```

Export `getSettingsMessage`, add `minHeight: variables.debugTabViewHeight` to the inner bar `View`, and export a `useDebugTabViewHeight()` hook that returns the constant only when the bar truly renders (see Change 2 gate).

**Change 2 — `variables.ts` + `useDebugTabViewHeight()`**

Add next to `bottomTabHeight`:

```diff
     bottomTabHeight: 72,
+    // styles.p3 (12) on each side of the DebugTabView row plus the View button (componentSizeNormal).
+    debugTabViewHeight: 64,
```

Hook (exported from `DebugTabView.tsx`):

```ts
function useDebugTabViewHeight(): number {
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const [isDebugModeEnabled] = useOnyx(ONYXKEYS.IS_DEBUG_MODE_ENABLED);
    const {status} = useIndicatorStatus();

    if (shouldUseNarrowLayout || !isDebugModeEnabled || !getSettingsMessage(status)) {
        return 0;
    }
    return variables.debugTabViewHeight;
}
```

Gate on `getSettingsMessage(status)`, **not** `!!status`. Several statuses (`HAS_PHONE_NUMBER_ERROR`, `HAS_DEVICE_MANAGEMENT_ERROR`) are truthy but map to `undefined` in `getSettingsMessage`, so a `!!status` gate would reserve a blank 64px strip with no bar present.

**Change 3 — `WorkspaceListLayout.tsx`: reserve once for both roots**

```diff
+    const debugTabViewHeight = useDebugTabViewHeight();
     ...
                     {content}
+                    {debugTabViewHeight > 0 && <View style={{height: debugTabViewHeight}} />}
                     {!shouldUseNarrowLayout && <OfflineIndicator style={styles.pl5} />}
```

Shrinking this flex column shrinks the FlashList viewport, so the last row scrolls fully clear and the sibling `OfflineIndicator` is lifted above the banner too — neither of which a `Table.Body` padding-only fix achieves.

**Why this is the best fix**

- Fixes the root geometry bug on Domains (padding alone leaves a 319px bar on a page with no sidebar).
- Fixes the side-panel overrun no competing proposal addresses.
- Covers Workspaces list, Domains list, and the offline indicator in one shared layout change.
- 64px is deterministic once geometry is corrected; `minHeight` on the bar keeps reservation and render in sync.
- Narrow layouts, Settings, Inbox, and sessions with no mapped message are unchanged.

### What alternative solutions did you explore? (Optional)

**Measured height via `onLayout` + context** — what most posted proposals use. Correct in principle, but unnecessary once geometry is fixed: both full-width roots guarantee a single-line bar at ≥729px, so 64px is exact. Measurement also introduces a one-frame gap before padding lands and adds cross-tree plumbing.

**Fixed 64px spacer without fixing geometry** — clears the Workspaces row but leaves Domains on the wrong 319px branch and does not stop the bar running under Concierge when the side panel is open.

**Anchor the banner to `top: 0` on Workspaces** — follows the Settings carve-out at line 222, but moves the overlap onto `TopBarWithLoadingBar` and the Workspaces/Domains tab selector, which is worse on a full-width page.

**`Table.Body` `contentContainerStyle` padding in `WorkspaceListTable` only** — fixes the reported row but misses Domains (different table, same overlay) and leaves the `OfflineIndicator` covered.

**Revert wide-layout banner to in-flow** — regresses PR #89893's fix for content-push under the RHP backdrop.

### What specific scenarios should we cover in automated tests?

- Wide layout + debug mode + mapped indicator status → `useDebugTabViewHeight()` returns 64; `WorkspaceListLayout` content column includes a spacer of that height.
- Wide layout + debug mode + truthy status with no mapped message (e.g. phone-number error) → hook returns 0 (no blank strip).
- Debug mode off, or narrow layout → hook returns 0.
- `BottomTabBarTest`: Domains leaf (`SCREENS.DOMAINS_LIST`) asserts full-width geometry (`bottom: 0`, `width: windowWidth - navigationTabBarSize`), which fails today.
- `BottomTabBarTest`: side panel open on Workspaces root asserts width excludes `variables.sidePanelWidth`.
- Existing wide-layout Settings positioning test stays green (sidebar-width branch unchanged).
