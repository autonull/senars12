import type { Lens, LensFieldDescriptor } from '@senars/core';
import { debounce } from '@senars/util';
import type { LensSpec } from '../../shared/lens-schema.js';
import { isBuiltinLens, type BuiltinLens } from '../../shared/lens-schema.js';
import { beliefLens, builtinLensModulations, compile } from '../modulation/compile.js';
import { timeGate } from '../modulation/composition.js';
import { evaluate } from '../modulation/evaluate.js';
import type { Delta, Item, Modulation, Lens as ModulationLens, View } from '../modulation/types.js';
import { builtinLensSpec, LENS_DEFAULT_LAYOUTS, LENS_DEFS, LENS_IDS, PRIMARY_LENSES } from '../utils/lens-catalog.js';
import { CONVERSATION_LAYOUT_IDS } from './conversation-layout.js';
import { GRAPH_LAYERS, type GraphLayer } from './graph-layer.js';
import { isRegisteredLayoutId, type LayoutScope } from './layout-ids.js';
import { pageOf, sectionTree } from './sections.js';
import { getSurfaces } from './surface-registry.js';
import { viewAdapters } from './view-adapter.js';
import type { Shape, ViewSelection } from './view-spec.js';
import { PANEL_DEFS, panelDef, PANEL_KINDS, type PanelKind } from './panel-defs.js';
import { workspaceRendererIds } from './workspace-renderer.js';
import { loadConfig, saveConfig, DEFAULT_UI_CONFIG, type UiConfig, type Theme, type Density, type Motion } from './config-schema.js';

// Import kernel atoms and types from kernel/state.ts
import {
  atom,
  type Readable,
  type Writable,
  type GraphNodeData,
  $chatMessages,
  $streamingDelta,
  $graphNodes,
  $graphEdges,
  $graphMeta,
  $config,
  $telemetry,
  $cognitiveMetrics,
  $connectionState,
  $lastSeqId,
  $serverErrors,
  pushServerError,
  $cognitiveEvents,
  pushCognitiveEvents,
  clearCognitiveEvents,
  $configChanges,
  pushConfigChange,
  clearConfigChanges,
  $webllmAvailable,
  $webllmActive,
  $webllmModel,
  $controlMode,
  $reasoningRunning,
  $runTerminations,
  $workspaceGraph,
  $activeRenderer,
  setActiveRenderer,
  setWorkspaceFocus,
  revealBlock,
  setWorkspaceSelection,
  $collapsedBlocks,
  $neighborhoodDepth,
  setNeighborhoodDepth,
  toggleCollapsed,
  setCollapsed,
  $capabilityFilter,
  emptyWorkspaceGraph,
  type WorkspaceGraph,
  type SemanticBlock,
  type TelemetryData,
  type CognitiveMetricsData,
  type CognitiveMeta,
  type ServerErrorRecord,
  type RevisionEntry,
  exposeKernelTestApi as exposeKernelTestApi,
  setWsClient,
} from '../kernel/state.js';

// Import derived from framework
import { derived, setEqual } from '../framework/derived.js';

export type { UiConfig };

// Re-export kernel atoms and types
export {
  atom,
  type Readable,
  type Writable,
  type GraphNodeData,
  $chatMessages,
  $streamingDelta,
  $graphNodes,
  $graphEdges,
  $graphMeta,
  $config,
  $telemetry,
  $cognitiveMetrics,
  $connectionState,
  $lastSeqId,
  $serverErrors,
  pushServerError,
  $cognitiveEvents,
  pushCognitiveEvents,
  clearCognitiveEvents,
  $configChanges,
  pushConfigChange,
  clearConfigChanges,
  $webllmAvailable,
  $webllmActive,
  $webllmModel,
  $controlMode,
  $reasoningRunning,
  $runTerminations,
  $workspaceGraph,
  $activeRenderer,
  setActiveRenderer,
  setWorkspaceFocus,
  revealBlock,
  setWorkspaceSelection,
  $collapsedBlocks,
  $neighborhoodDepth,
  setNeighborhoodDepth,
  toggleCollapsed,
  setCollapsed,
  $capabilityFilter,
  emptyWorkspaceGraph,
  setWsClient,
  type WorkspaceGraph,
  type SemanticBlock,
  type TelemetryData,
  type CognitiveMetricsData,
  type CognitiveMeta,
  type ServerErrorRecord,
  type RevisionEntry,
};

export function updateEdgeData(
  id: string,
  patch: Record<string, unknown>
): Record<string, unknown> | undefined {
  const edges = $graphEdges.get();
  const existing = edges.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  edges.set(id, updated);
  $graphEdges.set(edges);
  return updated;
}

export function updateNodeData(
  id: string,
  patch: Partial<GraphNodeData>
): GraphNodeData | undefined {
  const nodes = $graphNodes.get();
  const existing = nodes.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch } as GraphNodeData;
  nodes.set(id, updated);
  $graphNodes.set(nodes);
  return updated;
}

export type ViewportMode = '2d' | '3d';

export const $activeLens = atom<Lens>('belief');
export const $focusTerm = atom<string | null>(null);
export const $selectedNodeId = atom<string | null>(null);
export const $selectedEdgeId = atom<string | null>(null);
export const $viewport = atom<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
export const $workingMemory = atom<string[]>([]);

export const $selectedNodeIds = derived($workspaceGraph, (graph) => graph.selection, setEqual);

/**
 * The view-system selection is a *view* of the one selection source: the
 * workspace graph's node selection plus the focused node (`$selectedNodeId`).
 * Derived — not a second atom kept in sync — so a view selection can never
 * desync from the graph and equal values never churn subscribers.
 */
export const $viewSelection = derived(
  [$selectedNodeIds, $selectedNodeId],
  ([nodes, focus]) => ({ nodes, edges: new Set<string>(), focus: focus ?? undefined }) as ViewSelection,
  (a: ViewSelection, b: ViewSelection) =>
    a.focus === b.focus && setEqual(a.nodes, b.nodes) && setEqual(a.edges, b.edges)
);

export const $lensViewport = atom<Record<string, { x: number; y: number; zoom: number }>>({
  belief: { x: 0, y: 0, zoom: 1 },
  goal: { x: 0, y: 0, zoom: 1 },
  contradiction: { x: 0, y: 0, zoom: 1 },
});

export const $graphFilter = atom<string | null>(null);

export const $viewportMode = atom<ViewportMode>('2d');

export const $graphShape = atom<Shape>('graph');

export const $graphLayer = atom<GraphLayer>('both');

export const $lensLayer = atom<Record<string, GraphLayer>>({});

export const $view = atom<View>({
  flags: detectViewFlags(),
  timeline: { t: Number.POSITIVE_INFINITY },
});

export const $lensRegistry = atom<Map<string, LensSpec>>(new Map());

export const $lensLayout = atom<Record<string, string>>({ ...LENS_DEFAULT_LAYOUTS });

export const $layoutScope = atom<LayoutScope>('concept');

export const $conversationLayout = atom<string>(CONVERSATION_LAYOUT_IDS[0]!);

export const setConversationLayout = (id: string): void => {
  if ((CONVERSATION_LAYOUT_IDS as readonly string[]).includes(id)) {
    $conversationLayout.set(id);
  }
};

export function setActiveLayout(id: string): void {
  const scope: LayoutScope = (CONVERSATION_LAYOUT_IDS as readonly string[]).includes(id)
    ? 'conversation'
    : 'concept';
  $layoutScope.set(scope);
  if (scope === 'conversation') $conversationLayout.set(id);
  else $lensLayout.set({ ...$lensLayout.get(), [$activeLens.get()]: id });
}

export function setGraphLayer(layer: GraphLayer): void {
  $lensLayer.set({ ...$lensLayer.get(), [$activeLens.get()]: layer });
  $graphLayer.set(layer);
}
$activeLens.subscribe((lens) => {
  $graphLayer.set($lensLayer.get()[lens] ?? 'both');
});

export interface PanelState {
  id: string;
  open: boolean;
  docked: 'left' | 'right' | 'bottom' | 'float';
  size: number;
  order: number;
}

const defaultPanelStates = new Map<string, PanelState>(
  PANEL_KINDS.map((kind) => {
    const def = panelDef(kind);
    return [
      kind,
      {
        id: kind,
        open: def.defaultOpen,
        docked: def.defaultDock,
        size: def.defaultSize,
        order: def.order,
      },
    ];
  })
);

export const $panels = atom<Map<string, PanelState>>(defaultPanelStates);

export interface PanelTab {
  id: string;
  label: string;
}

export function panelTabs(): PanelTab[] {
  return PANEL_KINDS.map((kind) => ({
    id: kind,
    label: panelDef(kind).label,
  }));
}

export function togglePanel(id: string): void {
  const panels = new Map($panels.get());
  const panel = panels.get(id);
  if (panel) {
    panels.set(id, { ...panel, open: !panel.open });
    $panels.set(panels);
  }
}

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

/**
 * `$workspaceGraph.timeCursor` is derived, not a second source: the scrub cursor
 * is `$view.timeline.t` (that is what the modulation gate already reads), and this
 * puts it on the substrate so the workspace renderers can admit blocks by the
 * same number (§4.4). `Infinity` is the present and is stored as `undefined`.
 */
$view.subscribe(({ timeline }) => {
  const cursor = Number.isFinite(timeline.t) ? timeline.t : undefined;
  const graph = $workspaceGraph.get();
  if (graph.timeCursor === cursor) return;
  $workspaceGraph.set(
    cursor === undefined ? { ...graph, timeCursor: undefined } : { ...graph, timeCursor: cursor }
  );
});

export const $lensFields = atom<LensFieldDescriptor[]>([]);

export const $nodeHistory = atom<RevisionEntry[]>([]);

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

export const hasTemporalData = (): boolean => {
  for (const node of $graphNodes.get().values()) {
    if (node.occurrenceTime !== undefined) return true;
  }
  return false;
}

function compileLensSpec(spec: LensSpec): Modulation {
  try {
    return compile(spec as Parameters<typeof compile>[0]);
  } catch {
    return beliefLens();
  }
}

export function registerLens(spec: LensSpec): Modulation {
  const registry = new Map($lensRegistry.get());
  registry.set(spec.id, spec);
  $lensRegistry.set(registry);
  return compileLensSpec(spec);
}

export function removeLens(id: string): void {
  if (isBuiltinLens(id)) return;
  const registry = new Map($lensRegistry.get());
  registry.delete(id);
  $lensRegistry.set(registry);
}

export function getLensIds(): string[] {
  const ids: string[] = LENS_IDS.filter((id) => LENS_DEFS.get(id)?.primary ?? false);
  for (const id of $lensRegistry.get().keys()) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

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

const LENS_MODULATION_MAP: Partial<Record<BuiltinLens, Modulation>> = builtinLensModulations();

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

export interface UrlState {
  lens: Lens;
  renderer?: string;
  layer?: GraphLayer;
  layout?: string;
  scope?: LayoutScope;
  focus?: string;
  page?: string;
  depth?: number;
  folded?: string[];
  viewport?: { x: number; y: number; zoom: number };
  search?: string;
  panels?: string[];
  theme?: Theme;
  density?: Density;
  motion?: Motion;
  defaultRenderer?: string;
  defaultLens?: Lens;
}

export const $urlState = atom<UrlState>({ lens: 'belief' });

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
    const x = parts[0], y = parts[1], z = parts[2];
    if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number' && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
      state.viewport = { x, y, zoom: z };
    }
  }
  const search = params.get('search');
  if (search) state.search = search;
  const panels = params.get('panels');
  if (panels) state.panels = panels.split(',');
  const folded = params.get('folded');
  if (folded) state.folded = folded.split(',').filter(Boolean);
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
  if (state.viewport) params.set('viewport', `${state.viewport.x},${state.viewport.y},${state.viewport.zoom}`);
  if (state.search) params.set('search', state.search);
  if (state.panels?.length) params.set('panels', state.panels.join(','));
  if (state.folded?.length) params.set('folded', state.folded.join(','));
  if (state.theme) params.set('theme', state.theme);
  if (state.density) params.set('density', state.density);
  if (state.motion) params.set('motion', state.motion);
  if (state.defaultRenderer) params.set('defaultRenderer', state.defaultRenderer);
  if (state.defaultLens) params.set('defaultLens', state.defaultLens);
  return params.toString();
}

export function hydrateFromUrl() {
  const parsed = parseHash();
  if (parsed.renderer && !workspaceRendererIds().includes(parsed.renderer)) {
    delete parsed.renderer;
  }
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
  if (parsed.theme) $config.set({ ...$config.get(), theme: parsed.theme });
  if (parsed.density) $config.set({ ...$config.get(), density: parsed.density });
  if (parsed.motion) $config.set({ ...$config.get(), motion: parsed.motion });
  if (parsed.defaultRenderer) $config.set({ ...$config.get(), defaultRenderer: parsed.defaultRenderer });
  if (parsed.defaultLens && ['belief', 'goal', 'contradiction'].includes(parsed.defaultLens)) {
    $config.set({ ...$config.get(), defaultLens: parsed.defaultLens as 'belief' | 'goal' | 'contradiction' });
  }
}

const sameNumber = (a: number | undefined, b: number | undefined): boolean => a === b;
const sameStringList = (
  a: readonly string[] | undefined,
  b: readonly string[] | undefined
): boolean => (a && b ? a.length === b.length && a.every((id) => b.includes(id)) : a === b);

function setUrlState<K extends keyof UrlState>(
  key: K,
  value: UrlState[K],
  equals: (a: UrlState[K], b: UrlState[K]) => boolean = Object.is
): void {
  if (!equals($urlState.get()[key], value)) {
    $urlState.set({ ...$urlState.get(), [key]: value } as UrlState);
  }
}

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

mirrorAtom($config, 'theme', (c) => c.theme);
mirrorAtom($config, 'density', (c) => c.density);
mirrorAtom($config, 'motion', (c) => c.motion);
mirrorAtom($config, 'defaultRenderer', (c) => c.defaultRenderer);
mirrorAtom($config, 'defaultLens', (c) => c.defaultLens);

$urlState.subscribe(syncUrl);

if (typeof window !== 'undefined') window.addEventListener('hashchange', hydrateFromUrl);

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

  applyTheme($config.get().theme);
  applyDensity($config.get().density);
  applyMotion($config.get().motion);

  $config.subscribe((config) => {
    applyTheme(config.theme);
    applyDensity(config.density);
    applyMotion(config.motion);
  });

  if (hasMatchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      const config = $config.get();
      if (config.theme === 'auto') {
        applyTheme('auto');
      }
    });

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener('change', (e) => {
      const config = $config.get();
    });
  }
}

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
  serverErrors: $serverErrors,
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
  configChanges: $configChanges,
} satisfies Record<string, ReadableAtom<unknown>>;

export type TestApiStorePath = keyof typeof storeAtoms;

if (typeof window !== 'undefined') exposeTestApi();