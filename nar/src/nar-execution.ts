import type { CognitiveController } from './cognitive';
import type { DriveManager } from './drives';
import { createLogger } from './logger';
import type { Memory } from './memory';
import type { NARConfig } from './nar';
import type { Reasoner } from './reason';
import { BagStrategy } from './reason';
import type { PolicyOptimizer, RLFPLearner } from './rlfp';
import type { ReasoningAboutReasoning } from './self';
import { createPipeline, MemoryPremiseSource } from './stream';
import type { TaskManager } from './task';
import { PhaseTimer } from './trace';
import type { Task } from './types';
import type { EventBus as NarEventBus } from './types/events.js';
import { errMsg } from './utils';

/** Cognitive state summary for observability */
export interface CognitiveStateSummary {
  timestamp: string;
  active_drives: Record<string, number>;
  active_meta_goals: string[];
  pending_tool_executions: string[];
  aikr_pressure: 'low' | 'medium' | 'high';
  rlfp_reward_avg: number;
  meta_derivation_budget_used: string;
}

export class NARExecution {
  private _cycleCount = 0;
  private readonly phaseTimer = new PhaseTimer();
  private readonly logger = createLogger({ scope: 'nar:execution' });
  private _metaDerivationsThisStep = 0;
  private _metaDerivationDepth = 0;
  private _rlfpRewardHistory: number[] = [];

  constructor(
    private readonly memory: Memory,
    private readonly taskManager: TaskManager,
    private readonly reasoner: Reasoner,
    private readonly config: NARConfig,
    private readonly rlfp?: RLFPLearner,
    private readonly policyOptimizer?: PolicyOptimizer,
    private readonly cognitiveController?: CognitiveController,
    private readonly driveManager?: DriveManager,
    private readonly systemEventBus?: NarEventBus,
    private readonly self?: ReasoningAboutReasoning
  ) {}

  /** Stimulate drives based on events — homeostatic regulation */
  private stimulateDrives(event: string, data?: Record<string, unknown>): void {
    if (!this.driveManager) return;

    switch (event) {
      case 'test_failed':
        // On test failure → competence decays, triggers repair
        this.driveManager.stimulate('competence', -0.15);
        this.driveManager.stimulate('coherence', -0.1);
        break;
      case 'test_passed':
        // On successful test run → competence replenished
        this.driveManager.stimulate('competence', 0.1);
        this.driveManager.stimulate('curiosity', 0.05);
        break;
      case 'contradiction_detected':
        // On contradiction detected → coherence decays
        this.driveManager.stimulate('coherence', -0.2);
        this.driveManager.stimulate('curiosity', 0.1);
        break;
      case 'low_coverage':
        // On low coverage concept → curiosity stimulated
        this.driveManager.stimulate('curiosity', 0.15);
        break;
      case 'scenario_passed':
        // On scenario pass → curiosity replenished
        this.driveManager.stimulate('curiosity', 0.05);
        this.driveManager.stimulate('competence', 0.05);
        break;
      case 'schema_promoted':
        // Schema promotion replenishes coherence
        this.driveManager.stimulate('coherence', 0.1);
        break;
      case 'capability_added':
        // New capability added
        this.driveManager.stimulate('competence', 0.15);
        this.driveManager.stimulate('curiosity', 0.1);
        break;
      case 'knob_tuned':
        // Knob tuning
        this.driveManager.stimulate('competence', 0.1);
        break;
    }
  }

  /** Emit cognitive state summary for observability */
  private emitCognitiveStateSummary(): void {
    if (!this.systemEventBus) return;

    const driveStates = this.driveManager?.getAllStates() ?? [];
    const activeDrives: Record<string, number> = {};
    for (const ds of driveStates) {
      activeDrives[ds.spec.id] = ds.currentIntensity;
    }

    // Get active meta-goals (goals starting with ^)
    const goals = this.memory.getGoals?.() ?? [];
    const activeMetaGoals = goals
      .filter((g) => g.term.toString().startsWith('^'))
      .map((g) => g.term.toString())
      .slice(0, 10);

    // Calculate AIKR pressure
    const stats = this.memory.getStatistics?.();
    const memoryPressure = stats?.memoryPressure ?? 0;
    let aikrPressure: 'low' | 'medium' | 'high' = 'low';
    if (memoryPressure > 0.8) aikrPressure = 'high';
    else if (memoryPressure > 0.5) aikrPressure = 'medium';

    // Average RLFP reward
    const rlfpRewardAvg = this._rlfpRewardHistory.length > 0
      ? this._rlfpRewardHistory.reduce((a, b) => a + b, 0) / this._rlfpRewardHistory.length
      : 0;

    const summary: CognitiveStateSummary = {
      timestamp: new Date().toISOString(),
      active_drives: activeDrives,
      active_meta_goals: activeMetaGoals,
      pending_tool_executions: [], // Would be populated by tool execution tracking
      aikr_pressure: aikrPressure,
      rlfp_reward_avg: Math.round(rlfpRewardAvg * 100) / 100,
      meta_derivation_budget_used: `${this._metaDerivationsThisStep}/5`,
    };

    this.systemEventBus.emit('cognitive:state:summary', summary);
  }

  /** Record RLFP reward for averaging */
  recordRLFPReward(reward: number): void {
    this._rlfpRewardHistory.push(reward);
    if (this._rlfpRewardHistory.length > 100) {
      this._rlfpRewardHistory.shift();
    }
  }

  /** Track meta-derivation budget */
  trackMetaDerivation(depth: number): void {
    this._metaDerivationsThisStep++;
    this._metaDerivationDepth = Math.max(this._metaDerivationDepth, depth);
  }

  /** Reset per-step meta budget */
  resetMetaBudget(): void {
    this._metaDerivationsThisStep = 0;
    this._metaDerivationDepth = 0;
  }

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
      let testPassed = false;
      let testFailed = false;
      let contradictionDetected = false;
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
          // Detect test results and contradictions
          const termStr = task.term.toString();
          if (termStr.includes('test_passed') || termStr.includes('test.passed')) {
            testPassed = true;
          }
          if (termStr.includes('test_failed') || termStr.includes('test.failed')) {
            testFailed = true;
          }
          if (termStr.includes('contradiction') || termStr.includes('conflict')) {
            contradictionDetected = true;
          }
        }
      }
      this.phaseTimer.end();

      // Homeostatic drive stimulation based on events
      if (testPassed) this.stimulateDrives('test_passed');
      if (testFailed) this.stimulateDrives('test_failed');
      if (contradictionDetected) this.stimulateDrives('contradiction_detected');

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

      // Emit cognitive state summary every 10 cycles (observability)
      if (this._cycleCount % 10 === 0) {
        this.emitCognitiveStateSummary();
      }

      // Reset meta-derivation budget for next cycle
      this.resetMetaBudget();

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
