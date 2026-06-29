import type { ChatMessage, GraphNodeData, Lens } from '../../shared/protocol.js';

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
  ])
);

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
  viewport: $viewport,
  workingMemory: $workingMemory,
  panels: $panels,
  urlState: $urlState,
  selectedNodeIds: $selectedNodeIds,
  lensViewport: $lensViewport,
  graphFilter: $graphFilter,
  lensLayout: $lensLayout,
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
