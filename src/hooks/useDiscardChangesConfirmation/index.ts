import type {NavigationAction} from '@react-navigation/native';
import {findFocusedRoute, useNavigation} from '@react-navigation/native';
import {useCallback, useEffect, useRef} from 'react';
import {ModalActions} from '@components/Modal/Global/ModalContext';
import useBeforeRemove from '@hooks/useBeforeRemove';
import useConfirmModal from '@hooks/useConfirmModal';
import useLocalize from '@hooks/useLocalize';
import Log from '@libs/Log';
import setNavigationActionToMicrotaskQueue from '@libs/Navigation/helpers/setNavigationActionToMicrotaskQueue';
import navigateAfterInteraction from '@libs/Navigation/navigateAfterInteraction';
import navigationRef from '@libs/Navigation/navigationRef';
import type {PlatformStackNavigationProp} from '@libs/Navigation/PlatformStackNavigation/types';
import type {RootNavigatorParamList} from '@libs/Navigation/types';
import CONST from '@src/CONST';
import type UseDiscardChangesConfirmationOptions from './types';

const DISCARD_NAV_DEBUG_PREFIX = '[DiscardNavDebug]';

function getHistoryLength() {
    return window.history.length;
}

function shouldReplayBlockedAction(action: NavigationAction) {
    return action.type === CONST.NAVIGATION.ACTION_TYPE.GO_BACK || action.type === CONST.NAVIGATION.ACTION_TYPE.POP || action.type === CONST.NAVIGATION.ACTION_TYPE.RESET;
}

function logDiscardNavDebug(message: string, extraData: Record<string, unknown> = {}) {
    Log.info(`${DISCARD_NAV_DEBUG_PREFIX} ${message}`, false, {
        historyLength: getHistoryLength(),
        ...extraData,
    });
}

function useDiscardChangesConfirmation({getHasUnsavedChanges, onCancel, onVisibilityChange, onConfirm}: UseDiscardChangesConfirmationOptions) {
    const navigation = useNavigation<PlatformStackNavigationProp<RootNavigatorParamList>>();
    const {translate} = useLocalize();
    const {showConfirmModal} = useConfirmModal();
    const blockedNavigationAction = useRef<NavigationAction>(undefined);
    const shouldNavigateBack = useRef(false);
    const shouldIgnoreNextBeforeRemove = useRef(false);
    const clearShouldIgnoreNextBeforeRemoveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const isDiscardModalOpen = useRef(false);
    // True while replaying navigation after the user confirmed discard in the modal.
    // transitionStart must not run window.history.go(1) for this app-initiated back.
    const isConfirmedNavigation = useRef(false);
    // True when beforeRemove blocked a web URL-sync RESET; confirm uses goBack instead of replaying RESET.
    const isBlockedResetNavigation = useRef(false);
    const getHasUnsavedChangesRef = useRef(getHasUnsavedChanges);
    getHasUnsavedChangesRef.current = getHasUnsavedChanges;

    const clearShouldIgnoreNextBeforeRemove = useCallback(() => {
        if (clearShouldIgnoreNextBeforeRemoveTimeout.current) {
            clearTimeout(clearShouldIgnoreNextBeforeRemoveTimeout.current);
            clearShouldIgnoreNextBeforeRemoveTimeout.current = undefined;
        }
        shouldIgnoreNextBeforeRemove.current = false;
    }, []);

    const markNextBeforeRemoveAsModalCleanup = useCallback(() => {
        if ((window.history.state as {shouldGoBack?: boolean} | null)?.shouldGoBack !== true) {
            return;
        }

        shouldIgnoreNextBeforeRemove.current = true;
        if (clearShouldIgnoreNextBeforeRemoveTimeout.current) {
            clearTimeout(clearShouldIgnoreNextBeforeRemoveTimeout.current);
        }
        clearShouldIgnoreNextBeforeRemoveTimeout.current = setTimeout(() => {
            shouldIgnoreNextBeforeRemove.current = false;
            clearShouldIgnoreNextBeforeRemoveTimeout.current = undefined;
        }, 250);
    }, []);

    const getDebugSnapshot = useCallback((extraData: Record<string, unknown> = {}) => {
        const rootState = navigationRef.current?.getRootState();
        const focusedRouteName = rootState ? findFocusedRoute(rootState)?.name : undefined;

        return {
            pathName: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash,
            shouldGoBackState: (window.history.state as {shouldGoBack?: boolean} | null)?.shouldGoBack,
            focusedRouteName,
            shouldNavigateBack: shouldNavigateBack.current,
            isConfirmedNavigation: isConfirmedNavigation.current,
            isBlockedResetNavigation: isBlockedResetNavigation.current,
            ...extraData,
        };
    }, []);

    const logPostConfirmSettledState = useCallback(
        (source: string, shouldClearConfirmedNavigation = false) => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const wasConfirmedNavigation = isConfirmedNavigation.current;
                    if (shouldClearConfirmedNavigation) {
                        isConfirmedNavigation.current = false;
                    }
                    logDiscardNavDebug('post-confirm settled state', getDebugSnapshot({source}));
                    if (shouldClearConfirmedNavigation) {
                        logDiscardNavDebug('post-confirm confirmed flag cleanup', {
                            source,
                            wasConfirmedNavigation,
                            ...getDebugSnapshot(),
                        });
                    }
                }, 0);
            });
        },
        [getDebugSnapshot],
    );

    const resetNavigationGuards = useCallback(() => {
        blockedNavigationAction.current = undefined;
        shouldNavigateBack.current = false;
        isConfirmedNavigation.current = false;
        isBlockedResetNavigation.current = false;
    }, []);

    const navigateBack = useCallback(
        (capturedBlockedAction?: NavigationAction, capturedShouldNavigateBack?: boolean) => {
            isConfirmedNavigation.current = true;

            const blockedAction = capturedBlockedAction ?? blockedNavigationAction.current;
            if (blockedAction) {
                const blockedActionType = blockedAction.type;
                blockedNavigationAction.current = undefined;

                if (shouldReplayBlockedAction(blockedAction)) {
                    logDiscardNavDebug('navigateBack dispatchBlockedAction', {
                        navigationStrategy: 'dispatchBlockedAction',
                        blockedActionType,
                        ...getDebugSnapshot(),
                    });
                    navigationRef.current?.dispatch(blockedAction);
                    isBlockedResetNavigation.current = false;
                    logPostConfirmSettledState('dispatchBlockedAction', true);
                    return;
                }

                logDiscardNavDebug('navigateBack goBackFallback', {
                    navigationStrategy: 'goBackFallback',
                    blockedActionType,
                    ...getDebugSnapshot(),
                });
                navigationRef.current?.goBack();
                isBlockedResetNavigation.current = false;
                logPostConfirmSettledState('goBackFallback', true);
                return;
            }

            const shouldGoBack = capturedShouldNavigateBack ?? shouldNavigateBack.current;
            if (!shouldGoBack) {
                logDiscardNavDebug('navigateBack noop (shouldNavigateBack false)', {
                    ...getDebugSnapshot(),
                });
                isConfirmedNavigation.current = false;
                return;
            }

            logDiscardNavDebug('navigateBack calling goBack', {
                navigationStrategy: 'goBack',
                ...getDebugSnapshot(),
            });
            navigationRef.current?.goBack();
            logPostConfirmSettledState('goBack', true);
        },
        [getDebugSnapshot, logPostConfirmSettledState],
    );

    const showDiscardModal = useCallback(() => {
        logDiscardNavDebug('showDiscardModal', {
            hasBlockedAction: !!blockedNavigationAction.current,
            blockedActionType: blockedNavigationAction.current?.type,
            ...getDebugSnapshot(),
        });
        isDiscardModalOpen.current = true;
        onVisibilityChange?.(true);
        showConfirmModal({
            title: translate('discardChangesConfirmation.title'),
            prompt: translate('discardChangesConfirmation.body'),
            danger: true,
            confirmText: translate('discardChangesConfirmation.confirmText'),
            cancelText: translate('common.cancel'),
            shouldHandleNavigationBack: false,
            shouldIgnoreBackHandlerDuringTransition: true,
        }).then((result) => {
            isDiscardModalOpen.current = false;
            onVisibilityChange?.(false);

            if (result.action === ModalActions.CONFIRM) {
                const confirmedBlockedAction = blockedNavigationAction.current;
                const confirmedShouldNavigateBack = shouldNavigateBack.current;

                logDiscardNavDebug('discard modal result', {
                    action: result.action,
                    blockedActionType: confirmedBlockedAction?.type,
                    ...getDebugSnapshot(),
                });

                Promise.resolve()
                    .then(() => onConfirm?.())
                    .then(() => {
                        logDiscardNavDebug('scheduling navigateBack after confirm', {
                            blockedActionType: confirmedBlockedAction?.type,
                            ...getDebugSnapshot(),
                        });
                        setNavigationActionToMicrotaskQueue(() => {
                            navigateBack(confirmedBlockedAction, confirmedShouldNavigateBack);
                        });
                    })
                    .catch((error: unknown) => {
                        Log.warn('[useDiscardChangesConfirmation] Failed to run onConfirm callback', {error});
                        resetNavigationGuards();
                    });
            } else {
                logDiscardNavDebug('discard modal result', {
                    action: result.action,
                    blockedActionType: blockedNavigationAction.current?.type,
                    ...getDebugSnapshot(),
                });
                markNextBeforeRemoveAsModalCleanup();
                logDiscardNavDebug('discard cancelled');
                resetNavigationGuards();
                onCancel?.();
            }
        });
    }, [showConfirmModal, translate, navigateBack, onCancel, onConfirm, onVisibilityChange, markNextBeforeRemoveAsModalCleanup, resetNavigationGuards, getDebugSnapshot]);

    useBeforeRemove((e) => {
        const hasUnsavedChanges = getHasUnsavedChanges();
        if (!hasUnsavedChanges) {
            clearShouldIgnoreNextBeforeRemove();
            return;
        }

        if (shouldNavigateBack.current || isConfirmedNavigation.current) {
            clearShouldIgnoreNextBeforeRemove();
            return;
        }

        if (isDiscardModalOpen.current || shouldIgnoreNextBeforeRemove.current) {
            clearShouldIgnoreNextBeforeRemove();
            e.preventDefault();
            return;
        }

        const blockedActionType = e.data.action.type;
        isBlockedResetNavigation.current = blockedActionType === CONST.NAVIGATION.ACTION_TYPE.RESET;

        logDiscardNavDebug('beforeRemove intercepted', {
            blockedActionType,
            ...getDebugSnapshot(),
        });
        e.preventDefault();
        blockedNavigationAction.current = e.data.action;
        navigateAfterInteraction(showDiscardModal);
    });

    /**
     * We cannot programmatically stop the browser's back navigation like react-navigation's beforeRemove.
     * Events like popstate and transitionStart are triggered AFTER the back navigation has already completed.
     * So we need to go forward to get back to the current page.
     */
    useEffect(() => {
        const unsubscribe = navigation.addListener('transitionStart', ({data: {closing}}) => {
            const hasUnsavedChanges = getHasUnsavedChangesRef.current();

            if (isConfirmedNavigation.current || isBlockedResetNavigation.current) {
                logDiscardNavDebug('transitionStart skip history recovery (confirmed navigation)', {
                    closing,
                    hasUnsavedChanges,
                    ...getDebugSnapshot(),
                });
                isConfirmedNavigation.current = false;
                isBlockedResetNavigation.current = false;
                return;
            }

            if (!hasUnsavedChanges) {
                return;
            }

            shouldNavigateBack.current = true;
            logDiscardNavDebug('transitionStart run history recovery', {
                closing,
                ...getDebugSnapshot(),
            });

            if (closing) {
                window.history.go(1);
                return;
            }

            window.history.go(1);
            navigateAfterInteraction(showDiscardModal);
        });

        return unsubscribe;
    }, [navigation, showDiscardModal, getDebugSnapshot]);

    useEffect(() => clearShouldIgnoreNextBeforeRemove, [clearShouldIgnoreNextBeforeRemove]);
}

export default useDiscardChangesConfirmation;
