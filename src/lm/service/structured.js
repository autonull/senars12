import { toError } from '@senars/util/error';
import { parseJsonOrThrow, toCachedJsonSchema } from '../json';
import { temperatureLadder } from './errors';
/** JSON-mode structured generation over plain text: schema in the prompt,
 *  first JSON object extracted, validated against the zod schema. Extracted
 *  from LMService (M4) — depends only on the text-generation seam. */
export async function generateObjectViaText(generateText, prompt, schema, opts, nativeError) {
    const jsonSchema = toCachedJsonSchema(schema);
    const enriched = `${prompt}\n\nRespond with ONLY a single JSON object matching this JSON Schema` +
        ` (no markdown fences, no commentary):\n${JSON.stringify(jsonSchema)}`;
    let lastError = nativeError;
    for (const temperature of temperatureLadder(opts?.temperature ?? 0)) {
        if (opts?.signal?.aborted)
            break;
        try {
            const text = await generateText(enriched, {
                task: opts?.task ?? 'structured',
                signal: opts?.signal,
                temperature,
                model: opts?.model,
            });
            return parseJsonOrThrow(text, schema);
        }
        catch (e) {
            lastError = e;
        }
    }
    throw toError(lastError);
}
