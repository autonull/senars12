/**
 * The operation-term convention — one encoder, one decoder, one spelling.
 *
 * An operation is the `operation` kind, so `move(dir-->left,steps-->3)` is a term
 * like any other and the grammar reads it back without a special case. Its
 * arguments are a product, so `move()` is the 0-ary product rather than a
 * sentinel atom, and `(move^(x,y))` and `move(x,y)` are the same term.
 *
 * What this replaces was a second spelling for one idea: `^move(args)` decoded to
 * `Inheritance(Product(args), Atom('^move'))`, which no reader of an `operation`
 * term could see. Every recogniser of a tool goal therefore sniffed a predicate
 * atom's sigil, in six files, and each could disagree with the next. `^move` is
 * now a parse error and a term's `kind` is the recogniser.
 */
import { type Term } from '../types';
/** An operation term read back into the name and arguments a tool receives. */
export interface OperationCall {
    readonly name: string;
    readonly args: Record<string, unknown>;
}
/**
 * `(move^(dir-->left,steps-->3))`. Keys are read in insertion order, so the
 * encoder is deterministic and the decoder reproduces it.
 */
export declare const operationTerm: (name: string, args?: Readonly<Record<string, unknown>>) => Term;
/** The operation a term names, or `undefined` when it names none. */
export declare const operationNameOf: (term: Term) => string | undefined;
/** The name and arguments a term calls, or `undefined` when it calls nothing. */
export declare const readOperationTerm: (term: Term) => OperationCall | undefined;
//# sourceMappingURL=operation-term.d.ts.map