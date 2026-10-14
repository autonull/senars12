/**
 * Lab presets — the catalogue of compositions the Lab opens on.
 *
 * Each preset is a Composition with explicit area names, so the Lab can reuse
 * composition-view and composer-controls. Custom grid templates (columns/rows)
 * are preserved via the optional layout override on the composition.
 */

import { registerComposition, type Composition, type Globals, type LayoutId } from '../../framework/composition.js';

/** The global controls every graph-bearing preset starts from. */
const GRAPH_GLOBALS: Required<Globals> = {
  lens: 'belief',
  layer: 'both',
  shape: 'graph',
  mode: '2d',
  fit: 'legible',
  filter: 'all',
};

/** A composition with optional custom grid template (for hand-crafted presets). */
interface LabComposition extends Composition {
  /** Custom columns template (overrides layout). */
  columns?: string;
  /** Custom rows template (overrides layout). */
  rows?: string;
  /** Custom areas template (overrides layout). */
  areas?: string;
  /** Human-readable description for the catalogue. */
  blurb: string;
}

/** Single-pane presets — use standard layouts. */
const singlePane = (
  id: string,
  name: string,
  blurb: string,
  surface: string,
  layout: LayoutId = 'auto',
  globals?: Globals
): LabComposition => ({
  id,
  name,
  blurb,
  layout,
  cells: [{ surface, area: 'a' }],
  globals: globals ?? GRAPH_GLOBALS,
});

/** Two-pane presets with custom area names and standard 'h' layout. */
const twoPane = (
  id: string,
  name: string,
  blurb: string,
  left: { surface: string; area: string },
  right: { surface: string; area: string },
  globals?: Globals
): LabComposition => ({
  id,
  name,
  blurb,
  layout: 'h',
  cells: [
    { surface: left.surface, area: left.area },
    { surface: right.surface, area: right.area },
  ],
  globals: globals ?? GRAPH_GLOBALS,
});

/** Three-pane presets with custom area names. */
const threePane = (
  id: string,
  name: string,
  blurb: string,
  cells: { surface: string; area: string }[],
  layout: LayoutId = 'h',
  globals?: Globals
): LabComposition => ({
  id,
  name,
  blurb,
  layout,
  cells: cells.map((c) => ({ surface: c.surface, area: c.area })),
  globals: globals ?? GRAPH_GLOBALS,
});

/** Presets with custom grid templates (columns/rows/areas). */
const custom = (
  id: string,
  name: string,
  blurb: string,
  cells: { surface: string; area: string }[],
  columns: string,
  rows: string,
  areas: string,
  globals?: Globals
): LabComposition => ({
  id,
  name,
  blurb,
  layout: 'auto',
  cells: cells.map((c) => ({ surface: c.surface, area: c.area })),
  columns,
  rows,
  areas,
  globals: globals ?? GRAPH_GLOBALS,
});

/** Every Lab preset as a Composition. */
export const LAB_PRESETS: readonly LabComposition[] = [
  // ── single pane ──────────────────────────────────────────────────────────────
  singlePane('chat', 'Chat', 'The bare conversational loop — say it, get an answer, one-click why.', 'ask-surface'),
  singlePane('graph', 'Graph', 'The knowledge substrate, spatial — concepts, truth, provenance.', 'graph-surface'),
  singlePane('notebook', 'Notebook', 'The same blocks as a document — headings, claims, derivations.', 'notebook-surface'),
  singlePane('console', 'Console', 'The REPL mirror of the bot — power-user ingress.', 'console-surface'),
  singlePane('goals', 'Goals', 'The teleological workspace — objectives, gates, budgets.', 'goals-surface'),
  singlePane('explore', 'Explore', 'The knowledge map — browse concepts, truth, neighbours.', 'explore-surface'),
  singlePane('hud', 'HUD (legacy)', 'The maximalist debugger console, as one option among many.', 'hud-surface'),

  // ── two-pane splits (standard h layout, named areas) ────────────────────────
  twoPane('chat-graph', 'Chat ⇄ Graph (split)', 'Speak on the left, watch knowledge form on the right.',
    { surface: 'ask-surface', area: 'chat' }, { surface: 'graph-surface', area: 'graph' }),
  twoPane('graph-chat', 'Graph ⇄ Chat (split)', 'Knowledge first; the conversation as a side panel.',
    { surface: 'graph-surface', area: 'graph' }, { surface: 'ask-surface', area: 'chat' }),
  twoPane('chat-notebook', 'Chat ⇄ Notebook', 'The conversation and its readable projection, side by side.',
    { surface: 'ask-surface', area: 'chat' }, { surface: 'notebook-surface', area: 'doc' }),
  twoPane('notebook-graph', 'Notebook ⇄ Graph', 'Read the argument; see it as structure.',
    { surface: 'notebook-surface', area: 'doc' }, { surface: 'graph-surface', area: 'graph' }),
  twoPane('console-graph', 'Console + Graph', 'Type Narsese; watch the concept graph answer.',
    { surface: 'console-surface', area: 'console' }, { surface: 'graph-surface', area: 'graph' }),
  twoPane('goals-graph', 'Goals + Graph', 'Objectives and the reasoning that serves them.',
    { surface: 'goals-surface', area: 'goals' }, { surface: 'graph-surface', area: 'graph' }),
  twoPane('explore-chat', 'Explore + Chat', 'Browse the map, ask about what you find.',
    { surface: 'explore-surface', area: 'explore' }, { surface: 'ask-surface', area: 'chat' }),
  twoPane('chat-metrics', 'Chat + Telemetry', 'Conversation with the live cognitive meters beside it.',
    { surface: 'ask-surface', area: 'chat' }, { surface: 'telemetry-panel', area: 'metrics' }),
  twoPane('hud-chat', 'HUD + Chat', 'The debugger and the assistant, together.',
    { surface: 'hud-surface', area: 'hud' }, { surface: 'ask-surface', area: 'chat' }),
  twoPane('chat-history', 'Chat + History', 'The transcript beside the live thread.',
    { surface: 'ask-surface', area: 'chat' }, { surface: 'chat-history-panel', area: 'history' }),

  // ── three-pane (standard layouts) ───────────────────────────────────────────
  threePane('triple', 'Chat | Graph | Notebook', 'All three projections of one substrate, simultaneously.',
    [{ surface: 'ask-surface', area: 'chat' }, { surface: 'graph-surface', area: 'graph' }, { surface: 'notebook-surface', area: 'doc' }]),
  threePane('notebook-inspector-chat', 'Notebook + Inspector + Chat', 'A three-pane reasoning desk.',
    [{ surface: 'notebook-surface', area: 'doc' }, { surface: 'node-detail-drawer', area: 'inspector' }, { surface: 'ask-surface', area: 'chat' }]),
  threePane('reasoning-desk', 'Reasoning Desk', 'Ask, read, and inspect in one workspace.',
    [{ surface: 'ask-surface', area: 'chat' }, { surface: 'notebook-surface', area: 'doc' }, { surface: 'node-detail-drawer', area: 'inspector' }]),
  threePane('command-deck', 'Command Deck', 'Console, goals, and the graph they operate on.',
    [{ surface: 'console-surface', area: 'console' }, { surface: 'goals-surface', area: 'goals' }, { surface: 'graph-surface', area: 'graph' }]),
  threePane('chat-console', 'Chat + Console', 'Natural language and raw Narsese, together.',
    [{ surface: 'ask-surface', area: 'chat' }, { surface: 'console-surface', area: 'console' }]),
  threePane('notebook-goals', 'Notebook + Goals', 'Read the argument; state the objectives.',
    [{ surface: 'notebook-surface', area: 'doc' }, { surface: 'goals-surface', area: 'goals' }]),

  // ── custom grid templates (hand-crafted columns/rows/areas) ────────────────
  custom('graph-stack', 'Graph over Chat', 'Full-width canvas with the composer beneath it.',
    [{ surface: 'graph-surface', area: 'graph' }, { surface: 'ask-surface', area: 'chat' }],
    '1fr', '1.6fr minmax(0, 1fr)', '"graph" "chat"'),

  custom('dashboard', 'Dashboard', 'Metrics + graph + conversation: the observability wall.',
    [{ surface: 'cognitive-metrics', area: 'metrics' }, { surface: 'graph-surface', area: 'graph' }, { surface: 'ask-surface', area: 'chat' }],
    '260px 1fr 360px', '1fr', '"metrics graph chat"'),

  custom('graph-inspector', 'Graph + Inspector', 'Canvas with a live detail rail for the selection.',
    [{ surface: 'graph-surface', area: 'graph' }, { surface: 'node-detail-drawer', area: 'inspector' }],
    '1fr 340px', '1fr', '"graph inspector"'),

  custom('graph-timeline', 'Graph + Timeline', 'Reasoning history as a scrubber under the canvas.',
    [{ surface: 'graph-surface', area: 'graph' }, { surface: 'timeline-scrubber', area: 'timeline' }],
    '1fr', '1fr 180px', '"graph" "timeline"'),

  custom('graph-toc-chat', 'Graph + Outline + Chat', 'Navigate the argument, talk to the engine.',
    [{ surface: 's-toc', area: 'toc' }, { surface: 'graph-surface', area: 'graph' }, { surface: 'ask-surface', area: 'chat' }],
    '240px 1fr 320px', '1fr', '"toc graph chat"'),

  custom('graph-minimap', 'Graph + Minimap + Legend', 'Overview first, detail on demand.',
    [{ surface: 'graph-surface', area: 'graph' }, { surface: 'graph-legend', area: 'legend' }, { surface: 'graph-minimap', area: 'minimap' }, { surface: 'lens-controller', area: 'lens' }],
    '1fr 200px', '1fr', '"graph rail"', // areas will be generated from cells
    { ...GRAPH_GLOBALS }),

  custom('chat-minimap', 'Chat + Knowledge map', 'Conversation with a thumbnail of the whole graph.',
    [{ surface: 'ask-surface', area: 'chat' }, { surface: 'graph-minimap', area: 'map' }, { surface: 'cognitive-metrics', area: 'metrics' }],
    'minmax(340px, 1fr) 260px', '1fr', '"chat map"'),

  custom('graph-chat-timeline', 'Graph + Chat + Timeline', 'The full loop: see, speak, replay.',
    [{ surface: 'graph-surface', area: 'graph' }, { surface: 'ask-surface', area: 'chat' }, { surface: 'timeline-scrubber', area: 'timeline' }],
    '1.4fr minmax(320px, 1fr)', '1fr 160px', '"graph chat" "timeline timeline"'),

  // ── graph modes ──────────────────────────────────────────────────────────────
  singlePane('graph-3d', 'Graph — 3D', 'The SpaceGraphJS canvas — the spatial substrate in three dimensions.', 'graph-surface', 'auto', { ...GRAPH_GLOBALS, mode: '3d', fit: 'fit' }),
  singlePane('graph-table', 'Graph — Table', 'The same graph as a sortable table projection.', 'graph-surface', 'auto', { ...GRAPH_GLOBALS, shape: 'table' }),
  twoPane('chat-graph-3d', 'Chat ⇄ Graph 3D', 'Talk to the engine beside the 3D canvas.',
    { surface: 'ask-surface', area: 'chat' }, { surface: 'graph-surface', area: 'graph' }, { ...GRAPH_GLOBALS, mode: '3d' }),
  custom('graph-3d-table', 'Graph 3D + Table', 'Two projections of one substrate: spatial and tabular.',
    [{ surface: 'graph-surface', area: 'graph' }, { surface: 'explore-surface', area: 'table' }],
    '1.4fr 1fr', '1fr', '"graph table"', { ...GRAPH_GLOBALS, mode: '3d' }),

  // ── chrome: toolbars, rails, panels ─────────────────────────────────────────
  custom('graph-full-chrome', 'Graph + Full Chrome', 'Canvas with its own top toolbar, minimap and legend rail.',
    [{ surface: 'graph-toolbar', area: 'toolbar' }, { surface: 'graph-surface', area: 'graph' }, { surface: 'graph-minimap', area: 'minimap' }, { surface: 'graph-legend', area: 'legend' }, { surface: 'lens-controller', area: 'lens' }],
    '1fr 200px', '1fr', '"graph rail"'),

  custom('config-desk', 'Config Desk', 'Tune the engine live while watching the graph.',
    [{ surface: 'config-hud', area: 'config' }, { surface: 'graph-surface', area: 'graph' }],
    '300px 1fr', '1fr', '"config graph"'),

  custom('lens-desk', 'Lens Desk', 'Design a projection and see it applied.',
    [{ surface: 'graph-surface', area: 'graph' }, { surface: 'lens-designer', area: 'lens' }],
    '1fr 340px', '1fr', '"graph lens"'),

  custom('telemetry-wall', 'Telemetry Wall', 'Every meter the kernel exposes, side by side.',
    [{ surface: 'telemetry-panel', area: 't' }, { surface: 'cognitive-metrics', area: 'c' }, { surface: 'graph-surface', area: 'g' }],
    '1fr 1fr', '1fr 1fr', '"t c" "g g"'),

  custom('graph-events', 'Graph + Event Log', 'The reasoning stream beside the state it produces.',
    [{ surface: 'graph-surface', area: 'graph' }, { surface: 's-events', area: 'events' }],
    '1.5fr minmax(300px, 1fr)', '1fr', '"graph events"'),

  custom('graph-nodes', 'Graph + Node List', 'The spatial view and the list view of the same concepts.',
    [{ surface: 'graph-surface', area: 'graph' }, { surface: 's-nodes', area: 'nodes' }],
    '1.5fr minmax(280px, 1fr)', '1fr', '"graph nodes"'),

  custom('graph-related', 'Graph + Related', 'Focus a concept; explore its neighbourhood.',
    [{ surface: 'graph-surface', area: 'graph' }, { surface: 's-related', area: 'related' }],
    '1fr 320px', '1fr', '"graph related"'),

  custom('graph-explain', 'Graph + Explain', 'The derivation, made readable, beside the graph.',
    [{ surface: 'graph-surface', area: 'graph' }, { surface: 's-explain', area: 'explain' }],
    '1.4fr minmax(340px, 1fr)', '1fr', '"graph explain"'),

  custom('inspector-desk', 'Inspector Desk', 'Canvas, detail rail, and the timeline of reasoning.',
    [{ surface: 'graph-surface', area: 'graph' }, { surface: 'node-detail-drawer', area: 'inspector' }, { surface: 'timeline-scrubber', area: 'timeline' }],
    '1fr 320px', '1fr 160px', '"graph inspector" "timeline timeline"'),

  // ── multi-pane studies ──────────────────────────────────────────────────────
  custom('quad', 'Quad', 'A 2×2 of the four core projections.',
    [{ surface: 'ask-surface', area: 'chat' }, { surface: 'graph-surface', area: 'graph' }, { surface: 'notebook-surface', area: 'doc' }, { surface: 'cognitive-metrics', area: 'metrics' }],
    '1fr 1fr', '1fr 1fr', '"chat graph" "doc metrics"'),

  custom('briefing', 'Briefing', 'A summary rail of metrics over the canvas and the conversation.',
    [{ surface: 'graph-surface', area: 'main' }, { surface: 'cognitive-metrics', area: 'metrics' }, { surface: 'telemetry-panel', area: 'telemetry' }, { surface: 'chat-history-panel', area: 'history' }],
    '1fr 300px', '1fr', '"main brief"'),

  custom('mosaic', 'Mosaic', 'Six panes: chat, graph, notebook, metrics, console, explorer.',
    [{ surface: 'ask-surface', area: 'chat' }, { surface: 'graph-surface', area: 'graph' }, { surface: 'notebook-surface', area: 'doc' }, { surface: 'cognitive-metrics', area: 'metrics' }, { surface: 'console-surface', area: 'console' }, { surface: 'explore-surface', area: 'explore' }],
    '1fr 1fr 1fr', '1fr 1fr', '"chat graph doc" "metrics console explore"'),

  custom('study', 'Study', 'Everything: chat, notebook, graph, explorer, metrics, timeline.',
    [{ surface: 'ask-surface', area: 'chat' }, { surface: 'graph-surface', area: 'graph' }, { surface: 'notebook-surface', area: 'doc' }, { surface: 'console-surface', area: 'console' }, { surface: 'explore-surface', area: 'metrics' }, { surface: 'timeline-scrubber', area: 'timeline' }],
    'minmax(260px,1fr) 1.2fr minmax(260px,1fr)', '1.4fr 1fr', '"chat graph doc" "console metrics timeline"'),
];

/** Register every preset (idempotent). */
export const registerLabPresets = (): void => {
  for (const preset of LAB_PRESETS) registerComposition(preset);
};