import { NARY_OPS, OPERATORS } from '../operators.js';
import type { OperatorKey, Term } from '../types.js';
import { getArgs } from './accessors.js';

const NARY_OPS_SET: ReadonlySet<string> = NARY_OPS;
const BINARY_OPS = new Set(
  Object.entries(OPERATORS)
    .filter(([, v]) => v.arity === 2 && !v.nary)
    .map(([k]) => k)
);
const UNARY_OPS = new Set(
  Object.entries(OPERATORS)
    .filter(([, v]) => v.arity === 1)
    .map(([k]) => k)
);

const ARGUMENT_SEPARATOR = ',';

/**
 * Narsese spells an n-ary copula two ways and they are not interchangeable:
 * `(a&b)` is **infix and only valid for two members**, and `(&,a,b,c)` is the
 * prefix form for any arity. `docs/java/NarseseParser.java` draws the line
 * itself — `CompoundInfix` is exactly `Term() op Term()`, while `MultiArgTerm`
 * with `initialOp` reads the operator first and then a comma-separated list.
 *
 * So the repeated-infix spelling `(a&b&c)` is not a third form, it is a
 * malformed one, and a serialiser that emits it writes terms its own reader
 * cannot accept. Two members stays infix because it is shorter and it is what
 * Narsese authors write; three or more takes the prefix form.
 */
const PREFIX_ARITY_THRESHOLD = 2;

/**
 * An operation always parenthesises its arguments. `f^(x)` names one argument and
 * `f^(x,y)` names several — the product is what makes the second several — so
 * the parens are not decoration and the writer cannot drop them.
 */
const serializeOperation = (op: Term | undefined, args: Term | undefined): string => {
  if (!op || !args) return '';
  const body =
    args.kind === 'product'
      ? getArgs(args).map((arg) => serialize(arg)).join(ARGUMENT_SEPARATOR)
      : serialize(args);
  return `(${serialize(op)}${OPERATORS.operation.symbol}(${body}))`;
};

const WRAPPERS: Record<string, [string, string]> = {
  negation: ['--', ''],
  setExt: ['{', '}'],
  setInt: ['[', ']'],
};

/**
 * What goes between an n-ary kind's arguments, verbatim: the operator symbol
 * itself, no padding. Every space a serialiser emits is a byte in every
 * serialised term, every key built from one and every log line, and this is the
 * form that gets copied the most.
 */
const NARY_SEPARATORS: Partial<Record<OperatorKey, string>> = {
  conjunction: OPERATORS.conjunction.symbol,
  disjunction: OPERATORS.disjunction.symbol,
  sequence: OPERATORS.sequence.symbol,
  parallel: OPERATORS.parallel.symbol,
  product: ARGUMENT_SEPARATOR,
};
const EMPTY_COMPOUND: Partial<Record<OperatorKey, string>> = {
  conjunction: 'TRUE',
  disjunction: 'FALSE',
  product: '()',
  sequence: 'TRUE',
  parallel: 'TRUE',
  predictive: 'TRUE',
  retrospective: 'TRUE',
};

/**
 * Hoisted out of {@link serialize}: it was declared inside it, so the recursion
 * allocated a fresh closure at every term it descended into, and it reads nothing
 * but `serialize` and a separator.
 */
const serializeArgs = (args: readonly Term[], sep = ARGUMENT_SEPARATOR): string =>
  args.map(serialize).join(sep);

const serialize = (term: Term): string => {
  if (term.kind === 'atom') return term.symbol;

  if (NARY_OPS_SET.has(term.kind)) {
    const args = getArgs(term);
    if (args.length === 0) return EMPTY_COMPOUND[term.kind as OperatorKey] ?? '';
    if (args.length === 1) {
      // Product with 1 arg is a real term, not a fold: (a) not a
      if (term.kind === 'product') return `(${serialize(args[0]!)})`;
      // Disjunction and conjunction fold 1-arg to the arg
      return serialize(args[0]!);
    }
    const sep = NARY_SEPARATORS[term.kind as OperatorKey] ?? ARGUMENT_SEPARATOR;
    // `product`'s copula is the comma itself, so `(a,b,c)` already *is* its
    // prefix form and there is no second spelling to choose between.
    if (args.length > PREFIX_ARITY_THRESHOLD && term.kind !== 'product') {
      const symbol = OPERATORS[term.kind as OperatorKey]?.symbol ?? sep;
      return `(${symbol}${ARGUMENT_SEPARATOR}${serializeArgs(args)})`;
    }
    return `(${serializeArgs(args, sep)})`;
  }

  if (term.kind === 'operation') {
    const [op, args] = getArgs(term);
    return serializeOperation(op, args);
  }

  if (BINARY_OPS.has(term.kind)) {
    const [a, b] = getArgs(term);
    const op = OPERATORS[term.kind as OperatorKey]?.symbol ?? '';
    return a && b ? `(${serialize(a)}${op}${serialize(b)})` : '';
  }

  if (UNARY_OPS.has(term.kind)) {
    const args = getArgs(term);
    const [prefix, suffix] = WRAPPERS[term.kind] ?? ['', ''];
    if (args.length === 0) return `${prefix}${suffix}`;
    return args.length === 1
      ? `${prefix}${serialize(args[0]!)}${suffix}`
      : `${prefix}${serializeArgs(args)}${suffix}`;
  }

  const args = getArgs(term);
  return args.length > 0 ? `(${serializeArgs(args)})` : '';
};

export const serializeTerm = serialize;

/**
 * Canonical term → Narsese string API. Delegates to {@link serializeTerm}.
 * @public
 */
export const toNarsese = (term: Term): string => serializeTerm(term);
