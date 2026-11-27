/**
 * Operator definitions - standalone to avoid circular dependencies
 *
 * `symbol` is the **Narsese surface spelling**: what `narsese.peggy` accepts and
 * what `serialize.ts` writes. `scripts/terms-canonical.ts` fails if the grammar's
 * token table and this one disagree, so neither can drift from the other.
 */
export declare const OPERATORS: {
    readonly inheritance: {
        readonly symbol: '-->';
        readonly arity: 2;
        readonly commutative: false;
        readonly nary: false;
    };
    readonly similarity: {
        readonly symbol: '<->';
        readonly arity: 2;
        readonly commutative: true;
        readonly nary: false;
    };
    readonly conjunction: {
        readonly symbol: '&';
        readonly arity: 0;
        readonly commutative: true;
        readonly nary: true;
    };
    readonly disjunction: {
        readonly symbol: '|';
        readonly arity: 0;
        readonly commutative: true;
        readonly nary: true;
    };
    readonly negation: {
        readonly symbol: '--';
        readonly arity: 1;
        readonly commutative: false;
        readonly nary: false;
    };
    readonly implication: {
        readonly symbol: '==>';
        readonly arity: 2;
        readonly commutative: false;
        readonly nary: false;
    };
    readonly equivalence: {
        readonly symbol: '<=>';
        readonly arity: 2;
        readonly commutative: true;
        readonly nary: false;
    };
    readonly setExt: {
        readonly symbol: '{';
        readonly arity: 1;
        readonly commutative: false;
        readonly nary: false;
    };
    readonly setInt: {
        readonly symbol: '[';
        readonly arity: 1;
        readonly commutative: false;
        readonly nary: false;
    };
    readonly sequence: {
        readonly symbol: '&/';
        readonly arity: 2;
        readonly commutative: false;
        readonly nary: false;
    };
    readonly parallel: {
        readonly symbol: '&|';
        readonly arity: 0;
        readonly commutative: true;
        readonly nary: true;
    };
    readonly predictive: {
        readonly symbol: '=/>';
        readonly arity: 2;
        readonly commutative: false;
        readonly nary: false;
    };
    readonly retrospective: {
        readonly symbol: '=|';
        readonly arity: 2;
        readonly commutative: false;
        readonly nary: false;
    };
    readonly operation: {
        readonly symbol: '^';
        readonly arity: 2;
        readonly commutative: false;
        readonly nary: false;
    };
    readonly product: {
        readonly symbol: ',';
        readonly arity: 0;
        readonly commutative: false;
        readonly nary: true;
    };
};
export type OperatorKey = keyof typeof OPERATORS;
export type OperatorSymbol = (typeof OPERATORS)[OperatorKey]['symbol'];
/**
 * The infix binary operators — a statement's copulas, longest symbol first so a
 * scanner that tests prefixes cannot take `==>` for `=|` or `=/>` for `=>`.
 *
 * Derived from {@link OPERATORS} rather than written out, because three modules
 * were spelling out their own list of them: `nl/normalize.ts` carried one that
 * included `'&&'`, which is not a Narsese copula at all (conjunction is `'&'`),
 * and omitted the predictive, retrospective, sequence and operation forms.
 */
export declare const COPULA_SYMBOLS: readonly string[];
/** Whether `text` contains any copula — the one "is this a statement?" test. */
export declare const hasCopula: (text: string) => boolean;
export declare const COMMUTATIVE_OPS: Set<"conjunction" | "disjunction" | "equivalence" | "implication" | "inheritance" | "negation" | "operation" | "parallel" | "predictive" | "product" | "retrospective" | "sequence" | "setExt" | "setInt" | "similarity">;
export declare const NARY_OPS: Set<"conjunction" | "disjunction" | "equivalence" | "implication" | "inheritance" | "negation" | "operation" | "parallel" | "predictive" | "product" | "retrospective" | "sequence" | "setExt" | "setInt" | "similarity">;
//# sourceMappingURL=operators.d.ts.map