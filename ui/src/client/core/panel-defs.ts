/**
 * The one definition per `PanelKind` (Tracks E1–E3): every facet a panel kind
 * carries — its label, icon, default dock/size/order, and the custom-element tag
 * that renders it — lives on one record, so a kind cannot drift across the
 * hardcoded switch in `panel-dock.ts`, the command palette, the graph toolbar,
 * and the default state map in `store.ts`. The catalog is the source of the
 * `PanelKind` union (E1): `keyof typeof PANEL_DEFS`, so adding a panel is one
 * entry and no hand union to edit.
 *
 * `d()` defaults every facet, so a new panel names only what it is; an unknown
 * facet key is an excess-property error against `PanelDef`.
 */

export interface PanelDef {
  /** Human label for tabs, palette, and toolbar. */
  readonly label: string;
  /** Icon name for the tab/header (matches `s-icon` names). */
  readonly icon: string;
  /** Default dock edge when opened. */
  readonly defaultDock: 'left' | 'right' | 'bottom' | 'float';
  /** Default width/height in pixels. */
  readonly defaultSize: number;
  /** Tab order (lower = earlier). */
  readonly order: number;
  /** Custom-element tag that renders this panel. */
  readonly component: string;
  /** Whether the panel opens by default on first load. */
  readonly defaultOpen: boolean;
}

const d = (
  label: string,
  facets: Partial<Omit<PanelDef, 'label'>> = {}
): PanelDef => ({
  label,
  icon: 'panel',
  defaultDock: 'right',
  defaultSize: 360,
  order: 0,
  component: 's-panel',
  defaultOpen: false,
  ...facets,
});

export const PANEL_DEFS = {
  search: d('Search', {
    icon: 'search',
    defaultDock: 'left',
    defaultSize: 280,
    order: 0,
    component: 's-search-panel',
  }),
  chat: d('Chat', {
    icon: 'chat',
    defaultDock: 'right',
    defaultSize: 360,
    order: 1,
    component: 'chat-history-panel',
    defaultOpen: false,
  }),
  'lens-designer': d('Lenses', {
    icon: 'lens',
    defaultDock: 'right',
    defaultSize: 400,
    order: 2,
    component: 'lens-designer',
  }),
  split: d('Split', {
    icon: 'split',
    defaultDock: 'bottom',
    defaultSize: 300,
    order: 3,
    component: 'split-panel',
  }),
} as const satisfies Record<string, PanelDef>;

/** The semantic kind of a panel — the catalog keys are its source (E1). */
export type PanelKind = keyof typeof PANEL_DEFS;

/** Every panel kind, in catalog order. */
export const PANEL_KINDS = Object.keys(PANEL_DEFS) as readonly PanelKind[];

export const panelDef = (kind: PanelKind): PanelDef => PANEL_DEFS[kind];

/** The kinds a facet selects, in catalog order — the one way a partial set is read. */
export const panelKindsWhere = (facet: (def: PanelDef) => boolean): PanelKind[] =>
  PANEL_KINDS.filter((kind) => facet(PANEL_DEFS[kind]));