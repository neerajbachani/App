import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import type {ReactNode} from 'react';

type EdgeBackGuard = {
    routeName: string;
    getIsActive: () => boolean;
    onEdgeBack: () => void;
};

type RegisterEdgeBackGuard = (guard: EdgeBackGuard) => () => void;

type DiscardChangesEdgeGuardContextValue = {
    registerEdgeBackGuard: RegisterEdgeBackGuard;
    subscribe: (listener: () => void) => () => void;
    getActiveGuard: () => EdgeBackGuard | undefined;
};

const DiscardChangesEdgeGuardContext = createContext<DiscardChangesEdgeGuardContextValue | null>(null);

function DiscardChangesEdgeGuardProvider({children}: {children: ReactNode}) {
    const guardsRef = useRef(new Map<string, EdgeBackGuard>());
    const listenersRef = useRef(new Set<() => void>());

    const notify = useCallback(() => {
        for (const listener of listenersRef.current) {
            listener();
        }
    }, []);

    const subscribe = useCallback((listener: () => void) => {
        listenersRef.current.add(listener);
        return () => {
            listenersRef.current.delete(listener);
        };
    }, []);

    const getActiveGuard = useCallback(() => {
        for (const guard of guardsRef.current.values()) {
            if (guard.getIsActive()) {
                return guard;
            }
        }
        return undefined;
    }, []);

    const registerEdgeBackGuard = useCallback<RegisterEdgeBackGuard>(
        (guard) => {
            guardsRef.current.set(guard.routeName, guard);
            notify();
            return () => {
                guardsRef.current.delete(guard.routeName);
                notify();
            };
        },
        [notify],
    );

    const value = useMemo(
        () => ({
            registerEdgeBackGuard,
            subscribe,
            getActiveGuard,
        }),
        [registerEdgeBackGuard, subscribe, getActiveGuard],
    );

    return <DiscardChangesEdgeGuardContext.Provider value={value}>{children}</DiscardChangesEdgeGuardContext.Provider>;
}

function useActiveEdgeBackGuard() {
    const context = useContext(DiscardChangesEdgeGuardContext);
    return useSyncExternalStore(context?.subscribe ?? (() => () => {}), context?.getActiveGuard ?? (() => undefined), context?.getActiveGuard ?? (() => undefined));
}

function useRegisterEdgeBackGuard(routeName: string, getIsActive: () => boolean, onEdgeBack: () => void) {
    const context = useContext(DiscardChangesEdgeGuardContext);
    const guardCallbacksRef = useRef({getIsActive, onEdgeBack});

    useEffect(() => {
        guardCallbacksRef.current = {getIsActive, onEdgeBack};
    });

    const isActive = getIsActive();

    useEffect(() => {
        if (!context) {
            return undefined;
        }

        return context.registerEdgeBackGuard({
            routeName,
            getIsActive: () => guardCallbacksRef.current.getIsActive(),
            onEdgeBack: () => guardCallbacksRef.current.onEdgeBack(),
        });
    }, [context, routeName, isActive]);
}

export {DiscardChangesEdgeGuardProvider, useActiveEdgeBackGuard, useRegisterEdgeBackGuard};
export type {EdgeBackGuard, RegisterEdgeBackGuard};
