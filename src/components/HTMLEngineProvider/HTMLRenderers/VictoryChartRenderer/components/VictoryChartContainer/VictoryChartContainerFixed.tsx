import React from 'react';
import type {CSSProperties} from 'react';
import type {ViewStyle} from 'react-native';
import {View} from 'react-native';
import {CHART_TYPE} from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/constants';
import {useVictoryChartContext} from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/context/VictoryChartContext';
import {resolveChartContainerBgColor} from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/utils/resolveChartThemeColor';
import useTheme from '@hooks/useTheme';
import getVictoryChartContainerStyleBase from './getVictoryChartContainerStyleBase';
import type {VictoryChartContainerLayout, VictoryChartContainerThemeStyles} from './types';

/**
 * Polar charts are circular but their design canvas is often taller than the
 * visible content, leaving dead space at the bottom. We clip the container
 * (not the content) so the chart renders at full fidelity while the unused
 * bottom portion is hidden.
 */
const POLAR_CONTAINER_HEIGHT_RATIO = 0.9;

type VictoryChartContainerFixedProps = {
    children: React.ReactNode;
    layout: VictoryChartContainerLayout;
    themeStyles?: VictoryChartContainerThemeStyles;
};

function VictoryChartContainerFixed({children, layout, themeStyles}: VictoryChartContainerFixedProps) {
    const {chartContentStyles, chartContainerStyles, type} = useVictoryChartContext();
    const theme = useTheme();
    const {backgroundColor: rawBgColor, borderRadius, ...layoutContainerStyles} = chartContainerStyles;
    const backgroundColor = resolveChartContainerBgColor(rawBgColor, theme);
    const layoutKind = layout.kind;
    const fixedWidth = layout.kind === 'fixed' ? layout.width : undefined;
    const fixedHeight = layout.kind === 'fixed' ? layout.height : undefined;
    const scaledDesignWidth = layout.kind === 'scaled' ? layout.designWidth : undefined;
    const scaledDesignHeight = layout.kind === 'scaled' ? layout.designHeight : undefined;
    const scaledScale = layout.kind === 'scaled' ? layout.scale : undefined;
    const isPolar = type === CHART_TYPE.POLAR;

    const containerStyleBase = getVictoryChartContainerStyleBase(layoutKind, themeStyles, layoutContainerStyles);
    let containerStyle: ViewStyle[] = containerStyleBase;

    if (layoutKind === 'fixed' && fixedWidth !== undefined && fixedHeight !== undefined) {
        containerStyle = [...containerStyleBase, {width: fixedWidth, height: fixedHeight, borderRadius: 0, overflow: 'hidden'}];
    } else if (layoutKind === 'scaled' && scaledDesignWidth !== undefined && scaledDesignHeight !== undefined && scaledScale !== undefined) {
        const effectiveHeight = isPolar ? scaledDesignHeight * POLAR_CONTAINER_HEIGHT_RATIO : scaledDesignHeight;
        containerStyle = [
            ...containerStyleBase,
            {
                width: scaledDesignWidth * scaledScale,
                height: effectiveHeight * scaledScale,
                alignSelf: 'flex-start',
                borderRadius: isPolar ? borderRadius : 0,
                overflow: 'hidden',
            },
        ];
    }

    const contentStyle: ViewStyle[] = [];

    if (layoutKind === 'fluid' && themeStyles?.content) {
        contentStyle.push(themeStyles.content);
    }

    contentStyle.push(chartContentStyles, {backgroundColor, borderRadius, overflow: 'hidden'});

    const scaledContentTransformStyle: CSSProperties | undefined =
        layoutKind === 'scaled' && scaledDesignWidth !== undefined && scaledDesignHeight !== undefined && scaledScale !== undefined
            ? {
                  width: scaledDesignWidth,
                  height: scaledDesignHeight,
                  transform: `scale(${scaledScale})`,
                  transformOrigin: 'top left',
              }
            : undefined;

    if (scaledContentTransformStyle) {
        return (
            <View style={containerStyle}>
                {/* A DOM wrapper is required on web because React Native View does not reliably apply transformOrigin. */}
                <div style={scaledContentTransformStyle}>
                    <View style={contentStyle}>{children}</View>
                </div>
            </View>
        );
    }

    return (
        <View style={containerStyle}>
            <View style={contentStyle}>{children}</View>
        </View>
    );
}

VictoryChartContainerFixed.displayName = 'VictoryChartContainerFixed';

export default VictoryChartContainerFixed;
