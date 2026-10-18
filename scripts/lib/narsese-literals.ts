/**
 * The `narsese:literals` rule, as a callable verdict (TODO30 §2.3 T3).
 *
 * A Narsese string literal in this tree has one job: it must read back as the
 * term it was written to be. This module is that check, separated from the file
 * walk so a test can call it and prove it can fail — §10.1's rule, and the reason
 * `scripts/terms-canonical.ts` keeps its verdicts in `scripts/lib/` too. A gate
 * whose logic is inline in the script that runs it is a gate nobody can check.
 */

import { serializeTerm } from '../../nar/src/terms/impls/serialize.js';
import { PUNCTUATION_BY_TASK_TYPE, termParser } from '../../nar/src/terms/index.js';
import { escapeRegExp } from '../../util/src/utils/text.js';

/** One literal's verdict, and why it went the way it did. */
export interface LiteralRoundTrip {
  /** The canonical text the system would write back. */
  readonly canonical: string;
  /** `true` when the written form differs from the canonical form by more than spacing. */
  readonly canonicalUpToSpacing: boolean;
  /** `true` when the canonical form does not re-read to itself. */
  readonly stable: boolean;
  /** The failure to report, or `undefined` when the literal round-trips. */
  readonly failure?: string;
}

/**
 * Whitespace runs that sit against a non-word character on either side, dropped.
 * A run between two word characters is part of an atom's name and is kept, so
 * `[long cat]` never tightens into `[longcat]`.
 *
 * Whitespace is insignificant *here* and only here: the gate compared raw strings
 * and so reported the author's spaces as a defect, which is not a property of
 * Narsese and had gone red on a worked example written the way the README writes
 * them.
 */
export const tighten = (text: string): string =>
  text.replace(/\s+/g, (run, offset: number) => {
    const before = offset === 0 ? '' : text[offset - 1]!;
    const after = text[offset + run.length] ?? '';
    return /\w/.test(before) && /\w/.test(after) ? run : '';
  });

/**
 * A literal's canonical text, assembled from what the parser returns rather than
 * copied from the source.
 *
 * A literal is either a bare term or a *task*, and which one decides which reader
 * can round-trip it: the sentence mark that makes `(robin --> bird).` a judgment
 * is not part of a `Term` at all, so handing a task literal to the term parser and
 * the term serialiser guarantees the mark is lost. `parseTask` keeps it.
 */
export const canonical = (literal: string): string => {
  const task = termParser.parseTask(literal);
  return task
    ? `${serializeTerm(task.term)}${task.punctuation}`
    : serializeTerm(termParser.parse(literal));
};

/**
 * One literal, split at its sentence marks — the tasks a task reader would take.
 * The marks are the grammar's own (`PUNCTUATION_BY_TASK_TYPE`), read as a
 * character class so a mark added there is a mark here.
 */
const SENTENCE_MARKS = Object.values(PUNCTUATION_BY_TASK_TYPE).map(escapeRegExp).join('');
const SENTENCE_END = new RegExp(`(?<=[${SENTENCE_MARKS}])\\s+`);
const splitTasks = (literal: string): string[] =>
  literal
    .split(SENTENCE_END)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

/** Whether a literal reads back as the term it was written to be.
 *
 * One literal may hold several sentences: the one-shot CLI accepts an argument
 * that does (CORE.19 C7.1) and `USAGE.md` shows one, so the round trip that
 * actually happens there is per task. A multi-sentence literal is checked as its
 * tasks — the same reason the single-task path reads `parseTask`, not `parse`.
 */
export const roundTrip = (literal: string): LiteralRoundTrip => {
  const tasks = splitTasks(literal);
  if (tasks.length <= 1) return roundTripTask(literal);
  const verdicts = tasks.map(roundTripTask);
  const failure = verdicts.find((verdict) => verdict.failure)?.failure;
  return {
    canonical: verdicts.map((verdict) => verdict.canonical).join(' '),
    canonicalUpToSpacing: verdicts.every((verdict) => verdict.canonicalUpToSpacing),
    stable: verdicts.every((verdict) => verdict.stable),
    ...(failure === undefined ? {} : { failure }),
  };
};

const roundTripTask = (literal: string): LiteralRoundTrip => {
  let rendered: string;
  try {
    rendered = canonical(literal);
  } catch (error) {
    return {
      canonical: '',
      canonicalUpToSpacing: false,
      stable: false,
      failure: `parse failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const same = tighten(literal) === tighten(rendered);
  // The fixed point is a separate property and is not implied by the first: a
  // serialiser that changes its own output on a second pass produces a first
  // round trip that looks fine and a second one that does not.
  const stable = (() => {
    try {
      return canonical(rendered) === rendered;
    } catch {
      return false;
    }
  })();

  const failure = !same
    ? `'${literal}' re-serialises as '${rendered}'`
    : !stable
      ? `'${rendered}' does not survive serialising twice`
      : undefined;

  return {
    canonical: rendered,
    canonicalUpToSpacing: same,
    stable,
    ...(failure === undefined ? {} : { failure }),
  };
};
