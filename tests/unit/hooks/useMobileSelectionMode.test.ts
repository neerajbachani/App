import {act, renderHook} from '@testing-library/react-native';

import useMobileSelectionMode from '@hooks/useMobileSelectionMode';
import useOnyx from '@hooks/useOnyx';

import {turnOffMobileSelectionMode} from '@libs/actions/MobileSelectionMode';

import ONYXKEYS from '@src/ONYXKEYS';

import {useIsFocused} from '@react-navigation/native';

jest.mock('@hooks/useOnyx', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const actualNavigation = jest.requireActual('@react-navigation/native');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
        ...actualNavigation,
        __esModule: true,
        useIsFocused: jest.fn(() => true),
    };
});

jest.mock('@libs/actions/MobileSelectionMode', () => ({
    turnOffMobileSelectionMode: jest.fn(),
}));

const mockedUseOnyx = jest.mocked(useOnyx);
const mockedUseIsFocused = jest.mocked(useIsFocused);
const mockedTurnOffMobileSelectionMode = jest.mocked(turnOffMobileSelectionMode);

describe('useMobileSelectionMode', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedUseIsFocused.mockReturnValue(true);
    });

    it('returns the current mobile selection mode value from Onyx', () => {
        mockedUseOnyx.mockReturnValue([true]);

        const {result} = renderHook(() => useMobileSelectionMode());

        expect(result.current).toBe(true);
        expect(mockedUseOnyx).toHaveBeenCalledWith(ONYXKEYS.RAM_ONLY_MOBILE_SELECTION_MODE);
    });

    // Regression coverage for https://github.com/Expensify/App/issues/95132. A background subscriber (e.g. a still-mounted
    // report screen) must not turn off the selection mode that a focused screen just enabled.
    it('does not turn off selection mode when it mounts unfocused while selection is already on', () => {
        mockedUseOnyx.mockReturnValue([true]);
        mockedUseIsFocused.mockReturnValue(false);

        renderHook(() => useMobileSelectionMode());

        expect(mockedTurnOffMobileSelectionMode).not.toHaveBeenCalled();
    });

    // Regression coverage for https://github.com/Expensify/App/issues/47685. When the focused screen mounts with a stale
    // selection mode still on (e.g. after navigating back to a list), it must be turned off.
    it('turns off selection mode when it mounts focused while selection is already on', () => {
        mockedUseOnyx.mockReturnValue([true]);
        mockedUseIsFocused.mockReturnValue(true);

        renderHook(() => useMobileSelectionMode());

        expect(mockedTurnOffMobileSelectionMode).toHaveBeenCalledTimes(1);
    });

    it('does not turn off selection mode when it is already off at mount', () => {
        mockedUseOnyx.mockReturnValue([false]);
        mockedUseIsFocused.mockReturnValue(true);

        renderHook(() => useMobileSelectionMode());

        expect(mockedTurnOffMobileSelectionMode).not.toHaveBeenCalled();
    });

    it('defers the turn off until the screen becomes focused', () => {
        mockedUseOnyx.mockReturnValue([true]);
        mockedUseIsFocused.mockReturnValue(false);

        const {rerender} = renderHook(() => useMobileSelectionMode());

        expect(mockedTurnOffMobileSelectionMode).not.toHaveBeenCalled();

        mockedUseIsFocused.mockReturnValue(true);
        act(() => {
            rerender(undefined);
        });

        expect(mockedTurnOffMobileSelectionMode).toHaveBeenCalledTimes(1);
    });

    it('calls onTurnOffSelectionMode when selection mode transitions from on to off', () => {
        const onTurnOffSelectionMode = jest.fn();
        mockedUseOnyx.mockReturnValue([true]);
        mockedUseIsFocused.mockReturnValue(false);

        const {rerender} = renderHook(() => useMobileSelectionMode(onTurnOffSelectionMode));

        mockedUseOnyx.mockReturnValue([false]);
        act(() => {
            rerender(undefined);
        });

        expect(onTurnOffSelectionMode).toHaveBeenCalledTimes(1);
        expect(mockedTurnOffMobileSelectionMode).not.toHaveBeenCalled();
    });
});
