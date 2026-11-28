import type { Term } from '../terms';
/**
 * Canonicalize common LLM Narsese deviations so the parser and firewall accept
 * semantically-correct output from any model:
 * - multi-word phrases inside parens → snake_case atoms
 * - top-level "A --> B" without enclosing parens → wrapped
 * Idempotent: canonical Narsese passes through unchanged.
 */
export declare const normalizeNarsese: (input: string) => string;
/** Parse with normalization; cached for firewall hot paths. Null when unparseable. */
export declare const parseNarseseLenient: (narsese: string) => Term | null;
//# sourceMappingURL=normalize.d.ts.map