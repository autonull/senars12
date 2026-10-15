/**
 * WorkspaceAddress — one URL/serialization model for the entire workspace (§7, §15).
 *
 * Replaces the fragmented focus fragment ⊕ renderer ⊕ selection model with a
 * single addressable URL. Every coordinate and UI state is encoded as URL params.
 */

import type { TimeRef } from '../framework/coordinates.js';

/** The complete workspace address — one URL, all state. */
export interface WorkspaceAddress {
  /** The focus address (encoded FocusRef key). */
  readonly focus: string;
  /** The aspect projection (optional, defaults to 'content'). */
  readonly aspect?: string;
  /** The depth of containment expansion (optional, defaults to 0). */
  readonly depth?: number;
  /** The time reference (optional, defaults to 'live'). */
  readonly time?: string;
  /** The active renderer id (optional, defaults to 'graph-2d'). */
  readonly renderer?: string;
  /** Currently selected node/edge ids (optional). */
  readonly selection?: readonly string[];
  /** Currently open overlay ids (optional). */
  readonly overlays?: readonly string[];
  /** Active lens (optional). */
  readonly lens?: string;
  /** Graph layer (optional). */
  readonly layer?: string;
  /** Layout id (optional). */
  readonly layout?: string;
  /** Viewport position and zoom (optional). */
  readonly viewport?: { readonly x: number; readonly y: number; readonly zoom: number };
  /** Folded/collapsed block ids (optional). */
  readonly folded?: readonly string[];
  /** Open panel ids (optional). */
  readonly panels?: readonly string[];
}

/** Encode a WorkspaceAddress to a URL hash string. */
export const encodeAddress = (address: WorkspaceAddress): string => {
  const params = new URLSearchParams();

  params.set('focus', address.focus);
  if (address.aspect && address.aspect !== 'content') params.set('aspect', address.aspect);
  if (address.depth !== undefined && address.depth !== 0) params.set('depth', String(address.depth));
  if (address.time && address.time !== 'live') params.set('time', address.time);
  if (address.renderer && address.renderer !== 'graph-2d') params.set('renderer', address.renderer);
  if (address.selection?.length) params.set('selection', address.selection.join(','));
  if (address.overlays?.length) params.set('overlays', address.overlays.join(','));
  if (address.lens) params.set('lens', address.lens);
  if (address.layer && address.layer !== 'both') params.set('layer', address.layer);
  if (address.layout) params.set('layout', address.layout);
  if (address.viewport) {
    params.set('viewport', `${address.viewport.x},${address.viewport.y},${address.viewport.zoom}`);
  }
  if (address.folded?.length) params.set('folded', address.folded.join(','));
  if (address.panels?.length) params.set('panels', address.panels.join(','));

  return params.toString();
};

/** Parse a URL hash string back to a WorkspaceAddress. */
export const decodeAddress = (hash: string): WorkspaceAddress => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));

  const focus = params.get('focus') ?? 'mind';
  const aspect = params.get('aspect') ?? undefined;
  const depth = params.get('depth') !== null ? Number(params.get('depth')) : undefined;
  const time = params.get('time') ?? undefined;
  const renderer = params.get('renderer') ?? undefined;
  const selection = params.get('selection') ? params.get('selection')!.split(',') : undefined;
  const overlays = params.get('overlays') ? params.get('overlays')!.split(',') : undefined;
  const lens = params.get('lens') ?? undefined;
  const layer = params.get('layer') ?? undefined;
  const layout = params.get('layout') ?? undefined;
  const folded = params.get('folded') ? params.get('folded')!.split(',') : undefined;
  const panels = params.get('panels') ? params.get('panels')!.split(',') : undefined;

  let viewport: WorkspaceAddress['viewport'] = undefined;
  const vp = params.get('viewport');
  if (vp) {
    const parts = vp.split(',').map(Number);
    const x = parts[0], y = parts[1], zoom = parts[2];
    if (typeof x === 'number' && typeof y === 'number' && typeof zoom === 'number' && !Number.isNaN(x) && !Number.isNaN(y) && !Number.isNaN(zoom)) {
      viewport = { x, y, zoom };
    }
  }

  return {
    focus,
    aspect,
    depth,
    time,
    renderer,
    selection,
    overlays,
    lens,
    layer,
    layout,
    viewport,
    folded,
    panels,
  };
};

/** Build a WorkspaceAddress from the current UI state. */
export const buildWorkspaceAddress = (
  focus: string,
  aspect: string,
  depth: number,
  time: TimeRef,
  renderer: string,
  selection: readonly string[],
  overlays: readonly string[],
  lens: string,
  layer: string,
  layout: string,
  viewport: { x: number; y: number; zoom: number },
  folded: readonly string[],
  panels: readonly string[]
): WorkspaceAddress => ({
  focus,
  aspect: aspect !== 'content' ? aspect : undefined,
  depth: depth !== 0 ? depth : undefined,
  time: time.kind !== 'live' ? time.kind : undefined,
  renderer: renderer !== 'graph-2d' ? renderer : undefined,
  selection: selection.length > 0 ? selection : undefined,
  overlays: overlays.length > 0 ? overlays : undefined,
  lens,
  layer: layer !== 'both' ? layer : undefined,
  layout,
  viewport,
  folded: folded.length > 0 ? folded : undefined,
  panels: panels.length > 0 ? panels : undefined,
});

/** Default workspace address. */
export const DEFAULT_WORKSPACE_ADDRESS: WorkspaceAddress = {
  focus: 'mind',
  aspect: undefined,
  depth: undefined,
  time: undefined,
  renderer: undefined,
  selection: undefined,
  overlays: undefined,
  lens: undefined,
  layer: undefined,
  layout: undefined,
  viewport: undefined,
  folded: undefined,
  panels: undefined,
};

/** Whether two workspace addresses are equivalent. */
export const addressEquals = (a: WorkspaceAddress, b: WorkspaceAddress): boolean => {
  return (
    a.focus === b.focus &&
    a.aspect === b.aspect &&
    a.depth === b.depth &&
    a.time === b.time &&
    a.renderer === b.renderer &&
    JSON.stringify(a.selection ?? []) === JSON.stringify(b.selection ?? []) &&
    JSON.stringify(a.overlays ?? []) === JSON.stringify(b.overlays ?? []) &&
    a.lens === b.lens &&
    a.layer === b.layer &&
    a.layout === b.layout &&
    JSON.stringify(a.viewport) === JSON.stringify(b.viewport) &&
    JSON.stringify(a.folded ?? []) === JSON.stringify(b.folded ?? []) &&
    JSON.stringify(a.panels ?? []) === JSON.stringify(b.panels ?? [])
  );
};