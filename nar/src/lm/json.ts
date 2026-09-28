/**
 * Single seam for pulling a JSON object out of untrusted LM text.
 *
 * Brace-balanced scanning replaces the greedy `/\{[\s\S]*\}/` regex that
 * previously ran at every call site: greedy matching swallowed trailing prose
 * and sibling objects, so any response with a `}` after the payload failed to
 * parse. Fenced blocks and prose around the object are tolerated.
 */

import type { ZodType } from 'zod';
import { z } from 'zod';

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

/** Parse the first JSON object in `text` and validate it; null on any failure. */
export function parseJsonWith<T>(text: string, schema: ZodType<T>): T | null {
  const raw = parseJsonObject(text);
  if (raw === null) return null;
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** As {@link parseJsonWith} but throws, for callers that retry on failure. */
export function parseJsonOrThrow<T>(text: string, schema: ZodType<T>): T {
  const slice = extractJsonObject(text);
  if (slice === null) throw new Error('No JSON object in LM response');
  return schema.parse(JSON.parse(slice));
}

const jsonSchemaCache = new WeakMap<ZodType, unknown>();

/** `z.toJSONSchema` memoized per schema object — generation is not free. */
export function toCachedJsonSchema(schema: ZodType): unknown {
  let cached = jsonSchemaCache.get(schema);
  if (cached === undefined) {
    cached = z.toJSONSchema(schema as never);
    jsonSchemaCache.set(schema, cached);
  }
  return cached;
}
