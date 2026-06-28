type Listener<T> = (value: T) => void;

class Atom<T> {
  private _value: T;
  private listeners = new Set<Listener<T>>();

  constructor(initial: T) { this._value = initial; }

  get() { return this._value; }

  set(value: T) {
    this._value = value;
    for (const fn of this.listeners) fn(value);
  }

  subscribe(fn: Listener<T>): () => void {
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

export interface CognitiveMeta { truncated: boolean; total_hidden: number }

export const $chat = atom<Array<{ role: 'user' | 'agent'; content: string }>>([]);
export const $streamingDelta = atom<string>('');
export const $graphNodes = atom<Map<string, Record<string, any>>>(new Map());
export const $graphEdges = atom<Map<string, Record<string, any>>>(new Map());
export const $graphMeta = atom<CognitiveMeta>({ truncated: false, total_hidden: 0 });
export const $workingMemory = atom<any[]>([]);
export const $config = atom<Record<string, any>>({});
export const $telemetry = atom<TelemetryData>({
  reasoning_hz: [], tokens_per_sec: [], memory_mb: [], ws_latency_ms: [],
});
export const $connectionState = atom<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
export const $lastSeqId = atom<number | null>(null);

export const $activeLens = atom<'belief' | 'goal' | 'contradiction'>('belief');
export const $focusTerm = atom<string | null>(null);
export const $selectedMessageId = atom<string | null>(null);
export const $userLevel = atom<'simple' | 'full'>('simple');

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
