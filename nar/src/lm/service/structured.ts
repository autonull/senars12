import type { LMTask } from '@senars/util';
import { toError } from '@senars/util';
import type { ZodSchema } from 'zod';
import { parseJsonOrThrow, toCachedJsonSchema } from '../json.js';

type GenerateText = (
  prompt: string,
  opts?: { task?: LMTask; signal?: AbortSignal; temperature?: number; model?: string }
) => Promise<string>;

/** JSON-mode structured generation over plain text: schema in the prompt,
 *  first JSON object extracted, validated against the zod schema. Extracted
 *  from LMService (M4) — depends only on the text-generation seam. */
export async function generateObjectViaText<T>(
  generateText: GenerateText,
  prompt: string,
  schema: ZodSchema<T>,
  opts: { task?: LMTask; signal?: AbortSignal; temperature?: number; model?: string } | undefined,
  nativeError: unknown
): Promise<T> {
  const jsonSchema = toCachedJsonSchema(schema);
  const enriched =
    `${prompt}\n\nRespond with ONLY a single JSON object matching this JSON Schema` +
    ` (no markdown fences, no commentary):\n${JSON.stringify(jsonSchema)}`;
  const base = opts?.temperature ?? 0;
  const temperatures = base === 0 ? [0, 0.2] : [base, base + 0.3];
  let lastError: unknown = nativeError;
  for (const temperature of temperatures) {
    if (opts?.signal?.aborted) break;
    try {
      const text = await generateText(enriched, {
        task: opts?.task ?? 'structured',
        signal: opts?.signal,
        temperature,
        model: opts?.model,
      });
      return parseJsonOrThrow(text, schema);
    } catch (e) {
      lastError = e;
    }
  }
  throw toError(lastError);
}
