/**
 * Shared fetch decorator: forces `chat_template_kwargs.enable_thinking = false`
 * on chat requests. Qwen-family reasoning models otherwise spend the entire
 * token budget on `reasoning_content` and never emit an answer.
 */
/** Wraps `base` so every chat request carries thinking disabled. */
export declare const withThinkingDisabled: (base?: typeof fetch) => typeof fetch;
//# sourceMappingURL=thinking.d.ts.map