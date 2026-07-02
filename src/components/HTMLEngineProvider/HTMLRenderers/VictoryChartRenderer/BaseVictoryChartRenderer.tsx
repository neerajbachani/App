import React, {useState} from 'react';
import {View} from 'react-native';
import {ChartFontsProvider} from '@components/Charts/hooks';
import useChartFonts from '@components/Charts/hooks/useChartFonts';
import getVictoryChartTreeTypeface from '@components/Charts/utils/getVictoryChartTreeTypeface';
import Log from '@libs/Log';
import VictoryChartContainer from './components/VictoryChartContainer';
import VictoryChartContent from './components/VictoryChartContent';
import VictoryChartExpandButton from './components/VictoryChartExpandButton';
import VictoryChartExpandModal from './components/VictoryChartExpandModal';
import {VictoryChartProvider} from './context/VictoryChartContext';
import processVictoryChartTree from './parsers/processVictoryChartTree';
import type {VictoryChartRendererProps} from './types';
import resolveVictoryChartType from './utils/resolveVictoryChartType';

function BaseVictoryChartRenderer({tnode}: VictoryChartRendererProps) {
    const fonts = useChartFonts();
    const [isExpanded, setIsExpanded] = useState(false);

    let processedResult;
    try {
        processedResult = processVictoryChartTree(tnode, getVictoryChartTreeTypeface(fonts.typefaces), null);
    } catch (error) {
        // Malformed chart HTML can make a parser throw. Fail closed (render nothing) instead of crashing the whole report.
        Log.warn('[VictoryChartRenderer] Failed to process chart tree from malformed HTML', {error});
        return null;
    }

    const type = resolveVictoryChartType(processedResult.data);
    if (!type) {
        Log.warn('Trying to render an invalid chart (empty or mixed chart types).');
        return null;
    }

    return (
        <ChartFontsProvider value={fonts}>
            <VictoryChartProvider
                tnode={tnode}
                processedResult={processedResult}
                type={type}
            >
                {/*
                 * width: '100%' is required so the wrapper fills the HTML engine container's width
                 * (which is constrained by the chat panel / side panel) instead of sizing to the
                 * chart's 680 px design width. Without it, the onLayout measurement inside
                 * VictoryChartContainerResponsive always sees 680 px and scale never decreases.
                 * The wrapper also anchors the absolutely-positioned expand button to the chart corner.
                 */}
                <View style={{width: '100%'}}>
                    <VictoryChartContainer>
                        <VictoryChartContent />
                    </VictoryChartContainer>
                    <VictoryChartExpandButton onPress={() => setIsExpanded(true)} />
                </View>
                <VictoryChartExpandModal
                    isVisible={isExpanded}
                    onClose={() => setIsExpanded(false)}
                />
            </VictoryChartProvider>
        </ChartFontsProvider>
    );
}

export default BaseVictoryChartRenderer;
