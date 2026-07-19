// TODO(#95132): temporary trace helper, remove before PR

type SelectionModeTracePayload = Record<string, unknown>;

type SelectionModeTraceOptions = {
    includeStack?: boolean;
};

function logSelectionModeTrace(source: string, event: string, payload: SelectionModeTracePayload = {}, options?: SelectionModeTraceOptions) {
    const hasPayload = Object.keys(payload).length > 0;
    const shouldIncludeStack = options?.includeStack;

    if (!hasPayload && !shouldIncludeStack) {
        console.log(`[95132][${source}] ${event}`);
        return;
    }

    console.log(`[95132][${source}] ${event}`, {
        ...payload,
        ...(shouldIncludeStack ? {stack: new Error().stack} : {}),
    });
}

export {logSelectionModeTrace};
