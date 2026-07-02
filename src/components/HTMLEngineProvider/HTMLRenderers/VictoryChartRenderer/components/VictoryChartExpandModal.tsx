import React, {useState} from 'react';
import type {LayoutChangeEvent} from 'react-native';
import {View} from 'react-native';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import Modal from '@components/Modal';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import VictoryChartContainer from './VictoryChartContainer';
import VictoryChartContent from './VictoryChartContent';

type VictoryChartExpandModalProps = {
    /** Whether the modal is visible */
    isVisible: boolean;

    /** Called when the modal should close */
    onClose: () => void;
};

/**
 * Centered full-screen modal that re-renders the current chart at full viewport width.
 * Must be rendered inside a VictoryChartProvider so VictoryChartContent can read the parsed chart context.
 */
function VictoryChartExpandModal({isVisible, onClose}: VictoryChartExpandModalProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const [chartAreaHeight, setChartAreaHeight] = useState<number>();

    const handleChartAreaLayout = (event: LayoutChangeEvent) => {
        setChartAreaHeight(event.nativeEvent.layout.height);
    };

    return (
        <Modal
            isVisible={isVisible}
            type={CONST.MODAL.MODAL_TYPE.CENTERED_UNSWIPEABLE}
            onClose={onClose}
            shouldHandleNavigationBack
            enableEdgeToEdgeBottomSafeAreaPadding
        >
            <ScreenWrapper
                shouldEnableMaxHeight
                includePaddingTop={false}
                includeSafeAreaPaddingBottom={false}
                testID="VictoryChartExpandModal"
            >
                <HeaderWithBackButton
                    title={translate('common.details')}
                    onBackButtonPress={onClose}
                    shouldShowBackButton
                />
                <View
                    style={[styles.flex1, styles.w100]}
                    onLayout={handleChartAreaLayout}
                >
                    <ScrollView
                        contentContainerStyle={[styles.flexGrow1, styles.justifyContentCenter, styles.ph5, styles.pv3]}
                        keyboardShouldPersistTaps="handled"
                    >
                        <VictoryChartContainer
                            maxScale={Number.POSITIVE_INFINITY}
                            availableViewportHeight={chartAreaHeight}
                        >
                            <VictoryChartContent />
                        </VictoryChartContainer>
                    </ScrollView>
                </View>
            </ScreenWrapper>
        </Modal>
    );
}

VictoryChartExpandModal.displayName = 'VictoryChartExpandModal';

export default VictoryChartExpandModal;
