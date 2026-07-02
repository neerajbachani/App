import React from 'react';
import Icon from '@components/Icon';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Tooltip from '@components/Tooltip';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';

type VictoryChartExpandButtonProps = {
    /** Called when the user presses the expand button */
    onPress: () => void;
};

function VictoryChartExpandButton({onPress}: VictoryChartExpandButtonProps) {
    const styles = useThemeStyles();
    const theme = useTheme();
    const {translate} = useLocalize();
    const icons = useMemoizedLazyExpensifyIcons(['Expand']);

    return (
        <Tooltip text={translate('videoPlayer.expand')}>
            <PressableWithFeedback
                accessibilityLabel={translate('videoPlayer.expand')}
                role={CONST.ROLE.BUTTON}
                onPress={onPress}
                // Overlays the chart's top-right corner without affecting the chart's layout. The pressable
                // intentionally captures pointer events in that corner, suppressing any underlying chart
                // gesture layer — acceptable since charts render nothing interactive there.
                // Positioning must go on wrapperStyle (the outermost OpacityView) — styling the inner
                // pressable would leave the zero-height wrapper in normal flow below the chart, rendering
                // the button outside the chart bounds where the next message intercepts its clicks.
                wrapperStyle={[styles.pAbsolute, styles.t0, styles.r0, styles.m1]}
                style={{backgroundColor: theme.buttonDefaultBG, borderRadius: 8, padding: 4}}
                hoverStyle={{backgroundColor: theme.buttonHoveredBG}}
            >
                <Icon
                    src={icons.Expand}
                    fill={theme.icon}
                    small
                />
            </PressableWithFeedback>
        </Tooltip>
    );
}

VictoryChartExpandButton.displayName = 'VictoryChartExpandButton';

export default VictoryChartExpandButton;
