/**
 * Schema-validating JSON extraction for model text. The scanning and parsing
 * primitives are pure and live in `@senars/util` (see there for why); what is
 * left here is the part that needs a schema.
 */
import { extractJsonObject, parseJsonObject } from '@senars/util/json';
import { z } from 'zod';
import { SenarsError } from '../errors/senars-error';
export { extractJsonObject, parseJsonObject };
/** Parse the first JSON object in `text` and validate it; null on any failure. */
export function parseJsonWith(text, schema) {
    const raw = parseJsonObject(text);
    if (raw === null)
        return null;
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : null;
}
/** As {@link parseJsonWith} but throws, for callers that retry on failure. */
export function parseJsonOrThrow(text, schema) {
    const slice = extractJsonObject(text);
    if (slice === null)
        throw new SenarsError('No JSON object in LM response', 'OPERATION_ERROR');
    return schema.parse(JSON.parse(slice));
}
const jsonSchemaCache = new WeakMap();
/** `z.toJSONSchema` memoized per schema object — generation is not free. */
export function toCachedJsonSchema(schema) {
    let cached = jsonSchemaCache.get(schema);
    if (cached === undefined) {
        cached = z.toJSONSchema(schema);
        jsonSchemaCache.set(schema, cached);
    }
    return cached;
}
