/**
 * Text measurement, tokenizing, and truncation. The three questions — how big
 * is this, what words are in it, and how do I show the first `n` of it — had one
 * answer each across the repo rather than one each here.
 */
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

/** Lowercased word-token set — the tokenizer behind every text-similarity path. */
export const tokenizeWords = (text: string, splitPattern: RegExp = /\s+/): Set<string> =>
  new Set(text.toLowerCase().split(splitPattern).filter(Boolean));

export const wordOverlap = (a: string, b: string, splitPattern?: RegExp): number => {
  const aWords = tokenizeWords(a, splitPattern);
  const bWords = tokenizeWords(b, splitPattern);
  const denominator = Math.max(aWords.size, bWords.size);
  if (denominator === 0) return 0;
  let overlap = 0;
  for (const word of aWords) if (bWords.has(word)) overlap++;
  return overlap / denominator;
};

/** The leading run of atom characters in `content`, or nothing if it starts with none. */
export function extractTerm(content: string): string | undefined {
  const trimmed = content.trim();
  if (!trimmed) return undefined;
  const words = trimmed.split(/\s+/);
  return words[0]?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) ?? undefined;
}

/** Whether `text` is Narsese rather than prose — the router between the two parsers. */
export function isNarsese(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('(') ||
    trimmed.startsWith('<') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[')
  )
    return true;
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
