import type {Task} from './types';
import type {Memory} from './memory';
import type {TaskManager} from './task';
import type {Reasoner} from './reason';
import {BagStrategy} from './reason';
import type {NARConfig} from './nar';
import type {RLFPLearner} from './rlfp';
import type {CognitiveController} from './cognitive/controller';
import type {DriveManager} from './drives/index.js';
import {createPipeline, MemoryPremiseSource} from './stream';
import {PhaseTimer} from './trace/index.js';
import {createLogger} from './logger/index.js';

export class NARExecution {
 private _cycleCount = 0;
 private readonly phaseTimer = new PhaseTimer();
 private readonly logger = createLogger({scope: 'nar:execution'});

 constructor(
   private readonly memory: Memory,
   private readonly taskManager: TaskManager,
   private readonly reasoner: Reasoner,
   private readonly config: NARConfig,
   private readonly rlfp?: RLFPLearner,
   private readonly cognitiveController?: CognitiveController,
   private readonly driveManager?: DriveManager
 ) {}

  async run(steps = 1, signal?: AbortSignal): Promise<number> {
    let derived = 0;
    this.phaseTimer.clear();

    for (let i = 0; i < steps; i++) {
      if (signal?.aborted) break;

      this._cycleCount++;
      this.phaseTimer.begin('cycle', `cycle-${this._cycleCount}`);

      this.phaseTimer.begin('task-manager', 'processPending');
      const processed = await this.taskManager.processPending();
      derived += processed.length;
      this.phaseTimer.end();

      // Update drive states before reasoning
      this.phaseTimer.begin('drives', 'update');
      this.driveManager?.updateCycle();
      this.phaseTimer.end();

      // Adaptation hook — allows CognitiveController to tune strategies at runtime
      this.cognitiveController?.adapt();

      this.phaseTimer.begin('reasoner', `step-${this._cycleCount}`);
      const results = this.cognitiveController
        ? await this.cognitiveController.getInferenceController().step(5000, 100, signal)
        : await this.reasoner.step(5000, 100, signal);
      derived += results.length;
      this.phaseTimer.end();

      this.phaseTimer.begin('memory', 'addTasks');
      results.forEach(task => this.memory.addTask(task.term, task.type, task.truth, task.budget, task.stamp));
      this.phaseTimer.end();

      // RLFP optimization handled by CognitiveController when present
      if (!this.cognitiveController && this.rlfp && this._cycleCount % (this.config.rlfp?.optimizeInterval ?? 100) === 0) {
        this.phaseTimer.begin('rlfp', 'optimize');
        this.rlfp.optimize();
        this.rlfp.updateModel([]);
        this.phaseTimer.end();
      }

      this.phaseTimer.end();
    }

    this.phaseTimer.begin('memory', 'consolidate');
    this.memory.consolidate({ cycleCount: this._cycleCount });
    this.phaseTimer.end();

    this.logger.info('run complete', {steps, cycles: this._cycleCount, derived});
    return derived;
  }

    getPhaseTimer(): PhaseTimer {
        return this.phaseTimer;
    }

    async* runStream(steps = 1, maxResults = 100, signal?: AbortSignal): AsyncGenerator<Task> {
        const source = new MemoryPremiseSource(this.memory, 'priority-weighted');
        const pipeline = createPipeline(source, this.memory, BagStrategy, {
            maxDepth: 10,
            maxQueueSize: 1000,
            maxDerivationsPerStep: maxResults,
            cpuThrottleMs: 10
        });

        let count = 0;
        for await (const task of pipeline) {
            if (signal?.aborted) break;
            yield task;
            this.taskManager.addTask(task);
            if (++count >= steps) break;
        }
    }

    getCycleCount(): number {
        return this._cycleCount;
    }
}
