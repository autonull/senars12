/**
 * Shared Narsese Formatters — common term formatting logic.
 *
 * Provides the core formatting functions used by both the Narsese codec
 * and the Term class's toString method.
 */
import type { Term } from '../term-internal';
/** Escape a constant value for Narsese. */
export declare function escapeConstant(value: string): string;
/** Format a term as Narsese using precedence-based parentheses. */
export declare function formatTerm(term: Term, parentPrec?: number): string;
/** Get punctuation for a term (., ?, !). */
export declare function getPunctuation(term: Term): string | null;
//# sourceMappingURL=formatters.d.ts.map