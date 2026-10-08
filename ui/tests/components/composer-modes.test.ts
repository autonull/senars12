import { describe, expect, it } from 'vitest';
import type { Capability } from '../../src/client/core/capabilities.js';
import {
  availableComposerModes,
  COMPOSER_MODE_IDS,
  composerModes,
  decomposeForMode,
} from '../../src/client/core/composer-modes.js';

const caps = (...ids: Capability[]): Set<Capability> => new Set(ids);

describe('composer mode catalog', () => {
  it('names every mode exactly once', () => {
    expect(composerModes().map((mode) => mode.id)).toEqual([...COMPOSER_MODE_IDS]);
  });

  it('offers language modes under the LM-only composition', () => {
    const ids = availableComposerModes(caps('language')).map((mode) => mode.id);
    expect(ids).toContain('ask');
    expect(ids).toContain('command');
    expect(ids).not.toContain('believe');
    expect(ids).not.toContain('goal');
    expect(ids).not.toContain('tool');
  });

  it('admits structured modes only when their capability is on', () => {
    const ids = availableComposerModes(caps('language', 'reasoning', 'tools')).map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(['believe', 'goal', 'tool']));
  });
});

describe('mode-aware decomposition', () => {
  it('imposes the question kind in question mode', () => {
    expect(decomposeForMode('Robins are birds.', 'question')).toEqual([
      { kind: 'question', text: 'Robins are birds.' },
    ]);
  });

  it('collapses the whole input into one command in command mode', () => {
    expect(decomposeForMode('/config reasoning true', 'command')).toEqual([
      { kind: 'command', text: '/config reasoning true' },
    ]);
    expect(decomposeForMode('reasoning on', 'command')).toEqual([
      { kind: 'command', text: 'reasoning on' },
    ]);
    expect(decomposeForMode('   ', 'command')).toEqual([]);
  });

  it('uses the lexical split for language modes', () => {
    expect(decomposeForMode('A. What is B?', 'ask')).toEqual([
      { kind: 'claim', text: 'A.' },
      { kind: 'question', text: 'What is B?' },
    ]);
  });
});
