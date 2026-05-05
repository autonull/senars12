import type { Task } from '../terms/index.js';

export type PremiseSource = AsyncGenerator<Task, void, void>;

export type PipelineConfig = Readonly<{
    cpuThrottleMs: number;
    maxDepth: number;
    maxQueueSize: number;
}>;

const DEFAULT_CONFIG: PipelineConfig = Object.freeze({
    cpuThrottleMs: 10,
    maxDepth: 10,
    maxQueueSize: 1000
});

export async function *createPipeline(
    source: PremiseSource,
    config: PipelineConfig = DEFAULT_CONFIG
): AsyncGenerator<Task> {
    let lastYield = Date.now();
    let queueSize = 0;

    for await (const task of source) {
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
    }
}

export async function *throttled<T>(
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

export async function *backpressureAware<T>(
    gen: AsyncGenerator<T>,
    maxQueueSize: number,
    shouldPause: () => boolean
): AsyncGenerator<T> {
    const buffer: T[] = [];
    let writing = false;

    async function *reader(): AsyncGenerator<T> {
        while (buffer.length > 0 || writing) {
            if (buffer.length === 0) {
                await new Promise(r => setTimeout(r, 1));
                continue;
            }
            yield buffer.shift()!;
        }
    }

    (async () => {
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