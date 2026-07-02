import React from 'react';
import VictoryChartContainerFixed from './VictoryChartContainerFixed';
import VictoryChartContainerResponsive from './VictoryChartContainerResponsive';

type ExplicitSize = {width: number; height: number};

type VictoryChartContainerProps = {
    children: React.ReactNode;
    explicitSize?: ExplicitSize;
    maxScale?: number;
    availableViewportHeight?: number;
};

function VictoryChartContainer({children, explicitSize, maxScale = 1, availableViewportHeight}: VictoryChartContainerProps) {
    if (explicitSize) {
        return <VictoryChartContainerFixed layout={{kind: 'fixed', width: explicitSize.width, height: explicitSize.height}}>{children}</VictoryChartContainerFixed>;
    }

    return (
        <VictoryChartContainerResponsive
            maxScale={maxScale}
            availableViewportHeight={availableViewportHeight}
        >
            {children}
        </VictoryChartContainerResponsive>
    );
}

VictoryChartContainer.displayName = 'VictoryChartContainer';

export default VictoryChartContainer;
