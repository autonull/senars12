/**
 * The config catalog is the single source of config field metadata. It must
 * agree with both the client UI config schema (paths, types) and the server
 * config schema (the shared nars.* fields), and every field must reach the
 * settings UI — a new field needs no edit outside the catalog.
 */
import { describe, expect, it } from 'vitest';
import { configFieldFor, getConfigFields } from '../../src/client/core/config-catalog.js';
import { DEFAULT_UI_CONFIG } from '../../src/client/core/config-schema.js';
import { buildConfigSchema as buildServerConfigSchema } from '../../src/server/config-schema.js';
import { fieldsForSection } from '../../src/client/components/config-hud.js';

const valueAt = (path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], DEFAULT_UI_CONFIG);

describe('config catalog agreement', () => {
  it('every catalog field resolves to a default in the UI config schema', () => {
    for (const field of getConfigFields()) {
      expect(valueAt(field.id), field.id).not.toBeUndefined();
    }
  });

  it('every primitive catalog field matches the type of its UI config default', () => {
    const expected: Record<string, string> = { string: 'string', number: 'number', boolean: 'boolean' };
    for (const field of getConfigFields()) {
      const kind = expected[field.type];
      const value = valueAt(field.id);
      if (!kind || value === null) continue;
      expect(typeof value, field.id).toBe(kind);
    }
  });

  it('agrees with the server config schema on the nars fields', () => {
    const server = buildServerConfigSchema();
    expect(Object.keys(server).length).toBeGreaterThan(0);
    for (const [key, field] of Object.entries(server)) {
      const catalog = configFieldFor(key);
      expect(catalog, key).toBeDefined();
      expect(catalog?.label).toBe(field.label);
    }
  });

  it('assigns every catalog field to exactly one settings section', () => {
    const sections = ['appearance', 'defaults', 'panels', 'provider', 'budgets', 'nars', 'advanced'] as const;
    const shown = new Set(sections.flatMap((section) => fieldsForSection(section)));
    for (const field of getConfigFields()) {
      expect(shown.has(field.id), field.id).toBe(true);
    }
  });
});
