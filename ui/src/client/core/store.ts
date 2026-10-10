import type { ChatMessage, CognitiveEvent, GraphNodeData, Lens, LensFieldDescriptor } from '@senars/core';
import { debounce } from '@senars/util';
import type { LensSpec } from '../../shared/lens-schema.js';
import { isBuiltinLens } from '../../shared/lens-schema.js';
import { beliefLens, builtinLensModulations, compile } from '../modulation/compile.js';
import { timeGate } from '../modulation/composition.js';
import { evaluate } from '../modulation/evaluate.js';
import type { Delta, Item, Modulation, Lens as ModulationLens, View } from '../modulation/types.js';
import { builtinLensSpec, LENS_DEFAULT_LAYOUTS, PRIMARY_LENSES } from '../utils/lens-catalog.js';
import { CONVERSATION_LAYOUT_IDS } from './conversation-layout.js';
import { GRAPH_LAYERS, type GraphLayer } from './graph-layer.js';
import { isRegisteredLayoutId, type LayoutScope } from './layout-ids.js';
import { pageOf, sectionTree } from './sections.js';
import { getSurfaces } from './surface-registry.js';
import { viewAdapters } from './view-adapter.js';
import type { Shape, ViewSelection } from './view-spec.js';
import { emptyWorkspaceGraph, type WorkspaceGraph } from './workspace-graph.js';
import { workspaceRendererIds } from './workspace-renderer.js';
import { loadConfig, saveConfig, DEFAULT_UI_CONFIG, type UiConfig, type Theme, type Density, type Motion } from './config-schema.js';

export type { UiConfig };

type Listener<T> = (value: T) => void;
type Unsubscriber = () => void;

interface Readable<T> {
  get(): T;

  subscribe(fn: Listener<T>): Unsubscriber;
}

interface Writable<T> extends Readable<T> {
  set(value: T): void;
}

class Atom<T> implements Writable<T> {
  private _value: T;
  private listeners = new Set<Listener<T>>();

  constructor(initial: T) {
    this._value = initial;
  }

  get() {
    return this._value;
  }

  set(value: T) {
    this._value = value;
    for (const fn of this.listeners) fn(value);
  }

  subscribe(fn: Listener<T>): Unsubscriber {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const atom = <T>(initial: T) => new Atom(initial);

export interface TelemetryData {
  reasoning_hz: number[];
  tokens_per_sec: number[];
  memory_mb: number[];
  ws_latency_ms: number[];
}

export interface CognitiveMetricsData {
  activeConcepts: number;
  totalConcepts: number;
  derivationsPerSec: number;
  contradictionCount: number;
  workingMemorySize: number;
  goalUrgencyDistribution?: Record<string, number>;
}

export interface CognitiveMeta {
  truncated: boolean;
  totalHidden: number;
}

// --- Existing atoms ---
export const $chatMessages = atom<ChatMessage[]>([]);
export const $streamingDelta = atom<string>('');
export const $graphNodes = atom<Map<string, GraphNodeData>>(new Map());
export const $graphEdges = atom<Map<string, Record<string, any>>>(new Map());
export const $graphMeta = atom<CognitiveMeta>({ truncated: false, totalHidden: 0 });
/** Load persisted config or use defaults. */
const initialConfig: UiConfig = (() => {
  try {
    return loadConfig();
  } catch {
    return DEFAULT_UI_CONFIG;
  }
})();

export const $config = atom<UiConfig>(initialConfig);

/** Persist config changes to localStorage. */
if (typeof window !== 'undefined') {
  $config.subscribe((config) => {
    saveConfig(config);
  });
}
export const $telemetry = atom<TelemetryData>({
  reasoning_hz: [],
  tokens_per_sec: [],
  memory_mb: [],
  ws_latency_ms: [],
});
export const $cognitiveMetrics = atom<CognitiveMetricsData | null>(null);
export const $connectionState = atom<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>(
  'connecting'
);
export const $lastSeqId = atom<number | null>(null);

export interface ServerErrorRecord {
  code: string;
  message: string;
  at: number;
}

const SERVER_ERROR_CAP = 20;
export const $serverErrors = atom<ServerErrorRecord[]>([]);

export function pushServerError(code: string, message: string): void {
  $serverErrors.set([
    ...$serverErrors.get().slice(-(SERVER_ERROR_CAP - 1)),
    { code, message, at: Date.now() },
  ]);
}

// --- Cognitive Events ---
export const $cognitiveEvents = atom<CognitiveEvent[]>([]);

const COGNITIVE_EVENTS_CAP = 500;
export function pushCognitiveEvents(events: CognitiveEvent[]): void {
  $cognitiveEvents.set([...$cognitiveEvents.get().slice(-(COGNITIVE_EVENTS_CAP - events.length)), ...events]);
}

export function clearCognitiveEvents(): void {
  $cognitiveEvents.set([]);
}

// --- WebLLM ---
export const $webllmAvailable = atom<boolean>(false);
export const $webllmActive = atom<boolean>(false);
export const $webllmModel = atom<string>('');

export const $activeLens = atom<Lens>('belief');
export const $focusTerm = atom<string | null>(null);
export const $selectedNodeId = atom<string | null>(null);
export const $selectedEdgeId = atom<string | null>(null);
export const $viewport = atom<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
export const $workingMemory = atom<string[]>([]);

// --- Phase 2: Multi-select ---
export const $selectedNodeIds = atom<Set<string>>(new Set());

// --- Phase 4: The one cross-shape selection model ---
export const $viewSelection = atom<ViewSelection>({ nodes: new Set(), edges: new Set() });

// --- Phase 2: Per-lens viewport persistence ---
export const $lensViewport = atom<Record<string, { x: number; y: number; zoom: number }>>({
  belief: { x: 0, y: 0, zoom: 1 },
  goal: { x: 0, y: 0, zoom: 1 },
  contradiction: { x: 0, y: 0, zoom: 1 },
});

// --- Phase 2: Graph filter (contradiction badge → filter graph) ---
export const $graphFilter = atom<string | null>(null);

// --- Phase 6: Viewport mode (2D/3D toggle) ---
export type ViewportMode = '2d' | '3d';
export const $viewportMode = atom<ViewportMode>('2d');

/** The shape the graph surface renders as: the viewport or its tabular alternative. */
export const $graphShape = atom<Shape>('graph');

// --- Phase 0.1: One workspace, many renderers ---
/** The one semantic substrate every workspace renderer projects. */
export const $workspaceGraph = atom<WorkspaceGraph>(emptyWorkspaceGraph());
/** The active `WorkspaceRenderer` id — URL-addressable, palette-switchable, agent-settable. */
export const $activeRenderer = atom<string>('graph');

/** Switch the active workspace renderer. */
export function setActiveRenderer(id: string): void {
  $activeRenderer.set(id);
}

/** Point the workspace focus at a block (session state; survives re-projection). */
export function setWorkspaceFocus(ref?: string): void {
  const current = $workspaceGraph.get();
  if (current.focus === ref) return;
  $workspaceGraph.set({ ...current, focus: ref });
}

/**
 * Take the reader to a block: the Notebook is the renderer that shows one, so
 * reaching a ref from a graph surface (hover popover, context menu, inspector)
 * means switching to it as well. One seam, so every surface gets there the same way.
 */
export function revealBlock(ref?: string): void {
  $activeRenderer.set('notebook');
  setWorkspaceFocus(ref);
}

/** Which Graph-mode layer(s) to show: the engine concepts, the conversation, or both (§2.1). */
export const $graphLayer = atom<GraphLayer>('both');

/** The layer each lens last chose, so switching lens restores its filter (§2.6). */
export const $lensLayer = atom<Record<string, GraphLayer>>({});

export const setGraphLayer = (layer: GraphLayer): void => {
  $lensLayer.set({ ...$lensLayer.get(), [$activeLens.get()]: layer });
  $graphLayer.set(layer);
};
$activeLens.subscribe((lens) => {
  $graphLayer.set($lensLayer.get()[lens] ?? 'both');
});

/** Replace the workspace selection set (session state; survives re-projection). */
export function setWorkspaceSelection(refs: Iterable<string>): void {
  $workspaceGraph.set({ ...$workspaceGraph.get(), selection: new Set(refs) });
}

/**
 * `$selectedNodeIds` is derived, not a second source: `$workspaceGraph.selection`
 * is authoritative and this projection keeps the two in step for the renderers
 * that read the flat set (§2.5). Compares by value so a re-projection that
 * carries the same selection over does not churn subscribers.
 */
$workspaceGraph.subscribe(({ selection }) => {
  const current = $selectedNodeIds.get();
  if (current.size === selection.size && [...selection].every((id) => current.has(id))) return;
  $selectedNodeIds.set(new Set(selection));
});

/** Blocks whose children are folded in the workspace renderers (§1.1; session state). */
export const $collapsedBlocks = atom<ReadonlySet<string>>(new Set());

/** How many link hops "Open related" walks (1–3; session state, URL-owned). */
export const $neighborhoodDepth = atom(2);

export function setNeighborhoodDepth(depth: number): void {
  $neighborhoodDepth.set(Math.min(Math.max(Math.round(depth), 1), 3));
}

/** Fold/unfold a block's children in place, preserved across renderer switches. */
export function toggleCollapsed(ref: string): void {
  const next = new Set($collapsedBlocks.get());
  if (next.has(ref)) next.delete(ref);
  else next.add(ref);
  $collapsedBlocks.set(next);
}

/** Fold exactly `refs` — the bulk counterpart of `toggleCollapsed` (§1.5 fold-all). */
export function setCollapsed(refs: ReadonlySet<string>): void {
  const current = $collapsedBlocks.get();
  if (refs.size === current.size && [...refs].every((ref) => current.has(ref))) return;
  $collapsedBlocks.set(new Set(refs));
}

// --- Batch 4: Capability-based filtering ---
export const $capabilityFilter = atom<string | 'all'>('all');

// --- Phase 2: Modulation engine atoms ---
function detectViewFlags(): View['flags'] {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return { reducedMotion: false, highContrast: false, prefersColorScheme: 'dark' };
  }
  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast: window.matchMedia('(prefers-contrast: more)').matches,
    prefersColorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  };
}

export const $view = atom<View>({
  flags: detectViewFlags(),
  timeline: { t: Number.POSITIVE_INFINITY },
});

/**
 * `$workspaceGraph.timeCursor` is derived, not a second source: the scrub cursor
 * is `$view.timeline.t` (that is what the modulation gate already reads), and this
 * puts it on the substrate so the workspace renderers can admit blocks by the
 * same number (§4.4). `Infinity` is the present and is stored as `undefined`.
 */
$view.subscribe(({ timeline }) => {
  const cursor = Number.isFinite(timeline.t) ? timeline.t : undefined;
  if ($workspaceGraph.get().timeCursor === cursor) return;
  const graph = $workspaceGraph.get();
  $workspaceGraph.set(
    cursor === undefined ? { ...graph, timeCursor: undefined } : { ...graph, timeCursor: cursor }
  );
});

/** Dynamic lens fields received from server (fallback to hardcoded). */
export const $lensFields = atom<LensFieldDescriptor[]>([]);

export interface RevisionEntry {
  truth: { frequency: number; confidence: number };
  stampId: string;
  timestamp: number;
  source: 'input' | 'derivation' | 'revision' | 'inference';
}

export const $nodeHistory = atom<RevisionEntry[]>([]);

// Derive $items from $graphNodes (convert GraphNodeData → Item)
function graphNodeToItem(id: string, nd: GraphNodeData): Item {
  return {
    id,
    priority: nd.priority ?? 0.5,
    confidence: nd.confidence ?? 0.9,
    nodeType: nd.nodeType,
    isContradiction: nd.isContradiction,
    truth: nd.truth
      ? { frequency: nd.truth.frequency, confidence: nd.truth.confidence }
      : undefined,
    occurrenceTime: nd.occurrenceTime,
    goalRelevance: nd.goalRelevance,
  };
}

function graphEdgeToItem(id: string, ed: Record<string, any>): Item {
  return {
    id,
    priority: ed.priority ?? 0.5,
    confidence: ed.confidence ?? 0.9,
    nodeType: 'edge',
    truth: ed.truth
      ? { frequency: ed.truth.frequency, confidence: ed.truth.confidence }
      : undefined,
    edgeType: ed.type,
    weight: ed.weight,
    source: ed.source,
    target: ed.target,
    directed: ed.directed,
  };
}

export function getItems(): Item[] {
  const items: Item[] = [];
  for (const [id, nd] of $graphNodes.get()) {
    items.push(graphNodeToItem(id, nd));
  }
  for (const [id, ed] of $graphEdges.get()) {
    items.push(graphEdgeToItem(id, ed));
  }
  return items;
}

/** Whether any engine node carries a temporal anchor — the timeline control gates on this (§4.4). */
export const hasTemporalData = (): boolean => {
  for (const node of $graphNodes.get().values()) {
    if (node.occurrenceTime !== undefined) return true;
  }
  return false;
};

// --- Phase 4: Lens Registry ---
export const $lensRegistry = atom<Map<string, LensSpec>>(new Map());

function compileLensSpec(spec: LensSpec): Modulation {
  try {
    return compile(spec as Parameters<typeof compile>[0]);
  } catch {
    return beliefLens();
  }
}

/** Register or update a lens in the registry. Returns the compiled modulation. */
export function registerLens(spec: LensSpec): Modulation {
  const registry = new Map($lensRegistry.get());
  registry.set(spec.id, spec);
  $lensRegistry.set(registry);
  return compileLensSpec(spec);
}

/** Remove a user-defined lens from the registry. */
export function removeLens(id: string): void {
  if (isBuiltinLens(id)) return;
  const registry = new Map($lensRegistry.get());
  registry.delete(id);
  $lensRegistry.set(registry);
}

/** Get all registered lens IDs (builtins + user-defined). */
export function getLensIds(): string[] {
  const ids: string[] = PRIMARY_LENSES.map((lens) => lens.id);
  for (const id of $lensRegistry.get().keys()) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Get the full LensSpec for a given lens ID, including builtins. */
export function getLensSpec(id: string): LensSpec | undefined {
  return $lensRegistry.get().get(id) ?? builtinLensSpec(id);
}

export function getActiveLensModulation(): Modulation {
  const lensId = $activeLens.get();
  if (isBuiltinLens(lensId)) {
    return LENS_MODULATION_MAP[lensId] ?? beliefLens();
  }
  const spec = $lensRegistry.get().get(lensId);
  if (spec) {
    return compileLensSpec(spec);
  }
  return beliefLens();
}

const LENS_MODULATION_MAP: Record<string, Modulation> = builtinLensModulations();

export function evaluateLens(): Delta {
  const items = getItems();
  const lensId = $activeLens.get();
  const baseMod = getActiveLensModulation();
  const mod = timeGate(baseMod);
  const lens: ModulationLens = {
    id: lensId,
    label: '',
    description: '',
    modulation: mod,
  };
  return evaluate(items, lens, $view.get());
}

// --- Phase 3: Per-lens layout selection ---
export const $lensLayout = atom<Record<string, string>>({ ...LENS_DEFAULT_LAYOUTS });

/** Which layout substrate is active — concept layouts are per-lens, conversation has one slot (§2.6). */
export const $layoutScope = atom<LayoutScope>('concept');

/** The one saved conversation layout (the conversation scope's slot). */
export const $conversationLayout = atom<string>(CONVERSATION_LAYOUT_IDS[0]);

/** Route a chosen layout to its scope's slot; the scope is the layout's own substrate (§2.6). */
export function setActiveLayout(id: string): void {
  const scope: LayoutScope = (CONVERSATION_LAYOUT_IDS as readonly string[]).includes(id)
    ? 'conversation'
    : 'concept';
  $layoutScope.set(scope);
  if (scope === 'conversation') $conversationLayout.set(id);
  else $lensLayout.set({ ...$lensLayout.get(), [$activeLens.get()]: id });
}

// --- Phase 0: Panel Registry ---
export interface PanelState {
  id: string;
  open: boolean;
  docked: 'left' | 'right' | 'bottom' | 'float';
  size: number;
  order: number;
}

export const $panels = atom<Map<string, PanelState>>(
  new Map([
    ['chat', { id: 'chat', open: false, docked: 'right', size: 360, order: 1 }],
    ['search', { id: 'search', open: false, docked: 'left', size: 280, order: 0 }],
    ['lens-designer', { id: 'lens-designer', open: false, docked: 'right', size: 400, order: 2 }],
  ])
);

/** Optimistically patch an edge's data in $graphEdges. Returns the updated edge data or undefined. */
export function updateEdgeData(
  id: string,
  patch: Record<string, unknown>
): Record<string, unknown> | undefined {
  const edges = new Map($graphEdges.get());
  const existing = edges.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  edges.set(id, updated);
  $graphEdges.set(edges);
  return updated;
}

/** Optimistically patch a node's data in $graphNodes. Returns the updated node or undefined. */
export function updateNodeData(
  id: string,
  patch: Partial<GraphNodeData>
): GraphNodeData | undefined {
  const nodes = new Map($graphNodes.get());
  const existing = nodes.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch } as GraphNodeData;
  nodes.set(id, updated);
  $graphNodes.set(nodes);
  return updated;
}

// --- Phase 0: URL State ---
export interface UrlState {
  lens: Lens;
  renderer?: string;
  layer?: GraphLayer;
  layout?: string;
  scope?: LayoutScope;
  focus?: string;
  /** The page (root section) holding `focus`; omitted when focus *is* the page. */
  page?: string;
  /** Link hops the neighborhood traversal walks. */
  depth?: number;
  folded?: string[];
  viewport?: { x: number; y: number; zoom: number };
  search?: string;
  panels?: string[];
  /** UI Config fields (synced to URL for shareable links). */
  theme?: Theme;
  density?: Density;
  motion?: Motion;
  defaultRenderer?: string;
  defaultLens?: Lens;
}

export const $urlState = atom<UrlState>({ lens: 'belief' });

// URL synchronization
const syncUrl = debounce((state: UrlState) => {
  const hash = serializeHash(state);
  const current = window.location.hash.replace(/^#/, '');
  if (hash !== current) {
    window.history.replaceState(null, '', `#${hash}`);
  }
}, 300);

function parseHash(): Partial<UrlState> {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return {};
  const params = new URLSearchParams(hash);
  const state: Partial<UrlState> = {};
  const lens = params.get('lens') as Lens | null;
  if (lens && ['belief', 'goal', 'contradiction'].includes(lens)) state.lens = lens;
  const renderer = params.get('renderer');
  if (renderer) state.renderer = renderer;
  const layer = params.get('layer');
  if (layer && (GRAPH_LAYERS as readonly string[]).includes(layer)) state.layer = layer as GraphLayer;
  const layout = params.get('layout');
  if (layout) state.layout = layout;
  const scope = params.get('scope');
  if (scope === 'concept' || scope === 'conversation') state.scope = scope;
  const focus = params.get('focus');
  if (focus) state.focus = focus;
  const page = params.get('page');
  if (page) state.page = page;
  const depth = params.get('depth');
  if (depth && Number.isFinite(Number(depth))) state.depth = Number(depth);
  const vp = params.get('viewport');
  if (vp) {
    const parts = vp.split(',').map(Number);
    const x = parts[0],
      y = parts[1],
      z = parts[2];
    if (
      typeof x === 'number' &&
      typeof y === 'number' &&
      typeof z === 'number' &&
      !isNaN(x) &&
      !isNaN(y) &&
      !isNaN(z)
    ) {
      state.viewport = { x, y, zoom: z };
    }
  }
  const search = params.get('search');
  if (search) state.search = search;
  const panels = params.get('panels');
  if (panels) state.panels = panels.split(',');
  const folded = params.get('folded');
  if (folded) state.folded = folded.split(',').filter(Boolean);
  // Config fields
  const theme = params.get('theme');
  if (theme && ['dark', 'light', 'auto'].includes(theme)) state.theme = theme as Theme;
  const density = params.get('density');
  if (density && ['comfortable', 'compact'].includes(density)) state.density = density as Density;
  const motion = params.get('motion');
  if (motion && ['reduced', 'normal'].includes(motion)) state.motion = motion as Motion;
  const defaultRenderer = params.get('defaultRenderer');
  if (defaultRenderer) state.defaultRenderer = defaultRenderer;
  const defaultLens = params.get('defaultLens') as Lens | null;
  if (defaultLens && ['belief', 'goal', 'contradiction'].includes(defaultLens)) state.defaultLens = defaultLens;
  return state;
}

function serializeHash(state: UrlState): string {
  const params = new URLSearchParams();
  params.set('lens', state.lens);
  if (state.renderer) params.set('renderer', state.renderer);
  if (state.layer && state.layer !== 'both') params.set('layer', state.layer);
  if (state.layout) params.set('layout', state.layout);
  if (state.scope && state.scope !== 'concept') params.set('scope', state.scope);
  if (state.focus) params.set('focus', state.focus);
  if (state.page) params.set('page', state.page);
  if (state.depth) params.set('depth', String(state.depth));
  if (state.viewport)
    params.set('viewport', `${state.viewport.x},${state.viewport.y},${state.viewport.zoom}`);
  if (state.search) params.set('search', state.search);
  if (state.panels?.length) params.set('panels', state.panels.join(','));
  if (state.folded?.length) params.set('folded', state.folded.join(','));
  // Config fields
  if (state.theme) params.set('theme', state.theme);
  if (state.density) params.set('density', state.density);
  if (state.motion) params.set('motion', state.motion);
  if (state.defaultRenderer) params.set('defaultRenderer', state.defaultRenderer);
  if (state.defaultLens) params.set('defaultLens', state.defaultLens);
  return params.toString();
}

export function hydrateFromUrl() {
  const parsed = parseHash();
  // An address that names no registered renderer is dropped rather than adopted (§2.6).
  if (parsed.renderer && !workspaceRendererIds().includes(parsed.renderer)) {
    delete parsed.renderer;
  }
  // Likewise a layout the registry does not know, so a stale link cannot seed `$lensLayout`.
  if (parsed.layout && !isRegisteredLayoutId(parsed.layout)) {
    delete parsed.layout;
  }
  if (parsed.lens) $activeLens.set(parsed.lens);
  const currentUrl = $urlState.get();
  $urlState.set({ ...currentUrl, ...parsed });
  if (parsed.renderer) $activeRenderer.set(parsed.renderer);
  if (parsed.layer) setGraphLayer(parsed.layer);
  if (parsed.scope) $layoutScope.set(parsed.scope);
  if (parsed.layout) {
    const scope =
      parsed.scope ?? ((CONVERSATION_LAYOUT_IDS as readonly string[]).includes(parsed.layout)
        ? 'conversation'
        : 'concept');
    if (scope === 'conversation') $conversationLayout.set(parsed.layout);
    else $lensLayout.set({ ...$lensLayout.get(), [$activeLens.get()]: parsed.layout });
  }
  // A page link focuses the page; an explicit block ref is the more specific half of the tuple.
  if (parsed.focus ?? parsed.page) setWorkspaceFocus(parsed.focus ?? parsed.page);
  if (parsed.folded) $collapsedBlocks.set(new Set(parsed.folded));
  if (parsed.depth !== undefined) setNeighborhoodDepth(parsed.depth);
  if (parsed.panels) {
    const panels = new Map($panels.get());
    for (const [id, panel] of panels) {
      panel.open = parsed.panels.includes(id);
    }
    $panels.set(panels);
  }
  // Apply config from URL
  if (parsed.theme) $config.set({ ...$config.get(), theme: parsed.theme });
  if (parsed.density) $config.set({ ...$config.get(), density: parsed.density });
  if (parsed.motion) $config.set({ ...$config.get(), motion: parsed.motion });
  if (parsed.defaultRenderer) $config.set({ ...$config.get(), defaultRenderer: parsed.defaultRenderer });
  if (parsed.defaultLens && ['belief', 'goal', 'contradiction'].includes(parsed.defaultLens)) {
    $config.set({ ...$config.get(), defaultLens: parsed.defaultLens as 'belief' | 'goal' | 'contradiction' });
  }
}

// Keep the URL-addressable slice of session state in step with the atoms it mirrors (§2.6).
const sameNumber = (a: number | undefined, b: number | undefined): boolean => a === b;
const sameStringList = (
  a: readonly string[] | undefined,
  b: readonly string[] | undefined
): boolean => (a && b ? a.length === b.length && a.every((id) => b.includes(id)) : a === b);

/** Write one URL-owned key, skipping a no-op write. The one mirror primitive. */
function setUrlState<K extends keyof UrlState>(
  key: K,
  value: UrlState[K],
  equals: (a: UrlState[K], b: UrlState[K]) => boolean = Object.is
): void {
  if (!equals($urlState.get()[key], value)) {
    $urlState.set({ ...$urlState.get(), [key]: value } as UrlState);
  }
}

/** Keep one URL-owned key in step with an atom's projection of it. */
function mirrorAtom<K extends keyof UrlState, T>(
  source: Readable<T>,
  key: K,
  project: (value: T) => UrlState[K],
  equals?: (a: UrlState[K], b: UrlState[K]) => boolean
): void {
  source.subscribe((value) => setUrlState(key, project(value), equals));
}

mirrorAtom($activeRenderer, 'renderer', (renderer) => renderer);
mirrorAtom($activeLens, 'lens', (lens) => lens);
mirrorAtom($workspaceGraph, 'focus', (graph) => graph.focus);
// The page half of the URL tuple (§1.5): derived from focus through the section model, and
// elided when the focus is the page itself, so a page link stays a single `focus`.
mirrorAtom($workspaceGraph, 'page', (graph) => {
  const page = pageOf(sectionTree(graph), graph.focus);
  return page === graph.focus ? undefined : page;
});
mirrorAtom($graphLayer, 'layer', (layer) => layer);
mirrorAtom($collapsedBlocks, 'folded', (folded) => [...folded], sameStringList);
mirrorAtom($neighborhoodDepth, 'depth', (depth) => depth, sameNumber);
mirrorAtom(
  $panels,
  'panels',
  (panels) => [...panels.values()].filter((panel) => panel.open).map((panel) => panel.id),
  sameStringList
);

// Layout is scope-aware: the conversation slot stands alone, concept layouts are per-lens (§2.6).
const DEFAULT_LAYOUTS = LENS_DEFAULT_LAYOUTS as Record<string, string>;
const mirrorLayout = (): void => {
  const scope = $layoutScope.get();
  setUrlState('scope', scope === 'concept' ? undefined : scope);
  if (scope === 'conversation') {
    setUrlState('layout', $conversationLayout.get());
    return;
  }
  const lens = $activeLens.get();
  const layout = $lensLayout.get()[lens];
  setUrlState('layout', layout && layout !== DEFAULT_LAYOUTS[lens] ? layout : undefined);
};
$lensLayout.subscribe(mirrorLayout);
$conversationLayout.subscribe(mirrorLayout);
$layoutScope.subscribe(mirrorLayout);
$activeLens.subscribe(mirrorLayout);

// Config mirroring to URL
mirrorAtom($config, 'theme', (c) => c.theme);
mirrorAtom($config, 'density', (c) => c.density);
mirrorAtom($config, 'motion', (c) => c.motion);
mirrorAtom($config, 'defaultRenderer', (c) => c.defaultRenderer);
mirrorAtom($config, 'defaultLens', (c) => c.defaultLens);

// Sync URL when urlState changes
$urlState.subscribe(syncUrl);

// Re-hydrate on back/forward or a pasted hash (replaceState writes do not fire hashchange).
if (typeof window !== 'undefined') window.addEventListener('hashchange', hydrateFromUrl);

// Apply theme, density, motion to document
if (typeof window !== 'undefined') {
  const hasMatchMedia = typeof window.matchMedia === 'function';

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    if (theme === 'auto' && hasMatchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  };
  const applyDensity = (density: Density) => {
    document.documentElement.setAttribute('data-density', density);
  };
  const applyMotion = (motion: Motion) => {
    document.documentElement.setAttribute('data-motion', motion);
  };

  // Initial application
  applyTheme($config.get().theme);
  applyDensity($config.get().density);
  applyMotion($config.get().motion);

  // Subscribe to changes
  $config.subscribe((config) => {
    applyTheme(config.theme);
    applyDensity(config.density);
    applyMotion(config.motion);
  });

  // Listen for system theme changes when in 'auto' mode
  if (hasMatchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      const config = $config.get();
      if (config.theme === 'auto') {
        applyTheme('auto');
      }
    });

    // Listen for reduced motion preference changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener('change', (e) => {
      const config = $config.get();
      // Only auto-apply if user hasn't explicitly set motion preference
      // (We don't auto-change user's explicit choice)
    });
  }
}

// --- Phase 0: Test API ---
type ReadableAtom<T> = { get(): T };
const storeAtoms = {
  chatMessages: $chatMessages,
  streamingDelta: $streamingDelta,
  graphNodes: $graphNodes,
  graphEdges: $graphEdges,
  graphMeta: $graphMeta,
  config: $config,
  telemetry: $telemetry,
  cognitiveMetrics: $cognitiveMetrics,
  connectionState: $connectionState,
  lastSeqId: $lastSeqId,
  activeLens: $activeLens,
  focusTerm: $focusTerm,
  selectedNodeId: $selectedNodeId,
  selectedEdgeId: $selectedEdgeId,
  viewport: $viewport,
  workingMemory: $workingMemory,
  panels: $panels,
  urlState: $urlState,
  selectedNodeIds: $selectedNodeIds,
  viewSelection: $viewSelection,
  lensViewport: $lensViewport,
  graphFilter: $graphFilter,
  capabilityFilter: $capabilityFilter,
  lensLayout: $lensLayout,
  lensRegistry: $lensRegistry,
  lensFields: $lensFields,
  nodeHistory: $nodeHistory,
  viewportMode: $viewportMode,
  graphShape: $graphShape,
  workspaceGraph: $workspaceGraph,
  activeRenderer: $activeRenderer,
  cognitiveEvents: $cognitiveEvents,
} satisfies Record<string, ReadableAtom<unknown>>;

export type TestApiStorePath = keyof typeof storeAtoms;

export function mountTestApi<T>(namespace: string, api: T): void {
  const w = window as unknown as { __testApi?: Record<string, unknown> };
  w.__testApi = { ...w.__testApi, [namespace]: api };
}

export function exposeTestApi(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    __testApi?: Record<string, unknown>;
    __testApiExposed?: boolean;
  };
  w.__testApi = {
    ...w.__testApi,
    store: {
      getState: (path: string) => storeAtoms[path as TestApiStorePath]?.get(),
      setState: (path: string, value: unknown) => {
        const entry = storeAtoms[path as TestApiStorePath] as { set?: (v: unknown) => void } | undefined;
        if (!entry?.set) throw new Error(`Unknown or read-only store path: ${path}`);
        entry.set(value);
      },
    },
    connection: { getState: () => $connectionState.get() },
    workingMemory: { getTerms: () => $workingMemory.get() },
    surfaces: { list: () => getSurfaces() },
    views: {
      adapters: () => viewAdapters(),
      selection: () => $viewSelection.get(),
    },
  };
  w.__testApiExposed = true;
}

// Auto-expose test API when store module is evaluated (browser only)
if (typeof window !== 'undefined') exposeTestApi();
