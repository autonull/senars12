/**
 * Shared fetch decorator: forces `chat_template_kwargs.enable_thinking = false`
 * on chat requests. Qwen-family reasoning models otherwise spend the entire
 * token budget on `reasoning_content` and never emit an answer.
 */

import { withBodyPatch } from './body-patch.js';

/** Wraps `base` so every chat request carries thinking disabled. */
export const withThinkingDisabled =
  (base: typeof fetch = fetch): typeof fetch =>
  withBodyPatch((body) => {
    if (!body.messages || body.chat_template_kwargs) return false;
    body.chat_template_kwargs = { enable_thinking: false };
  }, base);