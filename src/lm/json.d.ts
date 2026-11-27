/**
 * Schema-validating JSON extraction for model text. The scanning and parsing
 * primitives are pure and live in `@senars/util` (see there for why); what is
 * left here is the part that needs a schema.
 */
import { extractJsonObject, parseJsonObject } from '@senars/util/json';
import type { ZodType } from 'zod';
export { extractJsonObject, parseJsonObject };
/** Parse the first JSON object in `text` and validate it; null on any failure. */
export declare function parseJsonWith<T>(text: string, schema: ZodType<T>): T | null;
/** As {@link parseJsonWith} but throws, for callers that retry on failure. */
export declare function parseJsonOrThrow<T>(text: string, schema: ZodType<T>): T;
/** `z.toJSONSchema` memoized per schema object — generation is not free. */
export declare function toCachedJsonSchema(schema: ZodType): unknown;
//# sourceMappingURL=json.d.ts.map