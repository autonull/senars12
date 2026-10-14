/**
 * Shared app-shell components — barrel export.
 */
export { AppChrome } from './app-chrome.js';

export {
  DEFAULT_PRESET,
  FILTER_ALL,
  resolveGlobals,
  resolveLayout,
  compositionFromUrl,
  compositionToSearch,
  applyGlobals,
} from './config-sync.js';

export { ComposerControls, hasGraphSurface } from './composer-controls.js';
export type { ComposerSurface } from './composer-controls.js';

export { GraphViewportWrapper } from './graph-viewport-wrapper.js';
export type { GraphViewportWrapperConfig } from './graph-viewport-wrapper.js';

export { createGraphProjector } from './workspace-graph-projector.js';
export type { GraphProjectionConfig, UseGraphProjectionReturn } from './workspace-graph-projector.js';

export { ToolbarSelect } from './toolbar-select.js';
export type { SelectOption } from './toolbar-select.js';

export { GraphToolbar } from './graph-toolbar.js';
export type { GraphToolbarConfig } from './graph-toolbar.js';