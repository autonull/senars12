/**
 * Framework — the shared substrate every app composes from.
 *
 * This re-exports the contribution + catalog primitives. Individual
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

export {
  createContribution,
  registerContribution,
  unregisterContribution,
} from './contribution.js';

export {
  defineCatalog,
  catalogFromContributions,
} from './catalog.js';