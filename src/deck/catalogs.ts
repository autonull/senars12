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
export interface DeckCatalogRegistry {
  /** Shape catalog. */
  shapes?: DeckCatalogView<any>;
  /** View adapter catalog. */
  viewAdapters?: DeckCatalogView<any>;
  /** Intent catalog. */
  intents?: DeckCatalogView<any>;
  /** Custom catalogs by name. */
  custom: Record<string, DeckCatalogView<any>>;
}

/**
 * Create a deck catalog registry.
 */
export function createDeckCatalogRegistry(): DeckCatalogRegistry {
  return {
    custom: {},
  };
}

/**
 * Register a catalog in the registry.
 */
export function registerDeckCatalog(
  registry: DeckCatalogRegistry,
  name: keyof DeckCatalogRegistry | string,
  catalog: Catalog<any>
): void {
  const view = createDeckCatalogView(catalog);
  if (name === 'shapes' || name === 'viewAdapters' || name === 'intents') {
    (registry as any)[name] = view;
  } else {
    registry.custom[name] = view;
  }
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

  for (const [name, view] of Object.entries(registry)) {
    if (view && 'size' in view) {
      const v = view as DeckCatalogView<any>;
      lines.push(`║ ${name.padEnd(15)} │ ${String(v.size).padStart(3)} entries ║`);
      totalEntries += v.size;
    }
  }

  lines.push(`╠══════════════════════════════════════════════════════════════╣`);
  lines.push(`║ Total: ${String(totalEntries).padStart(3)} entries across ${String(Object.keys(registry).length).padStart(2)} catalogs          ║`);
  lines.push(`╚══════════════════════════════════════════════════════════════╝`);

  return lines.join('\n');
}