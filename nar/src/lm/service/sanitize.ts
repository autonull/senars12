import { SenarsError } from '@senars/util/errors';

export const DEFAULT_MAX_LM_OUTPUT_CHARS = 65_536;

export const maxLMOutputChars = (): number => {
  const raw = process.env.LM_MAX_OUTPUT_CHARS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_LM_OUTPUT_CHARS;
};

export class LMOutputTooLargeError extends SenarsError {
  readonly length: number;
  readonly limit: number;
  constructor(length: number, limit: number) {
    super(`LM output exceeds size limit: ${length} > ${limit} chars`, 'LM_OUTPUT_TOO_LARGE', {
      length,
      limit,
    });
    this.length = length;
    this.limit = limit;
  }
}

/** S4 (TODO20): size limit on all LM outputs. Throws LMOutputTooLargeError past the limit. */
export function enforceLMOutputSize(
  text: string,
  limit: number = maxLMOutputChars()
): string {
  if (text.length > limit) throw new LMOutputTooLargeError(text.length, limit);
  return text;
}
