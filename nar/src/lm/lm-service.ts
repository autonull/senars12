import type {
    LanguageModelV2,
    LanguageModelV2CallOptions,
    LanguageModelV2CallWarning,
    LanguageModelV2Content,
    LanguageModelV2FinishReason,
    LanguageModelV2StreamPart,
    LanguageModelV2Usage,
} from '@ai-sdk/provider';
import {generateObject, generateText, type LanguageModel, streamText, zodSchema} from 'ai';
import type {ZodSchema} from 'zod';
import type {SeNARSRegistry} from './providers.js';
import {createSeNARSRegistry} from './providers.js';

export type LMTask = 'quality' | 'fast' | 'structured';

export class LMService {
    private stats: LMExecutionStats = defaultStats();

    constructor(private registry: SeNARSRegistry) {
    }

    get provider(): string | undefined {
        const model = this.getModel('quality');
        return (model as { provider?: string })?.provider;
    }

    get model(): string | undefined {
        const model = this.getModel('quality');
        return (model as { modelId?: string })?.modelId;
    }

    get available(): boolean {
        return this.hasModel();
    }

    getModel(task: LMTask): LanguageModel | undefined {
        const provider = process.env.LM_PROVIDER ?? 'transformers';
        const mockChain = {
            quality: ['builtin:quality'],
            fast: ['builtin:fast'],
            structured: ['builtin:structured'],
        };
        const transformersChain = {
            quality: ['builtin:quality'],
            fast: ['builtin:fast'],
            structured: ['builtin:structured'],
        };
        const ollamaChain = {
            quality: ['local:quality', 'builtin:quality', 'builtin:compact', 'builtin:mock'],
            fast: ['local:fast', 'builtin:compact', 'builtin:mock'],
            structured: ['local:quality', 'builtin:compact', 'builtin:mock'],
        };
        const chain =
            provider === 'ollama' ? ollamaChain : provider === 'mock' ? mockChain : transformersChain;

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

    async generateText(
        prompt: string,
        opts?: {
            task?: LMTask;
            signal?: AbortSignal;
            temperature?: number;
            maxOutputTokens?: number;
        }
    ): Promise<string> {
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

    async generateObject<T>(
        prompt: string,
        schema: ZodSchema<T>,
        opts?: {
            task?: LMTask;
            signal?: AbortSignal;
        }
    ): Promise<T> {
        const model = this.getModel(opts?.task ?? 'structured');
        if (!model) throw new Error('No model available');

        const start = Date.now();
        try {
            const {object} = await generateObject({
                model,
                prompt,
                schema: zodSchema(schema),
                abortSignal: opts?.signal,
            });
            this.recordCall(true, start, prompt.length + JSON.stringify(object).length);
            return object;
        } catch (e) {
            this.recordCall(false, start, prompt.length);
            throw e;
        }
    }

    async* stream(
        prompt: string,
        opts?: {
            task?: LMTask;
            signal?: AbortSignal;
        }
    ): AsyncIterable<string> {
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

export interface LMExecutionStats {
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
    return {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalDuration: 0,
        totalTokens: 0,
        averageDuration: 0,
        successRate: 0,
        totalCost: 0,
        averageCost: 0,
    };
}

export function createLMService(): LMService {
    const registry = createSeNARSRegistry();
    return new LMService(registry);
}

export interface LMRuleStats {
    id: string;
    name: string;
    enabled: boolean;
    stats: LMExecutionStats;
    circuitState: 'closed' | 'open' | 'half-open';
}

export type LMRuleConfig = {
    id?: string;
    name?: string;
    description?: string;
    category?: string;
    priority?: number;
    enabled?: boolean;
    singlePremise?: boolean;
    promptTemplate?:
        | string
        | ((primary: any, secondary?: any, context?: Record<string, unknown>) => string);
    responseProcessor?: (
        response: unknown,
        primary: any,
        secondary?: any,
        context?: Record<string, unknown>
    ) => unknown;
    taskGenerator?: (
        processed: unknown,
        primary: any,
        secondary?: any,
        context?: Record<string, unknown>
    ) => unknown[];
    activationCondition?: (
        primary: any,
        secondary?: any,
        context?: Record<string, unknown>
    ) => boolean;
    lmOptions?: {
        temperature?: number;
        maxTokens?: number;
        signal?: AbortSignal;
    };
};

export type LMPromptGenerator = (
    primary: any,
    secondary?: any,
    context?: Record<string, unknown>
) => string;
export type LMResponseProcessor = (
    response: unknown,
    primary: any,
    secondary?: any,
    context?: Record<string, unknown>
) => unknown;
export type LMTaskGenerator = (
    processed: unknown,
    primary: any,
    secondary?: any,
    context?: Record<string, unknown>
) => unknown[];

export interface MockLMConfig {
    generateTextFn?: (prompt: string) => string | Promise<string>;
    generateObjectFn?: <T>(prompt: string, schema: ZodSchema<T>) => T | Promise<T>;
    available?: boolean;
    provider?: string;
    model?: string;
}

export function createMockLMService(config: MockLMConfig = {}): LMService {
    const {
        generateTextFn,
        generateObjectFn,
        available = true,
        provider = 'mock',
        model = 'mock',
    } = config;
    const service = new MockLMServiceImpl(
        generateTextFn,
        generateObjectFn,
        available,
        provider,
        model
    );
    return service as unknown as LMService;
}

class MockLMServiceImpl {
    private stats: LMExecutionStats = defaultStats();

    constructor(
        private readonly _generateTextFn?: (prompt: string) => string | Promise<string>,
        private readonly _generateObjectFn?: <T>(
            prompt: string,
            schema: ZodSchema<T>
        ) => T | Promise<T>,
        private readonly _available: boolean = true,
        private readonly _provider: string = 'mock',
        private readonly _model: string = 'mock'
    ) {
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

    getModel(_task: LMTask): LanguageModel | undefined {
        return {
            specificationVersion: 'v2',
            provider: this._provider,
            modelId: this._model,
            supportedUrls: {},
            doGenerate: async (options: any) => {
                const key = extractLastUserMessage(options.messages || options.prompt || []);
                const text = this._generateTextFn ? await this._generateTextFn(key) : 'Mock response';
                return {
                    content: [{type: 'text', text}],
                    finishReason: 'stop',
                    usage: {inputTokens: 0, outputTokens: text.length, totalTokens: text.length},
                    warnings: [],
                };
            },
            doStream: async (options: any) => {
                const key = extractLastUserMessage(options.messages || options.prompt || []);
                const text = this._generateTextFn ? await this._generateTextFn(key) : 'Mock response';
                const stream = new ReadableStream({
                    start(controller) {
                        controller.enqueue({type: 'text-delta', id: '0', delta: text});
                        controller.enqueue({
                            type: 'finish',
                            finishReason: 'stop',
                            usage: {inputTokens: 0, outputTokens: text.length, totalTokens: text.length},
                        });
                        controller.close();
                    },
                });
                return {stream};
            },
        } as unknown as LanguageModel;
    }

    hasModel(): boolean {
        return this._available;
    }

    getStats(): LMExecutionStats {
        return {...this.stats};
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
            const obj = this._generateObjectFn
                ? await this._generateObjectFn(_prompt, schema)
                : ({} as T);
            this.recordCall(true, start, JSON.stringify(obj).length);
            return obj;
        } catch (e) {
            this.recordCall(false, start, 0);
            throw e;
        }
    }

    async* stream(_prompt: string): AsyncIterable<string> {
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

export function createMockLanguageModel(
    generateTextFn?: (prompt: string) => string | Promise<string>
): LanguageModelV2 {
    return {
        specificationVersion: 'v2',
        provider: 'mock',
        modelId: 'mock',
        supportedUrls: {},
        async doGenerate(options: LanguageModelV2CallOptions): Promise<{
            content: LanguageModelV2Content[];
            finishReason: LanguageModelV2FinishReason;
            usage: LanguageModelV2Usage;
            warnings: LanguageModelV2CallWarning[];
        }> {
            const key = extractTextFromPrompt(options.prompt);
            let responseText = generateTextFn
                ? await generateTextFn(key)
                : `Mock response: ${key.slice(0, 50)}`;

            if (options.responseFormat?.type === 'json') {
                try {
                    responseText = JSON.stringify({result: 'mock', data: responseText.slice(0, 100)});
                } catch {
                    responseText = '{"result": "mock"}';
                }
            }

            return {
                content: [{type: 'text', text: responseText}],
                finishReason: 'stop',
                usage: {
                    inputTokens: 0,
                    outputTokens: responseText.length,
                    totalTokens: responseText.length,
                },
                warnings: [],
            };
        },
        async doStream(options: LanguageModelV2CallOptions): Promise<{
            stream: ReadableStream<LanguageModelV2StreamPart>;
        }> {
            const key = extractTextFromPrompt(options.prompt);
            const responseText = generateTextFn
                ? await generateTextFn(key)
                : `Mock response: ${key.slice(0, 50)}`;

            const stream = new ReadableStream<LanguageModelV2StreamPart>({
                start(controller) {
                    controller.enqueue({type: 'text-delta', id: '0', delta: responseText});
                    controller.enqueue({
                        type: 'finish',
                        finishReason: 'stop',
                        usage: {
                            inputTokens: 0,
                            outputTokens: responseText.length,
                            totalTokens: responseText.length,
                        },
                    });
                    controller.close();
                },
            });
            return {stream};
        },
    };
}

function extractTextFromPrompt(prompt: LanguageModelV2CallOptions['prompt']): string {
    return extractLastUserMessage(prompt ?? []);
}

function extractLastUserMessage(messages: Array<{ role?: string; content: unknown }>): string {
    if (!messages || messages.length === 0) return '';
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return '';
    const c = lastUser.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map((p: any) => (p.type === 'text' ? p.text : '')).join('');
    return '';
}
