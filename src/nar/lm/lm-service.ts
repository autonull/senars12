import {generateText, generateObject, streamText, type LanguageModel} from 'ai';
import type {ZodSchema} from 'zod';
import {createSeNARSRegistry} from './providers.js';
import type {SeNARSRegistry} from './providers.js';

export type LMTask = 'quality' | 'fast' | 'structured';

export class LMService {
    private stats: LMExecutionStats = defaultStats();

    constructor(private registry: SeNARSRegistry) {}

    getModel(task: LMTask): LanguageModel | undefined {
        const provider = process.env.LM_PROVIDER ?? 'transformers';
        const mockChain = {quality: ['builtin:quality'], fast: ['builtin:fast'], structured: ['builtin:structured']};
        const transformersChain = {quality: ['builtin:quality'], fast: ['builtin:fast'], structured: ['builtin:structured']};
        const ollamaChain = {quality: ['local:quality', 'builtin:quality', 'builtin:compact', 'builtin:mock'], fast: ['local:fast', 'builtin:compact', 'builtin:mock'], structured: ['local:quality', 'builtin:compact', 'builtin:mock']};
        const chain = provider === 'ollama' ? ollamaChain : (provider === 'mock' ? mockChain : transformersChain);

        for (const id of chain[task as keyof typeof chain]) {
            try {
                return this.registry.languageModel(id as any);
            } catch {
                continue;
            }
        }
        return undefined;
    }

    hasModel(): boolean {
        return !!this.getModel('fast');
    }

    getStats(): LMExecutionStats {
        return {...this.stats};
    }

    get provider(): string | undefined {
        const model = this.getModel('quality');
        return (model as {provider?: string})?.provider;
    }

    get model(): string | undefined {
        const model = this.getModel('quality');
        return (model as {modelId?: string})?.modelId;
    }

    get available(): boolean {
        return this.hasModel();
    }

    async generateText(prompt: string, opts?: {
        task?: LMTask;
        signal?: AbortSignal;
        temperature?: number;
        maxOutputTokens?: number;
    }): Promise<string> {
        const model = this.getModel(opts?.task ?? 'fast');
        if (!model) throw new Error('No model available');

        const start = Date.now();
        try {
            const {text} = await generateText({
                model,
                prompt,
                abortSignal: opts?.signal,
                temperature: opts?.temperature,
                maxOutputTokens: opts?.maxOutputTokens,
            });
            this.recordCall(true, start, prompt.length + text.length);
            return text;
        } catch (e) {
            this.recordCall(false, start, prompt.length);
            throw e;
        }
    }

    async generateObject<T>(prompt: string, schema: ZodSchema<T>, opts?: {
        task?: LMTask;
        signal?: AbortSignal;
    }): Promise<T> {
        const model = this.getModel(opts?.task ?? 'structured');
        if (!model) throw new Error('No model available');

        const start = Date.now();
        try {
            const {object} = await generateObject({
                model,
                prompt,
                schema,
                abortSignal: opts?.signal,
            });
            this.recordCall(true, start, prompt.length + JSON.stringify(object).length);
            return object;
        } catch (e) {
            this.recordCall(false, start, prompt.length);
            throw e;
        }
    }

    async *stream(prompt: string, opts?: {
        task?: LMTask;
        signal?: AbortSignal;
    }): AsyncIterable<string> {
        const model = this.getModel(opts?.task ?? 'fast');
        if (!model) return;

        const result = streamText({
            model,
            prompt,
            abortSignal: opts?.signal,
        });
        for await (const chunk of result.textStream) {
            yield chunk;
        }
    }

    private recordCall(success: boolean, start: number, tokens: number): void {
        const duration = Date.now() - start;
        this.stats.totalCalls++;
        if (success) this.stats.successfulCalls++;
        else this.stats.failedCalls++;
        this.stats.totalDuration += duration;
        this.stats.totalTokens += tokens;
        this.stats.averageDuration = this.stats.totalDuration / this.stats.totalCalls;
        this.stats.successRate = this.stats.successfulCalls / this.stats.totalCalls;
    }
}

interface LMExecutionStats {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalDuration: number;
    totalTokens: number;
    averageDuration: number;
    successRate: number;
    totalCost: number;
    averageCost: number;
}

function defaultStats(): LMExecutionStats {
    return {totalCalls: 0, successfulCalls: 0, failedCalls: 0, totalDuration: 0, totalTokens: 0, averageDuration: 0, successRate: 0, totalCost: 0, averageCost: 0};
}

export function createLMService(): LMService {
    const registry = createSeNARSRegistry();
    return new LMService(registry);
}

export interface MockLMConfig {
    generateTextFn?: (prompt: string) => string | Promise<string>;
    generateObjectFn?: <T>(prompt: string, schema: ZodSchema<T>) => T | Promise<T>;
    available?: boolean;
    provider?: string;
    model?: string;
}

export function createMockLMService(config: MockLMConfig = {}): LMService {
    const {generateTextFn, generateObjectFn, available = true, provider = 'mock', model = 'mock'} = config;
    const service = new MockLMServiceImpl(generateTextFn, generateObjectFn, available, provider, model);
    return service as unknown as LMService;
}

class MockLMServiceImpl {
    private stats: LMExecutionStats = defaultStats();

    constructor(
        private readonly _generateTextFn?: (prompt: string) => string | Promise<string>,
        private readonly _generateObjectFn?: <T>(prompt: string, schema: ZodSchema<T>) => T | Promise<T>,
        private readonly _available: boolean = true,
        private readonly _provider: string = 'mock',
        private readonly _model: string = 'mock'
    ) {}

    getModel(_task: LMTask): LanguageModel | undefined {
        return {
            specificationVersion: 'v2',
            provider: this._provider,
            modelId: this._model,
            supportedUrls: {},
            doGenerate: async (options: any) => {
                const msgs = options.messages || options.prompt || [];
                const key = msgs.map((m: any) => {
                    const c = m.content;
                    if (typeof c === 'string') return c;
                    if (Array.isArray(c)) return c.map((p: any) => p.type === 'text' ? p.text : '').join('');
                    return '';
                }).join(' ');
                const text = this._generateTextFn ? await this._generateTextFn(key) : 'Mock response';
                return {
                    content: [{type: 'text', text}],
                    finishReason: 'stop',
                    usage: {inputTokens: 0, outputTokens: text.length, totalTokens: text.length},
                    warnings: [],
                };
            },
            doStream: async (options: any) => {
                const msgs = options.messages || options.prompt || [];
                const key = msgs.map((m: any) => {
                    const c = m.content;
                    if (typeof c === 'string') return c;
                    if (Array.isArray(c)) return c.map((p: any) => p.type === 'text' ? p.text : '').join('');
                    return '';
                }).join(' ');
                const text = this._generateTextFn ? await this._generateTextFn(key) : 'Mock response';
                const stream = new ReadableStream({
                    start(controller) {
                        controller.enqueue({type: 'text-delta', id: '0', delta: text});
                        controller.enqueue({type: 'finish', finishReason: 'stop', usage: {inputTokens: 0, outputTokens: text.length, totalTokens: text.length}});
                        controller.close();
                    }
                });
                return {stream};
            }
        } as unknown as LanguageModel;
    }

    hasModel(): boolean {
        return this._available;
    }

    getStats(): LMExecutionStats {
        return {...this.stats};
    }

    get provider(): string {
        return this._provider;
    }

    get model(): string {
        return this._model;
    }

    get available(): boolean {
        return this._available;
    }

    async generateText(prompt: string): Promise<string> {
        const start = Date.now();
        try {
            const text = this._generateTextFn ? await this._generateTextFn(prompt) : 'Mock response';
            this.recordCall(true, start, prompt.length + text.length);
            return text;
        } catch (e) {
            this.recordCall(false, start, prompt.length);
            throw e;
        }
    }

    async generateObject<T>(_prompt: string, schema: ZodSchema<T>): Promise<T> {
        const start = Date.now();
        try {
            const obj = this._generateObjectFn ? await this._generateObjectFn(_prompt, schema) : {} as T;
            this.recordCall(true, start, JSON.stringify(obj).length);
            return obj;
        } catch (e) {
            this.recordCall(false, start, 0);
            throw e;
        }
    }

    async *stream(_prompt: string): AsyncIterable<string> {
        yield '';
    }

    private recordCall(success: boolean, start: number, tokens: number): void {
        const duration = Date.now() - start;
        this.stats.totalCalls++;
        if (success) this.stats.successfulCalls++;
        else this.stats.failedCalls++;
        this.stats.totalDuration += duration;
        this.stats.totalTokens += tokens;
        this.stats.averageDuration = this.stats.totalDuration / this.stats.totalCalls;
        this.stats.successRate = this.stats.successfulCalls / this.stats.totalCalls;
    }
}