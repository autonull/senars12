import { describe, expect, it } from 'vitest';
import {
  COMPOSER_MODE_DEFS,
  COMPOSER_MODE_IDS,
  composerModeDef,
  composerModeIdsWhere,
  availableComposerModes,
  DEFAULT_COMPOSER_MODE,
} from '../../src/client/core/composer-modes.js';
import type { Capability } from '../../src/client/core/capabilities.js';

const sorted = (ids: readonly string[]): string[] => [...ids].sort();

describe('composer mode definitions (D7)', () => {
  it('derives ComposerMode from the catalog keys (one source)', () => {
    expect(sorted(COMPOSER_MODE_IDS)).toEqual(
      sorted(['ask', 'reply', 'question', 'command', 'explain', 'demonstrate', 'transform', 'believe', 'goal', 'tool'])
    );
    expect(COMPOSER_MODE_IDS).toEqual(Object.keys(COMPOSER_MODE_DEFS.definition));
  });

  it('reads a definition by id with a non-empty, distinct label', () => {
    for (const id of COMPOSER_MODE_IDS) expect(composerModeDef(id).label.length).toBeGreaterThan(0);
    const labels = COMPOSER_MODE_IDS.map((id) => composerModeDef(id).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('selects exactly the expected modes for each facet', () => {
    expect(sorted(composerModeIdsWhere((def) => def.capability === 'language'))).toEqual(
      sorted(['ask', 'reply', 'question', 'command', 'explain', 'demonstrate', 'transform'])
    );
    expect(sorted(composerModeIdsWhere((def) => def.capability === 'reasoning'))).toEqual(
      sorted(['believe', 'goal'])
    );
    expect(sorted(composerModeIdsWhere((def) => def.capability === 'tools'))).toEqual(['tool']);
    expect(sorted(composerModeIdsWhere((def) => def.structured))).toEqual(sorted(['believe', 'goal', 'tool']));
    expect(sorted(composerModeIdsWhere((def) => !def.structured))).toEqual(
      sorted(['ask', 'reply', 'question', 'command', 'explain', 'demonstrate', 'transform'])
    );
  });

  it('availableComposerModes filters by capability', () => {
    const languageOnly = new Set<Capability>(['language']);
    const available = availableComposerModes(languageOnly);
    expect(available.map((m) => m.id).sort()).toEqual(
      ['ask', 'reply', 'question', 'command', 'explain', 'demonstrate', 'transform'].sort()
    );
  });

  it('DEFAULT_COMPOSER_MODE is in the catalog', () => {
    expect(COMPOSER_MODE_IDS).toContain(DEFAULT_COMPOSER_MODE);
  });

  it('catalog order matches declaration order', () => {
    expect(COMPOSER_MODE_IDS).toEqual([
      'ask', 'reply', 'question', 'command', 'explain', 'demonstrate', 'transform', 'believe', 'goal', 'tool',
    ]);
  });
});