import type { LMProviderName } from './providers.js';

export type ResolvedProvider = LMProviderName;

export interface ResolvedLMConfig {
  provider: ResolvedProvider;
  model: string;
  host?: string;
}

const OLLAMA_DEFAULT_HOST = 'http://localhost:11434';
const TRANSFORMERS_DEFAULT_MODEL = 'onnx-community/Qwen2.5-1.5B-Instruct';

const isResolvedProvider = (v: string): v is ResolvedProvider =>
  v === 'transformers' ||
  v === 'ollama' ||
  v === 'mock' ||
  v === 'anthropic' ||
  v === 'openai' ||
  v === 'openai-compatible';

export const resolveLMConfig = (): ResolvedLMConfig => {
  const rawProvider = (
    process.env.LM_PROVIDER ??
    process.env.SENARS_LM_PROVIDER ??
    'transformers'
  ).toLowerCase();
  if (!isResolvedProvider(rawProvider)) {
    throw new Error(
      `Invalid LM_PROVIDER=${process.env.LM_PROVIDER}. ` +
        `Must be one of: transformers, ollama, anthropic, openai, openai-compatible, mock.`
    );
  }

  const provider: ResolvedProvider = rawProvider;

  const model = (() => {
    const override = process.env.LM_MODEL ?? process.env.SENARS_LM_MODEL;
    switch (provider) {
      case 'ollama':
        return override ?? process.env.OLLAMA_MODEL ?? 'llama3.2';
      case 'transformers':
        return override ?? TRANSFORMERS_DEFAULT_MODEL;
      case 'anthropic':
        return override ?? 'claude-3-5-sonnet-latest';
      case 'openai':
        return override ?? 'gpt-4o-mini';
      case 'openai-compatible':
        return override ?? 'default';
      case 'mock':
        return 'mock';
    }
  })();

  const host =
    provider === 'ollama'
      ? (process.env.OLLAMA_HOST ?? OLLAMA_DEFAULT_HOST)
      : provider === 'openai-compatible'
        ? (process.env.LM_BASE_URL ?? '')
        : undefined;

  return { provider, model, host };
};

export const formatLMConfig = (cfg: ResolvedLMConfig): string => {
  const lines = [`provider: ${cfg.provider}`, `model:    ${cfg.model}`];
  if (cfg.host) lines.push(`host:     ${cfg.host}`);
  return lines.join('\n');
};
