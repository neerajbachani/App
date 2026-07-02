import type {ViewStyle} from 'react-native';
import type {VictoryChartContainerLayout, VictoryChartContainerThemeStyles} from './types';

/**
 * Builds the base outer-container style array for VictoryChartContainerFixed.
 * Scaled layouts omit chart HTML parent layout constraints (width/maxWidth) because
 * dimensions are computed from design size * scale.
 */
function getVictoryChartContainerStyleBase(
    layoutKind: VictoryChartContainerLayout['kind'],
    themeStyles: VictoryChartContainerThemeStyles | undefined,
    layoutContainerStyles: ViewStyle,
): ViewStyle[] {
    return [themeStyles?.mw100, themeStyles?.container, ...(layoutKind === 'scaled' ? [] : [layoutContainerStyles])].filter((style): style is ViewStyle => !!style);
}

export default getVictoryChartContainerStyleBase;
