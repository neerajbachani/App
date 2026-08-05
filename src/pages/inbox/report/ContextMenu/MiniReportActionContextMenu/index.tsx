import useStyleUtils from '@hooks/useStyleUtils';

import BaseReportActionContextMenu from '@pages/inbox/report/ContextMenu/BaseReportActionContextMenu';

import CONST from '@src/CONST';

import React, {useEffect, useRef} from 'react';
import {View} from 'react-native';

import type MiniReportActionContextMenuProps from './types';

const TOOLBAR_BUTTON_SELECTOR = `[role="${CONST.ROLE.BUTTON}"]:not([aria-disabled="true"])`;

function MiniReportActionContextMenu({displayAsGroup = false, ...rest}: MiniReportActionContextMenuProps) {
    const StyleUtils = useStyleUtils();
    const toolbarRef = useRef<View>(null);

    useEffect(() => {
        const toolbar = toolbarRef.current as unknown as HTMLElement | null;
        if (!toolbar) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            const isPrevious = event.key === CONST.KEYBOARD_SHORTCUTS.ARROW_LEFT.shortcutKey;
            const isNext = event.key === CONST.KEYBOARD_SHORTCUTS.ARROW_RIGHT.shortcutKey;
            if (!isPrevious && !isNext) {
                return;
            }

            const buttons = Array.from(toolbar.querySelectorAll<HTMLElement>(TOOLBAR_BUTTON_SELECTOR));
            const focusedIndex = buttons.indexOf(document.activeElement as HTMLElement);
            if (focusedIndex < 0 || buttons.length === 0) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const nextIndex = (focusedIndex + (isPrevious ? -1 : 1) + buttons.length) % buttons.length;
            buttons.at(nextIndex)?.focus();
        };

        toolbar.addEventListener('keydown', handleKeyDown);
        return () => toolbar.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <View
            ref={toolbarRef}
            role={CONST.ROLE.TOOLBAR}
            style={StyleUtils.getMiniReportActionContextMenuWrapperStyle(displayAsGroup)}
            dataSet={{[CONST.SELECTION_SCRAPER_HIDDEN_ELEMENT]: rest.isVisible ?? false}}
        >
            <BaseReportActionContextMenu
                isMini
                {...rest}
            />
        </View>
    );
}

export default MiniReportActionContextMenu;
