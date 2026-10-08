import { describe, expect, it } from 'vitest';
import { matchCommands } from '../../src/client/core/command-match.js';
import type { Command } from '../../src/client/core/commands.js';

const command = (id: string, title: string, group = 'View', keywords = ''): Command => ({
  id,
  title,
  group,
  keywords,
  run: () => {},
});

const commands = [
  command('a', 'Switch to Notebook', 'View', 'renderer notebook'),
  command('b', 'Toggle minimap', 'View', 'graph overview'),
  command('c', 'Table of contents', 'Open', 'overlay toc'),
];

describe('matchCommands', () => {
  it('keeps order for an empty query', () => {
    expect(matchCommands(commands, '   ')).toEqual(commands);
  });

  it('ranks a title prefix first', () => {
    expect(matchCommands(commands, 'switch')[0]?.id).toBe('a');
  });

  it('matches on keywords', () => {
    expect(matchCommands(commands, 'minimap').map((entry) => entry.id)).toEqual(['b']);
  });

  it('matches an in-order subsequence', () => {
    expect(matchCommands(commands, 'tgl').map((entry) => entry.id)).toContain('b');
  });

  it('drops non-matches', () => {
    expect(matchCommands(commands, 'zzzz')).toEqual([]);
  });
});
