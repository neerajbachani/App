import type {AvatarPrimitivesCommonProps} from '@components/Avatar/types';
import Image from '@components/Image';

import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';

import type {ImageStyle, StyleProp, ViewStyle} from 'react-native';

import React, {useMemo} from 'react';
import {View} from 'react-native';

type AvatarImageProps = AvatarPrimitivesCommonProps & {
    /** URL of the remote avatar image. */
    avatarSource: string;

    /** Overrides expo-image's URL cache key. Set for the current user's uploaded photo after a successful upload. */
    cacheKey?: string;

    /** Callback invoked when the avatar image fails to load. */
    onImageError: () => void;

    /** Styles for View wrapping Icon / Image. */
    imageStyles?: StyleProp<ViewStyle & ImageStyle>;

    /** Additional styles for Icon */
    imageContainerAdditionalStyles?: StyleProp<ViewStyle>;
};

/** Renders an avatar as a remote image. */
function AvatarImage({avatarSource, cacheKey, size, shape, imageStyles, imageContainerAdditionalStyles, onImageError}: AvatarImageProps) {
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();
    const imageStyle = [StyleUtils.getAvatarStyle(size), imageStyles, styles.noBorderRadius];
    const imageContainerStyle = imageStyles ? [StyleUtils.getAvatarStyle(size), styles.bgTransparent, imageStyles] : undefined;
    const source = useMemo(() => (cacheKey ? {uri: avatarSource, cacheKey} : {uri: avatarSource}), [avatarSource, cacheKey]);

    return (
        <View style={[imageContainerStyle, StyleUtils.getAvatarBorderStyle(size, shape), imageContainerAdditionalStyles]}>
            {/* eslint-disable-next-line react-native-a11y/has-valid-accessibility-ignores-invert-colors -- Custom Image wrapper does not support this prop. */}
            <Image
                key={size}
                source={source}
                style={imageStyle}
                onError={onImageError}
                cachePolicy="memory-disk"
            />
        </View>
    );
}

export default AvatarImage;
