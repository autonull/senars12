/**
 * Term types and operators
 * Defines the structure of terms in NARS12
 *
 * This is the pure types module - all type definitions only.
 * For operations on terms, see:
 * - serialize.ts / deserialize.ts - String conversion
 * - complexity.ts - Complexity and similarity metrics
 * - substitute.ts - Variable substitution
 * - accessors.ts - Term accessors and type guards
 * - guards.ts - Additional type guards
 * - factory.ts - Term construction
 * - parser.ts - Term parsing
 */
export { COMMUTATIVE_OPS, COPULA_SYMBOLS, hasCopula, NARY_OPS, OPERATORS } from './operators';
/**
 * Narsese variable sigils. This is the single definition: the atom factory
 * stamps `isVariable` from it, and every variable test — rules, complexity,
 * substitution, the unifier — agrees with it. Two of those read the stamped
 * flag rather than this regex, so they hold only while every atom came from the
 * factory; {@link isVariableSymbol} is the form to reach for when that is not
 * guaranteed. The unifier previously used a `$`-only test while the factory
 * accepted all five, so `atom('?x')` was built as a variable that the unifier
 * then refused to bind.
 */
export const VARIABLE_SYMBOL = /^[?$#*%]/;
export const isVariableSymbol = (symbol) => VARIABLE_SYMBOL.test(symbol);
export const isAtomic = (term) => term.kind === 'atom';
export const isCompound = (term) => term.kind !== 'atom';
