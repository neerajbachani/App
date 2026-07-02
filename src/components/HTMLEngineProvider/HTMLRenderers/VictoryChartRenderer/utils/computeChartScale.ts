/**
 * Computes a uniform scale factor to fit a chart of `designWidth` into `availableWidth`,
 * capping at `maxScale` so the chart never scales up beyond that limit (default 1 for inline charts).
 */
function computeChartScale(designWidth: number | undefined, availableWidth: number, maxScale = 1): number {
    if (!designWidth || availableWidth <= 0) {
        return 1;
    }
    return Math.min(availableWidth / designWidth, maxScale);
}

/**
 * Computes a uniform scale to fit a chart into a viewport, using the smaller of width- and height-derived
 * scale so the chart stays fully visible (used for full-screen modal rendering).
 */
function computeChartScaleForViewport(
    designWidth: number | undefined,
    designHeight: number | undefined,
    availableWidth: number,
    availableHeight: number | undefined,
    maxScale = 1,
): number {
    const widthScale = computeChartScale(designWidth, availableWidth, maxScale);

    if (!designHeight || !availableHeight || availableHeight <= 0) {
        return widthScale;
    }

    const heightScale = Math.min(availableHeight / designHeight, maxScale);
    return Math.min(widthScale, heightScale);
}

export default computeChartScale;
export {computeChartScaleForViewport};
