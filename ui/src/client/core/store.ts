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
export const $focus = atom<any[]>([]);
export const $config = atom<Record<string, any>>({});
export const $telemetry = atom<TelemetryData>({
  reasoning_hz: [], tokens_per_sec: [], memory_mb: [], ws_latency_ms: [],
});
export const $connectionState = atom<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
export const $lastSeqId = atom<number | null>(null);

export const $activeLens = atom<Lens>('belief');
export const $focusTerm = atom<string | null>(null);
export const $selectedMessageId = atom<string | null>(null);



type ReadableAtom<T> = { get(): T };
const storeAtoms = {
  chat: $chat, streamingDelta: $streamingDelta, graphNodes: $graphNodes,
  graphEdges: $graphEdges, graphMeta: $graphMeta, focus: $focus,
  config: $config, telemetry: $telemetry, connectionState: $connectionState,
  lastSeqId: $lastSeqId, activeLens: $activeLens, focusTerm: $focusTerm,
  selectedMessageId: $selectedMessageId,
} satisfies Record<string, ReadableAtom<unknown>>;

export type TestApiStorePath = keyof typeof storeAtoms;

export function mountTestApi<T>(namespace: string, api: T): void {
  const w = window as unknown as { __testApi?: Record<string, unknown> };
  w.__testApi = { ...w.__testApi, [namespace]: api };
}

export function exposeTestApi(): void {
  mountTestApi('store', { getState: (path: string) => storeAtoms[path as TestApiStorePath]?.get() });
  mountTestApi('connection', { getState: () => $connectionState.get() });
}
