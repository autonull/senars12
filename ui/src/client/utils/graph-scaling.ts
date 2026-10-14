/**
 * The one scaling policy for the graph: how large a node is drawn, the zoom
 * window the viewport is allowed to settle in, and when a label earns its place.
 * Pure arithmetic, so the live viewport and the legibility assertion (§G.1/G.2/G.3,
 * T.4) share one definition and the tokens are the only source of the numbers.
 */

import { numericToken, token } from './theme.js';

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/** World-space node-size window, from the priority (importance) scale. */
export const NODE_SIZE = {
  min: numericToken('colors.priority.size-min'),
  max: numericToken('colors.priority.size-max'),
} as const;

/** The floor and ceiling of the zoom window the viewport settles in. */
export const ZOOM = {
  min: numericToken('colors.legibility.min-zoom'),
  max: numericToken('colors.legibility.max-zoom'),
} as const;

/** The smallest rendered node edge (px) that still reads as a node. */
export const LEGIBLE_NODE_PX = numericToken('colors.legibility.node-px');

/** Padding (px) around the fit, so content never touches the viewport edge. */
export const FIT_PADDING = numericToken('colors.legibility.fit-padding');

/** World-space gutter between nodes the layout aims to keep (§Move 1.3). */
export const NODE_GUTTER = numericToken('colors.legibility.node-gutter');

/** The most `<s-node-body>` elements that may mount at once (§Move 2.2). */
export const HTML_BODY_BUDGET = numericToken('colors.legibility.html-body-budget');

const LABEL_LOD = numericToken('colors.legibility.label-lod-threshold');
const LABEL_BUDGET = numericToken('colors.legibility.label-budget');
const HTML_LOD_ZOOM = numericToken('colors.legibility.html-lod-zoom');
const REFERENCE_AREA = numericToken('colors.legibility.reference-area');
const REFERENCE_COUNT = numericToken('colors.legibility.reference-count');

/**
 * Viewport-density factor: a denser graph or a larger viewport pushes node size
 * up, so a node keeps a legible rendered size as the fit zoom falls to fit the
 * content (§G.1). Bounded so neither extreme distorts the size channel.
 */
export function densityFactor(count: number, area: number): number {
  const byCount = Math.sqrt(Math.max(count, 1) / REFERENCE_COUNT);
  const byArea = Math.sqrt(Math.max(area, 1) / REFERENCE_AREA);
  return clamp(byCount * byArea, 0.6, 2.2);
}

/** World-space node size for an importance (0..1) at a viewport's density (§G.1). */
export function nodeSize(importance: number, count: number, area: number): number {
  const base = NODE_SIZE.min + (NODE_SIZE.max - NODE_SIZE.min) * clamp(importance, 0, 1);
  return clamp(base * densityFactor(count, area), NODE_SIZE.min, NODE_SIZE.max);
}

/**
 * The minimum zoom that keeps a typical node (importance ½) legible: it scales
 * with the density-adjusted node size, never below the token floor, so a fit can
 * never settle onto an illegible view (§G.2).
 */
export function zoomFloor(count: number, area: number): number {
  return clamp(LEGIBLE_NODE_PX / nodeSize(0.5, count, area), ZOOM.min, 1);
}

/** A fit zoom clamped into the legible window: floor (legible) ≤ zoom ≤ ceiling (§G.2). */
export function clampZoom(zoom: number, count: number, area: number): number {
  return clamp(zoom, zoomFloor(count, area), ZOOM.max);
}

/**
 * How a viewport settles after a fit. `legible` lifts the zoom to the node
 * legibility floor, so a sparse graph never reads as specks; `fit` only caps at
 * the ceiling, so a graph embedded in a small cell (the Lab wall) shows *all* of
 * its content rather than a legible crop.
 */
export type GraphFit = 'legible' | 'fit';

/** A fit zoom settled under the requested policy (§G.2). */
export function settleZoom(zoom: number, count: number, area: number, fit: GraphFit): number {
  return fit === 'fit' ? Math.min(zoom, ZOOM.max) : clampZoom(zoom, count, area);
}

/** The on-screen size of a node of the given world size at a zoom. */
export const renderedNodeSize = (worldSize: number, zoom: number): number => worldSize * zoom;

/** Whether a node reads at rest (T.4). */
export const isLegible = (worldSize: number, zoom: number): boolean =>
  renderedNodeSize(worldSize, zoom) >= LEGIBLE_NODE_PX;

/**
 * Label level-of-detail: a node shows its label when its importance, amplified
 * by zoom, clears the threshold. Important nodes label first, so a dense or
 * zoomed-out graph shows the few labels that matter and never collides (§G.3).
 */
export const showsLabel = (importance: number, zoom: number): boolean =>
  importance * zoom >= LABEL_LOD;

/**
 * The importance at which labels stop: only the top `budget` nodes (by
 * importance, capped by zoom and shrunk by density) keep a label, so a dense
 * canvas cannot collide no matter how close the nodes sit (§G.3). An empty graph
 * or a budget that covers every node yields `Infinity` (label everything).
 */
export function labelCutoff(importances: readonly number[], zoom: number): number {
  const count = importances.length;
  if (count === 0) return Number.POSITIVE_INFINITY;
  // Denser graphs buy fewer labels, so spacing never has to grow to avoid collisions.
  const density = REFERENCE_COUNT / Math.max(count, REFERENCE_COUNT);
  const budget = clamp(Math.round(LABEL_BUDGET * zoom * density), 3, count);
  const sorted = [...importances].sort((a, b) => b - a);
  return sorted[budget - 1] ?? Number.POSITIVE_INFINITY;
}

/** Whether the `full` HTML body may mount: a near (`card`/`full`) tier only (§G.3/R.1). */
export const htmlLabelVisible = (zoom: number): boolean => zoom >= HTML_LOD_ZOOM;

/** Level-of-detail tiers for node rendering. */
export type LoDTier = 'glyph' | 'label' | 'card' | 'full';

/** Zoom thresholds for each LoD tier (increasing zoom = more detail). */
export const LOD_ZOOM_THRESHOLDS: Record<LoDTier, number> = {
  glyph: 0,
  label: LABEL_LOD,
  card: HTML_LOD_ZOOM * 0.75,
  full: HTML_LOD_ZOOM,
} as const;

/**
 * The motion of a LoD transition — the properties that change as a node crosses a
 * tier, and the tempo they change at, both from motion tokens so the canvas, the
 * node body and the embedded views all breathe at one rhythm (§Move 2 aliveness).
 * The duration lives in the 150–200 ms "alive, not laggy" band; reduced motion is
 * handled globally in `base.css`.
 */
export const LOD_TRANSITION = {
  property: 'background-color, width, height, opacity, border-color, border-width',
  duration: token('motion.durations.normal'),
  easing: token('motion.easings.ease-out'),
} as const;

/** Determine the active LoD tier for a node at a given zoom and importance. */
export function getLoDTier(
  zoom: number,
  importance: number,
  isWorkspace: boolean
): LoDTier {
  if (!isWorkspace) {
    // Engine nodes: glyph → label only
    if (zoom < LOD_ZOOM_THRESHOLDS.label) return 'glyph';
    return 'label';
  }
  // Workspace nodes: glyph → label → card → full
  if (zoom < LOD_ZOOM_THRESHOLDS.label) return 'glyph';
  if (zoom < LOD_ZOOM_THRESHOLDS.card) return 'label';
  if (zoom < LOD_ZOOM_THRESHOLDS.full) return 'card';
  return 'full';
}

/** Whether a node should show its HTML body (card or full tier). */
export const showsHtmlBody = (zoom: number, importance: number, isWorkspace: boolean): boolean =>
  getLoDTier(zoom, importance, isWorkspace) !== 'glyph' &&
  getLoDTier(zoom, importance, isWorkspace) !== 'label';
