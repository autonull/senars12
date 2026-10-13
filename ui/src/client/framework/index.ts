/**
 * Framework — the shared substrate every app composes from.
 *
 * This re-exports the contribution + catalog + surface + app primitives. Individual
 * catalogs live in their domain modules (renderers, panels, blocks,
 * layers, lenses, events, fields, links, composer modes, embedded views).
 */

export type {
  Contribution,
} from './contribution.js';

export type {
  Catalog,
  CatalogDefinition,
  CatalogEntry,
  CatalogKey,
  CatalogEntryOf,
  KeyOf,
  EntryOf,
  FacetsOf,
} from './catalog.js';

export type {
  SurfaceDescriptor,
  Placement,
  Presentation,
  SurfaceBinding,
  SurfaceSource,
  SurfaceA11y,
} from './surface.js';

export type {
  FacetDescriptor,
  FacetKind,
  FacetGate,
  FacetData,
  FacetKey,
  FacetEntryOf,
} from './facet.js';

export type {
  AppDescriptor,
  AppLifecycle,
  AppContext,
  ConnectionConfig,
} from './app.js';

export {
  createContribution,
  registerContribution,
  unregisterContribution,
} from './contribution.js';

export {
  defineCatalog,
  catalogFromContributions,
} from './catalog.js';

export {
  surfaceRegistry,
  registerSurface,
  surfaceFor,
  getSurfaces,
  surfacesWhere,
  surfaceIdsWhere,
  surfacesByPlacement,
  surfaceIdsByPlacement,
  surfaceTag,
  defaultPresentation,
  resolvedPresentation,
} from './surface.js';

export {
  defineFacetCatalog,
  createLensFacet,
  createLayerFacet,
  createModeFacet,
  createFilterFacet,
  facetKeysByKind,
  facetKeysByGate,
  availableFacets,
  isLensFacet,
  isLayerFacet,
  isModeFacet,
  isFilterFacet,
} from './facet.js';

export {
  defineApp,
  registerApp,
  appFor,
  getApps,
  appIds,
  appSurfaces,
  resolveConnectionConfig,
  APP_SHELL_TAG,
} from './app.js';