import { sharedStyles } from './shared_styles.js';
import * as physics from './physics.js';
import { YenvuiBase, YenvuiScrubTrack } from './yenvui-base.js';
import { YenvuiBtn, YenvuiAsyncBtn } from './async-btn.js';
import { YenvuiStatusBar } from './status-bar.js';
import { YenvuiToastContainer } from './toast.js';
import { YenvuiModal } from './modal.js';
import { YenvuiWindow } from './window.js';
import { YenvuiCard } from './card.js';
import { YenvuiCardGroup } from './card-group.js';
import { YenvuiCategorySection } from './category-section.js';
import { YenvuiSpinner } from './spinner.js';
import { YenvuiEmptyState } from './empty-state.js';
import { YenvuiBoard, YenvuiColumn } from './board.js';
import { YenvuiScrollView } from './scroll-view.js';
import { YenvuiDropdown, YenvuiFilterDropdown } from './dropdown.js';
import { YenvuiCollapsible } from './collapsible.js';
import { YenvuiPill } from './pill.js';
import { YenvuiFilterGroup } from './filter-group.js';
import { YenvuiTag } from './tag.js';
import { YenvuiLabel } from './label.js';
import { YenvuiSearchBar } from './search-bar.js';
import { YenvuiToolbar } from './toolbar.js';
import { YenvuiTabs } from './tabs.js';
import { YenvuiDiffViewer } from './diff-viewer.js';
import { YenvuiEditor } from './editor.js';
import { YenvuiDropOverlay, YenvuiDropTarget } from './drop-zone.js';
import { YenvuiSelectionTray } from './selection-tray.js';
import { YenvuiInput, YenvuiSelect, YenvuiTextarea, YenvuiToggle } from './inputs.js';

export const CHASSIS_PROVIDER_META = Object.freeze({
    name: 'yenvui',
    version: '2.0.0'
});
export {
    sharedStyles,
    physics,
    YenvuiBase as BaseElement,
    YenvuiBtn as Btn,
    YenvuiAsyncBtn as AsyncBtn,
    YenvuiStatusBar as StatusBar,
    YenvuiToastContainer as ToastContainer,
    YenvuiModal as Modal,
    YenvuiWindow as Window,
    YenvuiCard as Card,
    YenvuiCardGroup as CardGroup,
    YenvuiCategorySection as CategorySection,
    YenvuiSpinner as Spinner,
    YenvuiEmptyState as EmptyState,
    YenvuiBoard as Board,
    YenvuiColumn as Column,
    YenvuiScrubTrack as ScrubTrack,
    YenvuiScrollView as ScrollView,
    YenvuiDropdown as Dropdown,
    YenvuiFilterDropdown as FilterDropdown,
    YenvuiCollapsible as Collapsible,
    YenvuiPill as Pill,
    YenvuiFilterGroup as FilterGroup,
    YenvuiTag as Tag,
    YenvuiLabel as Label,
    YenvuiSearchBar as SearchBar,
    YenvuiToolbar as Toolbar,
    YenvuiTabs as Tabs,
    YenvuiDiffViewer as DiffViewer,
    YenvuiEditor as Editor,
    YenvuiDropOverlay as DropOverlay,
    YenvuiDropTarget as DropTarget,
    YenvuiSelectionTray as SelectionTray,
    YenvuiInput as Input,
    YenvuiSelect as Select,
    YenvuiTextarea as Textarea,
    YenvuiToggle as Toggle,
    // Preserve explicit Yenvui* named exports for backward compatibility
    YenvuiBase,
    YenvuiBtn,
    YenvuiAsyncBtn,
    YenvuiStatusBar,
    YenvuiToastContainer,
    YenvuiModal,
    YenvuiWindow,
    YenvuiCard,
    YenvuiCardGroup,
    YenvuiCategorySection,
    YenvuiSpinner,
    YenvuiEmptyState,
    YenvuiBoard,
    YenvuiColumn,
    YenvuiScrubTrack,
    YenvuiScrollView,
    YenvuiDropdown,
    YenvuiFilterDropdown,
    YenvuiCollapsible,
    YenvuiPill,
    YenvuiFilterGroup,
    YenvuiTag,
    YenvuiLabel,
    YenvuiSearchBar,
    YenvuiToolbar,
    YenvuiTabs,
    YenvuiDiffViewer,
    YenvuiEditor,
    YenvuiDropOverlay,
    YenvuiDropTarget,
    YenvuiSelectionTray,
    YenvuiInput,
    YenvuiSelect,
    YenvuiTextarea,
    YenvuiToggle
};
