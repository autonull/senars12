/**
 * Panel definitions — now a view onto the unified surface registry (P2).
 *
 * A panel is a surface with `placement: 'panel'`. This module provides
 * backward-compatible APIs while the unified registry is the single source.
 */

import {
  surfaceRegistry,
  registerSurface,
  surfaceFor,
  getSurfaces,
  surfacesByPlacement,
  surfaceIdsByPlacement,
  type SurfaceDescriptor,
  type Placement,
  type Presentation,
} from '../framework/surface.js';
import { defineCatalog } from '../framework/catalog.js';

/** Panel-specific presentation options (subset of unified Presentation). */
export interface PanelPresentation extends Presentation {
  readonly dock: 'left' | 'right' | 'bottom' | 'float';
  readonly size: number;
  readonly order: number;
  readonly defaultOpen?: boolean;
  readonly component: string;
}

/** Backward-compatible panel entry. */
export interface PanelEntry {
  readonly label: string;
  readonly icon: string;
  readonly defaultDock: 'left' | 'right' | 'bottom' | 'float';
  readonly defaultSize: number;
  readonly order: number;
  readonly component: string;
  readonly defaultOpen?: boolean;
}

/** Convert a legacy PanelEntry to a unified SurfaceDescriptor. */
function toSurfaceDescriptor(id: string, entry: PanelEntry): SurfaceDescriptor {
  return {
    id,
    title: entry.label,
    label: entry.label,
    icon: entry.icon,
    tag: entry.component,
    placement: 'panel' as Placement,
    presentation: {
      dock: entry.defaultDock,
      size: entry.defaultSize,
      order: entry.order,
      defaultOpen: entry.defaultOpen,
      component: entry.component,
    } as PanelPresentation,
  };
}

/** The panel catalog definition (backward-compatible shape). */
const PANEL_CATALOG_DEFINITION = {
  search: {
    label: 'Search',
    icon: 'search',
    defaultDock: 'left',
    defaultSize: 280,
    order: 0,
    component: 's-search-panel',
    defaultOpen: false,
  },
  chat: {
    label: 'Chat',
    icon: 'chat',
    defaultDock: 'right',
    defaultSize: 360,
    order: 1,
    component: 'chat-history-panel',
    defaultOpen: false,
  },
  'lens-designer': {
    label: 'Lenses',
    icon: 'lens',
    defaultDock: 'right',
    defaultSize: 400,
    order: 2,
    component: 'lens-designer',
    defaultOpen: false,
  },
  split: {
    label: 'Split',
    icon: 'split',
    defaultDock: 'bottom',
    defaultSize: 300,
    order: 3,
    component: 'split-panel',
    defaultOpen: false,
  },
} as const;

/** Backward-compatible catalog using defineCatalog. */
export const PANEL_DEFS = defineCatalog(PANEL_CATALOG_DEFINITION);

/** The semantic kind of a panel — the catalog keys are its source. */
export type PanelKind = keyof typeof PANEL_DEFS.definition;

/** Every panel kind, in catalog order. */
export const PANEL_KINDS = PANEL_DEFS.ids;

export type PanelEntryType = typeof PANEL_DEFS.definition[PanelKind];

export const panelDef = (kind: PanelKind): PanelEntryType => PANEL_DEFS.get(kind);

/** The kinds a facet selects, in catalog order — the one way a partial set is read. */
export const panelKindsWhere = (facet: (def: PanelEntryType) => boolean): PanelKind[] =>
  PANEL_DEFS.where(facet);

/** Register all panels into the unified surface registry. */
export function registerPanels(): void {
  for (const [id, entry] of Object.entries(PANEL_CATALOG_DEFINITION)) {
    registerSurface(toSurfaceDescriptor(id, entry));
  }
}

/** Get a panel as a unified surface descriptor. */
export const panelSurface = (id: string): SurfaceDescriptor | undefined => {
  const surface = surfaceFor(id);
  if (!surface || surface.placement !== 'panel') return undefined;
  return surface;
};

/** All panel surfaces from the unified registry. */
export const panelSurfaces = (): readonly SurfaceDescriptor[] =>
  surfacesByPlacement('panel');

/** Re-export the unified registry for new code. */
export { surfaceRegistry, registerSurface, surfaceFor, getSurfaces, surfacesByPlacement, surfaceIdsByPlacement };
export type { SurfaceDescriptor, Placement, Presentation };