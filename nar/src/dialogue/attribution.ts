/**
 * DQ2 heuristic reaction attribution (TODO24). Opt-in via
 * `dialogue.attribution: 'cues'`; the default stays 'explicit' because
 * mis-attribution poisons the flywheel (plan §9). The heuristic is
 * deliberately conservative: cue-word matching over the user's *next*
 * utterance, bound to the immediately preceding turn only.
 */
import type { ReactionKind } from './types.js';

/** Priority order: high-value negatives first, weak positives last. */
const CUES: readonly (readonly [ReactionKind, RegExp])[] = [
  ['reject', /(?:\b(?:that|this|it)['’]?(?:s|\s+is)\s+(?:completely\s+)?(?:wrong|incorrect|useless|nonsense|garbage)\b)|(?:\bno,?\s+(?:that|this)\s+is\s+not\s+(?:right|correct)\b)|(?:\bthat['’]?s\s+not\s+right\b)/i],
  ['correct', /\b(?:actually|i meant|not quite|should be|rather than|instead of|that['’]?s not|is not right|no,)\b/i],
  ['redirect', /\b(?:anyway|moving on|never mind|new (?:question|topic)|let['’]?s talk about|forget that)\b/i],
  ['clarify', /\b(?:what do you mean|what did you mean|can you (?:clarify|explain)|explain that)\b/i],
  ['accept', /\b(?:thanks|thank you|exactly|perfect|that['’]?s right|good answer|spot on|nice work)\b/i],
];

/**
 * Infer the reaction the utterance implies toward the previous turn, or
 * undefined when no cue fires (the overwhelmingly common case — a normal
 * continuation must never be mistaken for a reaction).
 */
export const inferReactionFromUtterance = (utterance: string): ReactionKind | undefined => {
  const text = utterance.trim();
  if (!text || text.length > 200) return undefined;
  for (const [kind, cue] of CUES) {
    if (cue.test(text)) return kind;
  }
  return undefined;
};
