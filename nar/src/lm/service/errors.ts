import { errMsg, type LMTask, withRetry as retry } from '@senars/util';
import { SenarsError } from '@senars/util/errors';

/** H6/X14: provider-specific remediation hints appended to LM failures. */
const LADDER_HINTS: Partial<Record<string, string>> = {
  'openai-compatible':
    "start the OpenAI-compatible server ('ollama serve' for a local daemon) or set LM_PROVIDER=mock",
  'llamacpp-embedded': "fetch a GGUF model first ('pnpm exec tsx scripts/fetch-model.ts')",
  llamacpp: 'start llama-server or set LM_PROVIDER=mock',
  transformers: 'check the model cache dir / network for the model download',
  webllm: 'requires WebGPU (browser context only)',
  anthropic: 'set ANTHROPIC_API_KEY or fall back to a local provider',
  openai: 'set OPENAI_API_KEY or fall back to a local provider',
  mock: 'LM_PROVIDER=mock is always available — check MockLMConfig',
};

export const withHint = (message: string, provider?: string): string => {
  const hint = provider ? LADDER_HINTS[provider.split('.')[0] ?? ''] : undefined;
  return hint ? `${message} — hint: ${hint}` : message;
};

/** Typed error for provider/transport failures (offline fallbacks, re-probing). */
export class LMUnavailableError extends SenarsError {
  readonly provider: string | undefined;
  readonly task: LMTask | undefined;
  readonly detail: unknown;

  constructor(message: string, provider?: string, task?: LMTask, detail?: unknown) {
    super(message, 'LM_UNAVAILABLE', { provider, task, detail });
    this.provider = provider;
    this.task = task;
    this.detail = detail;
  }
}

export const isTransportError = (e: unknown): boolean => {
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return (
    /\b(fetch|network|econn|timeout|aborted|socket|rate.?limit|5\d\d)\b/.test(msg) ||
    /failed to (fetch|connect)/.test(msg)
  );
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  provider: string | undefined,
  task: LMTask,
  retries = 2
): Promise<T> =>
  retry(fn, {
    retries,
    baseMs: 250,
    isRetryable: isTransportError,
    mapError: (error) =>
      new LMUnavailableError(
        withHint(
          `LM provider unavailable (${provider ?? 'unknown'}): ${errMsg(error)}`,
          provider
        ),
        provider,
        task,
        error
      ),
  });
