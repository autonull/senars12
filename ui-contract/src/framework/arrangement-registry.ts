/**
 * Arrangement registry — open arrangements (§8, §12).
 *
 * An arrangement is a strategy for laying out cells and projecting their content.
 * It unifies the fragmented concepts of LayoutId, ArrangementKind, and Shape
 * into a single extensible registry. The core arrangements SeNARS registers
 * by default cover the flat↔graph continuum (UI.17 §5).
 */

import type { Cell, LayoutId } from './composition.js';
import type { Shape } from '../core/view-spec.js';
import { layoutTemplate, cellAreaNames } from './layout.js';

/** Context passed to arrangement strategies. */
export interface ArrangementContext {
  readonly containerSize: { width: number; height: number };
  readonly theme: unknown; // ThemeTokens
  readonly flags: unknown; // ViewFlags
}

/** The result of an arrangement — a layout template and cell projections. */
export interface Layout {
  readonly template: {
    readonly columns: string;
    readonly rows: string;
    readonly areas: string;
  };
  readonly cells: readonly Cell[];
}

/** An arrangement strategy — a layout with optional shape projection. */
export interface Arrangement {
  readonly kind: string;
  readonly label: string;
  readonly description?: string;
  /** Layout strategy — how cells are arranged in space. */
  readonly layout: LayoutId;
  /** Optional shape override — projects all cells to this shape. */
  readonly shape?: Shape;
  /** Optional per-cell shape overrides. */
  readonly cellShapes?: Readonly<Record<string, Shape>>;
  /** Arrange cells into a layout. */
  arrange(cells: readonly Cell[], ctx: ArrangementContext): Layout;
}

const arrangementRegistry = new Map<string, Arrangement>();
const registrationOrder: string[] = [];

/** Register an arrangement strategy. */
export const registerArrangement = (arrangement: Arrangement): void => {
  if (arrangementRegistry.has(arrangement.kind)) {
    console.warn(`Arrangement ${arrangement.kind} already registered; overwriting`);
  } else {
    registrationOrder.push(arrangement.kind);
  }
  arrangementRegistry.set(arrangement.kind, arrangement);
};

/** Get a registered arrangement. */
export const getArrangement = (kind: string): Arrangement | undefined => arrangementRegistry.get(kind);

/** All registered arrangements in registration order. */
export const getArrangements = (): readonly Arrangement[] => registrationOrder.map((id) => arrangementRegistry.get(id)!);

/** Whether an arrangement is registered. */
export const hasArrangement = (kind: string): boolean => arrangementRegistry.has(kind);

/** Arrangement IDs in registration order. */
export const arrangementIds = (): readonly string[] => [...registrationOrder];

/** Clear the registry (test-only). */
export const resetArrangements = (): void => {
  arrangementRegistry.clear();
  registrationOrder.length = 0;
};

/** Default arrangement function — uses the layout engine. */
function defaultArrange(cells: readonly Cell[], _ctx: ArrangementContext, layout: LayoutId): Layout {
  return {
    template: layoutTemplate(layout, cellAreaNames(cells)),
    cells,
  };
}

/** The core arrangements SeNARS registers by default. */
export const CORE_ARRANGEMENTS: readonly Arrangement[] = [
  {
    kind: 'auto',
    label: 'Auto',
    description: 'Automatic layout based on cell count',
    layout: 'auto',
    arrange: (cells, _ctx) => defaultArrange(cells, _ctx, 'auto'),
  },
  {
    kind: 'horizontal',
    label: 'Horizontal',
    description: 'Cells arranged horizontally',
    layout: 'h',
    arrange: (cells, ctx) => defaultArrange(cells, ctx, 'h'),
  },
  {
    kind: 'vertical',
    label: 'Vertical',
    description: 'Cells arranged vertically',
    layout: 'v',
    arrange: (cells, ctx) => defaultArrange(cells, ctx, 'v'),
  },
  {
    kind: 'grid',
    label: 'Grid',
    description: 'Cells arranged in a grid',
    layout: 'grid',
    arrange: (cells, ctx) => defaultArrange(cells, ctx, 'grid'),
  },
  {
    kind: 'hero',
    label: 'Hero',
    description: 'One main cell with sidebar cells',
    layout: 'hero',
    arrange: (cells, ctx) => defaultArrange(cells, ctx, 'hero'),
  },
  {
    kind: 'rail',
    label: 'Rail',
    description: 'Sidebar with main content area',
    layout: 'rail',
    arrange: (cells, ctx) => defaultArrange(cells, ctx, 'rail'),
  },
  // Shape-specific arrangements (project cells to a specific shape)
  {
    kind: 'graph',
    label: 'Graph',
    description: 'Graph visualization arrangement',
    layout: 'auto',
    shape: 'graph',
    arrange: (cells, _ctx) => defaultArrange(cells, _ctx, 'auto'),
  },
  {
    kind: 'table',
    label: 'Table',
    description: 'Tabular data arrangement',
    layout: 'auto',
    shape: 'table',
    arrange: (cells, _ctx) => defaultArrange(cells, _ctx, 'auto'),
  },
  {
    kind: 'tree',
    label: 'Tree',
    description: 'Hierarchical tree arrangement',
    layout: 'auto',
    shape: 'tree',
    arrange: (cells, _ctx) => defaultArrange(cells, _ctx, 'auto'),
  },
  // Instrument arrangement (from Phase 1)
  {
    kind: 'instrument',
    label: 'Instrument',
    description: 'Cycle controls + trace viewer + gate inspector rail',
    layout: 'rail',
    cellShapes: {
      's-cycle-controls': 'graph',
      's-trace-viewer': 'graph',
      's-gate-inspector': 'text',
      's-aspect-panel': 'text',
    },
    arrange: (cells, ctx) => defaultArrange(cells, ctx, 'rail'),
  },
] as const;

/** Register the core SeNARS arrangements. */
export const registerCoreArrangements = (): void => {
  for (const arrangement of CORE_ARRANGEMENTS) registerArrangement(arrangement);
}

/** Type of registered arrangement IDs (for exhaustiveness). */
export type RegisteredArrangement = Arrangement['kind'];

/** Get arrangements that use a specific layout. */
export const arrangementsForLayout = (layout: LayoutId): readonly Arrangement[] =>
  getArrangements().filter((a) => a.layout === layout);

/** Get arrangements that project to a specific shape. */
export const arrangementsForShape = (shape: Shape): readonly Arrangement[] =>
  getArrangements().filter((a) => a.shape === shape || (a.cellShapes && Object.values(a.cellShapes).includes(shape)));

/** Ensure core arrangements are registered on first import. */
registerCoreArrangements();