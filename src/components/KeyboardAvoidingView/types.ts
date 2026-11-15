import type {KeyboardAvoidingViewProps as RNKeyboardAvoidingViewProps} from 'react-native';

type KeyboardAvoidingViewProps = RNKeyboardAvoidingViewProps & {
    /**
     * Whether to compensate for the bottom safe area padding.
     * The KeyboardAvoidingView will use a negative keyboardVerticalOffset.
     */
    shouldOffsetBottomSafeAreaPadding?: boolean;

    /** Measures the view in the window so padding accounts for a modal header above the form. */
    automaticOffset?: boolean;
};

// eslint-disable-next-line import/prefer-default-export
export type {KeyboardAvoidingViewProps};
