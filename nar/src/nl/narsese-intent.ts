/**
 * The Narsese ingress router.
 *
 * One function answers "is this Narsese, and of what kind", so the agent's chat
 * path, the engine's `reason()` and the NL classifier cannot disagree on the same
 * utterance — two answers to one question is how `{a --> b}.` reached a parser that
 * rejects `{` from one site and the LM path from another.
 *
 * The predicate is `isNarsese` from `@senars/util`, so the router and the parser
 * agree on the alphabet by construction.
 */

import { isNarsese } from '@senars/util';

export type NarseseIntent =
  | { readonly kind: 'question'; readonly text: string }
  | { readonly kind: 'goal'; readonly text: string }
  | { readonly kind: 'belief'; readonly text: string };

/** `"statement. :|:"` / `"statement. :!:"` carry a tense marker the term parser rejects. */
const TENSE_MARKER = /\.\s*:(?:!|\|):\s*$/;

/** The intent of `input`, or `null` when it is prose and belongs to the LM path. */
export const dispatchNarseseIntent = (input: string): NarseseIntent | null => {
  if (!isNarsese(input)) return null;
  const text = input.trim().replace(TENSE_MARKER, '.').trim();
  if (text.endsWith('?') || text.endsWith('？')) return { kind: 'question', text };
  if (text.endsWith('!')) return { kind: 'goal', text };
  return { kind: 'belief', text };
};