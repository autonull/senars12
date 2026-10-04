/**
 * Pulling a JSON object out of untrusted model text.
 *
 * Brace-balanced scanning replaces the greedy `/\{[\s\S]*\}/` regex that
 * previously ran at every call site: greedy matching swallowed trailing prose
 * and sibling objects, so any response with a `}` after the payload failed to
 * parse. Fenced blocks and prose around the object are tolerated.
 *
 * Pure, and therefore in `util` rather than in the induction layer: the cycle
 * path parses model output too, and a core that reaches into the layer to do it
 * is a boundary the gate would have to carve an exception for (TODO29.a §5.2).
 */

const OPEN = '{'.charCodeAt(0);
const CLOSE = '}'.charCodeAt(0);
const QUOTE = '"'.charCodeAt(0);
const BACKSLASH = '\\'.charCodeAt(0);

/** The first balanced top-level JSON object in `text`, or null. */
export function extractJsonObject(text: string): string | null {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (inString) {
        if (code === BACKSLASH) i++;
        else if (code === QUOTE) inString = false;
        continue;
      }
      if (code === QUOTE) inString = true;
      else if (code === OPEN) depth++;
      else if (code === CLOSE && --depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Parse the first JSON object in `text`; null when absent or malformed.
 * `T` names what the caller expects — it is asserted, not checked, so it belongs
 * on a boundary that already validates the document it read.
 */
export function parseJsonObject<T = unknown>(text: string): T | null {
  const slice = extractJsonObject(text);
  if (slice === null) return null;
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

/**
 * Deterministic JSON with object keys emitted in sorted order — the single
 * serializer behind every cache key and content digest, so two structurally
 * equal values always digest identically regardless of insertion order.
 * `undefined` members are dropped, matching `JSON.stringify`.
 *
 * `sortArrays` treats array order as non-semantic, so `{ filters: ['b','a'] }`
 * and `{ filters: ['a','b'] }` are one value. Use it only where a list is a
 * set — strategy config, filters, tags — never for an ordered sequence.
 *
 * For *equality* rather than a digest, use `deepEqual`, which answers the same
 * question without serializing the graph.
 */
export function stableStringify(value: unknown, sortArrays = false): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (ArrayBuffer.isView(value)) {
    return JSON.stringify(Array.from(value as unknown as ArrayLike<number>));
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => stableStringify(item, sortArrays));
    return `[${sortArrays ? items.sort() : items.join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v, sortArrays)}`).join(',')}}`;
}
