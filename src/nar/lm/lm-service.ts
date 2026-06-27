import {generateText, generateObject, streamText, type LanguageModel} from 'ai';
import type {ZodSchema} from 'zod';
import type {SeNARSRegistry} from './providers.js';
import {getModelForTask} from './providers.js';

export type LMTask = 'quality' | 'fast' | 'structured';

export class LMService {
    private stats: LMExecutionStats = defaultStats();

    constructor(private registry: SeNARSRegistry) {}

    getModel(task: LMTask): LanguageModel | undefined {
        return getModelForTask(this.registry, task);
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
    const {createSeNARSRegistry} = require('./providers.js');
    const registry = createSeNARSRegistry();
    return new LMService(registry);
}