import type {LMClient} from '../../src/nar/lm/types.js';
import {TransformersLMClient} from '../../src/nar/lm/transformers-client.js';

export type LMProvider = 'transformers' | 'ollama' | 'anthropic' | 'mock';

export function resolveProvider(): LMProvider {
    const env = (process.env.LM_PROVIDER ?? 'mock').toLowerCase();
    if (env === 'anthropic' || env === 'ollama' || env === 'transformers') return env;
    return 'mock';
}

export async function resolveTestLMClient(): Promise<LMClient> {
    const provider = resolveProvider();
    switch (provider) {
        case 'anthropic': {
            const {anthropic} = await import('@ai-sdk/anthropic');
            const key = process.env.ANTHROPIC_API_KEY;
            if (!key) throw new Error('ANTHROPIC_API_KEY required for anthropic provider');
            const model = process.env.LM_MODEL ?? 'claude-haiku-4-20240307';
            const aiModel = anthropic(model);
            return {
                provider: 'anthropic',
                model,
                available: true,
                async generateText(prompt: string) {
                    const {generateText} = await import('ai');
                    const result = await generateText({model: aiModel, prompt});
                    return result.text;
                },
            };
        }
        case 'ollama': {
            const {Ollama} = await import('ollama');
            const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
            const client = new Ollama({host});
            const model = process.env.OLLAMA_MODEL ?? 'llama3.2:3b';
            return {
                provider: 'ollama',
                model,
                available: true,
                async generateText(prompt: string) {
                    const res = await client.generate({model, prompt});
                    return res.response;
                },
            };
        }
        case 'transformers': {
            const client = new TransformersLMClient();
            await client.init();
            return client;
        }
        case 'mock':
        default: {
            const script: Record<string, string> = {
                '15 * 3': 'The answer is 45.',
                'say goodbye': 'Goodbye! Have a great day!',
                'what is my favorite color': 'Your favorite color is blue.',
                'favorite color': 'Your favorite color is blue.',
                'remember that': 'Got it, I will remember that.',
                '2+2': 'The answer is 4.',
                'all cats are animals': 'I have recorded the belief: all cats are animals.',
                'what did i just tell you about cats': 'You told me that all cats are animals.',
                'is a cat living': 'Based on the beliefs: cat is an animal, and animal is living, yes a cat is living.',
                'penguins do not fly': 'I have recorded that penguins do not fly.',
                'hello': 'Hello! How can I help you?',
                'hi': 'Hi there! Nice to meet you.',
                'goodbye': 'Goodbye! Have a great day!',
            };
            const entries = Object.entries(script);
            return {
                provider: 'mock',
                model: 'scripted',
                available: true,
                async generateText(prompt: string): Promise<string> {
                    const lower = prompt.toLowerCase();
                    for (const [key, value] of entries) {
                        if (lower.includes(key)) return value;
                    }
                    return 'I need more information to answer that.';
                },
            };
        }
    }
}

export function describeProvider(): string {
    const provider = resolveProvider();
    const model = process.env.LM_MODEL ?? process.env.OLLAMA_MODEL ?? 'default';
    return `${provider}:${model}`;
}
