import { SenarsError } from '@senars/errors';
export declare const DEFAULT_MAX_LM_OUTPUT_CHARS = 65536;
export declare const maxLMOutputChars: () => number;
export declare class LMOutputTooLargeError extends SenarsError {
    readonly length: number;
    readonly limit: number;
    constructor(length: number, limit: number);
}
/** S4 (TODO20): size limit on all LM outputs. Throws LMOutputTooLargeError past the limit. */
export declare function enforceLMOutputSize(text: string, limit?: number): string;
//# sourceMappingURL=sanitize.d.ts.map