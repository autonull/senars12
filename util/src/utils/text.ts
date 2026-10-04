/**
 * Text measurement, tokenizing, and truncation. The three questions — how big
 * is this, what words are in it, and how do I show the first `n` of it — had one
 * answer each across the repo rather than one each here.
 */
import { safeRatio } from './numeric.js';

/** Cut to `maxLength`, marking what the cut hid — the shortest of the three. */
export const truncate = (text: string, maxLength = 60): string =>
  text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;

/** Byte-safe truncation for tool output — never splits a multi-byte character. */
export const truncateBytes = (
  text: string,
  maxBytes: number
): { text: string; truncated: boolean } => {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes <= maxBytes) return { text, truncated: false };
  return {
    text: Buffer.from(text, 'utf8').subarray(0, maxBytes).toString('utf8'),
    truncated: true,
  };
};

/** `items` through `format`, with a trailing count of what the limit hid. */
export const limitList = <T>(
  items: T[],
  limit: number,
  format: (item: T) => string,
  moreText = 'more'
): string[] => {
  const lines = items.slice(0, limit).map(format);
  if (items.length > limit) {
    lines.push(`  ... and ${items.length - limit} ${moreText}`);
  }
  return lines;
};

/**
 * Case-preserving word tokens. The one split: an empty or whitespace-only string
 * yields no tokens, which `String.split(/\s+/)` does not do — it yields `['']`,
 * and every caller that read `parts[0]` off that had to guard against the empty
 * string instead of against absence.
 */
export const splitWords = (text: string, splitPattern: RegExp = /\s+/): string[] =>
  text.trim().split(splitPattern).filter(Boolean);

/**
 * Escape every regexp metacharacter in `text`, so untrusted text becomes a
 * literal match instead of a pattern. Building a `RegExp` from unescaped input
 * is not a formatting convenience — it lets the input widen the match past its
 * own bounds — so this exists as the one spelling of "literal".
 */
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Lowercased word-token set — the tokenizer behind every text-similarity path. */
export const tokenizeWords = (text: string, splitPattern: RegExp = /\s+/): Set<string> =>
  new Set(splitWords(text.toLowerCase(), splitPattern));

/**
 * The separators between the words of a *term* rather than of prose. Three
 * similarity paths each declared their own character class and none agreed on
 * whether a Narsese arrow is one word or two; a term's words are the grammar's,
 * so the set is the grammar's and the three read it from here.
 */
export const TERM_SEPARATORS = /[\s_()[\]<>\-/=>]+/;

/** How many of `needle`'s words appear in `haystack` — the numerator every
 *  overlap ratio is, and the form a caller holding one precomputed set needs. */
export const overlapCount = (
  needle: ReadonlySet<string>,
  haystack: ReadonlySet<string>
): number => {
  let overlap = 0;
  for (const word of needle) if (haystack.has(word)) overlap++;
  return overlap;
};

export const wordOverlap = (a: string, b: string, splitPattern?: RegExp): number => {
  const aWords = tokenizeWords(a, splitPattern);
  const bWords = tokenizeWords(b, splitPattern);
  return safeRatio(overlapCount(aWords, bWords), Math.max(aWords.size, bWords.size));
};

/**
 * The characters a bare Narsese atom symbol may contain. The grammar's authority on
 * which of these `createAtom` accepts lives one layer up, but the alphabet itself is
 * lexical, and three sanitizers had each hardcoded their own copy of it — one of them
 * keeping a character the factory rejects, another silently deleting the `^` operator
 * marker, which mints a different term rather than refusing one.
 *
 * Variables (`? $ # * %`) and quoted atoms are grammar concerns, not alphabet concerns,
 * so neither appears here.
 */
export const NARSESE_ATOM_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_^';

/** Character class over {@link NARSESE_ATOM_CHARS}, hoisted so the pattern is not
 * recompiled per call. Only safe to derive while the alphabet holds no `]`, `\` or `-`. */
const ATOM_CHAR_RUN = new RegExp(`^[${NARSESE_ATOM_CHARS}]+`);

/** The leading run of atom characters in `content`, or nothing if it starts with none. */
export const extractTerm = (content: string): string | undefined =>
  ATOM_CHAR_RUN.exec(content.trim())?.[0].slice(0, 40);

/** Whether `text` is Narsese rather than prose — the router between the two parsers. */
export function isNarsese(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('(') || trimmed.startsWith('<') || trimmed.startsWith('[')) return true;
  if (
    trimmed.includes('-->') ||
    trimmed.includes('<->') ||
    trimmed.includes('==>') ||
    trimmed.includes('<=>')
  )
    return true;
  if (trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?')) {
    const body = trimmed.slice(0, -1).trim();
    if (body.startsWith('(') || body.startsWith('<')) return true;
  }
  return false;
}
