/**
 * Schema-validating JSON extraction for model text. The scanning and parsing
 * primitives are pure and live in `@senars/util` (see there for why); what is
 * left here is the part that needs a schema.
 */

import type { ZodType } from 'zod';
import { z } from 'zod';
import { extractJsonObject, parseJsonObject } from '@senars/util';

export { extractJsonObject, parseJsonObject };

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
