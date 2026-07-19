import {logSelectionModeTrace} from '@libs/debug/SelectionModeTrace';

import ONYXKEYS from '@src/ONYXKEYS';

import Onyx from 'react-native-onyx';

const turnOnMobileSelectionMode = () => {
    logSelectionModeTrace('MobileSelectionMode', 'turnOn');
    Onyx.merge(ONYXKEYS.RAM_ONLY_MOBILE_SELECTION_MODE, true);
};

const turnOffMobileSelectionMode = () => {
    logSelectionModeTrace('MobileSelectionMode', 'turnOff', {}, {includeStack: true});
    Onyx.merge(ONYXKEYS.RAM_ONLY_MOBILE_SELECTION_MODE, false);
};

export {turnOnMobileSelectionMode, turnOffMobileSelectionMode};
