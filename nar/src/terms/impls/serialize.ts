import { NARY_OPS, OPERATORS } from '../operators.js';
import type { OperatorKey, Term } from '../types.js';

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
      ? (args.args ?? []).map((arg: Term) => serialize(arg)).join(ARGUMENT_SEPARATOR)
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

const serialize = (term: Term): string => {
  if (term.kind === 'atom') return term.symbol;

  const serializeArgs = (args: readonly Term[]): string =>
    args.map((a: Term) => serialize(a)).join(ARGUMENT_SEPARATOR);

  if (NARY_OPS_SET.has(term.kind)) {
    const args = term.args ?? ([] as readonly Term[]);
    if (args.length === 0) return EMPTY_COMPOUND[term.kind as OperatorKey] ?? '';
    if (args.length === 1) {
      // Product with 1 arg is a real term, not a fold: (a) not a
      if (term.kind === 'product') return `(${serialize(args[0] as Term)})`;
      // Disjunction and conjunction fold 1-arg to the arg
      return serialize(args[0] as Term);
    }
    const sep = NARY_SEPARATORS[term.kind as OperatorKey] ?? ARGUMENT_SEPARATOR;
    // `product`'s copula is the comma itself, so `(a,b,c)` already *is* its
    // prefix form and there is no second spelling to choose between.
    if (args.length > PREFIX_ARITY_THRESHOLD && term.kind !== 'product') {
      const symbol = OPERATORS[term.kind as OperatorKey]?.symbol ?? sep;
      return `(${symbol}${ARGUMENT_SEPARATOR}${args.map((a: Term) => serialize(a)).join(ARGUMENT_SEPARATOR)})`;
    }
    return `(${args.map((a: Term) => serialize(a)).join(sep)})`;
  }

  if (term.kind === 'operation') {
    const [op, args] = term.args ?? ([] as readonly Term[]);
    return serializeOperation(op, args);
  }

  if (BINARY_OPS.has(term.kind)) {
    const [a, b] = term.args ?? ([] as readonly Term[]);
    const op = OPERATORS[term.kind as OperatorKey]?.symbol ?? '';
    return a && b ? `(${serialize(a as Term)}${op}${serialize(b as Term)})` : '';
  }

  if (UNARY_OPS.has(term.kind)) {
    const args = term.args ?? ([] as readonly Term[]);
    const [prefix, suffix] = WRAPPERS[term.kind] ?? ['', ''];
    if (args.length === 0) return `${prefix}${suffix}`;
    return args.length === 1
      ? `${prefix}${serialize(args[0] as Term)}${suffix}`
      : `${prefix}${serializeArgs(args)}${suffix}`;
  }

  const t = term as { args?: readonly Term[] };
  return t.args ? `(${serializeArgs(t.args)})` : '';
};

export const serializeTerm = serialize;

/**
 * Canonical term → Narsese string API. Delegates to {@link serializeTerm}.
 * @public
 */
export const toNarsese = (term: Term): string => serializeTerm(term);
