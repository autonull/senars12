/**
 * Shared fetch decorator: forces `chat_template_kwargs.enable_thinking = false`
 * on chat requests. Qwen-family reasoning models otherwise spend the entire
 * token budget on `reasoning_content` and never emit an answer.
 */

const inject = (init: RequestInit | undefined): RequestInit | undefined => {
  if (typeof init?.body !== 'string') return undefined;
  try {
    const body = JSON.parse(init.body);
    if (!body.messages || body.chat_template_kwargs) return undefined;
    return {
      ...init,
      body: JSON.stringify({ ...body, chat_template_kwargs: { enable_thinking: false } }),
    };
  } catch {
    /* non-JSON body: pass through untouched */
    return undefined;
  }
};

/** Wraps `base` so every chat request carries thinking disabled. */
export const withThinkingDisabled =
  (base: typeof fetch = fetch): typeof fetch =>
  async (input, init) =>
    base(input, inject(init) ?? init);
