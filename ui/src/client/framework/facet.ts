/**
 * Facet — the one modulation model.
 *
 * A facet is a named, selectable projection of a dataset. Lenses, graph layers,
 * composer modes, capability filters, and graph filters are all facets: they
 * each offer a distinct "view" on the same underlying data by applying a
 * modulation (transform) and/or a gate (predicate/capability).
 *
 * The modulation AST (for lenses) lives in `modulation/` and is unchanged.
 * Only the *registration and selection* of facets unifies here.
 *
 * A facet has:
 * - `id` — stable key (the union discriminant)
 * - `label` — human-readable for palette/toolbar
 * - `kind` — 'lens' | 'layer' | 'mode' | 'filter'
 * - `gate` — optional capability requirement or visibility predicate
 * - `data` — domain-specific payload (modulation for lenses, visible fn for layers, etc.)
 */

import type { Contribution } from './contribution.js';
import { defineCatalog, type Catalog, type CatalogDefinition } from './catalog.js';

/** The semantic kind of a facet — determines selection UI and behavior. */
export type FacetKind = 'lens' | 'layer' | 'mode' | 'filter';

/** A gate that determines whether a facet is available/applicable. */
export type FacetGate =
  | { readonly type: 'capability'; readonly capability: string }
  | { readonly type: 'predicate'; readonly predicate: (ctx: unknown) => boolean }
  | { readonly type: 'none' };

/** Domain-specific data payload per facet kind. */
export interface FacetData extends Record<string, unknown> {
  // Lens
  modulation?: unknown;
  color?: string;
  defaultLayout?: string;
  primary?: boolean;
  requires?: readonly string[];
  spec?: unknown;

  // Layer
  visible?: (ctx: { readonly isWorkspace: boolean }) => boolean;
  icon?: string;
  description?: string;

  // Mode
  capability?: string;
  hint?: string;
  structured?: boolean;

  // Filter
  filterType?: 'capability' | 'graph' | 'search';
  options?: readonly string[];
}

/** A facet descriptor — a Contribution with facet-specific structure. */
export interface FacetDescriptor<D extends FacetData = FacetData> extends Contribution<D> {
  readonly kind: FacetKind;
  readonly gate: FacetGate;
  readonly data: D;
  readonly [key: string]: unknown;
}

/** Type guard for lens facets. */
export function isLensFacet(facet: FacetDescriptor): facet is FacetDescriptor<FacetData & { modulation: unknown }> {
  return facet.kind === 'lens';
}

/** Type guard for layer facets. */
export function isLayerFacet(facet: FacetDescriptor): facet is FacetDescriptor<FacetData & { visible: (ctx: { isWorkspace: boolean }) => boolean }> {
  return facet.kind === 'layer';
}

/** Type guard for mode facets. */
export function isModeFacet(facet: FacetDescriptor): facet is FacetDescriptor<FacetData & { capability: string; hint: string; structured: boolean }> {
  return facet.kind === 'mode';
}

/** Type guard for filter facets. */
export function isFilterFacet(facet: FacetDescriptor): facet is FacetDescriptor<FacetData & { filterType: 'capability' | 'graph' | 'search' }> {
  return facet.kind === 'filter';
}

/** Compile a facet catalog definition. */
export function defineFacetCatalog<const Def extends CatalogDefinition<FacetDescriptor>>(
  def: Def
): Catalog<Def> {
  return defineCatalog(def);
}

/** Extract the facet entry type from a facet catalog. */
export type FacetEntryOf<C extends Catalog<any>> = C extends Catalog<infer Def> ? Def[keyof Def] : never;

/** Extract the facet key union from a facet catalog. */
export type FacetKey<C extends Catalog<any>> = C extends Catalog<infer Def> ? keyof Def : never;

/** Filter facet keys by kind. */
export function facetKeysByKind<C extends Catalog<any>>(
  catalog: C,
  kind: FacetKind
): FacetKey<C>[] {
  return catalog.where((entry) => entry.kind === kind) as FacetKey<C>[];
}

/** Filter facet keys by gate type. */
export function facetKeysByGate<C extends Catalog<any>>(
  catalog: C,
  gateType: FacetGate['type']
): FacetKey<C>[] {
  return catalog.where((entry) => entry.gate.type === gateType) as FacetKey<C>[];
}

/** Get facets that are available under the given capability set. */
export function availableFacets<C extends Catalog<any>>(
  catalog: C,
  capabilities: ReadonlySet<string>
): FacetEntryOf<C>[] {
  return catalog.entries.filter((entry) => {
    if (entry.gate.type === 'capability') {
      return capabilities.has(entry.gate.capability);
    }
    return true;
  });
}

/** Create a lens facet descriptor. */
export function createLensFacet<D extends FacetData>(
  id: string,
  label: string,
  data: D & { modulation: unknown; color: string; defaultLayout: string; requires?: readonly string[] }
): FacetDescriptor<D> {
  const requires = data.requires ?? [];
  const firstCapability = requires[0];
  return {
    id,
    label,
    facets: data,
    kind: 'lens' as const,
    gate: requires.length > 0 && firstCapability
      ? { type: 'capability' as const, capability: firstCapability }
      : { type: 'none' as const },
    data,
  };
}

/** Create a layer facet descriptor. */
export function createLayerFacet<D extends FacetData>(
  id: string,
  label: string,
  data: D & { visible: (ctx: { isWorkspace: boolean }) => boolean; icon: string; description: string }
): FacetDescriptor<D> {
  return {
    id,
    label,
    facets: data,
    kind: 'layer' as const,
    gate: { type: 'none' as const },
    data,
  };
}

/** Create a mode facet descriptor. */
export function createModeFacet<D extends FacetData>(
  id: string,
  label: string,
  data: D & { capability: string; hint: string; structured: boolean }
): FacetDescriptor<D> {
  return {
    id,
    label,
    facets: data,
    kind: 'mode' as const,
    gate: { type: 'capability' as const, capability: data.capability },
    data,
  };
}

/** Create a filter facet descriptor. */
export function createFilterFacet<D extends FacetData>(
  id: string,
  label: string,
  data: D & { filterType: 'capability' | 'graph' | 'search'; options?: readonly string[] }
): FacetDescriptor<D> {
  return {
    id,
    label,
    facets: data,
    kind: 'filter' as const,
    gate: { type: 'none' as const },
    data,
  };
}