/**
 * Structural identity of a MeTTa atom: the hash that buckets it, the key that
 * names it, and the one descent that says two of them are the same.
 *
 * The three engines that walk an atom — the unifier, a space query and the `=`
 * builtin — each used to carry its own `switch (kind)`. The differences between
 * them were the variable policy and nothing else, so the descent is one function
 * over the dialect below and the variable policy is its one parameter. A kind
 * added to {@link AtomKind} is read in one place, not three.
 */
import { type EqualityDialect } from '@senars/util/unify';
import type { MeTTaAtom } from '../types/ast';
export declare function hashAtom(atom: MeTTaAtom): number;
/**
 * String form of {@link hashAtom}, for the map and set keys that need one. Two
 * atoms with equal hashes are candidates for identity and still need
 * {@link equalAtoms} to confirm — this is the bucket key, not the comparison.
 *
 * Kind-tagged so that two atoms of different kinds can never share a bucket on
 * the strength of a hash collision alone; this is the only atom key in the
 * package, and every caller hashes to the same string.
 */
export declare const atomKey: (atom: MeTTaAtom) => string;
/** How a structural comparison reads a MeTTa atom. */
export declare const ATOM_EQUALITY: EqualityDialect<MeTTaAtom>;
/**
 * Structural equality: a variable is a named node and equals only itself.
 *
 * The whole answer for the unifier and the `=` builtin, and the shared descent
 * they now spell once between them.
 */
export declare function equalAtoms(a: MeTTaAtom, b: MeTTaAtom): boolean;
/**
 * Structural match of `atom` against `pattern`: a variable anywhere in the
 * pattern matches anything in its slot.
 *
 * **Fails closed** — an unrecognised atom kind never matches, so a malformed atom
 * cannot widen a query's result set.
 */
export declare const matchesAtom: (atom: MeTTaAtom, pattern: MeTTaAtom) => boolean;
//# sourceMappingURL=hash.d.ts.map