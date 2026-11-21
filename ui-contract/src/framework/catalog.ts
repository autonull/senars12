/**
 * Catalog — the single abstraction for every enumerable facet in the UI.
 *
 * Replaces:
 *   - `d()` helper + const object + `satisfies Record<...>`
 *   - manual `TYPE_IDS = Object.keys(CATALOG) as ...`
 *   - manual `typeDef = (id) => CATALOG[id]`
 *   - manual `typeIdsWhere = (facet) => TYPE_IDS.filter(...)`
 *
 * A catalog is defined once via `defineCatalog`, and all derived queries
 * (`get`, `ids`, `where`, `size`, `entries`, `values`) are generated
 * automatically with correct types.
 *
 * The `Key` type parameter derives from the catalog keys, so the union
 * is always the source of truth — no hand-written tuple to keep in sync.
 *
 * The entry shape is FLAT: `{ label: string, ...facets }` — this matches
 * the original `d()` helper pattern and allows direct property access
 * (e.g. `entry.hint`, `entry.category`, `entry.lens`).
 */

import type { Contribution } from './contribution.js';

/**
 * A catalog entry — a flat object with `label` and domain-specific facets.
 * Extend this with domain-specific facets.
 */
export interface CatalogEntry {
  /** Human-readable label for palette/toolbar. */
  readonly label: string;
  /** Domain-specific facets (merged at top level). */
  readonly [key: string]: unknown;
}

/**
 * The raw catalog definition — a record of flat entry descriptors keyed by id.
 * Each value must have `label` and arbitrary facets.
 */
export type CatalogDefinition<E extends CatalogEntry = CatalogEntry> = Readonly<
  Record<string, E>
>;

/**
 * The key type of a catalog — derives from the definition keys.
 */
export type CatalogKey<Def extends CatalogDefinition> = keyof Def;

/**
 * The entry type of a catalog — derives from the definition values.
 */
export type CatalogEntryOf<Def extends CatalogDefinition> = Def[CatalogKey<Def>];

/**
 * A compiled catalog with generated queries.
 */
export interface Catalog<Def extends CatalogDefinition> {
  /** The raw definition (frozen). */
  readonly definition: Def;
  /** Get an entry by key — returns the specific entry type for that key. */
  readonly get: <K extends CatalogKey<Def>>(key: K) => Def[K];
  /** All keys in catalog order. */
  readonly ids: readonly CatalogKey<Def>[];
  /** All entries in catalog order. */
  readonly entries: readonly Def[CatalogKey<Def>][];
  /** Filter keys by a predicate on the entry. */
  readonly where: (predicate: (entry: Def[CatalogKey<Def>]) => boolean) => CatalogKey<Def>[];
  /** Number of entries. */
  readonly size: number;
  /** Check if a key exists. */
  readonly has: (key: string) => boolean;
}

/**
 * Compile a catalog definition into a Catalog with generated queries.
 *
 * @param def — The catalog definition (const object with `satisfies Record<...>`)
 * @returns A Catalog with `get`, `ids`, `entries`, `where`, `size`, `has`
 *
 * @example
 * ```ts
 * const MY_CATALOG = defineCatalog({
 *   foo: { label: 'Foo', color: 'red' },
 *   bar: { label: 'Bar', color: 'blue' },
 * } as const);
 *
 * type MyKey = CatalogKey<typeof MY_CATALOG>; // 'foo' | 'bar'
 * MY_CATALOG.get('foo'); // { label: 'Foo', color: 'red' }
 * MY_CATALOG.ids; // ['foo', 'bar']
 * MY_CATALOG.where(e => e.color === 'red'); // ['foo']
 * ```
 */
export function defineCatalog<const Def extends CatalogDefinition>(def: Def): Catalog<Def> {
  const entries = Object.entries(def) as [CatalogKey<Def>, Def[CatalogKey<Def>]][];
  const ids = entries.map(([id]) => id);

  const catalog: Catalog<Def> = {
    definition: def,
    get: <K extends CatalogKey<Def>>(key: K) => def[key],
    ids: Object.freeze(ids),
    entries: Object.freeze(entries.map(([, entry]) => entry)),
    where: (predicate) => ids.filter((id) => predicate(def[id])),
    size: ids.length,
    has: (key) => key in def,
  };

  return catalog;
}

/**
 * Create a catalog from an array of contributions.
 * Useful when contributions are registered dynamically.
 */
export function catalogFromContributions(
  contributions: ReadonlyArray<Contribution>
): Catalog<CatalogDefinition<CatalogEntry>> {
  const def = Object.fromEntries(
    contributions.map((c) => [c.id, { label: c.label, ...c.facets }])
  ) as CatalogDefinition<CatalogEntry>;

  return defineCatalog(def);
}

/**
 * Type helper: extract the key union from a catalog.
 */
export type KeyOf<C extends Catalog<any>> = C extends Catalog<infer Def> ? CatalogKey<Def> : never;

/**
 * Type helper: extract the entry type from a catalog.
 */
export type EntryOf<C extends Catalog<any>> = C extends Catalog<infer Def> ? Def[keyof Def] : never;

/**
 * Type helper: extract the facets type from a catalog entry (everything except `label`).
 */
export type FacetsOf<C extends Catalog<any>> = C extends Catalog<infer Def>
  ? Omit<Def[keyof Def], 'label'>
  : never;