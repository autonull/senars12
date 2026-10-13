/**
 * Filter facets — capability filter, graph filter, search filter.
 * These are simple predicate-based facets (P4 unification).
 */

import { defineFacetCatalog, createFilterFacet } from '../framework/facet.js';

/** Internal facet catalog for filters — uses the unified Facet system (P4). */
const FILTER_FACET_DEFS = defineFacetCatalog({
  capability: createFilterFacet('capability', 'Capability', {
    filterType: 'capability',
    options: ['all', 'truth-revision', 'goal-management', 'language', 'reasoning', 'tools'] as const,
  }),
  graph: createFilterFacet('graph', 'Graph Filter', {
    filterType: 'graph',
  }),
  search: createFilterFacet('search', 'Search', {
    filterType: 'search',
  }),
} as const);

/** The facet catalog for filters (P4 unification). */
export const FILTER_FACETS = FILTER_FACET_DEFS;

/** The semantic id of a filter facet — the catalog keys are its source (P4). */
export type FilterFacetId = keyof typeof FILTER_FACET_DEFS.definition;

/** The filter facet entry type. */
export type FilterFacetEntry = typeof FILTER_FACET_DEFS.definition[FilterFacetId];

/** Default capability filter value. */
export const DEFAULT_CAPABILITY_FILTER: FilterFacetId = 'capability';

/** Get the capability filter options. */
export function getCapabilityFilterOptions(): readonly string[] {
  const facet = FILTER_FACET_DEFS.get('capability');
  return facet.data.options ?? [];
}