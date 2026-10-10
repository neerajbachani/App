import {ModalActions} from '@components/Modal/Global/ModalContext';

import useConfirmModal from '@hooks/useConfirmModal';
import {useMemoizedLazyIllustrations} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useThemeStyles from '@hooks/useThemeStyles';

import {setHasDeniedContactImportPrompt} from '@libs/actions/ContactPermissions';
import {getContactPermission, requestContactPermission} from '@libs/ContactPermission';
import Log from '@libs/Log';

import ONYXKEYS from '@src/ONYXKEYS';

import {useEffect, useEffectEvent, useRef} from 'react';
import {RESULTS} from 'react-native-permissions';

import type UseContactPermissionModalParams from './types';

// Stable id so the prompt can be closed after the screen that opened it unmounts. closeModalByID no-ops when the id is gone.
const CONTACT_PERMISSION_MODAL_ID = 'contact-permission-modal';

function useContactPermissionModal({onDeny, onGrant, onFocusTextInput}: UseContactPermissionModalParams) {
    const [hasDeniedContactImportPrompt, hasDeniedContactImportPromptMetadata] = useOnyx(ONYXKEYS.HAS_DENIED_CONTACT_IMPORT_PROMPT);

    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const illustrations = useMemoizedLazyIllustrations(['ToddWithPhones']);
    const {showConfirmModal, closeModalByID} = useConfirmModal();
    // closeModalByID's identity changes whenever ModalProvider re-renders. Keep the latest one in a ref so the
    // unmount cleanup can call it without listing it as an effect dependency, which would re-run the effect and
    // close the prompt while it is still on screen.
    const closeModalByIDRef = useRef(closeModalByID);
    const isMountedRef = useRef(false);
    useEffect(() => {
        closeModalByIDRef.current = closeModalByID;
    }, [closeModalByID]);

    const runContactPermissionFlow = useEffectEvent(async () => {
        if (hasDeniedContactImportPrompt) {
            onFocusTextInput();
            return;
        }

        try {
            const status = await getContactPermission();

            if (!isMountedRef.current) {
                return;
            }

            // Permission hasn't been asked yet, show the soft permission modal
            if (status !== RESULTS.DENIED) {
                onFocusTextInput();
                return;
            }

            const result = await showConfirmModal({
                id: CONTACT_PERMISSION_MODAL_ID,
                confirmText: translate('common.continue'),
                cancelText: translate('common.noThanks'),
                prompt: translate('contact.importContactsText'),
                promptStyles: [styles.textLabelSupportingEmptyValue, styles.mb4],
                title: translate('contact.importContactsTitle'),
                titleContainerStyles: [styles.mt2, styles.mb0],
                titleStyles: [styles.textHeadline],
                iconSource: illustrations.ToddWithPhones,
                iconFill: false,
                iconWidth: 176,
                iconHeight: 178,
                shouldCenterIcon: true,
                shouldReverseStackedButtons: true,
            });

            if (!isMountedRef.current) {
                return;
            }

            if (result?.action === ModalActions.CONFIRM) {
                try {
                    const permissionStatus = await requestContactPermission();
                    onFocusTextInput();
                    if (permissionStatus === RESULTS.GRANTED) {
                        onGrant();
                    }
                } catch (error) {
                    Log.warn('[useContactPermissionModal] Failed to request contact permission', {error});
                    onFocusTextInput();
                }
            } else {
                setHasDeniedContactImportPrompt(true);
                onDeny(RESULTS.DENIED);
                onFocusTextInput();
            }
        } catch (error) {
            Log.warn('[useContactPermissionModal] Failed to read contact permission', {error});
            if (!isMountedRef.current) {
                return;
            }
            onFocusTextInput();
        }
    });

    useEffect(() => {
        if (hasDeniedContactImportPromptMetadata.status === 'loading') {
            return;
        }

        isMountedRef.current = true;
        runContactPermissionFlow();

        return () => {
            // Set this before closing so the prompt's resolved promise returns early and does not record a denial.
            isMountedRef.current = false;
            closeModalByIDRef.current(CONTACT_PERMISSION_MODAL_ID);
        };
    }, [hasDeniedContactImportPrompt, hasDeniedContactImportPromptMetadata.status]);
}

export default useContactPermissionModal;
