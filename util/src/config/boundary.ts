/**
 * The values an untrusted boundary admits, named once.
 *
 * Every schema in this system is a boundary: a gate IO, a persisted record, a config
 * read off disk, a tool argument from a model. Each of those had spelled its own
 * fragments — `z.string().min(1)` twenty-five times, `z.string().uuid()` eighteen,
 * `z.number().int().nonnegative()` twenty-nine, `z.number().int().positive()`
 * thirty-six — and every spelling was correct, which is the problem. A rule id that
 * accepts the empty string on one edge and refuses it on the next is not a bug anyone
 * finds locally; it is a boundary whose strictness is a property of which file happened
 * to declare the field. And a fragment spelled inline cannot be widened once, because
 * there is no once.
 *
 * So the fragments are the vocabulary and the schemas compose them. A new bound is an
 * entry here and a name at every site that shares it, and `pnpm schema:grammar` fails on
 * the inline spelling.
 *
 * `unitInterval` and `signedUnitInterval` were here first, under the name `scalars` —
 * which stopped being true the moment a string and an identifier joined the intervals.
 */
import { z } from 'zod';

/** `0..1` — a probability, a rate, a priority, a threshold that cannot be negative. */
export const unitInterval = z.number().min(0).max(1);

/**
 * `-1..1` — a reward or a signed score.
 *
 * Not {@link unitInterval} with a wider max: a negative value here is information (a loss,
 * an opposition) and a schema that floored it at zero would report every loss as neutrality.
 */
export const signedUnitInterval = z.number().min(-1).max(1);

/**
 * A string with content — a rule id, a rule name, an artifact version, a term, a lens
 * label. The most-repeated fragment at a boundary, because an empty string is almost
 * always a caller that forgot to pass the field rather than a value anybody means.
 *
 * Not `z.string().trim().min(1)`: whether whitespace counts as content is a question
 * about the field, and a schema that silently trimmed would report a stored value that
 * no longer matches the input that produced it.
 */
export const nonEmpty = z.string().min(1);

/**
 * A minted identifier — a task, a derivation, a proposal, a correlation.
 *
 * Deliberately UUID-shaped rather than "some non-empty string": `makeId` mints UUIDs and
 * a seeded run mints UUID-shaped counters (`00000000-0000-4000-8000-…`), so a replay
 * trace reads the same as the live one it replaces.
 *
 * The event log's own append-order key is the one id that is *not* one of these — it is a
 * ULID because both logs range-scan on it, and `sortableIdSource` owns that domain.
 */
export const uuid = z.uuid();

/** A count that cannot be negative: lines removed, cycles elapsed, memory ops spent. */
export const nonNegativeInt = z.number().int().nonnegative();

/** A count that cannot be zero: a cycle limit, a port, a candidate budget. */
export const positiveInt = z.number().int().positive();

/**
 * Wall-clock milliseconds. The same integer domain as {@link positiveInt} and named
 * apart from it because the two mean different things: a timestamp is a position on a
 * clock that another record is compared against, so its failure mode is a bad clock
 * rather than a bad count.
 */
export const timestamp = positiveInt.describe('epoch milliseconds');

/**
 * A bounded count — how many steps to run, how many results to return, how many heads
 * to consult. Integer-only because every caller of this fragment turns it into a loop
 * bound or a slice length.
 */
export const intBetween = (min: number, max: number) => z.number().int().min(min).max(max);

/**
 * A count with a floor and no ceiling — a depth, a sample size, an embedding's width.
 * Distinct from {@link positiveInt} because a floor above zero that a caller must state
 * is a number they chose, and the schema that reports it should name it.
 */
export const intAtLeast = (min: number) => z.number().int().min(min);
