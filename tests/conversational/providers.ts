import type {LanguageModel} from 'ai';
import {generateText, generateObject} from 'ai';
import type {ZodSchema} from 'zod';
import {createSeNARSRegistry, getModelForTask} from '../../src/nar/lm';

export type LMProvider = 'transformers' | 'ollama' | 'mock';

export function resolveProvider(): LMProvider {
    const env = (process.env.LM_PROVIDER ?? 'mock').toLowerCase();
    if (env === 'ollama' || env === 'transformers') return env;
    return 'mock';
}

export function resolveTestLMService(): { generateText: (prompt: string) => Promise<string>, generateObject: <T>(prompt: string, schema: ZodSchema<T>) => Promise<T> } {
    const provider = resolveProvider();
    const registry = createSeNARSRegistry();
    const model = getModelForTask(registry, 'fast') as LanguageModel;

    return {
        async generateText(prompt: string) {
            if (!model) return 'No model available';
            const {text} = await generateText({model, prompt});
            return text;
        },
        async generateObject<T>(prompt: string, schema: ZodSchema<T>) {
            if (!model) throw new Error('No model available');
            const {object} = await generateObject({model, prompt, schema});
            return object;
        },
    };
}

export function describeProvider(): string {
    const provider = resolveProvider();
    const model = process.env.LM_MODEL ?? process.env.OLLAMA_MODEL ?? 'default';
    return `${provider}:${model}`;
}