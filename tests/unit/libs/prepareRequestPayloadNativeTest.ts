import type PrepareRequestPayload from '@libs/prepareRequestPayload/types';

const mockCheckFileExists = jest.fn<Promise<boolean>, [string | undefined]>();
jest.mock('@libs/fileDownload/checkFileExists', () => ({
    __esModule: true,
    default: mockCheckFileExists,
}));

const mockReadFileAsync = jest.fn<Promise<File | undefined>, [string, string, () => void, (error?: unknown) => void, string | undefined]>(() => Promise.resolve(undefined));
jest.mock('@libs/fileDownload/FileUtils', () => ({
    readFileAsync: (...args: Parameters<typeof mockReadFileAsync>) => mockReadFileAsync(...args),
}));

const mockValidateFormDataParameter = jest.fn();
jest.mock('@libs/validateFormDataParameter', () => ({
    __esModule: true,
    default: mockValidateFormDataParameter,
}));

const mockLogReceiptDropped = jest.fn();
jest.mock('@libs/telemetry/ReceiptObservability', () => ({
    logReceiptDropped: mockLogReceiptDropped,
}));

const mockLogAttachmentDropped = jest.fn();
jest.mock('@libs/telemetry/AttachmentObservability', () => ({
    logAttachmentDropped: mockLogAttachmentDropped,
}));

const RECEIPTS_FOLDER = '/Containers/Data/Application/CURRENT/Documents/Receipts-Upload';
jest.mock('@libs/ReceiptStorage', () => ({
    __esModule: true,
    default: {
        resolve: (source?: string) => {
            const name = source?.includes('/Receipts-Upload/') ? source.split('/').pop() : undefined;
            return name ? `file://${RECEIPTS_FOLDER}/${name}` : source;
        },
    },
}));

// Bypass the global jest/setup.ts mock to test the real native implementation.
// Dependencies above are still resolved through their respective mocks.

const {default: prepareRequestPayload}: {default: PrepareRequestPayload} = jest.requireActual('@libs/prepareRequestPayload/index.native.ts');

describe('prepareRequestPayload (native)', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should include receipt in FormData when the file exists', async () => {
        mockCheckFileExists.mockResolvedValue(true);

        const receipt = {
            source: 'file:///var/mobile/Documents/Receipts-Upload/receipt.jpg',
            name: 'receipt.jpg',
            type: 'image/jpeg',
            uri: 'file:///var/mobile/Documents/Receipts-Upload/receipt.jpg',
        };

        const formData = await prepareRequestPayload('RequestMoney', {receipt, amount: '100'}, false);

        expect(formData.has('receipt')).toBe(true);
        expect(formData.get('amount')).toBe('100');
    });

    it('should log a joinable [Receipt] dropped line and omit receipt from FormData when file does not exist', async () => {
        mockCheckFileExists.mockResolvedValue(false);

        const receipt = {
            source: 'file:///var/mobile/Library/Caches/ImageManipulator/receipt.jpg',
            name: 'receipt.jpg',
            type: 'image/jpeg',
            uri: 'file:///var/mobile/Library/Caches/ImageManipulator/receipt.jpg',
            receiptTraceId: 'trace-123',
        };

        const formData = await prepareRequestPayload('RequestMoney', {receipt, transactionID: 'txn-456', amount: '100'}, false);

        expect(formData.has('receipt')).toBe(false);
        expect(formData.get('amount')).toBe('100');
        // The drop carries the trace id and transaction id so it joins the capture/enqueue lines on the [Receipt] spine.
        expect(mockLogReceiptDropped).toHaveBeenCalledWith({
            receiptTraceId: 'trace-123',
            transactionID: 'txn-456',
            command: 'RequestMoney',
            source: 'file:///var/mobile/Library/Caches/ImageManipulator/receipt.jpg',
            fileName: 'receipt.jpg',
        });
    });

    it('should recover a queued receipt whose stored path names a stale container, by re-rooting the filename', async () => {
        mockCheckFileExists.mockResolvedValue(true);

        const receipt = {
            // Written before an app upgrade. The device no longer has this container.
            source: 'file:///Containers/Data/Application/STALE/Documents/Receipts-Upload/receipt_9.jpg',
            uri: 'file:///Containers/Data/Application/STALE/Documents/Receipts-Upload/receipt_9.jpg',
            name: 'receipt.jpg',
            type: 'image/jpeg',
        };

        const formData = await prepareRequestPayload('RequestMoney', {receipt, amount: '100'}, false);

        expect(mockCheckFileExists).toHaveBeenCalledWith(`file://${RECEIPTS_FOLDER}/receipt_9.jpg`);
        expect(formData.has('receipt')).toBe(true);
        expect(mockValidateFormDataParameter).toHaveBeenCalledWith('RequestMoney', 'receipt', expect.objectContaining({uri: `file://${RECEIPTS_FOLDER}/receipt_9.jpg`}));
        expect(mockLogReceiptDropped).not.toHaveBeenCalled();
    });

    it('should still report a genuinely missing file as dropped', async () => {
        mockCheckFileExists.mockResolvedValue(false);

        const receipt = {
            source: 'file:///Containers/Data/Application/CURRENT/Documents/Receipts-Upload/gone.jpg',
            uri: 'file:///Containers/Data/Application/CURRENT/Documents/Receipts-Upload/gone.jpg',
            name: 'receipt.jpg',
            type: 'image/jpeg',
        };

        const formData = await prepareRequestPayload('RequestMoney', {receipt, amount: '100'}, false);

        expect(formData.has('receipt')).toBe(false);
        expect(mockLogReceiptDropped).toHaveBeenCalledWith(expect.objectContaining({source: `file://${RECEIPTS_FOLDER}/gone.jpg`}));
    });

    it('should not check the filesystem for a bundled placeholder receipt', async () => {
        // Distance and per diem expenses carry a require() asset id. No file exists on disk.
        const receipt = {source: 686, name: 'receipt-generic.png', type: 'image/png'};

        const formData = await prepareRequestPayload('AddTrackedExpenseToPolicy', {receipt, amount: '100'}, false);

        expect(mockCheckFileExists).not.toHaveBeenCalled();
        expect(mockLogReceiptDropped).not.toHaveBeenCalled();
        expect(formData.has('receipt')).toBe(false);
        expect(formData.get('amount')).toBe('100');
    });

    it('should handle non-receipt data normally', async () => {
        const formData = await prepareRequestPayload('SomeCommand', {amount: '100', currency: 'USD'}, false);

        expect(formData.get('amount')).toBe('100');
        expect(formData.get('currency')).toBe('USD');
    });

    it('should skip undefined values', async () => {
        const formData = await prepareRequestPayload('SomeCommand', {amount: '100', undefinedField: undefined}, false);

        expect(formData.get('amount')).toBe('100');
        expect(formData.has('undefinedField')).toBe(false);
    });

    it('should append an offline chat attachment when the stored source names a stale container but the file exists under the current receipts folder', async () => {
        const staleSource = 'file:///Containers/Data/Application/STALE/Documents/Receipts-Upload/photo_1.jpg';
        const resolvedSource = `file://${RECEIPTS_FOLDER}/photo_1.jpg`;
        const fileObject = Object.assign(new File(['image-bytes'], 'photo.jpg', {type: 'image/jpeg'}), {
            uri: resolvedSource,
            source: staleSource,
        });

        mockCheckFileExists.mockImplementation((path) => Promise.resolve(path === resolvedSource));
        mockReadFileAsync.mockImplementation((path) => {
            if (path === resolvedSource) {
                return Promise.resolve(fileObject);
            }
            return Promise.resolve(undefined);
        });

        const formData = await prepareRequestPayload(
            'AddAttachment',
            {
                file: fileObject,
                reportID: 'report-1',
                attachmentID: 'attach-1',
                reportComment: '',
            },
            true,
        );

        expect(formData.has('file')).toBe(true);
        expect(mockReadFileAsync).toHaveBeenCalledWith(resolvedSource, 'photo.jpg', expect.any(Function), expect.any(Function), 'image/jpeg');
        expect(mockLogAttachmentDropped).not.toHaveBeenCalled();
    });

    it('should read the stored source as-is when it still exists and not consult the resolver fallback', async () => {
        const source = `file://${RECEIPTS_FOLDER}/photo_2.jpg`;
        const fileObject = Object.assign(new File(['image-bytes'], 'photo.jpg', {type: 'image/jpeg'}), {
            uri: source,
            source,
        });

        mockCheckFileExists.mockResolvedValue(true);
        mockReadFileAsync.mockResolvedValue(fileObject);

        const formData = await prepareRequestPayload('AddAttachment', {file: fileObject}, true);

        expect(formData.has('file')).toBe(true);
        expect(mockReadFileAsync).toHaveBeenCalledWith(source, 'photo.jpg', expect.any(Function), expect.any(Function), 'image/jpeg');
        expect(mockLogAttachmentDropped).not.toHaveBeenCalled();
    });

    it('should emit exactly one [Attachment] dropped alert and omit the file when offline replay cannot read it', async () => {
        const source = `file://${RECEIPTS_FOLDER}/gone.jpg`;
        const fileObject = Object.assign(new File([''], 'photo.jpg', {type: 'image/jpeg'}), {
            uri: source,
            source,
        });

        mockCheckFileExists.mockResolvedValue(false);
        mockReadFileAsync.mockImplementation((_path, _name, _onSuccess, onFailure) => {
            onFailure(new Error('ENOENT'));
            return Promise.resolve(undefined);
        });

        const formData = await prepareRequestPayload(
            'AddTextAndAttachment',
            {
                file: fileObject,
                reportID: 'report-2',
                attachmentID: 'attach-2',
                reportComment: 'hello',
            },
            true,
        );

        expect(formData.has('file')).toBe(false);
        expect(formData.get('reportComment')).toBe('hello');
        expect(mockLogAttachmentDropped).toHaveBeenCalledTimes(1);
        expect(mockLogAttachmentDropped).toHaveBeenCalledWith({
            attachmentID: 'attach-2',
            command: 'AddTextAndAttachment',
            reportID: 'report-2',
            reason: 'readFailed',
            triedResolved: false,
            source,
            fileName: 'photo.jpg',
        });
        expect(mockLogReceiptDropped).not.toHaveBeenCalled();
    });
});
