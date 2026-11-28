import type { LanguageModelV3, LanguageModelV3CallOptions } from '@ai-sdk/provider';
export interface MockModelOptions {
    provider?: string;
    modelId?: string;
    /** Prompt → response text; defaults to `defaultText(lastUserMessage)`. */
    generateTextFn?: (prompt: string) => string | Promise<string>;
    defaultText?: (lastUserMessage: string) => string;
    /** Wrap the generated text (e.g. force a JSON envelope for structured calls). */
    transformText?: (text: string, options: LanguageModelV3CallOptions) => string;
}
/**
 * The single mock `LanguageModelV3` shim: one `doGenerate`/`doStream` pair
 * shared by the mock LM service, the provider factory, and transport stubs.
 */
export declare function createMockModel({ provider, modelId, generateTextFn, defaultText, transformText, }?: MockModelOptions): LanguageModelV3;
//# sourceMappingURL=mock-model.d.ts.map