import checkFileExists from '@libs/fileDownload/checkFileExists';
import {readFileAsync} from '@libs/fileDownload/FileUtils';
import ReceiptStorage from '@libs/ReceiptStorage';
import {logAttachmentDropped} from '@libs/telemetry/AttachmentObservability';
import {logReceiptDropped} from '@libs/telemetry/ReceiptObservability';
import validateFormDataParameter from '@libs/validateFormDataParameter';

import type {Receipt} from '@src/types/onyx/Transaction';

import type PrepareRequestPayload from './types';

/**
 * Prefer the stored source when it still exists, otherwise fall back to the re-rooted receipts path.
 * Mirrors the receipt branch so offline replay survives an iOS container move between enqueue and send.
 */
function pickReadableAttachmentSource(source: string): Promise<{readUri: string; triedResolved: boolean}> {
    const resolvedSource = ReceiptStorage.resolve(source) ?? source;

    return checkFileExists(source).then((originalExists) => {
        if (originalExists) {
            return {readUri: source, triedResolved: false};
        }

        if (resolvedSource !== source) {
            return checkFileExists(resolvedSource).then((resolvedExists) => ({
                readUri: resolvedExists ? resolvedSource : source,
                triedResolved: true,
            }));
        }

        return {readUri: source, triedResolved: false};
    });
}

/**
 * Prepares the request payload (body) for a given command and data.
 * This function is specifically designed for native platforms (IOS and Android) to handle the regeneration of blob files. It ensures that files, such as receipts, are properly read and appended to the FormData object before the request is sent.
 */
const prepareRequestPayload: PrepareRequestPayload = (command, data, initiatedOffline) => {
    const formData = new FormData();
    let promiseChain = Promise.resolve();

    for (const key of Object.keys(data)) {
        promiseChain = promiseChain.then(() => {
            const value = data[key];

            if (value === undefined || value === null) {
                return Promise.resolve();
            }

            if (key === 'receipt') {
                const {source, name, type, receiptTraceId} = value as Omit<File, 'source'> & Pick<Receipt, 'receiptTraceId' | 'source'>;

                if (source) {
                    // A bundled placeholder image (distance, per diem) is a require() asset id, so no file exists on disk.
                    if (typeof source === 'number') {
                        return Promise.resolve();
                    }

                    const localUri = ReceiptStorage.resolve(source) ?? source;

                    return checkFileExists(localUri).then((exists) => {
                        if (!exists) {
                            const transactionID = typeof data.transactionID === 'string' ? data.transactionID : undefined;
                            logReceiptDropped({receiptTraceId, transactionID, command, source, fileName: name});
                            return;
                        }
                        const receiptFormData = {
                            uri: localUri,
                            name,
                            type,
                        };
                        validateFormDataParameter(command, key, receiptFormData);
                        formData.append(key, receiptFormData as File);
                    });
                }
            }

            if (key === 'file' && initiatedOffline) {
                const {uri: path = '', source, name, type} = value as File;
                if (!source) {
                    validateFormDataParameter(command, key, value);
                    formData.append(key, value as string | Blob);

                    return Promise.resolve();
                }

                const fileName = name || (path ? (path.split('/').pop() ?? '') : '') || '';
                const reportID = typeof data.reportID === 'string' ? data.reportID : undefined;
                const attachmentID = typeof data.attachmentID === 'string' ? data.attachmentID : undefined;

                return pickReadableAttachmentSource(source).then(({readUri, triedResolved}) => {
                    let dropLogged = false;
                    const logDropOnce = (reason: 'missing' | 'readFailed') => {
                        if (dropLogged) {
                            return;
                        }
                        dropLogged = true;
                        logAttachmentDropped({
                            attachmentID,
                            command,
                            reportID,
                            reason,
                            triedResolved,
                            source,
                            fileName,
                        });
                    };

                    return readFileAsync(
                        readUri,
                        fileName,
                        () => {},
                        () => logDropOnce('readFailed'),
                        type,
                    ).then((file) => {
                        if (!file) {
                            logDropOnce('missing');
                            return;
                        }

                        validateFormDataParameter(command, key, file);
                        formData.append(key, file);
                    });
                });
            }

            validateFormDataParameter(command, key, value);
            formData.append(key, value as string | Blob);

            return Promise.resolve();
        });
    }

    return promiseChain.then(() => formData);
};

export default prepareRequestPayload;
