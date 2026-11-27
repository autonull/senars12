/**
 * Generate a GBNF grammar enumerating the legal-action set. Generated text is
 * cached per action-set signature — deterministic games repeat action sets
 * heavily, so this stays off the hot path after the first tick.
 */
export declare function actionGrammar(legalActions: readonly string[]): string;
//# sourceMappingURL=action-grammar.d.ts.map