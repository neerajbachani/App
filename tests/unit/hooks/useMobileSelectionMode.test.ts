import {act, renderHook} from '@testing-library/react-native';

import useMobileSelectionMode from '@hooks/useMobileSelectionMode';
import useOnyx from '@hooks/useOnyx';

import {turnOffMobileSelectionMode} from '@libs/actions/MobileSelectionMode';

import ONYXKEYS from '@src/ONYXKEYS';

jest.mock('@hooks/useOnyx', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('@libs/actions/MobileSelectionMode', () => ({
    turnOffMobileSelectionMode: jest.fn(),
}));

jest.mock('@libs/debug/SelectionModeTrace', () => ({
    logSelectionModeTrace: jest.fn(),
}));

const mockedUseOnyx = jest.mocked(useOnyx);
const mockedTurnOffMobileSelectionMode = jest.mocked(turnOffMobileSelectionMode);

describe('useMobileSelectionMode', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not turn off global selection mode when mounting while selection is already on', () => {
        mockedUseOnyx.mockReturnValue([true]);

        renderHook(() => useMobileSelectionMode());

        expect(mockedTurnOffMobileSelectionMode).not.toHaveBeenCalled();
    });

    it('returns the current mobile selection mode value from Onyx', () => {
        mockedUseOnyx.mockReturnValue([true]);

        const {result} = renderHook(() => useMobileSelectionMode());

        expect(result.current).toBe(true);
        expect(mockedUseOnyx).toHaveBeenCalledWith(ONYXKEYS.RAM_ONLY_MOBILE_SELECTION_MODE);
    });

    it('calls onTurnOffSelectionMode when selection mode transitions from on to off', () => {
        const onTurnOffSelectionMode = jest.fn();
        mockedUseOnyx.mockReturnValue([true]);

        const {rerender} = renderHook(() => useMobileSelectionMode(onTurnOffSelectionMode));

        mockedUseOnyx.mockReturnValue([false]);
        act(() => {
            rerender(undefined);
        });

        expect(onTurnOffSelectionMode).toHaveBeenCalledTimes(1);
        expect(mockedTurnOffMobileSelectionMode).not.toHaveBeenCalled();
    });
});
