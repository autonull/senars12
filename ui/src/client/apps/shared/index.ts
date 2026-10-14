/**
 * Shared app-shell components — barrel export.
 */
export { BaseAppSurface } from './base-app-surface.js';
export type { BaseAppSurfaceConfig } from './base-app-surface.js';

export { GraphViewportWrapper } from './graph-viewport-wrapper.js';
export type { GraphViewportWrapperConfig } from './graph-viewport-wrapper.js';

export { createGraphProjector } from './workspace-graph-projector.js';
export type { GraphProjectionConfig, UseGraphProjectionReturn } from './workspace-graph-projector.js';

export { ToolbarSelect } from './toolbar-select.js';
export type { SelectOption } from './toolbar-select.js';

export { GraphToolbar } from './graph-toolbar.js';
export type { GraphToolbarConfig } from './graph-toolbar.js';