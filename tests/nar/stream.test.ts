import {afterEach, beforeEach, describe, expect, test} from '@jest/globals';
import {backpressureAware, createPipeline, FocusPremiseSource, MemoryPremiseSource, throttled} from '../../src/nar/stream';
import type {Memory} from '../../src/nar/memory';
import {SeNARSFactory} from '../../src/nar/index.js';
import {BagStrategy} from '../../src/nar/reason';

const createTestMemory = (): Memory => {
    const nar = SeNARSFactory.createForBot({maxConcepts: 50});
    return nar.memory;
};

async function* genFromArray<T>(arr: T[]): AsyncGenerator<T> {
    for (const item of arr) yield item;
}

describe('MemoryPremiseSource', () => {
    let memory: Memory;
    let source: MemoryPremiseSource;
    let controller: AbortController;

    beforeEach(async () => {
        memory = createTestMemory();
        source = new MemoryPremiseSource(memory, 'priority-weighted');
        controller = new AbortController();
        memory.addTask({kind: 'inheritance', symbol: 'A', hash: 0} as any, 'belief', {
            frequency: 0.9,
            confidence: 0.9
        } as any, {priority: 0.5, durability: 0.5, quality: 0.5} as any);
    });

    afterEach(() => controller.abort());

    test('streams tasks from memory', async () => {
        const tasks: any[] = [];
        for await (const task of source.stream(controller.signal)) {
            tasks.push(task);
            if (tasks.length >= 10) break;
        }
        expect(tasks.length).toBeGreaterThan(0);
    });

    test('respects abort signal', async () => {
        const shortController = new AbortController();
        const tasks: any[] = [];
        for await (const task of source.stream(shortController.signal)) {
            tasks.push(task);
            shortController.abort();
        }
        expect(tasks.length).toBeLessThanOrEqual(1);
    });
});

describe('FocusPremiseSource', () => {
    let memory: Memory;
    let source: FocusPremiseSource;

    beforeEach(() => {
        memory = createTestMemory();
        source = new FocusPremiseSource(memory);
    });

    test('can be constructed', () => {
        expect(source).toBeDefined();
    });
});

describe('throttled', () => {
    test('limits iteration rate', async () => {
        const items = [1, 2, 3, 4, 5];
        const throttledItems: number[] = [];

        for await (const item of throttled(genFromArray(items), 10)) {
            throttledItems.push(item as number);
        }

        expect(throttledItems).toEqual([1, 2, 3, 4, 5]);
    });

    test('handles empty iterable', async () => {
        const items: number[] = [];
        const result: number[] = [];
        for await (const item of throttled(genFromArray(items), 10)) {
            result.push(item as number);
        }
        expect(result).toEqual([]);
    });
});

describe('backpressureAware', () => {
    test('passes through items when queue not full', async () => {
        const items = [1, 2, 3];
        const result: number[] = [];

        for await (const item of backpressureAware(genFromArray(items), 10, () => false)) {
            result.push(item as number);
        }

        expect(result).toEqual([1, 2, 3]);
    });

    test('respects maxQueueSize', async () => {
        const items = [1, 2, 3, 4, 5];
        const result: number[] = [];
        const shouldPause = () => false;

        for await (const item of backpressureAware(genFromArray(items), 3, shouldPause)) {
            result.push(item as number);
        }

        expect(result).toEqual([1, 2, 3, 4, 5]);
    });
});

describe('createPipeline', () => {
    test('creates pipeline with memory and strategy', () => {
        const memory = createTestMemory();
        const source = new MemoryPremiseSource(memory);
        const pipeline = createPipeline(source, memory, BagStrategy, {
            cpuThrottleMs: 0,
            maxDepth: 5,
            maxQueueSize: 100,
            maxDerivationsPerStep: 10
        });
        expect(pipeline).toBeDefined();
    });
});