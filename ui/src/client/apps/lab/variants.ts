/**
 * UI Lab — a catalogue of layout metaphors over the one workspace substrate.
 *
 * Every variant is *data*: a CSS grid (areas/columns/rows) plus the surface tags
 * mounted into each named region. Adding a metaphor is one entry, no new code —
 * the same components recomposed. This is the "throw it at the wall" surface:
 * pick the arrangements that read well and promote them to a real app.
 */

export interface Variant {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly columns: string;
  readonly rows: string;
  readonly areas: string;
  /** grid-area name → surface tags mounted (stacked) in that region. */
  readonly regions: Readonly<Record<string, readonly string[]>>;
  /** Global graph controls, applied per page so 3D/table are explorable variants. */
  readonly mode?: '2d' | '3d';
  readonly shape?: 'graph' | 'table';
}

const v = (
  id: string,
  name: string,
  blurb: string,
  columns: string,
  rows: string,
  areas: string,
  regions: Record<string, readonly string[]>,
  opts: { mode?: '2d' | '3d'; shape?: 'graph' | 'table' } = {}
): Variant => ({ id, name, blurb, columns, rows, areas, regions, ...opts });

export const VARIANTS: readonly Variant[] = [
  v('chat', 'Chat', 'The bare conversational loop — say it, get an answer, one-click why.',
    '1fr', '1fr', '"a"', { a: ['ask-surface'] }),

  v('graph', 'Graph', 'The knowledge substrate, spatial — concepts, truth, provenance.',
    '1fr', '1fr', '"a"', { a: ['graph-surface'] }),

  v('notebook', 'Notebook', 'The same blocks as a document — headings, claims, derivations.',
    '1fr', '1fr', '"a"', { a: ['notebook-surface'] }),

  v('console', 'Console', 'The REPL mirror of the bot — power-user ingress.',
    '1fr', '1fr', '"a"', { a: ['console-surface'] }),

  v('goals', 'Goals', 'The teleological workspace — objectives, gates, budgets.',
    '1fr', '1fr', '"a"', { a: ['goals-surface'] }),

  v('explore', 'Explore', 'The knowledge map — browse concepts, truth, neighbours.',
    '1fr', '1fr', '"a"', { a: ['explore-surface'] }),

  v('hud', 'HUD (legacy)', 'The maximalist debugger console, as one option among many.',
    '1fr', '1fr', '"a"', { a: ['hud-surface'] }),

  v('chat-graph', 'Chat ⇄ Graph (split)', 'Speak on the left, watch knowledge form on the right.',
    'minmax(320px, 1fr) 1.4fr', '1fr', '"chat graph"',
    { chat: ['ask-surface'], graph: ['graph-surface'] }),

  v('graph-chat', 'Graph ⇄ Chat (split)', 'Knowledge first; the conversation as a side panel.',
    '1.6fr minmax(320px, 1fr)', '1fr', '"graph chat"',
    { graph: ['graph-surface'], chat: ['ask-surface'] }),

  v('chat-notebook', 'Chat ⇄ Notebook', 'The conversation and its readable projection, side by side.',
    'minmax(320px, 1fr) 1.2fr', '1fr', '"chat doc"',
    { chat: ['ask-surface'], doc: ['notebook-surface'] }),

  v('notebook-graph', 'Notebook ⇄ Graph', 'Read the argument; see it as structure.',
    '1.2fr 1fr', '1fr', '"doc graph"',
    { doc: ['notebook-surface'], graph: ['graph-surface'] }),

  v('triple', 'Chat | Graph | Notebook', 'All three projections of one substrate, simultaneously.',
    'minmax(280px,1fr) 1.2fr minmax(280px,1fr)', '1fr', '"chat graph doc"',
    { chat: ['ask-surface'], graph: ['graph-surface'], doc: ['notebook-surface'] }),

  v('graph-stack', 'Graph over Chat', 'Full-width canvas with the composer beneath it.',
    '1fr', '1.6fr minmax(0, 1fr)', '"graph" "chat"',
    { graph: ['graph-surface'], chat: ['ask-surface'] }),

  v('dashboard', 'Dashboard', 'Metrics + graph + conversation: the observability wall.',
    '260px 1fr 360px', '1fr', '"metrics graph chat"',
    { metrics: ['cognitive-metrics', 'telemetry-panel'], graph: ['graph-surface'], chat: ['ask-surface'] }),

  v('graph-inspector', 'Graph + Inspector', 'Canvas with a live detail rail for the selection.',
    '1fr 340px', '1fr', '"graph inspector"',
    { graph: ['graph-surface'], inspector: ['node-detail-drawer'] }),

  v('graph-timeline', 'Graph + Timeline', 'Reasoning history as a scrubber under the canvas.',
    '1fr', '1fr 180px', '"graph" "timeline"',
    { graph: ['graph-surface'], timeline: ['timeline-scrubber'] }),

  v('graph-toc-chat', 'Graph + Outline + Chat', 'Navigate the argument, talk to the engine.',
    '240px 1fr 320px', '1fr', '"toc graph chat"',
    { toc: ['s-toc'], graph: ['graph-surface'], chat: ['ask-surface'] }),

  v('console-graph', 'Console + Graph', 'Type Narsese; watch the concept graph answer.',
    'minmax(340px, 1fr) 1.5fr', '1fr', '"console graph"',
    { console: ['console-surface'], graph: ['graph-surface'] }),

  v('goals-graph', 'Goals + Graph', 'Objectives and the reasoning that serves them.',
    'minmax(340px, 1fr) 1.5fr', '1fr', '"goals graph"',
    { goals: ['goals-surface'], graph: ['graph-surface'] }),

  v('explore-chat', 'Explore + Chat', 'Browse the map, ask about what you find.',
    '1.4fr minmax(320px, 1fr)', '1fr', '"explore chat"',
    { explore: ['explore-surface'], chat: ['ask-surface'] }),

  v('chat-metrics', 'Chat + Telemetry', 'Conversation with the live cognitive meters beside it.',
    '1fr 280px', '1fr', '"chat metrics"',
    { chat: ['ask-surface'], metrics: ['telemetry-panel', 'cognitive-metrics'] }),

  v('graph-minimap', 'Graph + Minimap + Legend', 'Overview first, detail on demand.',
    '1fr 200px', '1fr', '"graph rail"',
    { graph: ['graph-surface', 'graph-legend'], rail: ['graph-minimap', 'lens-controller'] }),

  v('notebook-inspector-chat', 'Notebook + Inspector + Chat', 'A three-pane reasoning desk.',
    '1fr 320px 300px', '1fr', '"doc inspector chat"',
    { doc: ['notebook-surface'], inspector: ['node-detail-drawer'], chat: ['ask-surface'] }),

  v('chat-minimap', 'Chat + Knowledge map', 'Conversation with a thumbnail of the whole graph.',
    'minmax(340px, 1fr) 260px', '1fr', '"chat map"',
    { chat: ['ask-surface'], map: ['graph-minimap', 'cognitive-metrics'] }),

  v('graph-chat-timeline', 'Graph + Chat + Timeline', 'The full loop: see, speak, replay.',
    '1.4fr minmax(320px, 1fr)', '1fr 160px', '"graph chat" "timeline timeline"',
    { graph: ['graph-surface'], chat: ['ask-surface'], timeline: ['timeline-scrubber'] }),

  v('hud-chat', 'HUD + Chat', 'The debugger and the assistant, together.',
    '1.5fr minmax(320px, 1fr)', '1fr', '"hud chat"',
    { hud: ['hud-surface'], chat: ['ask-surface'] }),

  v('chat-history', 'Chat + History', 'The transcript beside the live thread.',
    'minmax(340px, 1fr) 320px', '1fr', '"chat history"',
    { chat: ['ask-surface'], history: ['chat-history-panel'] }),

  v('mosaic', 'Mosaic', 'Six panes: chat, graph, notebook, metrics, console, explorer.',
    '1fr 1fr 1fr', '1fr 1fr', '"chat graph doc" "metrics console explore"',
    { chat: ['ask-surface'], graph: ['graph-surface'], doc: ['notebook-surface'], metrics: ['cognitive-metrics'], console: ['console-surface'], explore: ['explore-surface'] }),

  // ── the same components, other graph modes ──────────────────────────────────
  v('graph-3d', 'Graph — 3D', 'The SpaceGraphJS canvas — the spatial substrate in three dimensions.',
    '1fr', '1fr', '"a"', { a: ['graph-surface'] }, { mode: '3d' }),

  v('graph-table', 'Graph — Table', 'The same graph as a sortable table projection.',
    '1fr', '1fr', '"a"', { a: ['graph-surface'] }, { shape: 'table' }),

  v('chat-graph-3d', 'Chat ⇄ Graph 3D', 'Talk to the engine beside the 3D canvas.',
    'minmax(340px, 1fr) 1.5fr', '1fr', '"chat graph"',
    { chat: ['ask-surface'], graph: ['graph-surface'] }, { mode: '3d' }),

  v('graph-3d-table', 'Graph 3D + Table', 'Two projections of one substrate: spatial and tabular.',
    '1.4fr 1fr', '1fr', '"graph table"',
    { graph: ['graph-surface'], table: ['explore-surface'] }, { mode: '3d' }),

  // ── chrome: toolbars, rails, panels ─────────────────────────────────────────
  v('graph-full-chrome', 'Graph + Full Chrome', 'Canvas with its own top toolbar, minimap and legend rail.',
    '1fr 200px', '1fr', '"graph rail"',
    { graph: ['graph-toolbar', 'graph-surface'], rail: ['graph-minimap', 'graph-legend', 'lens-controller'] }),

  v('config-desk', 'Config Desk', 'Tune the engine live while watching the graph.',
    '300px 1fr', '1fr', '"config graph"',
    { config: ['config-hud'], graph: ['graph-surface'] }),

  v('lens-desk', 'Lens Desk', 'Design a projection and see it applied.',
    '1fr 340px', '1fr', '"graph lens"',
    { graph: ['graph-surface'], lens: ['lens-designer'] }),

  v('telemetry-wall', 'Telemetry Wall', 'Every meter the kernel exposes, side by side.',
    '1fr 1fr', '1fr 1fr', '"t c" "g g"',
    { t: ['telemetry-panel'], c: ['cognitive-metrics'], g: ['graph-surface'] }),

  v('graph-events', 'Graph + Event Log', 'The reasoning stream beside the state it produces.',
    '1.5fr minmax(300px, 1fr)', '1fr', '"graph events"',
    { graph: ['graph-surface'], events: ['s-events'] }),

  v('graph-nodes', 'Graph + Node List', 'The spatial view and the list view of the same concepts.',
    '1.5fr minmax(280px, 1fr)', '1fr', '"graph nodes"',
    { graph: ['graph-surface'], nodes: ['s-nodes'] }),

  v('graph-related', 'Graph + Related', 'Focus a concept; explore its neighbourhood.',
    '1fr 320px', '1fr', '"graph related"',
    { graph: ['graph-surface'], related: ['s-related'] }),

  v('graph-explain', 'Graph + Explain', 'The derivation, made readable, beside the graph.',
    '1.4fr minmax(340px, 1fr)', '1fr', '"graph explain"',
    { graph: ['graph-surface'], explain: ['s-explain'] }),

  v('inspector-desk', 'Inspector Desk', 'Canvas, detail rail, and the timeline of reasoning.',
    '1fr 320px', '1fr 160px', '"graph inspector" "timeline timeline"',
    { graph: ['graph-surface'], inspector: ['node-detail-drawer'], timeline: ['timeline-scrubber'] }),

  // ── multi-pane studies ──────────────────────────────────────────────────────
  v('quad', 'Quad', 'A 2×2 of the four core projections.',
    '1fr 1fr', '1fr 1fr', '"chat graph" "doc metrics"',
    { chat: ['ask-surface'], graph: ['graph-surface'], doc: ['notebook-surface'], metrics: ['cognitive-metrics'] }),

  v('chat-console', 'Chat + Console', 'Natural language and raw Narsese, together.',
    '1fr 1fr', '1fr', '"chat console"',
    { chat: ['ask-surface'], console: ['console-surface'] }),

  v('notebook-goals', 'Notebook + Goals', 'Read the argument; state the objectives.',
    '1.4fr minmax(320px, 1fr)', '1fr', '"doc goals"',
    { doc: ['notebook-surface'], goals: ['goals-surface'] }),

  v('reasoning-desk', 'Reasoning Desk', 'Ask, read, and inspect in one workspace.',
    'minmax(320px, 1fr) 1.3fr 320px', '1fr', '"chat doc inspector"',
    { chat: ['ask-surface'], doc: ['notebook-surface'], inspector: ['node-detail-drawer'] }),

  v('command-deck', 'Command Deck', 'Console, goals, and the graph they operate on.',
    'minmax(280px, 1fr) minmax(280px, 1fr) 1.4fr', '1fr', '"console goals graph"',
    { console: ['console-surface'], goals: ['goals-surface'], graph: ['graph-surface'] }),

  v('briefing', 'Briefing', 'A summary rail of metrics over the canvas and the conversation.',
    '1fr 300px', '1fr', '"main brief"',
    { main: ['graph-surface'], brief: ['cognitive-metrics', 'telemetry-panel', 'chat-history-panel'] }),

  v('study', 'Study', 'Everything: chat, notebook, graph, explorer, metrics, timeline.',
    'minmax(260px,1fr) 1.2fr minmax(260px,1fr)', '1.4fr 1fr', '"chat graph doc" "console metrics timeline"',
    { chat: ['ask-surface'], graph: ['graph-surface'], doc: ['notebook-surface'], console: ['console-surface'], metrics: ['explore-surface'], timeline: ['timeline-scrubber'] }),
];

export const variantById = (id: string): Variant | undefined => VARIANTS.find((x) => x.id === id);
