/**
 * The one scaling policy for the graph: how large a node is drawn, the zoom
 * window the viewport is allowed to settle in, and when a label earns its place.
 * Pure arithmetic, so the live viewport and the legibility assertion (§G.1/G.2/G.3,
 * T.4) share one definition and the tokens are the only source of the numbers.
 */

import { TOKENS } from '../styles/tokens.generated.js';

const token = (key: string) => Number(TOKENS.dark[key]);
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/** World-space node-size window, from the priority (importance) scale. */
export const NODE_SIZE = {
  min: token('colors.priority.size-min'),
  max: token('colors.priority.size-max'),
} as const;

/** The floor and ceiling of the zoom window the viewport settles in. */
export const ZOOM = {
  min: token('colors.legibility.min-zoom'),
  max: token('colors.legibility.max-zoom'),
} as const;

/** The smallest rendered node edge (px) that still reads as a node. */
export const LEGIBLE_NODE_PX = token('colors.legibility.node-px');

/** Padding (px) around the fit, so content never touches the viewport edge. */
export const FIT_PADDING = token('colors.legibility.fit-padding');

/** World-space gutter between nodes the layout aims to keep (§Move 1.3). */
export const NODE_GUTTER = token('colors.legibility.node-gutter');

/** The most `<s-node-body>` elements that may mount at once (§Move 2.2). */
export const HTML_BODY_BUDGET = token('colors.legibility.html-body-budget');

const LABEL_LOD = token('colors.legibility.label-lod-threshold');
const LABEL_BUDGET = token('colors.legibility.label-budget');
const HTML_LOD_ZOOM = token('colors.legibility.html-lod-zoom');
const REFERENCE_AREA = token('colors.legibility.reference-area');
const REFERENCE_COUNT = token('colors.legibility.reference-count');

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
