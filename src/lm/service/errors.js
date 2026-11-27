import { errMsg } from '@senars/util/error';
import { withRetry as utilWithRetry } from '@senars/util/retry';
import { SenarsError, isRetryableError } from '@senars/errors';
/** H6/X14: provider-specific remediation hints appended to LM failures. */
const LADDER_HINTS = {
    'openai-compatible': "start the OpenAI-compatible server ('ollama serve' for a local daemon) or set LM_PROVIDER=mock",
    'llamacpp-embedded': "fetch a GGUF model first ('pnpm exec tsx scripts/fetch-model.ts')",
    llamacpp: 'start llama-server or set LM_PROVIDER=mock',
    transformers: 'check the model cache dir / network for the model download',
    webllm: 'requires WebGPU (browser context only)',
    anthropic: 'set ANTHROPIC_API_KEY or fall back to a local provider',
    openai: 'set OPENAI_API_KEY or fall back to a local provider',
    mock: 'LM_PROVIDER=mock is always available — check MockLMConfig',
};
export const withHint = (message, provider) => {
    const hint = provider ? LADDER_HINTS[provider.split('.')[0] ?? ''] : undefined;
    return hint ? `${message} — hint: ${hint}` : message;
};
/** Typed error for provider/transport failures (offline fallbacks, re-probing). */
export class LMUnavailableError extends SenarsError {
    provider;
    task;
    detail;
    constructor(message, provider, task, detail) {
        super(message, 'LM_UNAVAILABLE', { provider, task, detail });
        this.provider = provider;
        this.task = task;
        this.detail = detail;
    }
}
/** @deprecated Use `isRetryableError` from `@senars/errors` instead. Kept for backward compatibility. */
export const isTransportError = (e) => isRetryableError(e);
export const withRetry = async (fn, provider, task, retries = 2) => utilWithRetry(fn, {
    retries,
    baseMs: 250,
    isRetryable: isRetryableError,
    mapError: (error) => new LMUnavailableError(withHint(`LM provider unavailable (${provider ?? 'unknown'}): ${errMsg(error)}`, provider), provider, task, error),
});
/** How much hotter a retried generation runs. The documented escalation step. */
export const RETRY_TEMPERATURE_STEP = 0.2;
/**
 * The temperatures a failed generation is retried at, hottest last.
 *
 * One ladder for the escalation path: `tryGenerateText` and the structured-output
 * fallback each wrote their own, and they had drifted — the JSON-mode fallback
 * stepped by `0.3` where every other escalation stepped by `0.2`, so a
 * structured-output failure escalated further than the contract says. Retrying
 * hotter is a *different* axis from retrying later, which is why this sits
 * beside `withRetry` rather than inside it.
 */
export const temperatureLadder = (base = 0) => [
    base,
    base + RETRY_TEMPERATURE_STEP,
];
