/**
 * The one definition per `PanelKind` (Tracks E1–E3): every facet a panel kind
 * carries — its label, icon, default dock/size/order, and the custom-element tag
 * that renders it — lives on one record, so a kind cannot drift across the
 * hardcoded switch in `panel-dock.ts`, the command palette, the graph toolbar,
 * and the default state map in `store.ts`. The catalog is the source of the
 * `PanelKind` union (E1): `keyof typeof PANEL_DEFS`, so adding a panel is one
 * entry and no hand union to edit.
 */

import { defineCatalog } from '../framework/catalog.js';

export const PANEL_DEFS = defineCatalog({
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
} as const);

/** The semantic kind of a panel — the catalog keys are its source (E1). */
export type PanelKind = keyof typeof PANEL_DEFS.definition;

/** Every panel kind, in catalog order. */
export const PANEL_KINDS = PANEL_DEFS.ids;

export type PanelEntry = typeof PANEL_DEFS.definition[PanelKind];

export const panelDef = (kind: PanelKind): PanelEntry => PANEL_DEFS.get(kind);

/** The kinds a facet selects, in catalog order — the one way a partial set is read. */
export const panelKindsWhere = (facet: (def: PanelEntry) => boolean): PanelKind[] =>
  PANEL_DEFS.where(facet);