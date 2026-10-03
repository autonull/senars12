/**
 * The Narsese ingress router.
 *
 * One function answers "is this Narsese, and of what kind", so the agent's chat
 * path, the engine's `reason()` and the NL classifier cannot disagree on the same
 * utterance — two answers to one question is how `{a --> b}.` reached a parser that
 * rejects `{` from one site and the LM path from another.
 *
 * The predicate is `isNarsese` from `@senars/util` — a shape heuristic, not the
 * parser — so the router asks the parser before it answers: text the predicate
 * admits but the parser rejects (`{a --> b}.`, `a ==> b!`) belongs to the LM
 * path, not to a parser that will throw on it (TODO33 §5.P3.9). Toleration is
 * the same four punctuations `KernelPerceptionGate.parseTaskTolerant` tries, so
 * ingress and the router agree on what parses.
 */

import { isNarsese } from '@senars/util';
import { termParser } from '../terms';

export type NarseseIntent =
  | { readonly kind: 'question'; readonly text: string }
  | { readonly kind: 'goal'; readonly text: string }
  | { readonly kind: 'belief'; readonly text: string };

/** `"statement. :|:"` / `"statement. :!:"` carry a tense marker the term parser rejects. */
const TENSE_MARKER = /\.\s*:(?:!|\|):\s*$/;

/** The same four punctuations the perception gate tries, in the same order. */
const PUNCTUATIONS = ['', '.', '?', '!'] as const;

/** Parse `text` under any of the four punctuations, or `null` if none parses. */
export const parseNarseseTask = (text: string): ReturnType<typeof termParser.parseTask> => {
  for (const punctuation of PUNCTUATIONS) {
    const parsed = termParser.parseTask(`${text}${punctuation}`);
    if (parsed) return parsed;
  }
  return null;
};

/** The intent of `input`, or `null` when it is prose — or unparseable Narsese — and belongs to the LM path. */
export const dispatchNarseseIntent = (input: string): NarseseIntent | null => {
  if (!isNarsese(input)) return null;
  const text = input.trim().replace(TENSE_MARKER, '.').trim();
  if (!parseNarseseTask(text)) return null;
  if (text.endsWith('?') || text.endsWith('？')) return { kind: 'question', text };
  if (text.endsWith('!')) return { kind: 'goal', text };
  return { kind: 'belief', text };
};