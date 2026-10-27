import useDefaultAvatars from '@hooks/useDefaultAvatars';
import useOnyx from '@hooks/useOnyx';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';

import type {AvatarSource} from '@libs/UserAvatarUtils';
import {getAvatar, isUserUploadedAvatarURL, optimizeAvatarSource, parseLetterAvatarURL} from '@libs/UserAvatarUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

import {accountIDSelector} from '@selectors/Session';
import React from 'react';

import type {AvatarCommonProps} from './types';

import useAvatarLoadError from './hooks/useAvatarLoadError';
import AvatarContainer from './primitives/AvatarContainer';
import AvatarIcon from './primitives/AvatarIcon';
import AvatarImage from './primitives/AvatarImage';
import AvatarLetter from './primitives/AvatarLetter';

type UserAvatarProps = AvatarCommonProps & {
    /** A fallback avatar icon to display when there is an error on loading avatar from remote URL. */
    fallbackIcon?: AvatarSource;

    /** Used to locate fallback icon in end-to-end tests. */
    fallbackIconTestID?: string;

    /** Owning account ID. Picks the default avatar when `source` is a default or absent. */
    accountID: number;
};

/** Renders a user avatar, falling back to a default icon when no source is available. */
function UserAvatar({
    source,
    imageStyles,
    iconAdditionalStyles,
    containerStyles,
    size = CONST.AVATAR_SIZE.DEFAULT,
    fallbackIcon,
    fallbackIconTestID = '',
    accountID,
    testID,
}: UserAvatarProps) {
    const defaultAvatars = useDefaultAvatars();
    const theme = useTheme();
    const StyleUtils = useStyleUtils();
    const {hasImageError, onImageError} = useAvatarLoadError(source);
    const [currentUserAccountID] = useOnyx(ONYXKEYS.SESSION, {selector: accountIDSelector});
    const [uploadedAvatarCacheVersion] = useOnyx(ONYXKEYS.UPLOADED_AVATAR_CACHE_VERSION);

    const resolvedSource = getAvatar({avatarSource: source, accountID, defaultAvatars});

    // Generated letter-avatar URLs are not fetched — their color and initials are parsed out and drawn locally.
    const letterAvatar = parseLetterAvatarURL(resolvedSource);
    if (letterAvatar) {
        return (
            <AvatarContainer
                containerStyles={containerStyles}
                testID={testID}
            >
                <AvatarLetter
                    initials={letterAvatar.initials}
                    urlColors={letterAvatar.colors}
                    accountID={accountID}
                    size={size}
                    shape={CONST.AVATAR_SHAPE.CIRCLE}
                    containerStyles={imageStyles}
                    containerAdditionalStyles={iconAdditionalStyles}
                />
            </AvatarContainer>
        );
    }

    const optimizedSource = optimizeAvatarSource(resolvedSource);
    const useFallBackAvatar = hasImageError || !resolvedSource || resolvedSource === defaultAvatars.FallbackAvatar;
    const fallbackAvatar = (fallbackIcon ?? defaultAvatars.FallbackAvatar) || defaultAvatars.FallbackAvatar;
    const fallbackAvatarTestID = fallbackIconTestID || 'SvgFallbackAvatar Icon';
    const avatarSource = useFallBackAvatar ? fallbackAvatar : (optimizedSource ?? fallbackAvatar);

    if (typeof avatarSource === 'string') {
        // The backend reuses one URL per account. A version recorded after this device's own upload
        // makes expo-image miss the bitmap it cached for that URL. Other accounts keep the URL key.
        const uploadedAvatarCacheKey =
            currentUserAccountID === accountID && uploadedAvatarCacheVersion != null && isUserUploadedAvatarURL(avatarSource) ? `${avatarSource}#${uploadedAvatarCacheVersion}` : undefined;

        return (
            <AvatarContainer
                containerStyles={containerStyles}
                testID={testID}
            >
                <AvatarImage
                    avatarSource={avatarSource}
                    cacheKey={uploadedAvatarCacheKey}
                    size={size}
                    shape={CONST.AVATAR_SHAPE.CIRCLE}
                    imageStyles={imageStyles}
                    imageContainerAdditionalStyles={iconAdditionalStyles}
                    onImageError={onImageError}
                />
            </AvatarContainer>
        );
    }

    let iconColors = null;
    if (useFallBackAvatar && avatarSource === defaultAvatars.FallbackAvatar) {
        iconColors = StyleUtils.getBackgroundColorAndFill(theme.buttonHoveredBG, theme.icon);
    }

    return (
        <AvatarContainer
            containerStyles={containerStyles}
            testID={testID}
        >
            <AvatarIcon
                avatarSource={avatarSource}
                size={size}
                shape={CONST.AVATAR_SHAPE.CIRCLE}
                iconContainerStyles={imageStyles}
                iconAdditionalStyles={iconAdditionalStyles}
                fallbackAvatarTestID={fallbackAvatarTestID}
                iconColors={iconColors}
                fill={iconColors?.fill ?? (hasImageError ? theme.offline : undefined)}
            />
        </AvatarContainer>
    );
}

export default UserAvatar;

export type {UserAvatarProps};
