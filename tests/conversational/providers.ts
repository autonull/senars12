import type {LanguageModel} from 'ai';
import {generateText, generateObject} from 'ai';
import type {ZodSchema} from 'zod';
import {createSeNARSRegistry, getModelForTask} from '../../src/nar/lm';
import {LMService} from '../../src/nar/lm';

export type LMProvider = 'transformers' | 'ollama' | 'mock';

export function resolveProvider(): LMProvider {
    const env = (process.env.LM_PROVIDER ?? 'mock').toLowerCase();
    if (env === 'ollama' || env === 'transformers') return env;
    return 'mock';
}

export function resolveTestLMService(): LMService {
    const registry = createSeNARSRegistry();
    return new LMService(registry);
}

export function describeProvider(): string {
    const provider = resolveProvider();
    const model = process.env.LM_MODEL ?? process.env.OLLAMA_MODEL ?? 'default';
    return `${provider}:${model}`;
}