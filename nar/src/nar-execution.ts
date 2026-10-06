import { BoundedRing, createLogger, errMsg, indexBy, keyedBy, mean, rankBy, roundTo } from '@senars/util';
import { envBool } from '@senars/util/config';
import type { EventBus as NarEventBus } from '@senars/util/events';
import type { CognitiveController } from './cognitive';
import { ADMISSION_ORDER_CALL_SITE, EGRESS_VETO_CALL_SITE } from './decision/call-sites.js';
import type { DriveManager } from './drives';
import type { NARConfig } from './facade/config.js';
import { DECISION_DERIVATIONS_SCOPE } from './kernel/budget-scopes.js';
import { ControlBudgets } from './kernel/control-budgets.js';
import type { GateRegistry } from './kernel/GateRegistry.js';
import type { KernelBudgetGate } from './kernel/KernelBudgetGate.js';
import type { MemoryPorts } from './memory/ports/index.js';
import { askSafely, type DecisionPort } from './ports/index.js';
import { CycleTrace } from './proposal/cycle-trace.js';
import type { LMProposalProducer } from './proposal/lm-rule-producer.js';
import type { CycleStage, TraceRegion } from './proposal/stages.js';
import type { PolicyOptimizer, RLFPLearner } from './rlfp';
import {
  type RankableDerivation,
  type RankingOptions,
  rankDerivations,
} from './rules/impls/ranking.js';
import type { ReasoningAboutReasoning } from './self';
import type { TaskManager } from './task';
import { classifyTask, type TaskSignal } from './task';
import { isCompound, operationNameOf, type Term, TermSet, termParser } from './terms';
import { Truth } from './terms/impls/Truth.js';
import { type PhaseTimerSummary, summarizeRegions } from './trace';
import type { Task } from './types';
import { createTask } from './types';

/** Cognitive state summary for observability */
export interface CognitiveStateSummary {
  timestamp: string;
  active_drives: Record<string, number>;
  active_meta_goals: string[];
  pending_tool_executions: string[];
  aikr_pressure: 'unknown' | 'low' | 'medium' | 'high';
  rlfp_reward_avg: number;
}

/** Drive → meta-goal mapping for homeostatic self-operation injection. */
const META_GOAL_BY_DRIVE: Record<string, { threshold: number; narsese: string }> = {
  competence: {
    threshold: 0.3,
    narsese: 'switch_strategy((focused-->strategy),(derivation-->strategyType))',
  },
  curiosity: { threshold: 0.3, narsese: 'run_scenario_shadow((induction-->profile))' },
};

const logger = createLogger({ scope: 'nar:execution' });

/**
 * The meta-goal table's parsed form. The narsese is a literal, so the parse is a
 * constant too: doing it per cycle re-parsed two unchanging strings and
 * re-emitted the same failure every cycle when one was malformed.
 *
 * A literal that does not parse throws, and it used to warn and drop the drive.
 * That hid this retirement completely: the two literals stopped parsing, both
 * drives vanished, and every test below still passed — a filter that matches
 * nothing and a filter that was removed look identical from the outside. A
 * literal in this file is a constant, so it is either right or a build break.
 */
const META_GOALS: readonly { driveId: string; threshold: number; term: Term }[] = Object.entries(
  META_GOAL_BY_DRIVE
).map(([driveId, goal]) => ({
  driveId,
  threshold: goal.threshold,
  term: termParser.parse(goal.narsese),
}));

const META_GOAL_BY_DRIVE_ID = indexBy(META_GOALS, (g) => g.driveId);

export interface NARExecutionOptions {
  memory: MemoryPorts;
  taskManager: TaskManager;
  config: NARConfig;
  rlfp?: RLFPLearner;
  policyOptimizer?: PolicyOptimizer;
  cognitiveController: CognitiveController;
  driveManager?: DriveManager;
  systemEventBus?: NarEventBus;
  self?: ReasoningAboutReasoning;
  toolGoalExecutor?: (goalTerm: Task['term']) => Promise<unknown>;
  gates: GateRegistry;
  /**
   * TODO29.a §5.7: the declared control budgets, re-opened at the top of every
   * cycle. Absent ⇒ the declared defaults over the same gate, which is what a
   * NAR built without a composition root gets.
   */
  budgets?: ControlBudgets;
  /** Absent in the no-producer configuration: the cycle then stages nothing. */
  proposals?: LMProposalProducer;
  /**
   * TODO29.a §5.11, A11: the decision layer, reached from the cycle. **Optional
   * per call site** — a NAR built without one takes its own declared path, which
   * is the four-configuration matrix in miniature.
   *
   * Read from `config` when not given, so binding a port is a configuration
   * change rather than a wiring change: `nar.ts` is under a monolith budget that
   * exists to keep composition out of the facade, and a port that has to be
   * threaded through the constructor is a line of that budget spent on nothing.
   */
  decision?: DecisionPort;
  /** Optional callback invoked at the end of each cycle for learning consolidation (Phase C REFACTOR.todo1). */
  onCycleEnd?: (cycleCount: number, config: NARConfig) => Promise<void>;
}

export class NARExecution {
  private _cycleCount = 0;
  private readonly cycleTrace = new CycleTrace();
  private readonly cycleSignals = {
    testPassed: false,
    testFailed: false,
    contradictionDetected: false,
  };
  private readonly _rlfpRewardHistory = new BoundedRing<number>(100);

  constructor(options: NARExecutionOptions) {
    this.memory = options.memory;
    this.taskManager = options.taskManager;
    this.config = options.config;
    this.rlfp = options.rlfp;
    this.policyOptimizer = options.policyOptimizer;
    this.cognitiveController = options.cognitiveController;
    this.driveManager = options.driveManager;
    this.systemEventBus = options.systemEventBus;
    this.self = options.self;
    this.toolGoalExecutor = options.toolGoalExecutor;
    this.gates = options.gates;
    this.budgets =
      options.budgets ?? new ControlBudgets(options.gates.getBudgetGate() as KernelBudgetGate);
    this.proposals = options.proposals;
    this.decision = options.decision ?? options.config.decision;
    this.onCycleEnd = options.onCycleEnd;
  }

  private readonly memory: MemoryPorts;
  private readonly taskManager: TaskManager;
  private readonly config: NARConfig;
  private readonly rlfp?: RLFPLearner;
  private readonly policyOptimizer?: PolicyOptimizer;
  private readonly cognitiveController: CognitiveController;
  private readonly driveManager?: DriveManager;
  private readonly systemEventBus?: NarEventBus;
  private readonly self?: ReasoningAboutReasoning;
  private readonly toolGoalExecutor?: (goalTerm: Task['term']) => Promise<unknown>;
  private readonly gates: GateRegistry;
  private readonly budgets: ControlBudgets;
  private readonly proposals?: LMProposalProducer;
  private readonly decision?: DecisionPort;
  private readonly onCycleEnd?: (cycleCount: number, config: NARConfig) => Promise<void>;

  /** Stimulate drives based on events — homeostatic regulation. Public so tool layer can report outcomes. */
  stimulateDrives(event: string, _data?: Record<string, unknown>): void {
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

  /** Record RLFP reward for averaging and pass to learner */
  recordRLFPReward(reward: number, context?: string): void {
    this._rlfpRewardHistory.push(reward);
    this.rlfp?.reward(reward, context);
  }

  /**
   * `correlationId` names the stimulus that drove the run; every traced region and
   * every gate decision the run makes joins on it, which is what makes "which cycle
   * admitted this belief, for which utterance" answerable.
   */
  async run(steps = 1, signal?: AbortSignal, correlationId?: string): Promise<number> {
    let derived = 0;
    this.cycleTrace.setCorrelationId(correlationId);

    // Check RLFP enablement via env var
    const rlfpEnabled = envBool('RLFP_ENABLED') && this.policyOptimizer;

    for (let i = 0; i < steps; i++) {
      if (signal?.aborted) break;

      this._cycleCount++;
      await this.region('cycle', async () => {
        // Four of the five declared scopes are per cycle, so they are re-opened
        // here rather than left to exhaust once over the NAR's life (§5.7).
        this.budgets.beginCycle();
        this.cycleSignals.testPassed = false;
        this.cycleSignals.testFailed = false;
        this.cycleSignals.contradictionDetected = false;

        await this.stage('perceive', async () => {
          // Dispatch pending `tool(...)` goals to the tool layer (goal→tool wiring).
          // Must run before processPending so tool goals are executed rather than
          // being added to memory as plain goals.
          await this.dispatchToolGoals();
          const processed = await this.taskManager.processPending();
          derived += processed.length;
        });

        await this.stage('attend', async () => {
          // Update drive states before reasoning
          this.driveManager?.updateCycle();
          // Inject meta-goals from drive homeostasis (e.g. competence < threshold)
          this.injectMetaGoals();
          // Adaptation hook — allows CognitiveController to tune strategies at runtime
          this.cognitiveController.adapt();
        });

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

        const results = await this.stage('reason', () =>
          this.cognitiveController.getInferenceController().step(5000, effectiveSteps * 100, signal)
        );
        derived += results.length;

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

        // The one stage through which anything reaches state. Model-backed
        // proposals settled by a previous pump land here too, so a producer's work
        // is admitted at a declared boundary and by the same gate as a derivation.
        await this.stage('authorize', async () => {
          const ranking = this.cognitiveController.getParams().inference.ranking;
          const settled = this.proposals?.takeDerived() ?? [];
          // `proposal-application` is a declared scope, so a spent budget and a full
          // queue are the same kind of event with the same kind of reason (§5.7).
          // Symbolic derivations are not charged here: only what arrived from the seam.
          for (const task of await this.rankForAdmission(await this.vetoAtEgress(results), ranking))
            this.admit(task);
          // `proposal-application` is a declared scope, so a spent budget and a
          // full queue become the same kind of event with the same kind of reason
          // (§5.7). Symbolic derivations are not charged: only what the seam sent.
          for (const task of settled) {
            if (!this.budgets.charge('proposal-application')) {
              logger.warn('Proposal application budget exhausted; the rest stay queued');
              break;
            }
            this.admit(task);
          }
        });

        // Homeostatic drive stimulation based on events
        if (this.cycleSignals.testPassed) this.stimulateDrives('test_passed');
        if (this.cycleSignals.testFailed) this.stimulateDrives('test_failed');
        if (this.cycleSignals.contradictionDetected) this.stimulateDrives('contradiction_detected');

        await this.stage('propose', async () => {
          this.pumpProposals(signal);
        });

        await this.stage('learn', async () => {
          const rlfp = this.rlfp;
          if (
            rlfp &&
            this._cycleCount %
              (rlfp.optimizeInterval ?? this.config.rlfp?.optimizeInterval ?? 100) ===
              0
          ) {
            await this.region('rlfp.optimize', () => {
              rlfp.optimize();
              rlfp.updateModel([]);
            });
          }

          // Self-monitoring: assess quality and trigger self-improvement if low
          const self = this.self;
          if (self && this._cycleCount % 10 === 0) {
            await this.region('self.assess', async () => {
              try {
                const quality = await self.assessQuality();
                logger.debug('Self-assessment', {
                  quality: quality.overall,
                  cycle: this._cycleCount,
                });
                if (quality.overall < 0.4) {
                  await this.region('self.correct', () => self.performSelfCorrection());
                }
              } catch (e) {
                logger.warn('Self-assessment failed', { error: errMsg(e) });
              }
            });
          }

          // Emit cognitive state summary every 10 cycles (observability)
          if (this._cycleCount % 10 === 0) {
            this.emitCognitiveStateSummary();
          }
        });

        // Structured meta-reasoning log: drive stimuli, meta-goal fires
        logger.debug('meta-reasoning', {
          cycle: this._cycleCount,
          driveStates: this.driveManager
            ? keyedBy(
                this.driveManager.getAllStates(),
                (ds) => ds.spec.id,
                (ds) => ds.currentIntensity
              )
            : undefined,
        });

        // Phase C (REFACTOR.todo1): learning consolidation at end of cycle
        if (this.onCycleEnd) {
          await this.onCycleEnd(this._cycleCount, this.config);
        }
      });
    }

    this.region('memory.consolidate', () =>
      this.memory.consolidate({ cycleCount: this._cycleCount })
    );

    logger.debug('run complete', { steps, cycles: this._cycleCount, derived });
    return derived;
  }

  /**
   * Run `work` inside a named stage of the current cycle. Timing is a projection
   * over this trace, so one record is the correctness record and the measurement.
   */
  private async stage<T>(stage: CycleStage, work: () => Promise<T> | T): Promise<T> {
    return this.region(stage, work);
  }

  /** Open a trace region around `work`, closing it even if the work throws. */
  private async region<T>(region: TraceRegion, work: () => Promise<T> | T): Promise<T> {
    const cycle = this._cycleCount;
    this.cycleTrace.begin(cycle, region);
    try {
      return await work();
    } finally {
      this.cycleTrace.end(cycle, region);
    }
  }

  /** The one path from a cycle's work into memory, and it goes through the gate. */
  private admit(task: Task): void {
    const result = this.gates
      .getPerceptionGate()
      .admitTask(task.term, task.type, task.truth, 'derivation', task.stamp.id);

    // Unreachable while `decideAdmission` always admits: the gate is an ingress
    // filter, and on the tick's write path it is an event emitter with source
    // calibration. Kept because a future refusal policy (TODO33 P3.9) has exactly
    // one place to land — and a branch that is never taken must say why.
    if (!result.admitted) {
      logger.warn('Perception gate rejected derived task', {
        reason: result.rejectionReason,
        term: task.term.toString(),
      });
      return;
    }

    this.memory.addTask(task.term, task.type, task.truth, task.budget, task.stamp);
    if (task.type !== 'belief' || !this.systemEventBus) return;

    this.systemEventBus.emit('nar:derivation', {
      term: task.term.toString(),
      confidence: task.truth?.c ?? 0,
      timestamp: Date.now(),
    });
    for (const signal of classifyTask(task.term)) {
      switch (signal) {
        case 'test-passed':
          this.cycleSignals.testPassed = true;
          break;
        case 'test-failed':
          this.cycleSignals.testFailed = true;
          break;
        case 'contradiction':
          this.cycleSignals.contradictionDetected = true;
          // Phase C (REFACTOR.todo3 §10a M5): typed event alongside the drive
          // stimulation — SelfMetaGame subscribes for resolution intake.
          this.systemEventBus.emit('contradiction', {
            source: 'nal',
            term: task.term,
            mettaVote: false,
            nalVote: true,
            at: Date.now(),
          });
          break;
        // Other signals (schema-promoted, capability-added, goal-achieved, goal-failed)
        // are classified but not yet acted upon; they can drive future homeostatic responses.
      }
    }
  }

  /**
   * Kick the off-cycle proposal pass. Deliberately not awaited: a cycle's
   * progress may not depend on a provider, and every await inside the pump is
   * bounded — the error is logged and the cycle continues either way.
   */
  /**
   * The one stage that may consult a decision, and it is consulted for **order,
   * not for admission**. `rankDerivations` truncates to `ranking.maxAdmissions`,
   * so a decision that reorders the candidates changes which of them fit through
   * a truncation the configuration already declared — it does not create an
   * admission the symbolic ranking would have refused.
   *
   * Everything §5.11 requires of a bound port, in the order the code does it:
   * absence, refusal, timeout, breaker-open and out-of-domain all arrive as *no
   * decision* and fall through to the symbolic order, and every task either way
   * still goes through {@link admit} — the same gate — so the port cannot bypass
   * admission. It is `epistemic`, so a `Truth` conclusion stays confined to
   * `Truth` through that gate rather than being written here.
   *
   * `SynthesisQuery` is not reachable from here: `position: 'cycle'` is excluded
   * for it in `CycleDecisionRequest`, so `P` cannot be asked from a cycle stage at
   * all. The exclusion is in the type, not in a comment.
   */
  private async rankForAdmission<T extends RankableDerivation>(
    results: T[],
    ranking: RankingOptions | undefined
  ): Promise<T[]> {
    const ranked = rankDerivations(results, ranking);
    if (!this.decision || ranked.length === 0) return ranked;

    const answer = await askSafely(
      this.decision,
      {
        kind: 'classify',
        instruction: 'Which of these conclusions should be admitted first?',
        space: ranked.map((task) => task.term.toString()),
        axis: 'epistemic',
        budget: DECISION_DERIVATIONS_SCOPE,
        position: 'cycle',
      },
      ADMISSION_ORDER_CALL_SITE.timeoutMs
    );
    if (answer?.kind !== 'classify' || answer.abstained) return ranked;

    // Restricted to the terms the decision was shown and the symbolic ranking
    // already admitted, so an invented option cannot widen the set — only the
    // order of the set that was on offer.
    const weight = indexBy(answer.distribution, ({ option }) => option, ({ p }) => p);
    return rankBy(ranked, (task) => weight.get(task.term.toString()) ?? 0);
  }

  /**
   * TODO32 M2: egress judging — opt-in, bounded, and a **veto**, not an order.
   *
   * Three properties, and each is load-bearing:
   *
   * - **It only ever removes.** The candidates are the same ones
   *   `rankDerivations` is about to select, so a veto can shrink what is
   *   committed and never widen it. TODO30 §7's invariant — optimization may
   *   never change *what counts as* committed state — holds by construction
   *   rather than by review. It runs *before* ranking so that a vetoed
   *   candidate never consumes an admission slot it would not have taken.
   * - **It is not a second admission path.** Survivors go through {@link admit},
   *   the same gate, the same event. There is no other route into memory.
   * - **Absence means no veto, and is recorded.** This is deliberately the
   *   opposite of ingress, which fails *closed*. The baselines differ: ingress
   *   would otherwise let an injection through unjudged, whereas here the
   *   baseline is the symbolic ranking that already ran, so a dead judge costs
   *   the extra safety net and nothing else. Failing closed would halt cognition
   *   on a provider fault — the one thing a bounded runtime may not do — so a
   *   fault, an abstention and a timeout all return the candidate unchanged and
   *   log, because a silently dropped veto is the failure mode worth avoiding.
   */
  private async vetoAtEgress<T extends RankableDerivation>(candidates: T[]): Promise<T[]> {
    const egress = this.config.systemOne?.egressJudging;
    if (!egress?.enabled || !this.decision || candidates.length === 0) return candidates;

    // Bounded on purpose: an evaluate head judges one embedding, so this is one
    // embedding per candidate. Unbounded, cognition's cost would track
    // `ranking.maxAdmissions` instead of the configuration that declared it.
    const judged = candidates.slice(0, egress.maxCandidates);
    const scores = await Promise.all(
      judged.map((task) =>
        askSafely(
          this.decision,
          {
            kind: 'evaluate',
            instruction:
              'Does this conclusion contradict what is already committed? Score 0 for support, 1 for strong conflict.',
            rubric: egress.rubric,
            axis: 'epistemic',
            target: task.term.toString(),
            budget: EGRESS_VETO_CALL_SITE.budget,
            position: EGRESS_VETO_CALL_SITE.position,
          },
          EGRESS_VETO_CALL_SITE.timeoutMs
        )
      )
    );

    const vetoed = new Set<T>();
    for (const [index, task] of judged.entries()) {
      const verdict = scores[index];
      // null, abstained, or a different query kind all read the same way: the
      // judgment did not arrive, so this candidate is not vetoed.
      if (verdict?.kind !== 'evaluate' || verdict.abstained) continue;
      if (verdict.score < egress.vetoThreshold) continue;
      vetoed.add(task);
      logger.warn('Egress judging vetoed a derived conclusion', {
        term: task.term.toString(),
        score: verdict.score,
        threshold: egress.vetoThreshold,
      });
    }

    return vetoed.size === 0 ? candidates : candidates.filter((task) => !vetoed.has(task));
  }

  private pumpProposals(signal?: AbortSignal): void {
    this.proposals
      ?.pump(signal)
      .catch((error: unknown) => logger.warn('Proposal pump failed', { error: errMsg(error) }));
  }

  /** Resolves when no producer work is in flight — for the callers allowed to wait. */
  settleProposals(): Promise<void> {
    return this.proposals?.whenSettled() ?? Promise.resolve();
  }

  /** The live cycle's stage record; the trace A1's acceptance reads. */
  getCycleTrace(): CycleTrace {
    return this.cycleTrace;
  }

  /** Timing as a projection over the live trace — the same record, read as spans. */
  getPhaseSummary(): PhaseTimerSummary {
    return summarizeRegions(this.cycleTrace.regions());
  }

  /**
   * Streaming derivation, through the one inference path. The strategies come
   * from the configured slots like every other entry point; the previous
   * `stream/pipeline` was a parallel engine that sampled memory directly and
   * ignored them.
   */
  async *runStream(
    steps = 1,
    maxResults = 100,
    signal?: AbortSignal,
    correlationId?: string
  ): AsyncGenerator<Task> {
    this.cycleTrace.setCorrelationId(correlationId);
    const inference = this.cognitiveController.getInferenceController();
    let count = 0;
    for await (const task of inference.run(maxResults, signal)) {
      if (signal?.aborted) break;
      yield task;
      this.taskManager.addTask(task);
      if (++count >= steps) break;
    }
  }

  getCycleCount(): number {
    return this._cycleCount;
  }

  /** Emit cognitive state summary for observability */
  private emitCognitiveStateSummary(): void {
    if (!this.systemEventBus) return;

    const driveStates = this.driveManager?.getAllStates() ?? [];
    const activeDrives: Record<string, number> = {};
    for (const ds of driveStates) {
      activeDrives[ds.spec.id] = ds.currentIntensity;
    }

    // Both of the population-sized reads in the cycle are `control-work` (A7):
    // observability that costs O(N) is control work and is bounded like it.
    const goals = this.budgets.charge('control-work') ? (this.memory.getGoals?.() ?? []) : [];
    const activeMetaGoals = goals
      .filter((g) => operationNameOf(g.term) !== undefined)
      .map((g) => g.term.toString())
      .slice(0, 10);

    // Calculate AIKR pressure
    const stats = this.budgets.charge('control-work') ? this.memory.getStatistics?.() : undefined;
    // An exhausted `control-work` budget means *unmeasured*, and "no pressure" and
    // "no measurement" are different answers — reporting 'low' for both makes a
    // bounded system look healthy precisely when it is going blind.
    const memoryPressure = stats?.memoryPressure;
    let aikrPressure: CognitiveStateSummary['aikr_pressure'] = 'unknown';
    if (memoryPressure !== undefined) {
      aikrPressure = memoryPressure > 0.8 ? 'high' : memoryPressure > 0.5 ? 'medium' : 'low';
    }

    // Average RLFP reward
    const rlfpRewardAvg = mean(this._rlfpRewardHistory);

    const summary: CognitiveStateSummary = {
      timestamp: new Date().toISOString(),
      active_drives: activeDrives,
      active_meta_goals: activeMetaGoals,
      pending_tool_executions: [], // Would be populated by tool execution tracking
      aikr_pressure: aikrPressure,
      rlfp_reward_avg: roundTo(rlfpRewardAvg),
    };

    this.systemEventBus.emit('cognitive:state:summary', summary);
  }

  /**
   * Inject meta-goals driven by homeostatic drive state.
   * When a drive falls below its threshold, the corresponding self-operation
   * goal is injected so the tool layer can act (e.g. switch strategy, run scenarios).
   */
  private injectMetaGoals(): void {
    if (!this.driveManager) return;

    const activeTerms = new TermSet();
    // De-duplicating against every goal is control work (A7) — and the only
    // reason to skip it is an exhausted budget, not a missing method.
    if (this.budgets.charge('control-work'))
      for (const goal of this.memory.getGoals?.() ?? []) activeTerms.add(goal.term);
    // Include pending tasks so we don't re-inject the same goal across cycles
    const peeked = this.taskManager.peekTask();
    if (peeked) {
      activeTerms.add(peeked.term);
    }

    for (const state of this.driveManager.getAllStates()) {
      const goal = META_GOAL_BY_DRIVE_ID.get(state.spec.id);
      if (!goal) continue;

      if (state.currentIntensity >= goal.threshold || activeTerms.has(goal.term)) continue;

      this.taskManager.addTask(createTask(goal.term, 'goal', Truth.NEUTRAL));
      logger.debug('Injected meta-goal from drive', {
        drive: state.spec.id,
        intensity: state.currentIntensity,
        goal: goal.term.toString(),
      });
    }
  }

  /** A tool goal is an `operation`: `move(dir-->left)`, by kind and by nothing else. */
  private isToolGoal(term: Term): boolean {
    return operationNameOf(term) !== undefined;
  }

  /**
   * Dispatch pending `tool_name(args)` goals to the tool layer.
   * Injected meta-goals (e.g. `switch_strategy(...)`) are converted into real
   * tool executions, closing the goal→tool loop. Non-tool goals are left to the
   * reasoner via TaskManager.processPending().
   */
  private async dispatchToolGoals(): Promise<void> {
    if (!this.toolGoalExecutor) return;

    for (const task of this.taskManager.getPending()) {
      if (!this.isToolGoal(task.term)) continue;

      // Take ownership of the goal so it is not re-added as a plain memory goal.
      this.taskManager.removePending(task.stamp.id);

      try {
        const result = (await this.toolGoalExecutor(task.term)) as
          | { success?: boolean; error?: string }
          | undefined;
        const ok = result?.success !== false;
        logger.debug('Dispatched tool goal', {
          goal: task.term.toString(),
          success: ok,
          error: result?.error,
        });
        if (ok) {
          this.recordRLFPReward(0.7, 'tool-goal-success');
          this.driveManager?.stimulate('competence', 0.1);
        } else {
          this.recordRLFPReward(-0.3, 'tool-goal-failure');
          this.driveManager?.stimulate('competence', -0.1);
        }
      } catch (e) {
        logger.warn('Tool goal dispatch failed', {
          goal: task.term.toString(),
          error: errMsg(e),
        });
        this.recordRLFPReward(-0.5, 'tool-goal-error');
        this.driveManager?.stimulate('competence', -0.15);
      }
    }
  }
}
