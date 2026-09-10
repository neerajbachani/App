import type {Attachment} from '@src/types/onyx';

const ATTACHMENT_DIR = '/mock/caches/attachments';
const RECEIPTS_FOLDER = '/Containers/Data/Application/CURRENT/Documents/Receipts-Upload';

const mockCopyFile = jest.fn(() => Promise.resolve());
const mockExists = jest.fn(() => Promise.resolve(true));
const mockMkdir = jest.fn(() => Promise.resolve());

jest.mock('react-native-fs', () => ({
    CachesDirectoryPath: '/mock/caches',
    copyFile: (...args: unknown[]) => mockCopyFile(...args),
    exists: (...args: unknown[]) => mockExists(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    unlink: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-blob-util', () => ({
    config: jest.fn(() => ({
        fetch: jest.fn(() => Promise.resolve()),
    })),
    fs: {
        dirs: {
            DocumentDir: '/mock/documents',
        },
    },
}));

jest.mock('react-native-onyx', () => ({
    set: jest.fn(() => Promise.resolve()),
    setCollection: jest.fn(() => Promise.resolve()),
    connectWithoutView: jest.fn(),
}));

jest.mock('@libs/Log', () => ({
    __esModule: true,
    default: {
        warn: jest.fn(),
        info: jest.fn(),
        alert: jest.fn(),
    },
}));

const mockLogAttachmentCacheRequested = jest.fn();
const mockLogAttachmentCacheFailed = jest.fn();
const mockLogAttachmentCacheResolved = jest.fn();

jest.mock('@libs/telemetry/AttachmentObservability', () => ({
    logAttachmentCacheRequested: mockLogAttachmentCacheRequested,
    logAttachmentCacheFailed: mockLogAttachmentCacheFailed,
    logAttachmentCacheResolved: mockLogAttachmentCacheResolved,
}));

jest.mock('@libs/ReceiptStorage', () => ({
    __esModule: true,
    default: {
        resolve: (source?: string) => {
            const name = source?.includes('/Receipts-Upload/') ? source.split('/').pop() : undefined;
            return name ? `file://${RECEIPTS_FOLDER}/${name}` : source;
        },
    },
}));

type AttachmentNativeModule = {
    cacheAttachment: (props: {attachmentID: string; uri: string; mimeType?: string}) => Promise<void>;
    getCachedAttachment: (props: {attachmentID: string; attachment: Attachment | undefined; currentSource: string}) => Promise<string>;
};

const {cacheAttachment, getCachedAttachment}: AttachmentNativeModule = jest.requireActual('@libs/actions/Attachment/index.native.ts');

describe('Attachment cache (native)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockExists.mockResolvedValue(true);
        mockCopyFile.mockResolvedValue(undefined);
        mockMkdir.mockResolvedValue(undefined);
    });

    it('should copy from the re-rooted receipts path when cacheAttachment receives a stale container URI', async () => {
        const staleUri = 'file:///Containers/Data/Application/STALE/Documents/Receipts-Upload/photo_1.jpg';
        const resolvedUri = `file://${RECEIPTS_FOLDER}/photo_1.jpg`;

        await cacheAttachment({attachmentID: 'attach-1', uri: staleUri, mimeType: 'image/jpeg'});

        expect(mockCopyFile).toHaveBeenCalledWith(resolvedUri, `${ATTACHMENT_DIR}/attach-1.jpg`);
        expect(mockLogAttachmentCacheRequested).toHaveBeenCalledWith(
            expect.objectContaining({
                attachmentID: 'attach-1',
                branch: 'copy',
                wasResolved: true,
            }),
        );
    });

    it('should re-cache from and return the re-rooted currentSource when the cached file was purged', async () => {
        const staleCurrentSource = 'file:///Containers/Data/Application/STALE/Documents/Receipts-Upload/photo_2.jpg';
        const resolvedCurrentSource = `file://${RECEIPTS_FOLDER}/photo_2.jpg`;
        const attachment: Attachment = {
            attachmentID: 'attach-2',
            source: `${ATTACHMENT_DIR}/attach-2.jpg`,
        };

        mockExists.mockResolvedValueOnce(false);

        const resolvedSource = await getCachedAttachment({
            attachmentID: 'attach-2',
            attachment,
            currentSource: staleCurrentSource,
        });

        expect(resolvedSource).toBe(resolvedCurrentSource);
        expect(mockLogAttachmentCacheResolved).toHaveBeenCalledWith({
            attachmentID: 'attach-2',
            outcome: 'purgedRecache',
            wasResolved: true,
        });
        expect(mockLogAttachmentCacheRequested).toHaveBeenCalledWith(
            expect.objectContaining({
                attachmentID: 'attach-2',
                branch: 'download',
            }),
        );
    });

    it('should not apply the receipts resolver to a Caches localSource and should return the cached path on hit', async () => {
        const localSource = `${ATTACHMENT_DIR}/attach-3.jpg`;
        const attachment: Attachment = {
            attachmentID: 'attach-3',
            source: localSource,
        };

        mockExists.mockResolvedValueOnce(true);

        const resolvedSource = await getCachedAttachment({
            attachmentID: 'attach-3',
            attachment,
            currentSource: `file://${RECEIPTS_FOLDER}/photo_3.jpg`,
        });

        expect(resolvedSource).toBe(`file://${localSource}`);
        expect(mockCopyFile).not.toHaveBeenCalled();
        expect(mockLogAttachmentCacheResolved).toHaveBeenCalledWith({
            attachmentID: 'attach-3',
            outcome: 'hit',
            wasResolved: false,
        });
    });

    it('should report sourceExists false when the copy fails because the source file is missing', async () => {
        mockCopyFile.mockRejectedValueOnce({code: 'ENOENT'});
        mockExists.mockImplementation((path: string) => Promise.resolve(path === ATTACHMENT_DIR));

        await cacheAttachment({attachmentID: 'attach-4', uri: `file://${RECEIPTS_FOLDER}/missing.jpg`, mimeType: 'image/jpeg'});

        expect(mockLogAttachmentCacheFailed).toHaveBeenCalledWith(
            expect.objectContaining({
                attachmentID: 'attach-4',
                branch: 'copy',
                stage: 'copy',
                code: 'ENOENT',
                sourceExists: false,
                destDirExists: true,
            }),
        );
    });
});
