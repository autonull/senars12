import { escapeRegExp, getOrInsert, LruCache, splitWords } from '@senars/util';
import type { Term } from '../terms';
import { COPULA_SYMBOLS, isValidAtomSymbol, termParser, toAtomSymbol } from '../terms';

/** Built once from the operator table; every symbol here is regex-significant. */
const escaped = COPULA_SYMBOLS.map(escapeRegExp);
const COPULA = new RegExp(`(?:${escaped.join('|')})`);
const BARE_COPULA = new RegExp(`\\)\\s*(?:${escaped.join('|')})\\s*\\(`);
const BINARY_OPS = COPULA_SYMBOLS;

const snakeCaseWords = (operand: string): string =>
  splitWords(operand).map(toAtomSymbol).filter(Boolean).join('_');

/** Normalize each top-level operand (split on binary operators at depth 0). */
const normalizeOperands = (t: string): string => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const op = BINARY_OPS.find((o) => t.slice(i, i + o.length) === o);
      if (op) {
        parts.push(t.slice(start, i));
        parts.push(op);
        i += op.length - 1;
        start = i + 1;
      }
    }
  }
  parts.push(t.slice(start));
  if (parts.length <= 1) return t;
  return parts
    .map((p) => ((BINARY_OPS as readonly string[]).includes(p) ? p : snakeCaseWords(p)))
    .join(' ');
};

/**
 * Canonicalize common LLM Narsese deviations so the parser and firewall accept
 * semantically-correct output from any model:
 * - multi-word phrases inside parens → snake_case atoms
 * - top-level "A --> B" without enclosing parens → wrapped
 * Idempotent: canonical Narsese passes through unchanged.
 */
export const normalizeNarsese = (input: string): string => {
  let t = input.trim();
  if (!t) return t;

  // "(Backup Generator Kicks In)" → "(Backup_Generator_Kicks_In)";
  // inner statements with copulas get their operands normalized too
  t = t.replace(/\(([^()]*)\)/g, (m, inner: string) => {
    if (COPULA.test(inner)) return `(${normalizeOperands(inner.trim())})`;
    const words = splitWords(inner);
    if (words.length === 0) return m;
    if (words.length === 1 && isValidAtomSymbol(words[0]!)) return m;
    return `(${words.map(toAtomSymbol).join('_')})`;
  });

  // "(A) --> (B)" → "((A) --> (B))"; bare "A && B" → "(A && B)"
  if (BARE_COPULA.test(t) && !t.startsWith('((')) t = `(${t})`;
  const normalized = normalizeOperands(t);
  return BINARY_OPS.some((o) => normalized.includes(o)) && !normalized.startsWith('(')
    ? `(${normalized})`
    : normalized;
};

/**
 * Parse results are keyed on raw ingress text, so the cache is an untrusted
 * input surface: without a capacity bound a distinct utterance per request
 * grows it without limit. `LruCache` restores the AIKR bound and keeps the
 * hot firewall path allocation-free on a hit.
 */
const PARSE_CACHE_CAP = 2048;
const parseCache = new LruCache<string, Term | null>(PARSE_CACHE_CAP);

/** Parse with normalization; cached for firewall hot paths. Null when unparseable. */
export const parseNarseseLenient = (narsese: string): Term | null => {
  const key = narsese.trim();
  return getOrInsert(parseCache, key, () => {
    let term: Term | null = null;
    for (const candidate of [key, normalizeNarsese(key)]) {
      try {
        term = termParser.parse(candidate.replace(/[.?!]$/, ''));
        break;
      } catch {
        /* try next form */
      }
    }
    return term;
  });
};
