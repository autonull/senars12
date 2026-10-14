/**
 * Composition — the one data-driven model of an app's arrangement.
 *
 * An app is a *composition*: an ordered set of dumb surfaces (cells) arranged by
 * a layout, under global controls, addressed by URL. The shell owns the chrome;
 * surfaces only render content. Compositions are data — adding one is a registry
 * entry, not a component.
 *
 * A cell is either a surface id (from the surface registry) or another
 * composition, so variety is unbounded without new code.
 */

import { createIdRegistry, type Registry } from '../core/registry.js';

/** How a composition's cells are arranged. */
export type LayoutId = 'auto' | 'h' | 'v' | 'grid' | 'hero' | 'rail';

/** Global controls applied to a whole composition (a subset are graph-specific). */
export interface Globals {
  /** Active lens (`belief | goal | contradiction | temporal`). */
  readonly lens?: string;
  /** Graph layer (`both | conversation | concepts`). */
  readonly layer?: string;
  /** Graph shape. */
  readonly shape?: 'graph' | 'table';
  /** Graph dimensionality. */
  readonly mode?: '2d' | '3d';
  /** Graph fit policy. */
  readonly fit?: 'legible' | 'fit';
  /** Active capability/kind filter. */
  readonly filter?: string;
}

/** One slot in a composition: a surface id, or a nested composition. */
export type Cell = { readonly surface: string } | { readonly composition: Composition };

/** A named arrangement of cells under global controls. */
export interface Composition {
  readonly id: string;
  readonly name: string;
  readonly cells: readonly Cell[];
  readonly layout: LayoutId;
  readonly globals?: Globals;
}

/** The one composition registry (presets). */
const compositionRegistry: Registry<string, Composition> = createIdRegistry();

/** Register a composition. */
export const registerComposition = (composition: Composition): Composition => {
  compositionRegistry.register(composition);
  return composition;
};

/** Get a registered composition by id. */
export const compositionFor = (id: string): Composition | undefined => compositionRegistry.get(id);

/** All registered compositions, in registration order. */
export const getCompositions = (): readonly Composition[] => compositionRegistry.all();

/** Clear the registry (test-only). */
export const resetCompositions = (): void => compositionRegistry.reset();

/** The surface id of a cell, when the cell is a surface (not a nested composition). */
export const cellSurface = (cell: Cell): string | undefined =>
  'surface' in cell ? cell.surface : undefined;
