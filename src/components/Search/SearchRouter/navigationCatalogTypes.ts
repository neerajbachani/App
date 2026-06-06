import type {ExpensifyIconName} from '@components/Icon/ExpensifyIconLoader';
import type {AvatarSource} from '@libs/UserAvatarUtils';
import type {TranslationPaths} from '@src/languages/types';
import type {Route} from '@src/ROUTES';
import type IconAsset from '@src/types/utils/IconAsset';

type NavigationCatalogCategory = 'topLevel' | 'spend' | 'account' | 'workspace' | 'create';

type NavigationCatalogEntry = {
    /** Stable identifier used to build the row key */
    id: string;

    /** Category used for ordering and tie-breaking */
    category: NavigationCatalogCategory;

    /** Translation key for the destination or action label */
    titleKey?: TranslationPaths;

    /** Pre-translated label (used when titleKey is not applicable) */
    title?: string;

    /** Optional untranslated synonyms to widen matching */
    keywords?: string[];

    /** ExpensifyIconName literal for lazy-loading the left icon */
    iconName?: ExpensifyIconName;

    /** Pre-resolved left icon (used when iconName is not sufficient, e.g. create expense) */
    icon?: IconAsset;

    /** Whether the theme fill color should be applied to the left icon */
    shouldIconApplyFill?: boolean;

    /** Route to navigate to when selected */
    route?: Route;

    /** Action to run when selected instead of navigating */
    onSelectAction?: () => void;

    /** When true, row text is prefixed with "Go to {destination}" */
    shouldUseGoToPrefix?: boolean;

    /** Optional muted text shown on the right side of the row */
    rightTextKey?: TranslationPaths;

    /** Optional pre-translated right-side text */
    rightText?: string;

    /** Optional small icon shown to the left of rightText */
    rightIconName?: ExpensifyIconName;

    /** Optional workspace avatar shown to the left of rightText */
    rightAvatar?: {
        source: AvatarSource;
        name: string;
        id: string;
    };

    /** When true, selecting this entry should clear the search context before navigating */
    shouldClearSearchContext?: boolean;
};

const NAVIGATION_CATALOG_CATEGORY_ORDER: Record<NavigationCatalogCategory, number> = {
    topLevel: 0,
    spend: 1,
    account: 2,
    workspace: 3,
    create: 4,
};

export default NAVIGATION_CATALOG_CATEGORY_ORDER;
export type {NavigationCatalogCategory, NavigationCatalogEntry};
