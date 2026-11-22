/**
 * Shared app-shell components — barrel export.
 */
export { AppChrome } from './app-chrome';

export {
  DEFAULT_PRESET,
  FILTER_ALL,
  resolveGlobals,
  resolveLayout,
  compositionFromUrl,
  compositionToSearch,
  applyGlobals,
} from './config-sync';

export { ComposerControls, hasGraphSurface } from './composer-controls';
export type { ComposerSurface } from './composer-controls';

export { GraphViewportWrapper } from './graph-viewport-wrapper';
export type { GraphViewportWrapperConfig } from './graph-viewport-wrapper';

export { createGraphProjector } from './workspace-graph-projector';
export type { GraphProjectionConfig, UseGraphProjectionReturn } from './workspace-graph-projector';

export { ToolbarSelect } from './toolbar-select';
export type { SelectOption } from './toolbar-select';

export { GraphToolbar } from './graph-toolbar';
export type { GraphToolbarConfig } from './graph-toolbar';