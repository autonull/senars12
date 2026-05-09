import type {Task, Term} from '../types';
import type {Memory} from '../memory';
import type {Strategy} from '../reason';
import {Truth} from '../terms';
import {createBudget, createTask} from '../types';
import type {Concept} from '../memory/concept.js';
import {throttleGenerator} from '../utils/throttle.js';



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

export const createBeliefTask = (concept: Concept) => {
    const topBelief = concept.beliefBag.peek();
    return createTask(
        concept.term,
        'belief',
        topBelief?.truth ?? Truth.NEUTRAL,
        createBudget(concept.priority)
    );
};

export type PremiseSource = AsyncIterable<Task> | AsyncGenerator<Task, void, unknown>;

export function createMemoryPremiseSource(memory: Memory): AsyncGenerator<Task, void, unknown> {
    return (async function* () {
        while (true) {
            const concepts = memory.sample(100);
            for (const concept of concepts) {
                yield createBeliefTask(concept);
            }
            await new Promise(r => setTimeout(r, 0));
        }
    })();
}

export function createFocusPremiseSource(memory: Memory): AsyncGenerator<Task, void, unknown> {
    return (async function* () {
        while (true) {
            const concepts = memory.listConcepts().filter(c => c.priority > 0.7);
            for (const concept of concepts) {
                yield createBeliefTask(concept);
            }
            await new Promise(r => setTimeout(r, 0));
        }
    })();
}

export function createCompositePremiseSource(sources: Array<{ source: any; weight: number }>): AsyncGenerator<Task, void, unknown> {
    return (async function* () {
        const iterators = sources.map(s => s.source);
        const tasks: Task[] = [];

        while (true) {
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
    })();
}

export async function* createPipeline(
    source: PremiseSource,
    memory: Memory,
    strategy: Strategy,
    config: PipelineConfig = DEFAULT_CONFIG
): AsyncGenerator<Task> {
    let queueSize = 0;
    let derivationsCount = 0;

    // Ensure we have an AsyncGenerator to feed the throttle helper
    const asAsyncGenerator = async function* (it: AsyncIterable<Task>): AsyncGenerator<Task, void, unknown> {
        for await (const v of it) yield v;
    };

    const streamGen: AsyncGenerator<Task, void, unknown> = 'next' in (source as any)
        ? (source as AsyncGenerator<Task, void, unknown>)
        : asAsyncGenerator(source as AsyncIterable<Task>);

    for await (const task of throttleGenerator(streamGen, config.cpuThrottleMs)) {
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
    for await (const value of throttleGenerator(gen, intervalMs)) {
        if (shouldStop?.()) break;
        yield value;
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
    let count = 0;

    async function* sampled() {
        for (const concept of memory.sample(100)) {
            yield concept;
        }
    }

    for await (const concept of throttleGenerator(sampled(), config.cpuThrottleMs)) {
        if (count >= config.maxDerivationsPerStep) break;

        const task = createBeliefTask(concept);

        for (const secondary of strategy.selectSecondary(task, memory)) {
            if (++count >= config.maxDerivationsPerStep) break;
            yield secondary;
        }
    }
}
