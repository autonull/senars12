/**
 * Command matching (§3.5, Phase 0.5). A tiny, deterministic ranker: exact/prefix
 * beats word-prefix beats substring beats an in-order subsequence, then title
 * order breaks ties. Pure, so the palette's behaviour is unit-tested without a
 * DOM.
 */

import type { Command } from './commands.js';

const haystack = (command: Command): string =>
  `${command.title} ${command.group} ${command.keywords ?? ''}`.toLowerCase();

const isSubsequence = (text: string, query: string): boolean => {
  let index = 0;
  for (const character of text) {
    if (character === query[index]) index += 1;
    if (index === query.length) return true;
  }
  return query.length === 0;
};

const wordPrefix = (text: string, query: string): boolean =>
  text.split(/[\s.]+/).some((word) => word.startsWith(query));

const score = (command: Command, query: string): number => {
  const title = command.title.toLowerCase();
  if (title.startsWith(query)) return 100 - title.length;
  const text = haystack(command);
  if (wordPrefix(text, query)) return 60;
  if (text.includes(query)) return 30;
  return isSubsequence(text, query) ? 10 : 0;
};

/** Commands matching `query`, best first; the untrimmed-empty query keeps order. */
export function matchCommands(commands: readonly Command[], query: string): Command[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '') return [...commands];
  return commands
    .map((command) => ({ command, rank: score(command, trimmed) }))
    .filter((entry) => entry.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.command.title.localeCompare(b.command.title))
    .map((entry) => entry.command);
}
