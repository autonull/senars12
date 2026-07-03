import type { EventBus } from '../../agent/src';
import type { CognitiveController } from './cognitive';
import type { DriveManager } from './drives';
import { createLogger } from './logger';
import type { Memory } from './memory';
import type { NARConfig } from './nar';
import type { Reasoner } from './reason';
import { BagStrategy } from './reason';
import type { PolicyOptimizer, RLFPLearner } from './rlfp';
import type { ReasoningAboutReasoning } from './self';
import { MemoryPremiseSource, createPipeline } from './stream';
import type { TaskManager } from './task';
import { PhaseTimer } from './trace';
import type { Task } from './types';
import { errMsg } from './utils';

export class NARExecution {
  private _cycleCount = 0;
  private readonly phaseTimer = new PhaseTimer();
  private readonly logger = createLogger({ scope: 'nar:execution' });

  constructor(
    private readonly memory: Memory,
    private readonly taskManager: TaskManager,
    private readonly reasoner: Reasoner,
    private readonly config: NARConfig,
    private readonly rlfp?: RLFPLearner,
    private readonly policyOptimizer?: PolicyOptimizer,
    private readonly cognitiveController?: CognitiveController,
    private readonly driveManager?: DriveManager,
    private readonly systemEventBus?: EventBus,
    private readonly self?: ReasoningAboutReasoning
  ) {}

  async run(steps = 1, signal?: AbortSignal): Promise<number> {
    let derived = 0;
    this.phaseTimer.clear();

    // Check RLFP enablement via env var
    const rlfpEnabled = process.env.RLFP_ENABLED === 'true' && this.policyOptimizer;

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

      // RLFP-driven reasoning decisions
      let effectiveSteps = 1;
      let strategyPriority: string | null = null;

      if (rlfpEnabled && this.policyOptimizer) {
        // Select strategy priority based on learned policy
        strategyPriority = this.policyOptimizer.getBestStrategy();

        // Scale step count by exploration rate (high exploration = more steps)
        const explorationRate = this.policyOptimizer.getConfig().explorationRate ?? 0.1;
        effectiveSteps = Math.max(1, Math.round(1 + explorationRate * 4)); // 1-5 steps based on exploration
      }

      this.phaseTimer.begin('reasoner', `step-${this._cycleCount}`);
      const results = this.cognitiveController
        ? await this.cognitiveController.getInferenceController().step(5000, 100, signal)
        : await this.reasoner.step(5000, effectiveSteps * 100, signal);
      derived += results.length;
      this.phaseTimer.end();

      // Emit reasoning cycle event
      if (this.systemEventBus) {
        this.systemEventBus.emit('nar:reasoning:cycle', {
          cycle: this._cycleCount,
          derived: results.length,
          strategyPriority,
          effectiveSteps,
          timestamp: Date.now(),
        });
      }

      this.phaseTimer.begin('memory', 'addTasks');
      for (const task of results) {
        this.memory.addTask(task.term, task.type, task.truth, task.budget, task.stamp);
        // Emit derivation event for beliefs
        if (task.type === 'belief' && this.systemEventBus) {
          const confidence = task.truth?.c ?? 0;
          this.systemEventBus.emit('nar:derivation', {
            term: task.term.toString(),
            confidence,
            timestamp: Date.now(),
          });
        }
      }
      this.phaseTimer.end();

      // RLFP optimization handled by CognitiveController when present
      if (
        !this.cognitiveController &&
        this.rlfp &&
        this._cycleCount % (this.config.rlfp?.optimizeInterval ?? 100) === 0
      ) {
        this.phaseTimer.begin('rlfp', 'optimize');
        this.rlfp.optimize();
        this.rlfp.updateModel([]);
        this.phaseTimer.end();
      }

      // Self-monitoring: assess quality and trigger self-improvement if low
      if (this.self && this._cycleCount % 10 === 0) {
        this.phaseTimer.begin('self', 'assessQuality');
        try {
          const quality = await this.self.assessQuality();
          this.logger.debug('Self-assessment', {
            quality: quality.overall,
            cycle: this._cycleCount,
          });
          if (quality.overall < 0.4) {
            this.phaseTimer.begin('self', 'performSelfCorrection');
            await this.self.performSelfCorrection();
            this.phaseTimer.end();
          }
        } catch (e) {
          this.logger.warn('Self-assessment failed', { error: errMsg(e) });
        }
        this.phaseTimer.end();
      }

      this.phaseTimer.end();
    }

    this.phaseTimer.begin('memory', 'consolidate');
    this.memory.consolidate({ cycleCount: this._cycleCount });
    this.phaseTimer.end();

    this.logger.debug('run complete', { steps, cycles: this._cycleCount, derived });
    return derived;
  }

  getPhaseTimer(): PhaseTimer {
    return this.phaseTimer;
  }

  async *runStream(steps = 1, maxResults = 100, signal?: AbortSignal): AsyncGenerator<Task> {
    const source = new MemoryPremiseSource(this.memory, 'priority-weighted');
    const pipeline = createPipeline(source, this.memory, BagStrategy, {
      maxDepth: 10,
      maxQueueSize: 1000,
      maxDerivationsPerStep: maxResults,
      cpuThrottleMs: 10,
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
