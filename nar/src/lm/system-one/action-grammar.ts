const escapeGbnf = (literal: string): string =>
  `"${literal.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const grammarCache = new Map<string, string>();

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
    if (grammarCache.size > 1024) grammarCache.clear();
    grammarCache.set(signature, grammar);
  }
  return grammar;
}
