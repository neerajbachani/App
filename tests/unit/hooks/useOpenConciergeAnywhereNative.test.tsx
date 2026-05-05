import {act, renderHook} from '@testing-library/react-native';
import useOpenConciergeAnywhere from '@hooks/useOpenConciergeAnywhere/index.native';
import useSidePanelActions from '@hooks/useSidePanelActions';
import useSidePanelState from '@hooks/useSidePanelState';

jest.mock('@hooks/useSidePanelActions', () => jest.fn());
jest.mock('@hooks/useSidePanelState', () => jest.fn());

const mockUseSidePanelActions = useSidePanelActions as jest.MockedFunction<typeof useSidePanelActions>;
const mockUseSidePanelState = useSidePanelState as jest.MockedFunction<typeof useSidePanelState>;

describe('useOpenConciergeAnywhere native', () => {
    const openSidePanel = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseSidePanelActions.mockReturnValue({openSidePanel, closeSidePanel: jest.fn()});
    });

    it('returns isInSidePanel as true', () => {
        mockUseSidePanelState.mockReturnValue({
            shouldHideSidePanel: true,
        } as ReturnType<typeof useSidePanelState>);

        const {result} = renderHook(() => useOpenConciergeAnywhere());

        expect(result.current.isInSidePanel).toBe(true);
    });

    it('opens side panel when it is hidden', () => {
        mockUseSidePanelState.mockReturnValue({
            shouldHideSidePanel: true,
        } as ReturnType<typeof useSidePanelState>);

        const {result} = renderHook(() => useOpenConciergeAnywhere());

        act(() => {
            result.current.openConciergeAnywhere();
        });

        expect(openSidePanel).toHaveBeenCalledTimes(1);
    });

    it('does not open side panel when already visible', () => {
        mockUseSidePanelState.mockReturnValue({
            shouldHideSidePanel: false,
        } as ReturnType<typeof useSidePanelState>);

        const {result} = renderHook(() => useOpenConciergeAnywhere());

        act(() => {
            result.current.openConciergeAnywhere();
        });

        expect(openSidePanel).not.toHaveBeenCalled();
    });
});
