import {createLogger} from '../logger';

const logger = createLogger({scope: 'lm:env'});

export type ResolvedProvider = 'transformers' | 'ollama' | 'anthropic' | 'mock';

export interface ResolvedLMConfig {
    provider: ResolvedProvider;
    model: string;
    host?: string;
    apiKey?: string;
}

const OLLAMA_DEFAULT_HOST = 'http://localhost:11434';
const TRANSFORMERS_DEFAULT_MODEL = 'Xenova/gpt-2';
const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-20250514';

const isResolvedProvider = (v: string): v is ResolvedProvider =>
    v === 'transformers' || v === 'ollama' || v === 'anthropic' || v === 'mock';

export const resolveLMConfig = (): ResolvedLMConfig => {
    const rawProvider = (process.env.LM_PROVIDER ?? 'transformers').toLowerCase();
    if (!isResolvedProvider(rawProvider)) {
        throw new Error(
            `Invalid LM_PROVIDER=${process.env.LM_PROVIDER}. ` +
            `Must be one of: transformers, ollama, anthropic, mock.`
        );
    }

    const provider: ResolvedProvider = rawProvider;

    const model = (() => {
        switch (provider) {
            case 'ollama':
                return process.env.OLLAMA_MODEL ?? process.env.LM_MODEL ?? 'llama3.2';
            case 'anthropic':
                return process.env.LM_MODEL ?? ANTHROPIC_DEFAULT_MODEL;
            case 'transformers':
                return process.env.LM_MODEL ?? TRANSFORMERS_DEFAULT_MODEL;
            case 'mock':
                return 'mock';
        }
    })();

    const host = provider === 'ollama'
        ? (process.env.OLLAMA_HOST ?? OLLAMA_DEFAULT_HOST)
        : undefined;

    const apiKey = provider === 'anthropic'
        ? process.env.ANTHROPIC_API_KEY
        : undefined;

    if (provider === 'anthropic' && !apiKey) {
        logger.warn('LM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set; calls will fail');
    }

    return {provider, model, host, apiKey};
};

export const formatLMConfig = (cfg: ResolvedLMConfig): string => {
    const lines = [
        `provider: ${cfg.provider}`,
        `model:    ${cfg.model}`,
    ];
    if (cfg.host) lines.push(`host:     ${cfg.host}`);
    if (cfg.apiKey) lines.push(`apiKey:   ${cfg.apiKey.slice(0, 7)}...${cfg.apiKey.slice(-4)}`);
    else if (cfg.provider === 'anthropic') lines.push(`apiKey:   <not set>`);
    return lines.join('\n');
};
