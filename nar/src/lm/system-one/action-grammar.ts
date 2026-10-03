import { LruCache } from '@senars/util';

const escapeGbnf = (literal: string): string =>
  `"${literal.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const GRAMMAR_CACHE_MAX = 1024;
const grammarCache = new LruCache<string, string>(GRAMMAR_CACHE_MAX);

/**
 * Generate a GBNF grammar enumerating the legal-action set. Generated text is
 * cached per action-set signature — deterministic games repeat action sets
 * heavily, so this stays off the hot path after the first tick.
 */
export function actionGrammar(legalActions: readonly string[]): string {
  const signature = legalActions.join('\u0000');
  let grammar = grammarCache.get(signature);
  if (!grammar) {
    grammar = `root ::= ${legalActions.map(escapeGbnf).join(' | ')}`;
    grammarCache.set(signature, grammar);
  }
  return grammar;
}
