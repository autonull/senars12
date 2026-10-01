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

/** Parse the first JSON object in `text`; null when absent or malformed. */
export function parseJsonObject(text: string): unknown | null {
  const slice = extractJsonObject(text);
  if (slice === null) return null;
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}