/**
 * Canonical Term Operations — Narsese parsing and formatting.
 */
import type { Term } from './types';
import { TermOp } from '../term-ops';
/** Escape a constant value for Narsese. */
export declare function escapeConstant(value: string): string;
/** Get operator symbol for Narsese. */
export declare function getOperatorSymbol(op: TermOp): string;
/** Get operator precedence for formatting. */
export declare function getPrecedence(op: TermOp): number;
interface FormatOptions {
    /** Use short operator symbols. */
    short?: boolean;
    /** Parenthesize all compounds. */
    fullParens?: boolean;
}
/** Format a term as Narsese string. */
export declare function formatTerm(term: Term, options?: FormatOptions): string;
/** Parse a Narsese string into a term. */
export declare function fromNarsese(input: string): Term | null;
/** Narsese formatter class. */
export declare class NarseseFormatter {
    private options;
    constructor(options?: FormatOptions);
    format(term: Term): string;
    formatBatch(terms: Term[]): string;
}
export {};
//# sourceMappingURL=canonical.d.ts.map