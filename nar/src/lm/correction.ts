/**
 * Bidirectional correction: when a contradiction is traceable to a model
 * translation, reparse the source under the Narsese grammar.
 *
 * Lives in the layer rather than in `cognitive/impls/analyzers` because it is a
 * provider call with a layer-owned grammar, and because it has no production
 * caller: the only one is `scripts/fundamentals-bench.ts`. The cycle path naming
 * it was the last value import of `lm/` from core (TODO29.a §5.2), and it was
 * carrying the edge for a bench script alone.
 */

import type { Term } from '../terms/index.js';
import { fromNarsese } from '../terms/index.js';
import { loadGrammar } from './grammars/index.js';

/** The narrowest seam: a call that may return nothing. */
type TextProposer = { tryGenerateText(prompt: string, opts?: unknown): Promise<string | null> };

/** Returns null on model failure (escalation exhausted) — caller keeps the symbolic side. */
export const attemptLMCorrection = async (
  lm: Pick<TextProposer, 'tryGenerateText'> | null,
  sourceText: string,
  wrongNarsese: string,
  contradictingNarsese: string
): Promise<Term | null> => {
  if (!lm) return null;
  const prompt =
    `You parsed "${sourceText}" as: ${wrongNarsese}.\n` +
    `This contradicts: ${contradictingNarsese}.\n` +
    `Reparse "${sourceText}" to resolve the contradiction. Output only Narsese.`;
  const response = await lm.tryGenerateText(prompt, {
    task: 'structured',
    grammar: loadGrammar('narsese-term'),
    maxOutputTokens: 128,
  });
  if (!response) return null;
  return fromNarsese(response.trim());
};