import {createTimestamp} from '../types/core.js';
import type {Task} from '../types';
import {createBudget, createTask} from '../types';
import type {Memory} from '../memory';
import type {Strategy} from '../reason';

export type PremiseSource = AsyncGenerator<Task, void, void>;

export type PipelineConfig = Readonly<{
    cpuThrottleMs: number;
    maxDepth: number;
    maxQueueSize: number;
    maxDerivationsPerStep: number;
}>;

const DEFAULT_CONFIG: PipelineConfig = Object.freeze({
    cpuThrottleMs: 10,
    maxDepth: 10,
    maxQueueSize: 1000,
    maxDerivationsPerStep: 100
});

export abstract class PremiseSourceBase {
    abstract stream(signal?: AbortSignal): AsyncIterable<Task>;
}

export class MemoryPremiseSource extends PremiseSourceBase {
    constructor(
        private memory: Memory,
        private sampling: 'priority-weighted' | 'recency' | 'novelty' | 'fair' = 'priority-weighted'
    ) {
        super();
    }

    async* stream(signal?: AbortSignal): AsyncIterable<Task> {
        while (!signal?.aborted) {
            const concepts = this.memory.sample(100);
            for (const concept of concepts) {
                const topBelief = concept.beliefBag.peek();
                if (topBelief?.truth) {
                    yield createTask(
                        concept.term,
                        'belief',
                        topBelief.truth,
                        createBudget(concept.priority)
                    );
                }
            }
            await new Promise(r => setTimeout(r, 0));
        }
    }
}

export class FocusPremiseSource extends PremiseSourceBase {
    constructor(private memory: Memory) {
        super();
    }

    async* stream(signal?: AbortSignal): AsyncIterable<Task> {
        while (!signal?.aborted) {
            const concepts = this.memory.listConcepts().filter(c => c.priority > 0.7);
            for (const concept of concepts) {
                const topBelief = concept.beliefBag.peek();
                if (topBelief?.truth) {
                    yield createTask(
                        concept.term,
                        'belief',
                        topBelief.truth,
                        createBudget(concept.priority)
                    );
                }
            }
            await new Promise(r => setTimeout(r, 0));
        }
    }
}

export class CompositePremiseSource extends PremiseSourceBase {
    constructor(
        private sources: Array<{ source: PremiseSourceBase; weight: number }>
    ) {
        super();
    }

    async* stream(signal?: AbortSignal): AsyncGenerator<Task> {
        const iterators = this.sources.map(s => s.source.stream(signal));
        const tasks: Task[] = [];

        while (!signal?.aborted) {
            for await (const taskIter of iterators) {
                for await (const task of taskIter) {
                    tasks.push(task);
                }
            }

            if (tasks.length > 0) {
                yield tasks.shift()!;
            } else {
                await new Promise(r => setTimeout(r, 1));
            }
        }
    }
}

export async function* createPipeline(
    source: PremiseSource | PremiseSourceBase,
    memory: Memory,
    strategy: Strategy,
    config: PipelineConfig = DEFAULT_CONFIG,
    signal?: AbortSignal
): AsyncGenerator<Task> {
    let lastYield = Date.now();
    let queueSize = 0;
    let derivationsCount = 0;

    const stream = 'stream' in source && typeof source.stream === 'function'
        ? source.stream(signal)
        : source;

    for await (const task of stream as AsyncIterable<Task>) {
        if (signal?.aborted) break;
        if (Date.now() - lastYield > config.cpuThrottleMs) {
            await new Promise(r => setTimeout(r, 0));
            lastYield = Date.now();
        }

        if (queueSize > config.maxQueueSize) {
            await new Promise(r => setTimeout(r, 0));
            continue;
        }

        queueSize++;
        yield task;
        queueSize--;

        derivationsCount++;

        if (derivationsCount >= config.maxDerivationsPerStep) break;
    }
}

export async function* throttled<T>(
    gen: AsyncGenerator<T>,
    intervalMs: number,
    shouldStop?: () => boolean
): AsyncGenerator<T> {
    let lastYield = Date.now();

    for await (const value of gen) {
        if (shouldStop?.()) break;
        yield value;

        if (Date.now() - lastYield > intervalMs) {
            await new Promise(r => setTimeout(r, 0));
            lastYield = Date.now();
        }
    }
}

export async function* backpressureAware<T>(
    gen: AsyncGenerator<T>,
    maxQueueSize: number,
    shouldPause: () => boolean
): AsyncGenerator<T> {
    const buffer: T[] = [];
    let writing = false;

    async function* reader(): AsyncGenerator<T> {
        while (buffer.length > 0 || writing) {
            if (buffer.length === 0) {
                await new Promise(r => setTimeout(r, 1));
                continue;
            }
            yield buffer.shift()!;
        }
    }

    await (async () => {
        writing = true;
        for await (const value of gen) {
            while (buffer.length >= maxQueueSize && shouldPause()) {
                await new Promise(r => setTimeout(r, 1));
            }
            buffer.push(value);
        }
        writing = false;
    })();

    yield* reader();
}

export async function* derive(
    memory: Memory,
    strategy: Strategy,
    config: PipelineConfig = DEFAULT_CONFIG
): AsyncGenerator<Task> {
    let lastYield = Date.now();
    let count = 0;

    for (const concept of memory.sample(100)) {
        if (Date.now() - lastYield > config.cpuThrottleMs) {
            await new Promise(r => setTimeout(r, 0));
            lastYield = Date.now();
        }

        if (count >= config.maxDerivationsPerStep) break;

        const belief = concept.beliefBag.peek();
        if (!belief?.truth || !belief.stamp) continue;
        const task: Task = {
            term: concept.term,
            type: 'belief',
            truth: belief.truth,
            budget: {priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
            stamp: belief.stamp,
            occurrenceTime: createTimestamp(0),
            derived: false
        };

        for (const secondary of strategy.selectSecondary(task, memory)) {
            if (++count >= config.maxDerivationsPerStep) break;
            yield secondary;
        }
    }
}