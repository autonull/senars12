import { collectUpTo } from '@senars/util/collections';
export const termMatches = (candidate, lowerPattern) => candidate.term.toString().toLowerCase().includes(lowerPattern);
/** Filter `items` whose term contains `pattern`, stopping at `limit` matches. */
export const filterByTerm = (items, pattern, limit = Number.POSITIVE_INFINITY) => {
    const lower = pattern.toLowerCase();
    return collectUpTo(items, limit, (item) => (termMatches(item, lower) ? item : undefined));
};
