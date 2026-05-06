import type { Task } from '../task/task.js';
import type { Memory } from '../memory/memory.js';
import type { Strategy } from '../reason/strategy.js';
import { Stamp } from '../terms/stamp.js';

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

export async function *createPipeline(
  source: PremiseSource,
  memory: Memory,
  strategy: Strategy,
  config: PipelineConfig = DEFAULT_CONFIG
): AsyncGenerator<Task> {
  let lastYield = Date.now();
  let queueSize = 0;
  let derivationsCount = 0;

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

    derivationsCount++;

    if (derivationsCount >= config.maxDerivationsPerStep) break;
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

export async function *derive(
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
    const task: Task = {
      term: concept.term,
      type: 'belief',
      truth: belief?.truth ?? { f: 0.5, c: 0.9 },
      budget: { priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
      stamp: Stamp.createInput(),
      occurrenceTime: 0,
      derived: false
    };

    for (const secondary of strategy.selectSecondary(task, memory)) {
      if (++count >= config.maxDerivationsPerStep) break;
      yield secondary;
    }
  }
}