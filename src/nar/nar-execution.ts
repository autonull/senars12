import type {Task} from './types';
import type {Memory} from './memory';
import type {TaskManager} from './task';
import type {Reasoner} from './reason';
import {BagStrategy} from './reason';
import type {NARConfig} from './nar';
import type {RLFPLearner} from './rlfp';
import {createPipeline, MemoryPremiseSource} from './stream';

export class NARExecution {
  private _cycleCount = 0;

  constructor(
    private readonly memory: Memory,
    private readonly taskManager: TaskManager,
    private readonly reasoner: Reasoner,
    private readonly config: NARConfig,
    private readonly rlfp?: RLFPLearner
  ) {}

  async run(steps = 1): Promise<number> {
    let derived = 0;

    for (let i = 0; i < steps; i++) {
      this._cycleCount++;
      const processed = await this.taskManager.processPending();
      derived += processed.length;

      const results = await this.reasoner.step();
      derived += results.length;

      for (const task of results) {
        this.memory.addTask(task.term, task.type, task.truth, task.budget);
        this.taskManager.addTask(task);
      }

      if (this.rlfp && this._cycleCount % (this.config.rlfp?.optimizeInterval ?? 100) === 0) {
        this.rlfp.optimize();
        this.rlfp.updateModel([]);
      }
    }

    this.memory.consolidate();
    return derived;
  }

  async* runStream(steps = 1, maxResults = 100): AsyncGenerator<Task> {
    const source = new MemoryPremiseSource(this.memory, 'priority-weighted');
    const pipeline = createPipeline(source, this.memory, BagStrategy, {
      maxDepth: 10,
      maxQueueSize: 1000,
      maxDerivationsPerStep: maxResults,
      cpuThrottleMs: 10
    });

    let count = 0;
    for await (const task of pipeline) {
      yield task;
      this.taskManager.addTask(task);
      if (++count >= steps) break;
    }
  }

  getCycleCount(): number {
    return this._cycleCount;
  }
}
