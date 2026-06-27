export type ResolvedProvider = 'transformers' | 'ollama' | 'mock';

export interface ResolvedLMConfig {
    provider: ResolvedProvider;
    model: string;
    host?: string;
}

const OLLAMA_DEFAULT_HOST = 'http://localhost:11434';
const TRANSFORMERS_DEFAULT_MODEL = 'HuggingFaceTB/SmolLM2-135M-Instruct';

const isResolvedProvider = (v: string): v is ResolvedProvider =>
    v === 'transformers' || v === 'ollama' || v === 'mock';

export const resolveLMConfig = (): ResolvedLMConfig => {
    const rawProvider = (process.env.LM_PROVIDER ?? 'transformers').toLowerCase();
    if (!isResolvedProvider(rawProvider)) {
        throw new Error(
            `Invalid LM_PROVIDER=${process.env.LM_PROVIDER}. ` +
            `Must be one of: transformers, ollama, mock.`
        );
    }

    const provider: ResolvedProvider = rawProvider;

    const model = (() => {
        switch (provider) {
            case 'ollama':
                return process.env.LM_MODEL ?? process.env.OLLAMA_MODEL ?? 'llama3.2';
            case 'transformers':
                return process.env.LM_MODEL ?? TRANSFORMERS_DEFAULT_MODEL;
            case 'mock':
                return 'mock';
        }
    })();

    const host = provider === 'ollama'
        ? (process.env.OLLAMA_HOST ?? OLLAMA_DEFAULT_HOST)
        : undefined;

    return {provider, model, host};
};

export const formatLMConfig = (cfg: ResolvedLMConfig): string => {
    const lines = [
        `provider: ${cfg.provider}`,
        `model:    ${cfg.model}`,
    ];
    if (cfg.host) lines.push(`host:     ${cfg.host}`);
    return lines.join('\n');
};