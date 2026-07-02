import React from 'react';
import {View} from 'react-native';
import {CHART_TYPE} from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/constants';
import {useVictoryChartContext} from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/context/VictoryChartContext';
import computeChartScale, {computeChartScaleForViewport} from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/utils/computeChartScale';
import {resolveChartContainerBgColor} from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/utils/resolveChartThemeColor';
import useSafeAreaInsets from '@hooks/useSafeAreaInsets';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';

// Horizontal space consumed by chat message padding, avatar, and margins (excluding safe area insets).
// Used instead of onLayout because Yoga inflates the container width to match the fixed-width chart child.
const CHAT_MESSAGE_HORIZONTAL_PADDING = 92;

// Horizontal space consumed by the full-screen chart modal's horizontal padding.
const MODAL_HORIZONTAL_PADDING = 40;

// Vertical space reserved for the modal header and chart area padding (excluding safe area insets).
const MODAL_VERTICAL_PADDING = 80;

/** @see POLAR_CONTAINER_HEIGHT_RATIO in VictoryChartContainerFixed */
const POLAR_CONTAINER_HEIGHT_RATIO = 0.9;

function VictoryChartContainer({children, maxScale = 1, availableViewportHeight}: {children: React.ReactNode; maxScale?: number; availableViewportHeight?: number}) {
    const styles = useThemeStyles();
    const theme = useTheme();
    const {chartContentStyles, chartContainerStyles, type} = useVictoryChartContext();
    const {windowWidth, windowHeight} = useWindowDimensions();
    const {left: safeAreaLeft, right: safeAreaRight, top: safeAreaTop, bottom: safeAreaBottom} = useSafeAreaInsets();

    const designWidth = typeof chartContentStyles.width === 'number' ? chartContentStyles.width : undefined;
    const designHeight = typeof chartContentStyles.height === 'number' ? chartContentStyles.height : undefined;
    const hasExplicitDimensions = designWidth !== undefined && designHeight !== undefined;
    const isPolar = type === CHART_TYPE.POLAR;
    const effectiveDesignHeight = isPolar && designHeight ? designHeight * POLAR_CONTAINER_HEIGHT_RATIO : designHeight;

    const isFullscreen = maxScale > 1;
    const horizontalPadding = isFullscreen ? MODAL_HORIZONTAL_PADDING : CHAT_MESSAGE_HORIZONTAL_PADDING;
    const availableWidth = windowWidth - safeAreaLeft - safeAreaRight - horizontalPadding;
    const availableHeight = isFullscreen
        ? (availableViewportHeight ?? windowHeight - safeAreaTop - safeAreaBottom - MODAL_VERTICAL_PADDING)
        : undefined;
    const scale = hasExplicitDimensions
        ? isFullscreen
            ? computeChartScaleForViewport(designWidth, designHeight, availableWidth, availableHeight, maxScale)
            : computeChartScale(designWidth, availableWidth, maxScale)
        : 1;

    const {backgroundColor: rawBgColor, borderRadius, ...layoutContainerStyles} = chartContainerStyles;
    const backgroundColor = resolveChartContainerBgColor(rawBgColor, theme);

    const contentStyle = hasExplicitDimensions
        ? [chartContentStyles, {backgroundColor, borderRadius, overflow: 'hidden' as const, transform: [{scale}], transformOrigin: 'top left' as const}]
        : [styles.chartContent, chartContentStyles, {backgroundColor, borderRadius, overflow: 'hidden' as const}];

    const containerStyle =
        hasExplicitDimensions && effectiveDesignHeight && designWidth
            ? [{width: designWidth * scale, height: effectiveDesignHeight * scale, alignSelf: 'flex-start' as const, overflow: 'hidden' as const, borderRadius}]
            : [styles.chartContainer, styles.mw100, layoutContainerStyles];

    return (
        <View style={containerStyle}>
            <View style={contentStyle}>{children}</View>
        </View>
    );
}

VictoryChartContainer.displayName = 'VictoryChartContainer';

export default VictoryChartContainer;
