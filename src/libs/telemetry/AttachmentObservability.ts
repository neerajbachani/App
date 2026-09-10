import Log from '@libs/Log';

/** Prefix on every chat-attachment log line so we can filter without parsing free text. */
const ATTACHMENT_LOG_PREFIX = '[Attachment]';

type AttachmentCacheBranch = 'copy' | 'download';

type AttachmentCacheStage = 'mkdir' | 'copy' | 'onyx' | 'head' | 'download';

type AttachmentCacheOutcome = 'hit' | 'staleRecache' | 'purgedRecache' | 'noRecord';

type AttachmentDropReason = 'missing' | 'readFailed';

type AttachmentCacheRequestedParams = {
    attachmentID: string;
    branch: AttachmentCacheBranch;
    sourceScheme: string;
    mimeType?: string;
    hasExtension: boolean;
    wasResolved: boolean;
};

type AttachmentCacheFailedParams = {
    attachmentID: string;
    branch: AttachmentCacheBranch;
    stage: AttachmentCacheStage;
    code?: string;
    sourceExists: boolean;
    destDirExists: boolean;
};

type AttachmentCacheResolvedParams = {
    attachmentID: string;
    outcome: AttachmentCacheOutcome;
    wasResolved: boolean;
};

type AttachmentDroppedParams = {
    attachmentID: string | undefined;
    command: string;
    reportID: string | undefined;
    reason: AttachmentDropReason;
    triedResolved: boolean;
    /** Device log only — not forwarded to Sentry. */
    source: string | undefined;
    /** Device log only — not forwarded to Sentry. */
    fileName: string | undefined;
};

function logAttachmentCacheRequested(params: AttachmentCacheRequestedParams) {
    Log.info(`${ATTACHMENT_LOG_PREFIX} cache requested`, true, {
        event: 'cacheRequested',
        ...params,
    });
}

function logAttachmentCacheFailed(params: AttachmentCacheFailedParams) {
    Log.warn(`${ATTACHMENT_LOG_PREFIX} cache failed`, {
        event: 'cacheFailed',
        ...params,
    });
}

function logAttachmentCacheResolved(params: AttachmentCacheResolvedParams) {
    Log.info(`${ATTACHMENT_LOG_PREFIX} cache resolved`, true, {
        event: 'cacheResolved',
        ...params,
    });
}

/**
 * Records when an offline chat attachment could not be read back into the upload payload.
 * Logged at alert level on the [Attachment] spine so it reaches Sentry and stays separable
 * from receipt drops on the [Receipt] spine.
 */
function logAttachmentDropped({attachmentID, command, reportID, reason, triedResolved, source, fileName}: AttachmentDroppedParams) {
    Log.alert(`${ATTACHMENT_LOG_PREFIX} dropped`, {
        event: 'dropped',
        attachmentID,
        command,
        reportID,
        reason,
        triedResolved,
        source,
        fileName,
    });
}

export {logAttachmentCacheRequested, logAttachmentCacheFailed, logAttachmentCacheResolved, logAttachmentDropped, ATTACHMENT_LOG_PREFIX};
export type {AttachmentCacheBranch, AttachmentCacheStage, AttachmentCacheOutcome, AttachmentDropReason};
