/**
 * Config sync — URL ⇄ Composition ⇄ atoms.
 *
 * The URL is the config language: a composition is addressed by `?preset=<id>`
 * (and optionally overridden by `layout`, `lens`, `layer`, `shape`, `mode`,
 * `fit`, `filter`). Every point is shareable and reproducible. Applying a
 * composition's globals writes the atoms the surfaces already watch — the watch
 * pattern is unchanged.
 */

import {
  $activeLens,
  $graphFilter,
  $graphFit,
  $graphLayer,
  $graphShape,
  $viewportMode,
  VIEWPORT_MODES,
} from '../../kernel/index.js';
import {
  compositionFor,
  type Composition,
  type Globals,
  type LayoutId,
} from '../../framework/composition.js';
import { LAYOUT_IDS } from '../../framework/layout.js';
import { LENS_FACETS } from '../../utils/lens-catalog.js';
import { GRAPH_LAYER_FACETS } from '../../core/graph-layer-defs.js';
import { FILTER_FACETS } from '../../core/filter-facets.js';

/** The preset the Studio opens on when the URL names none. */
export const DEFAULT_PRESET = 'chat-graph';

const SHAPES = ['graph', 'table'] as const;
const FITS = ['legible', 'fit'] as const;
export const FILTER_ALL = 'all';

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

/** Resolve the global controls for a composition from a URL, falling back to `base`. */
export function resolveGlobals(params: URLSearchParams, base: Globals = {}): Required<Globals> {
  return {
    lens: pick(params.get('lens'), LENS_FACETS.ids, base.lens ?? 'belief'),
    layer: pick(params.get('layer'), GRAPH_LAYER_FACETS.ids, base.layer ?? 'both'),
    shape: pick(params.get('shape'), SHAPES, base.shape ?? 'graph'),
    mode: pick(params.get('mode'), VIEWPORT_MODES, base.mode ?? '2d'),
    fit: pick(params.get('fit'), FITS, base.fit ?? 'legible'),
    filter: pick(params.get('filter'), FILTER_FACETS.ids, base.filter ?? FILTER_ALL),
  };
}

/** Resolve the layout id from a URL, falling back to the composition's own layout. */
export const resolveLayout = (params: URLSearchParams, base: LayoutId): LayoutId =>
  pick(params.get('layout'), LAYOUT_IDS, base);

/**
 * Resolve the composition a URL addresses: a registered preset (by `?preset=`,
 * or `fallback`) with its globals/layout overridden by explicit URL params.
 */
export function compositionFromUrl(
  params: URLSearchParams,
  fallback?: Composition
): Composition | undefined {
  const base = compositionFor(params.get('preset') ?? '') ?? fallback;
  if (!base) return undefined;
  return {
    ...base,
    layout: resolveLayout(params, base.layout),
    globals: resolveGlobals(params, base.globals),
  };
}

/** Serialize a composition to a shareable search string (always names the preset). */
export function compositionToSearch(composition: Composition): string {
  const params = new URLSearchParams();
  params.set('preset', composition.id);
  params.set('layout', composition.layout);
  const globals = composition.globals;
  if (globals) {
    for (const [key, value] of Object.entries(globals)) {
      if (value !== undefined) params.set(key, String(value));
    }
  }
  return `?${params.toString()}`;
}

/** Apply a composition's globals to the atoms the surfaces watch. */
export function applyGlobals(globals: Globals = {}): void {
  if (globals.lens) $activeLens.set(globals.lens as never);
  // Lens changes cascade into the layer; set the explicit layer after so it wins.
  if (globals.layer) $graphLayer.set(globals.layer as never);
  if (globals.shape) $graphShape.set(globals.shape);
  if (globals.mode) $viewportMode.set(globals.mode);
  if (globals.fit) $graphFit.set(globals.fit);
  if (globals.filter !== undefined)
    $graphFilter.set(globals.filter === FILTER_ALL ? null : globals.filter);
}
