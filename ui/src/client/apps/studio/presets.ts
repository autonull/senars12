/**
 * Studio presets — the catalogue of compositions the Studio opens on.
 *
 * Each preset is *data*: an ordered set of cells, a layout and global controls.
 * Adding an app is adding a row here; the shell renders it, the URL addresses it.
 * The nested `study` preset proves recursion — a cell that is itself a
 * composition.
 */

import { registerComposition, type Composition, type Globals } from '../../framework/composition.js';

/** The global controls every graph-bearing preset starts from. */
const GRAPH_GLOBALS: Required<Globals> = {
  lens: 'belief',
  layer: 'both',
  shape: 'graph',
  mode: '2d',
  fit: 'legible',
  filter: 'all',
};

const chatGraph: Composition = {
  id: 'chat-graph',
  name: 'Chat ⇄ Graph',
  layout: 'h',
  cells: [{ surface: 'ask-surface' }, { surface: 'graph-surface' }],
  globals: GRAPH_GLOBALS,
};

const reasoningDesk: Composition = {
  id: 'reasoning-desk',
  name: 'Reasoning Desk',
  layout: 'grid',
  cells: [
    { surface: 'ask-surface' },
    { surface: 'notebook-surface' },
    { surface: 'node-detail-drawer' },
  ],
  globals: GRAPH_GLOBALS,
};

const graph3d: Composition = {
  id: 'graph-3d',
  name: 'Graph — 3D',
  layout: 'auto',
  cells: [{ surface: 'graph-surface' }],
  globals: { ...GRAPH_GLOBALS, layer: 'concepts', mode: '3d', fit: 'fit' },
};

const dashboard: Composition = {
  id: 'dashboard',
  name: 'Dashboard',
  layout: 'h',
  cells: [
    { surface: 'cognitive-metrics' },
    { surface: 'graph-surface' },
    { surface: 'ask-surface' },
  ],
  globals: GRAPH_GLOBALS,
};

/** Recursion: a cell that is itself a composition. */
const study: Composition = {
  id: 'study',
  name: 'Study',
  layout: 'h',
  cells: [{ composition: chatGraph }, { surface: 'notebook-surface' }],
  globals: GRAPH_GLOBALS,
};

/** Every Studio preset. */
export const STUDIO_PRESETS: readonly Composition[] = [
  chatGraph,
  reasoningDesk,
  graph3d,
  dashboard,
  study,
];

/** The composition the Studio opens on when the URL names none. */
export const DEFAULT_STUDIO_COMPOSITION = chatGraph;

/** Register every preset (idempotent). */
export const registerStudioPresets = (): void => {
  for (const preset of STUDIO_PRESETS) registerComposition(preset);
};
