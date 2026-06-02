/**
 * Transformers.js-backed `LMClient` implementation.
 *
 * Wraps `@browser-ai/transformers-js`'s V2 `LanguageModelV2` and exposes
 * the simple string-prompt `generateText` interface that the rest of the
 * SeNARS system speaks.
 *
 * Concurrency: at most one inference in flight at a time (`maxConcurrent=1`).
 * This protects the WASM runtime from contention; the queue is also bounded
 * by the inference timeout so a stuck call never blocks the agent forever.
 */

import type {LMClient, LMClientStats} from './types.js';
import {createLogger} from '../logger/index.js';

export const DEFAULT_TRANSFORMERS_MODEL = 'HuggingFaceTB/SmolLM2-135M-Instruct';

const logger = createLogger({scope: 'lm:transformers'});

export class TransformersLMClient implements LMClient {
    readonly provider = 'transformers';
    readonly model: string;
    available = true;
    private modelInstance?: {
        doGenerate(options: {
            prompt: Array<{role: string; content: Array<{type: 'text'; text: string}>}>;
            maxOutputTokens?: number;
            temperature?: number;
        }): Promise<{
            content?: Array<{type: 'text'; text: string}>;
        }>;
        createSessionWithProgress?: (cb: (p: {progress: number}) => void) => Promise<unknown>;
    };
    private initializing?: Promise<void>;
    private readonly queue: Array<() => void> = [];
    private running = 0;
    private readonly maxConcurrent = 1;
    private readonly inferenceTimeoutMs = 300_000;
    private consecutiveFailures = 0;
    private readonly maxConsecutiveFailures = 3;
    private stats: LMClientStats = {
        totalCalls: 0, successfulCalls: 0, failedCalls: 0, timeoutCount: 0,
        totalDuration: 0, averageDuration: 0, queueDepth: 0, queueHighWater: 0,
    };

    constructor(modelId: string = DEFAULT_TRANSFORMERS_MODEL) {
        this.model = modelId;
    }

    async init(): Promise<void> {
        await this.ensureInitialized();
    }

    getStats(): LMClientStats {
        return {...this.stats, queueDepth: this.queue.length};
    }

    async generateText(prompt: string, options?: {signal?: AbortSignal; maxTokens?: number; temperature?: number}): Promise<string> {
        if (!this.available) return '';
        const startTime = Date.now();
        this.stats.totalCalls++;

        try {
            await this.ensureInitialized();
            await this.acquire(options?.signal);
            if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
            if (!this.modelInstance) throw new Error('Transformers.js model not initialized');

            const result = await Promise.race([
                this.modelInstance.doGenerate({
                    prompt: [{role: 'user', content: [{type: 'text', text: prompt}]}],
                    maxOutputTokens: options?.maxTokens ?? 128,
                    temperature: options?.temperature ?? 0.7,
                }),
                this.timeoutPromise(this.inferenceTimeoutMs, options?.signal),
            ]);
            this.consecutiveFailures = 0;
            this.recordSuccess(Date.now() - startTime);
            return result.content?.[0]?.text ?? '';
        } catch (error) {
            const dur = Date.now() - startTime;
            const isTimeout = error instanceof Error && error.message.includes('timed out');
            const isAbort = (error as Error).name === 'AbortError';

            if (isTimeout || (!isAbort && error instanceof Error)) {
                this.consecutiveFailures++;
            }

            this.recordFailure(error as Error, dur);
            if (isAbort) throw error;

            if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
                this.available = false;
                const err = error as Error & {stack?: string};
                logger.error('generateText failed, LM unavailable after consecutive failures', err);
            }

            return '';
        } finally {
            this.release();
        }
    }

    private async acquire(signal?: AbortSignal): Promise<void> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (this.running < this.maxConcurrent) {
            this.running++;
            return;
        }
        this.stats.queueHighWater = Math.max(this.stats.queueHighWater, this.queue.length + 1);
        return new Promise<void>((resolve, reject) => {
            const onAbort = () => {
                const idx = this.queue.findIndex(r => r === inner);
                if (idx !== -1) this.queue.splice(idx, 1);
                reject(new DOMException('Aborted', 'AbortError'));
            };
            const inner = () => {
                signal?.removeEventListener('abort', onAbort);
                resolve();
            };
            if (signal) signal.aborted ? reject(new DOMException('Aborted', 'AbortError')) : signal.addEventListener('abort', onAbort, {once: true});
            this.queue.push(inner);
        });
    }

    private release(): void {
        this.queue.shift()?.();
        this.running--;
    }

    private timeoutPromise(ms: number, signal?: AbortSignal): Promise<never> {
        return new Promise<never>((_, reject) => {
            const timer = setTimeout(() => reject(new Error('Transformers.js call timed out')), ms);
            signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
            }, {once: true});
        });
    }

    private recordSuccess(dur: number): void {
        this.stats.successfulCalls++;
        this.stats.totalDuration += dur;
        this.stats.averageDuration = this.stats.totalDuration / this.stats.totalCalls;
    }

    private recordFailure(error: Error, dur: number): void {
        this.stats.totalDuration += dur;
        this.stats.averageDuration = this.stats.totalDuration / this.stats.totalCalls;
        if (error.name !== 'AbortError') this.stats.timeoutCount++;
        this.stats.failedCalls++;
    }

    private async ensureInitialized(): Promise<void> {
        if (this.modelInstance) return;
        if (this.initializing) return this.initializing;
        this.initializing = (async () => {
            try {
                const {transformersJS} = await import('@browser-ai/transformers-js');
                const model = transformersJS(this.model, {device: 'cpu'}) as TransformersLMClient['modelInstance'] & {
                    createSessionWithProgress?: (cb: (p: {progress: number}) => void) => Promise<unknown>;
                };
                logger.info('Loading Transformers.js model (may download weights on first run)...');
                await model.createSessionWithProgress?.((p: {progress: number}) => {
                    const pct = Math.round(p.progress * 100);
                    if (pct % 10 === 0) logger.info(`Model download: ${pct}%`);
                });
                this.modelInstance = model;
                logger.info('Transformers.js model ready');
            } catch (error) {
                this.available = false;
                logger.error('Failed to initialize Transformers.js', error as Error);
                throw error;
            } finally {
                this.initializing = undefined;
            }
        })();
        return this.initializing;
    }
}
