/**
 * The `WorkspaceRenderer` contract and its open registry (§3.1). This is the
 * new spine: a renderer receives the workspace substrate — a snapshot to
 * (re)hydrate and an op stream while streaming — and declares its capabilities
 * honestly, including partial parity. Notebook and Graph are full renderers over
 * the same graph; Graph3D ships later as a declared `partial` renderer. The
 * active renderer is store state, so it is URL-addressable, palette-switchable
 * and agent-settable, and switching round-trips `snapshot()` → `restore()`.
 */

import type {
  BlockKind,
  Ref,
  SemanticBlock,
  SemanticLink,
  WorkspaceOp,
} from './workspace-graph.js';
import { Capability } from './capabilities.js';

/** Every interaction a renderer may implement; capabilities declare the subset. */
export const WORKSPACE_INTERACTIONS = [
  'compose',
  'stream',
  'artifacts',
  'inspect',
  'explain',
  'select-context',
  'follow-up',
  'steer',
  'run-control',
  'palette',
  'structure-nav',
  'embed',
] as const;

export type WorkspaceInteraction = (typeof WORKSPACE_INTERACTIONS)[number];

/** Optional chrome a renderer opts into, so the shell never hard-codes renderer ids. */
export const WORKSPACE_CONTROLS = ['layers'] as const;

export type WorkspaceControl = (typeof WORKSPACE_CONTROLS)[number];

export type WorkspaceRendererCaps = {
  readonly interactions: readonly WorkspaceInteraction[];
  /** Block kinds this renderer presents richly, or `'all'`. */
  readonly blockKinds: readonly BlockKind[] | 'all';
  /** `graph3d` ships partial, declared honestly (§0.2/§10). */
  readonly parity: 'full' | 'partial';
  /** Optional shell controls this renderer presents (e.g. the graph layer filter). */
  readonly controls?: readonly WorkspaceControl[];
  /** The surface element/kind this renderer presents (e.g. `s-notebook`, `graph-surface`). */
  readonly surface?: string;
  /** Capability required to use this renderer; if absent, always available. */
  readonly requiredCapability?: Capability;
};

/** Viewport/scroll/camera plus focus/selection — what a renderer switch preserves. */
export interface RendererSnapshot {
  readonly renderer: string;
  readonly viewport?: { x: number; y: number; zoom: number };
  readonly focus?: Ref;
  readonly selection: readonly Ref[];
}

/** The shared shell services a renderer is mounted with — no panel chrome leaks in. */
export interface WorkspaceContext {
  readonly openOverlay: (id: string, anchor?: Ref) => void;
  readonly openPalette: () => void;
  /** Current active renderer id. */
  readonly renderer: string;
  /** Switch the active renderer (updates URL + session state). */
  readonly setRenderer: (id: string) => void;
  /** All open overlay ids, bottom to top. */
  readonly overlays: () => string[];
  /** Whether any overlay is open. */
  readonly hasOverlays: () => boolean;
}

export interface WorkspaceRenderer {
  readonly id: string;
  readonly label: string;
  capabilities(): WorkspaceRendererCaps;
  mount(host: HTMLElement, ctx: WorkspaceContext): void;
  /** Snapshot (re)hydration — the full current block/link sets. */
  present(blocks: readonly SemanticBlock[], links: readonly SemanticLink[]): void;
  /** Incremental streaming. */
  apply(ops: readonly WorkspaceOp[]): void;
  focus(ref: Ref): void;
  select(refs: readonly Ref[]): void;
  openComposer(anchor?: Ref): void;
  openExplain(ref: Ref): void;
  snapshot(): RendererSnapshot;
  restore(snap: RendererSnapshot): void;
  dispose(): void;
}

/** §10 parity matrix, as data. One row per registered renderer. */
export type RendererParity = {
  /** Declared parity from `capabilities()` — the honest self-report. */
  readonly parity: 'full' | 'partial';
  /** Interactions the renderer declares. */
  readonly interactions: readonly WorkspaceInteraction[];
  /** Optional shell controls (e.g. the graph layer filter). */
  readonly controls?: readonly WorkspaceControl[];
  /** The surface kind the renderer presents (`s-notebook`, `graph-surface`, …). */
  readonly rendererKind: string;
  /** Interactions declared but not actually implemented — drill-down notes (§10). */
  readonly gaps?: readonly string[];
};

const registry = new Map<string, WorkspaceRenderer>();
const parity = new Map<string, RendererParity>();

/** A renderer's own capabilities, reduced to a §10 matrix row. */
const parityRow = (id: string, caps: WorkspaceRendererCaps): RendererParity => ({
  parity: caps.parity,
  interactions: caps.interactions,
  ...(caps.controls ? { controls: caps.controls } : {}),
  rendererKind: caps.surface ?? id,
});

export const registerRenderer = (renderer: WorkspaceRenderer): void => {
  registry.set(renderer.id, renderer);
  parity.set(renderer.id, parityRow(renderer.id, renderer.capabilities()));
};

/** Enrich/override a renderer's §10 matrix row (gaps, surface kind, …). */
export const declareParity = (id: string, row: Partial<RendererParity>): void => {
  const caps = registry.get(id)?.capabilities();
  const base: RendererParity = caps
    ? parityRow(id, caps)
    : { parity: 'full', interactions: [], rendererKind: id };
  parity.set(id, { ...base, ...row });
};

/** The §10 parity matrix, as data — registration order. */
export const rendererParity = (): (RendererParity & { readonly id: string })[] =>
  [...registry.keys()].map((id) => ({ id, ...parity.get(id)! }));

/** The §10 matrix row for one renderer. */
export const rendererParityFor = (
  id: string
): (RendererParity & { readonly id: string }) | undefined => {
  const row = parity.get(id);
  return row ? { id, ...row } : undefined;
};

/** Every registered renderer, in registration order. */
export const workspaceRenderers = (): WorkspaceRenderer[] => [...registry.values()];

export const workspaceRendererIds = (): string[] => [...registry.keys()];

export const workspaceRenderer = (id: string): WorkspaceRenderer | undefined => registry.get(id);

/** Renderers that present a block kind richly — the block-kind filter and palette read this. */
export const renderersForKind = (kind: BlockKind): WorkspaceRenderer[] =>
  workspaceRenderers().filter((renderer) => {
    const { blockKinds } = renderer.capabilities();
    return blockKinds === 'all' || blockKinds.includes(kind);
  });

/** Whether a renderer implements an interaction the shell is about to offer. */
export const rendererSupports = (
  renderer: WorkspaceRenderer,
  interaction: WorkspaceInteraction
): boolean =>
  (parity.get(renderer.id)?.interactions ?? renderer.capabilities().interactions).includes(
    interaction
  );

/** Whether a renderer opts into a shell control (the graph layer filter, etc.). */
export const rendererHasControl = (
  renderer: WorkspaceRenderer,
  control: WorkspaceControl
): boolean =>
  (parity.get(renderer.id)?.controls ?? renderer.capabilities().controls ?? []).includes(control);
