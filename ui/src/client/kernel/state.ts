import type { ChatMessage, CognitiveEvent, GraphNodeData } from '@senars/core';

export type { GraphNodeData };
import { loadConfig, saveConfig, DEFAULT_UI_CONFIG, type UiConfig } from '../core/config-schema.js';

let wsSocket: WebSocket | null = null;

export function setWsClient(socket: WebSocket): void {
  wsSocket = socket;
}

function sendMessage(msg: Record<string, unknown>): void {
  wsSocket?.send(JSON.stringify(msg));
}
import { emptyWorkspaceGraph, type SemanticBlock, type WorkspaceGraph } from '../core/workspace-graph.js';

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

export type { Readable, Writable };

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

export interface ServerErrorRecord {
  code: string;
  message: string;
  at: number;
}

export interface RevisionEntry {
  truth: { frequency: number; confidence: number };
  stampId: string;
  timestamp: number;
  source: 'input' | 'derivation' | 'revision' | 'inference';
}

const initialConfig: UiConfig = (() => {
  try {
    return loadConfig();
  } catch {
    return DEFAULT_UI_CONFIG;
  }
})();

export const $chatMessages = atom<ChatMessage[]>([]);
export const $streamingDelta = atom<string>('');
export const $graphNodes = atom<Map<string, GraphNodeData>>(new Map());
export const $graphEdges = atom<Map<string, Record<string, any>>>(new Map());
export const $graphMeta = atom<CognitiveMeta>({ truncated: false, totalHidden: 0 });
export const $config = atom<UiConfig>(initialConfig);
export const $telemetry = atom<TelemetryData>({
  reasoning_hz: [],
  tokens_per_sec: [],
  memory_mb: [],
  ws_latency_ms: [],
});
export const $cognitiveMetrics = atom<CognitiveMetricsData | null>(null);
export const $connectionState = atom<'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'standalone'>('connecting');
export const $lastSeqId = atom<number | null>(null);

const SERVER_ERROR_CAP = 20;
export const $serverErrors = atom<ServerErrorRecord[]>([]);

export function pushServerError(code: string, message: string): void {
  $serverErrors.set([
    ...$serverErrors.get().slice(-(SERVER_ERROR_CAP - 1)),
    { code, message, at: Date.now() },
  ]);
}

export const $cognitiveEvents = atom<CognitiveEvent[]>([]);

const COGNITIVE_EVENTS_CAP = 500;
export function pushCognitiveEvents(events: CognitiveEvent[]): void {
  $cognitiveEvents.set([...$cognitiveEvents.get().slice(-(COGNITIVE_EVENTS_CAP - events.length)), ...events]);
}

export function clearCognitiveEvents(): void {
  $cognitiveEvents.set([]);
}

const CONFIG_CHANGES_CAP = 100;
export const $configChanges = atom<SemanticBlock<'config-change'>[]>([]);

export function pushConfigChange(block: SemanticBlock<'config-change'>): void {
  $configChanges.set([...$configChanges.get().slice(-(CONFIG_CHANGES_CAP - 1)), block]);
}

export function clearConfigChanges(): void {
  $configChanges.set([]);
}

export const $webllmAvailable = atom<boolean>(false);
export const $webllmActive = atom<boolean>(false);
export const $webllmModel = atom<string>('');

export const $controlMode = atom<boolean>(false);
export const $reasoningRunning = atom<boolean>(false);
export const $runTerminations = atom<ReadonlyArray<{ scope: string; reason: string }>>([]);

export const $workspaceGraph = atom<WorkspaceGraph>(emptyWorkspaceGraph());
export const $activeRenderer = atom<string>('graph');

export function setActiveRenderer(id: string): void {
  $activeRenderer.set(id);
}

export function setWorkspaceFocus(ref?: string): void {
  const current = $workspaceGraph.get();
  if (current.focus === ref) return;
  $workspaceGraph.set({ ...current, focus: ref });
}

export function revealBlock(ref?: string): void {
  $activeRenderer.set('notebook');
  setWorkspaceFocus(ref);
}

export function setWorkspaceSelection(refs: Iterable<string>): void {
  $workspaceGraph.set({ ...$workspaceGraph.get(), selection: new Set(refs) });
}

export const $collapsedBlocks = atom<ReadonlySet<string>>(new Set());

export const $neighborhoodDepth = atom(2);

export function setNeighborhoodDepth(depth: number): void {
  $neighborhoodDepth.set(Math.min(Math.max(Math.round(depth), 1), 3));
}

export function toggleCollapsed(ref: string): void {
  const next = new Set($collapsedBlocks.get());
  if (next.has(ref)) next.delete(ref);
  else next.add(ref);
  $collapsedBlocks.set(next);
}

export function setCollapsed(refs: ReadonlySet<string>): void {
  const current = $collapsedBlocks.get();
  if (refs.size === current.size && [...refs].every((ref) => current.has(ref))) return;
  $collapsedBlocks.set(new Set(refs));
}

export const $capabilityFilter = atom<string | 'all'>('all');

if (typeof window !== 'undefined') {
  $config.subscribe((config) => {
    saveConfig(config);
  });
}

export { emptyWorkspaceGraph, type WorkspaceGraph, type SemanticBlock };

export type TestApiStorePath =
  | 'chatMessages'
  | 'streamingDelta'
  | 'graphNodes'
  | 'graphEdges'
  | 'graphMeta'
  | 'config'
  | 'telemetry'
  | 'cognitiveMetrics'
  | 'connectionState'
  | 'lastSeqId'
  | 'serverErrors'
  | 'cognitiveEvents'
  | 'configChanges'
  | 'webllmAvailable'
  | 'webllmActive'
  | 'webllmModel'
  | 'controlMode'
  | 'reasoningRunning'
  | 'runTerminations'
  | 'workspaceGraph'
  | 'activeRenderer'
  | 'collapsedBlocks'
  | 'neighborhoodDepth'
  | 'capabilityFilter';

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
  serverErrors: $serverErrors,
  cognitiveEvents: $cognitiveEvents,
  configChanges: $configChanges,
  webllmAvailable: $webllmAvailable,
  webllmActive: $webllmActive,
  webllmModel: $webllmModel,
  controlMode: $controlMode,
  reasoningRunning: $reasoningRunning,
  runTerminations: $runTerminations,
  workspaceGraph: $workspaceGraph,
  activeRenderer: $activeRenderer,
  collapsedBlocks: $collapsedBlocks,
  neighborhoodDepth: $neighborhoodDepth,
  capabilityFilter: $capabilityFilter,
} satisfies Record<TestApiStorePath, Readable<unknown>>;

export function exposeKernelTestApi(): void {
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
    send: (msg: Record<string, unknown>) => sendMessage(msg),
  };
  w.__testApiExposed = true;
}

if (typeof window !== 'undefined') exposeKernelTestApi();