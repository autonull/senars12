/**
 * Deck Catalogs — consolidated catalogs from ui-contract.
 *
 * This brings the catalog abstraction (shapes, view adapters, intents)
 * into the deck for unified inspection and debugging.
 */

import type { Catalog, CatalogDefinition, CatalogKey, CatalogEntryOf, KeyOf, EntryOf } from '@senars/ui-contract/framework';

/**
 * Generic catalog view for deck.
 */
export interface DeckCatalogView<Def extends CatalogDefinition> {
  /** The underlying catalog. */
  readonly catalog: Catalog<Def>;
  /** Catalog keys. */
  readonly keys: readonly CatalogKey<Def>[];
  /** Catalog entries. */
  readonly entries: readonly Def[CatalogKey<Def>][];
  /** Catalog size. */
  readonly size: number;
}

/**
 * Create a deck catalog view from any catalog.
 */
export function createDeckCatalogView<Def extends CatalogDefinition>(
  catalog: Catalog<Def>
): DeckCatalogView<Def> {
  return {
    catalog,
    keys: catalog.ids,
    entries: catalog.entries,
    size: catalog.ids.length,
  };
}

/**
 * Render a catalog as a deck panel.
 */
export function renderDeckCatalog<Def extends CatalogDefinition>(
  view: DeckCatalogView<Def>,
  title: string,
  formatEntry: (key: CatalogKey<Def>, entry: Def[CatalogKey<Def>]) => string
): string {
  const lines = [
    `╔══════════════════════════════════════════════════════════════╗`,
    `║ ${title.toUpperCase()} (${view.size} entries)${' '.repeat(49 - title.length - view.size.toString().length)}║`,
    `╠══════════════════════════════════════════════════════════════╣`,
  ];

  if (view.size === 0) {
    lines.push(`║ (empty)                                                   ║`);
  } else {
    for (let i = 0; i < view.keys.length; i++) {
      const key = view.keys[i]!;
      const entry = view.entries[i]!;
      const formatted = formatEntry(key, entry);
      // Truncate to fit
      const truncated = formatted.length > 56 ? formatted.slice(0, 53) + '...' : formatted;
      lines.push(`║ ${truncated.padEnd(56)} ║`);
    }
  }

  lines.push(`╚══════════════════════════════════════════════════════════════╝`);
  return lines.join('\n');
}

/**
 * Filter catalog entries by predicate.
 */
export function filterDeckCatalog<Def extends CatalogDefinition>(
  view: DeckCatalogView<Def>,
  predicate: (key: CatalogKey<Def>, entry: Def[CatalogKey<Def>]) => boolean
): DeckCatalogView<Def> {
  const filteredKeys: CatalogKey<Def>[] = [];
  const filteredEntries: Def[CatalogKey<Def>][] = [];

  for (let i = 0; i < view.keys.length; i++) {
    const key = view.keys[i]!;
    const entry = view.entries[i]!;
    if (predicate(key, entry)) {
      filteredKeys.push(key);
      filteredEntries.push(entry);
    }
  }

  // Create a filtered catalog (simplified)
  return {
    catalog: view.catalog,
    keys: filteredKeys as readonly CatalogKey<Def>[],
    entries: filteredEntries as readonly Def[CatalogKey<Def>][],
    size: filteredKeys.length,
  };
}

/**
 * Built-in catalog formatters for common catalog types.
 */
export const CatalogFormatters = {
  /** Format a shape catalog entry. */
  shape: (key: string, entry: { label?: string; title: string; icon?: string }): string =>
    `${(entry.icon ?? '·')} ${entry.title} (${key})`,

  /** Format a view adapter catalog entry. */
  viewAdapter: (key: string, entry: { budgets?: string[]; interactions?: string[] }): string =>
    `${key} │ budgets: ${entry.budgets?.join(', ') ?? '—'} │ interactions: ${entry.interactions?.join(', ') ?? '—'}`,

  /** Format an intent catalog entry. */
  intent: (key: string, entry: { label: string; handler?: string }): string =>
    `${entry.label} (${key}) ${entry.handler ? '→ ' + entry.handler : ''}`,

  /** Format a generic catalog entry with label. */
  labeled: (key: string, entry: { label?: string; title?: string }): string =>
    `${entry.label ?? entry.title ?? key} (${key})`,
} as const;

/**
 * Multi-catalog registry for deck — aggregates all catalogs.
 */
import { KeyedRegistry } from '../util/keyed-collection';
import { SenarsError } from '../errors/senars-error';

/** Catalog entry for the registry. */
interface DeckCatalogEntry {
  readonly name: string;
  readonly view: DeckCatalogView<any>;
}

/** Multi-catalog registry for deck — aggregates all catalogs. */
export class DeckCatalogRegistry {
  shapes?: DeckCatalogView<any>;
  viewAdapters?: DeckCatalogView<any>;
  intents?: DeckCatalogView<any>;
  readonly custom: KeyedRegistry<DeckCatalogEntry>;

  constructor() {
    this.custom = new KeyedRegistry<DeckCatalogEntry>({
      keyOf: (e) => e.name,
      onDuplicate: (name) => { throw new SenarsError(`Custom catalog '${name}' already registered`, 'VALIDATION_ERROR', { name }); },
    });
  }

  /** Register a catalog in the registry. */
  register(name: string, catalog: Catalog<any>): void {
    const view = createDeckCatalogView(catalog);
    if (name === 'shapes') {
      this.shapes = view;
    } else if (name === 'viewAdapters') {
      this.viewAdapters = view;
    } else if (name === 'intents') {
      this.intents = view;
    } else {
      this.custom.register({ name, view });
    }
  }

  /** Get a catalog view by name. */
  get(name: string): DeckCatalogView<any> | undefined {
    if (name === 'shapes') return this.shapes;
    if (name === 'viewAdapters') return this.viewAdapters;
    if (name === 'intents') return this.intents;
    return this.custom.get(name)?.view;
  }

  /** Get all catalog names. */
  getNames(): string[] {
    const names: string[] = [];
    if (this.shapes) names.push('shapes');
    if (this.viewAdapters) names.push('viewAdapters');
    if (this.intents) names.push('intents');
    names.push(...this.custom.keys());
    return names;
  }

  /** Get total entry count across all catalogs. */
  getTotalEntries(): number {
    let total = 0;
    if (this.shapes) total += this.shapes.size;
    if (this.viewAdapters) total += this.viewAdapters.size;
    if (this.intents) total += this.intents.size;
    for (const entry of this.custom.all()) {
      total += entry.view.size;
    }
    return total;
  }

  /** Clear all registrations. */
  clear(): void {
    this.custom.clear();
  }
}

/** Create a deck catalog registry instance. */
export function createDeckCatalogRegistry(): DeckCatalogRegistry {
  return new DeckCatalogRegistry();
}

/**
 * Render all catalogs in the registry.
 */
export function renderDeckCatalogRegistry(registry: DeckCatalogRegistry): string {
  const lines = [
    `╔══════════════════════════════════════════════════════════════╗`,
    `║ DECK CATALOG REGISTRY                                     ║`,
    `╠══════════════════════════════════════════════════════════════╣`,
  ];

  let totalEntries = 0;
  let catalogCount = 0;

  const catalogs = [
    { name: 'shapes', view: registry.shapes },
    { name: 'viewAdapters', view: registry.viewAdapters },
    { name: 'intents', view: registry.intents },
    ...registry.custom.all().map((e) => ({ name: e.name, view: e.view })),
  ];

  for (const { name, view } of catalogs) {
    if (view) {
      lines.push(`║ ${name.padEnd(15)} │ ${String(view.size).padStart(3)} entries ║`);
      totalEntries += view.size;
      catalogCount++;
    }
  }

  lines.push(`╠══════════════════════════════════════════════════════════════╣`);
  lines.push(`║ Total: ${String(totalEntries).padStart(3)} entries across ${String(catalogCount).padStart(2)} catalogs          ║`);
  lines.push(`╚═══════════════════════════════════════════════════════════════╝`);

  return lines.join('\n');
}