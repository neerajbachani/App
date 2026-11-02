# `react-native-reanimated` patches

### [react-native-reanimated+4.7.0+001+retain-focused-flatlist-cell.patch](react-native-reanimated+4.7.0+001+retain-focused-flatlist-cell.patch)

- Reason: `Animated.FlatList` replaces VirtualizedList's cell with an `AnimatedView` that only forwarded `onLayout`. VirtualizedList keeps a window around the last focused cell only when that cell reports focus through `onFocusCapture`. Without it, a focused cell outside the render window unmounts. On web that drops the password form of a protected PDF when the attachment carousel's width changes during rotation and the scroll offset has not caught up yet. React Native Web's `View` forwards `onFocus` and drops `onFocusCapture`, and React's `onFocus` listens to the bubbling `focusin` event, so the cell maps the list's handler onto both.
- Upstream PR/issue: N/A
- E/App issue: [#103531](https://github.com/Expensify/App/issues/103531)
- PR Introducing Patch: N/A
