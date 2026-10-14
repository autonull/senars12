/**
 * The last catalogs expose the same generated API as every other catalog
 * (`get`/`ids`/`entries`/`where`/`size`/`has`), so a new capability or
 * reasoning layout is one entry with no hand-written tuple.
 */
import { describe, expect, it } from 'vitest';
import { CAPABILITY_DEFS } from '../../src/client/core/capabilities.js';
import { REASONING_LAYOUT_DEFS } from '../../src/client/core/reasoning-layout.js';
import type { Catalog } from '../../src/client/framework/catalog.js';

const CATALOGS: ReadonlyArray<[string, Catalog<any>]> = [
  ['capabilities', CAPABILITY_DEFS],
  ['reasoning-layouts', REASONING_LAYOUT_DEFS],
];

describe('domain catalog API', () => {
  for (const [name, catalog] of CATALOGS) {
    describe(name, () => {
      it('exposes ids in definition order with a matching size', () => {
        expect(catalog.size).toBe(catalog.ids.length);
        expect(catalog.ids.length).toBeGreaterThan(0);
        expect(catalog.entries).toHaveLength(catalog.size);
      });

      it('resolves every id via get/has and filters via where', () => {
        for (const id of catalog.ids) {
          expect(catalog.has(id)).toBe(true);
          expect(catalog.get(id).label).toBeTruthy();
        }
        const first = catalog.get(catalog.ids[0]);
        expect(catalog.where((entry) => entry.label === first.label)).toContain(catalog.ids[0]);
        expect(catalog.where(() => false)).toEqual([]);
      });
    });
  }
});
