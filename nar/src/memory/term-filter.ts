import { collectUpTo } from '@senars/util';

/** Shared case-insensitive term-substring matching (concepts, beliefs, goals). */
export interface TermBearing {
  readonly term: { toString(): string };
}

export const termMatches = (candidate: TermBearing, lowerPattern: string): boolean =>
  candidate.term.toString().toLowerCase().includes(lowerPattern);

/** Filter `items` whose term contains `pattern`, stopping at `limit` matches. */
export const filterByTerm = <T extends TermBearing>(
  items: Iterable<T>,
  pattern: string,
  limit = Number.POSITIVE_INFINITY
): T[] => {
  const lower = pattern.toLowerCase();
  return collectUpTo(items, limit, (item) => (termMatches(item, lower) ? item : undefined));
};
