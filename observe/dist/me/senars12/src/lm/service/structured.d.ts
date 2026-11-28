import type { LMGenerateOptions } from '@senars/types/llm';
import type { ZodSchema } from 'zod';
type GenerateText = (prompt: string, opts?: LMGenerateOptions) => Promise<string>;
/** JSON-mode structured generation over plain text: schema in the prompt,
 *  first JSON object extracted, validated against the zod schema. Extracted
 *  from LMService (M4) — depends only on the text-generation seam. */
export declare function generateObjectViaText<T>(generateText: GenerateText, prompt: string, schema: ZodSchema<T>, opts: LMGenerateOptions | undefined, nativeError: unknown): Promise<T>;
export {};
//# sourceMappingURL=structured.d.ts.map