import type { ChatMessage, Lens, GraphNodeData } from '../../shared/protocol.js';

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

  constructor(initial: T) { this._value = initial; }

  get() { return this._value; }

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

class Computed<T> implements Readable<T> {
  private _value: T;
  private listeners = new Set<Listener<T>>();
  private unsubs: Unsubscriber[] = [];

  constructor(deps: Readable<any>[], compute: (...values: any[]) => T) {
    this._value = compute(...deps.map(d => d.get()));
    this.unsubs = deps.map((dep) =>
      dep.subscribe(() => {
        this._value = compute(...deps.map(d => d.get()));
        for (const fn of this.listeners) fn(this._value);
      })
    );
  }

  get() { return this._value; }

  subscribe(fn: Listener<T>): Unsubscriber {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  destroy() { this.unsubs.forEach(u => u()); }
}

const computed = <T>(deps: Readable<any>[], fn: (...values: any[]) => T) => new Computed(deps, fn);

export interface TelemetryData {
  reasoning_hz: number[];
  tokens_per_sec: number[];
  memory_mb: number[];
  ws_latency_ms: number[];
}

export interface CognitiveMeta { truncated: boolean; total_hidden: number }

export const $chat = atom<ChatMessage[]>([]);
export const $streamingDelta = atom<string>('');
export const $graphNodes = atom<Map<string, GraphNodeData>>(new Map());
export const $graphEdges = atom<Map<string, Record<string, any>>>(new Map());
export const $graphMeta = atom<CognitiveMeta>({ truncated: false, total_hidden: 0 });
export const $workingMemory = atom<any[]>([]);
export const $config = atom<Record<string, any>>({});
export const $telemetry = atom<TelemetryData>({
  reasoning_hz: [], tokens_per_sec: [], memory_mb: [], ws_latency_ms: [],
});
export const $connectionState = atom<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
export const $lastSeqId = atom<number | null>(null);

export const $activeLens = atom<Lens>('belief');
export const $focusTerm = atom<string | null>(null);
export const $selectedMessageId = atom<string | null>(null);
export const $userLevel = atom<'simple' | 'full'>('simple');

export const $visibleNodes = computed([$graphNodes, $activeLens], (nodes: Map<string, GraphNodeData>, lens: string) => {
  const entries = Array.from(nodes.entries());
  const scored = entries
    .map(([id, n]) => ({ id, node: n, score: n.lensData?.score ?? 0.5 }))
    .sort((a, b) => b.score - a.score);
  return new Map(scored.map(s => [s.id, s.node]));
});

export const $visibleEdges = computed(
  [$graphEdges, $visibleNodes],
  (edges: Map<string, any>, nodes: Map<string, GraphNodeData>) => {
    const nodeIds = new Set(nodes.keys());
    return new Map(
      Array.from(edges.entries())
        .filter(([, e]) => nodeIds.has(e.source) && nodeIds.has(e.target))
    );
  }
);

export type TestApiStorePath =
  | 'chat' | 'streamingDelta' | 'graphNodes' | 'graphEdges' | 'graphMeta'
  | 'workingMemory' | 'config' | 'telemetry' | 'connectionState' | 'lastSeqId'
  | 'activeLens' | 'focusTerm' | 'selectedMessageId' | 'userLevel';

const STORE_READERS: Record<TestApiStorePath, () => unknown> = {
  chat: () => $chat.get(),
  streamingDelta: () => $streamingDelta.get(),
  graphNodes: () => $graphNodes.get(),
  graphEdges: () => $graphEdges.get(),
  graphMeta: () => $graphMeta.get(),
  workingMemory: () => $workingMemory.get(),
  config: () => $config.get(),
  telemetry: () => $telemetry.get(),
  connectionState: () => $connectionState.get(),
  lastSeqId: () => $lastSeqId.get(),
  activeLens: () => $activeLens.get(),
  focusTerm: () => $focusTerm.get(),
  selectedMessageId: () => $selectedMessageId.get(),
  userLevel: () => $userLevel.get(),
};

export function mountTestApi<T>(namespace: string, api: T): void {
  const w = window as unknown as { __testApi?: Record<string, unknown> };
  w.__testApi = { ...w.__testApi, [namespace]: api };
}

export function exposeTestApi(): void {
  mountTestApi('store', { getState: (path: string) => STORE_READERS[path as TestApiStorePath]?.() });
  mountTestApi('connection', { getState: () => $connectionState.get() });
}
