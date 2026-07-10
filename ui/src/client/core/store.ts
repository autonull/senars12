import type { LensSpec } from '../../shared/lens-schema.js';
import { isBuiltinLens } from '../../shared/lens-schema.js';
import type { ChatMessage, GraphNodeData, Lens } from '@senars/core';
import { beliefLens, compile, contradictionLens, goalLens } from '../modulation/compile.js';
import { timeGate } from '../modulation/composition.js';
import { evaluate } from '../modulation/evaluate.js';
import type { Delta, Item, Modulation, Lens as ModulationLens, View } from '../modulation/types.js';

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

const atom = <T>(initial: T) => new Atom(initial);

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
export const $config = atom<Record<string, any>>({});
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

export const $activeLens = atom<Lens>('belief');
export const $focusTerm = atom<string | null>(null);
export const $selectedNodeId = atom<string | null>(null);
export const $selectedEdgeId = atom<string | null>(null);
export const $viewport = atom<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
export const $workingMemory = atom<string[]>([]);

// --- Phase 2: Multi-select ---
export const $selectedNodeIds = atom<Set<string>>(new Set());

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

export interface LensFieldDescriptor {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'string' | 'object';
}

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
  const ids = ['belief', 'goal', 'contradiction'];
  for (const id of $lensRegistry.get().keys()) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Get the full LensSpec for a given lens ID, including builtins. */
export function getLensSpec(id: string): LensSpec | undefined {
  const builtin: Record<string, Pick<LensSpec, 'id' | 'label' | 'description'>> = {
    belief: { id: 'belief', label: 'Beliefs', description: 'What the system knows' },
    goal: { id: 'goal', label: 'Goals', description: 'What the system wants' },
    contradiction: {
      id: 'contradiction',
      label: 'Conflicts',
      description: 'Where beliefs conflict',
    },
  };
  return $lensRegistry.get().get(id) ?? (builtin[id] as LensSpec | undefined);
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

const LENS_MODULATION_MAP: Record<string, Modulation> = {
  belief: beliefLens(),
  goal: goalLens(),
  contradiction: contradictionLens(),
};

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
export const $lensLayout = atom<Record<string, string>>({
  belief: 'cose',
  goal: 'concentric',
  contradiction: 'breadthfirst',
});

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
    ['config', { id: 'config', open: false, docked: 'right', size: 320, order: 0 }],
    ['telemetry', { id: 'telemetry', open: true, docked: 'bottom', size: 200, order: 0 }],
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

// Migration alias: $configOpen → $panels.get('config').open
export const $configOpen = {
  get: () => $panels.get().get('config')?.open ?? false,
  set: (open: boolean) => {
    const panels = new Map($panels.get());
    const panel = panels.get('config');
    if (panel) {
      panels.set('config', { ...panel, open });
      $panels.set(panels);
    }
  },
  subscribe: (fn: (value: boolean) => void) =>
    $panels.subscribe((p) => fn(p.get('config')?.open ?? false)),
};

// --- Phase 0: URL State ---
export interface UrlState {
  lens: Lens;
  focus?: string;
  viewport?: { x: number; y: number; zoom: number };
  search?: string;
  panels?: string[];
}

export const $urlState = atom<UrlState>({ lens: 'belief' });

// URL synchronization
let urlDebounceTimer: number | undefined;

function parseHash(): Partial<UrlState> {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return {};
  const params = new URLSearchParams(hash);
  const state: Partial<UrlState> = {};
  const lens = params.get('lens') as Lens | null;
  if (lens && ['belief', 'goal', 'contradiction'].includes(lens)) state.lens = lens;
  const focus = params.get('focus');
  if (focus) state.focus = focus;
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
  return state;
}

function serializeHash(state: UrlState): string {
  const params = new URLSearchParams();
  params.set('lens', state.lens);
  if (state.focus) params.set('focus', state.focus);
  if (state.viewport)
    params.set('viewport', `${state.viewport.x},${state.viewport.y},${state.viewport.zoom}`);
  if (state.search) params.set('search', state.search);
  if (state.panels?.length) params.set('panels', state.panels.join(','));
  return params.toString();
}

function syncUrlFromState(state: UrlState) {
  if (urlDebounceTimer) clearTimeout(urlDebounceTimer);
  urlDebounceTimer = window.setTimeout(() => {
    const hash = serializeHash(state);
    const current = window.location.hash.replace(/^#/, '');
    if (hash !== current) {
      window.history.replaceState(null, '', `#${hash}`);
    }
  }, 300);
}

export function hydrateFromUrl() {
  const parsed = parseHash();
  if (parsed.lens) $activeLens.set(parsed.lens);
  const currentUrl = $urlState.get();
  $urlState.set({ ...currentUrl, ...parsed });
  if (parsed.panels) {
    const panels = new Map($panels.get());
    for (const [id, panel] of panels) {
      panel.open = parsed.panels.includes(id);
    }
    $panels.set(panels);
  }
}

// Sync URL when urlState changes
$urlState.subscribe((state) => syncUrlFromState(state));

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
  lensViewport: $lensViewport,
  graphFilter: $graphFilter,
  lensLayout: $lensLayout,
  lensRegistry: $lensRegistry,
  lensFields: $lensFields,
  nodeHistory: $nodeHistory,
  viewportMode: $viewportMode,
} satisfies Record<string, ReadableAtom<unknown>>;

export type TestApiStorePath = keyof typeof storeAtoms;

export function mountTestApi<T>(namespace: string, api: T): void {
  const w = window as unknown as { __testApi?: Record<string, unknown> };
  w.__testApi = { ...w.__testApi, [namespace]: api };
}

export function exposeTestApi(): void {
  mountTestApi('store', {
    getState: (path: string) => storeAtoms[path as TestApiStorePath]?.get(),
  });
  mountTestApi('connection', { getState: () => $connectionState.get() });
}
