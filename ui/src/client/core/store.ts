type Listener<T> = (value: T) => void;

class Atom<T> {
  private _value: T;
  private listeners = new Set<Listener<T>>();

  constructor(initial: T) {
    this._value = initial;
  }

  get() { return this._value; }

  set(value: T) {
    this._value = value;
    for (const fn of this.listeners) fn(value);
  }

  subscribe(fn: Listener<T>) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

function atom<T>(initial: T) {
  return new Atom(initial);
}

export interface TelemetryData {
  reasoning_hz: number[];
  tokens_per_sec: number[];
  memory_mb: number[];
  ws_latency_ms: number[];
}

export const $chat = atom<Array<{ role: 'user' | 'agent'; content: string }>>([]);
export const $streamingDelta = atom<string>('');
export const $graphNodes = atom<Map<string, Record<string, any>>>(new Map());
export const $graphEdges = atom<Map<string, Record<string, any>>>(new Map());
export const $graphMeta = atom<{ truncated: boolean; total_hidden: number }>({ truncated: false, total_hidden: 0 });
export const $workingMemory = atom<any[]>([]);
export const $config = atom<Record<string, any>>({});
export const $telemetry = atom<TelemetryData>({
  reasoning_hz: [], tokens_per_sec: [], memory_mb: [], ws_latency_ms: [],
});
export const $connectionState = atom<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
export const $lastSeqId = atom<number | null>(null);

// Expose test API for store / connection introspection
if (typeof window !== 'undefined') {
  const w = window as any;
  w.__testApi = w.__testApi || {};
  w.__testApi.store = {
    getState: (path: string) => {
      const stores: Record<string, () => any> = {
        'chat': () => $chat.get(),
        'streamingDelta': () => $streamingDelta.get(),
        'graphNodes': () => $graphNodes.get(),
        'graphEdges': () => $graphEdges.get(),
        'graphMeta': () => $graphMeta.get(),
        'workingMemory': () => $workingMemory.get(),
        'config': () => $config.get(),
        'telemetry': () => $telemetry.get(),
        'connectionState': () => $connectionState.get(),
        'lastSeqId': () => $lastSeqId.get(),
      };
      return stores[path]?.() ?? undefined;
    },
  };
  w.__testApi.connection = {
    getState: () => $connectionState.get(),
  };
}
