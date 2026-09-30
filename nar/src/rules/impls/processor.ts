/**
 * Rule processor for applying inference rules
 */

import type { LMRuleStats } from '@senars/util';
import { formatNarseseTruth, pushCapped, stopwatch, toError } from '@senars/util';
import { findConflicts } from '../../cognitive/impls/conflict-utils.js';
import type { DriveManager } from '../../drives';
import { GATE_LOG_CAPACITY } from '../../kernel/event-ring.js';
import type { LMRule } from '../../lm/rule/LMRule.js';
import type { Memory } from '../../memory';
import type { LMRuleSelector } from '../../strategies/types.js';
import type { StampType, Term } from '../../terms';
import { Truth, type Truth as TruthType } from '../../terms';
import type { NarEventBus, Task } from '../../types';
import type { RegisteredRule, RuleInput, RuleResult } from '../types.js';
import { META_AIKR_BOUNDS, shouldActivateMetaReasoning } from './meta-rules.js';
import { RuleIndex } from './RuleIndex.js';
import { DerivationRecorder } from './recorder.js';
import { RuleRegistry } from './rule-registry.js';
import { buildResult, deriveStamp, NEUTRAL_FN, validateRuleOutput } from './rule-utils.js';

interface LMRuleExecutionEntry {
  ruleName: string;
  status: 'fired' | 'skipped' | 'timeout' | 'aborted';
  durationMs: number;
  tasksProduced: number;
  timestamp: number;
}

/**
 * Narrow read-only view of the owning engine that the processor needs. Keeps
 * the rule layer free of any dependency on the NAR facade (dependency
 * inversion: the host is injected structurally, not imported).
 */
export interface RuleProcessorHost {
  getBeliefs(filter?: Record<string, unknown>): Task[];
  getDriveManager(): DriveManager | undefined;
}

/** Meta-reasoning budget state */
interface MetaBudgetState {
  derivationsThisStep: number;
  currentDepth: number;
  maxDerivationsPerStep: number;
  maxDerivationDepth: number;
}

export class RuleProcessor {
  private readonly ruleIndex: RuleIndex;
  private readonly lmRules: LMRule[] = [];
  /** Id index over `lmRules` — O(1) lookup instead of a linear scan per query. */
  private readonly lmRulesById = new Map<string, LMRule>();
  private eventBus: NarEventBus | null = null;
  private resultBuffer: RuleResult[] = [];
  private memory?: Memory;
  private host?: RuleProcessorHost;
  private readonly recorder: DerivationRecorder = new DerivationRecorder();
  private lmSelector: LMRuleSelector | null = null;
  private maxLMRulesPerStep = 13;
  private lmRotationIndex = 0;
  private executionLog: LMRuleExecutionEntry[] = [];
  // Reusable buffers to avoid allocations in hot paths
  private readonly seenBuffer = new Map<string, RuleResult>();

  /** Meta-reasoning budget tracking */
  private stepScalars: {
    totalConcepts: number;
    memoryPressure: number;
    conflictCount: number;
  } | null = null;
  private metaBudget: MetaBudgetState = {
    derivationsThisStep: 0,
    currentDepth: 0,
    maxDerivationsPerStep: META_AIKR_BOUNDS.maxMetaDerivationsPerStep,
    maxDerivationDepth: META_AIKR_BOUNDS.maxMetaDerivationDepth,
  };

  constructor(rules?: RegisteredRule[]) {
    this.ruleIndex = new RuleIndex();
    (rules ?? RuleRegistry.getAll()).forEach((rule) => {
      this.ruleIndex.register(rule);
    });
  }

  setConfig(config: {
    memory?: Memory;
    host?: RuleProcessorHost;
    recorderEnabled?: boolean;
  }): void {
    if (config.memory) this.memory = config.memory;
    if (config.host) this.host = config.host;
    if (config.recorderEnabled !== undefined) this.recorder.setEnabled(config.recorderEnabled);
  }

  getRecorder(): DerivationRecorder {
    return this.recorder;
  }

  setEventBus(eventBus: NarEventBus): void {
    this.eventBus = eventBus;
    this.lmRules.forEach((lmRule) => {
      lmRule.setEventBus(eventBus);
    });
  }

  registerLMRule(lmRule: LMRule): void {
    this.lmRules.push(lmRule);
    this.lmRulesById.set(lmRule.id, lmRule);
    if (this.eventBus) lmRule.setEventBus(this.eventBus);
  }

  setLMSelector(selector: LMRuleSelector, maxRules: number): void {
    this.lmSelector = selector;
    this.maxLMRulesPerStep = maxRules;
  }

  getLMRuleExecutionLog(): LMRuleExecutionEntry[] {
    return [...this.executionLog];
  }

  getLMRule(id: string): LMRule | undefined {
    return this.lmRulesById.get(id);
  }

  getLmRuleStats(): LMRuleStats[] {
    return this.lmRules.map((r) => r.getStats());
  }

  clearLMRuleExecutionLog(): void {
    this.executionLog = [];
  }

  serializeLMRules(): { rules: LMRuleStats[] } {
    return {
      rules: this.lmRules.map((r) => r.getStats()),
    };
  }

  deserializeLMRules(data: { rules: LMRuleStats[] }): void {
    for (const ruleData of data.rules) {
      const rule = this.lmRulesById.get(ruleData.id);
      if (rule) {
        if (ruleData.enabled !== undefined) {
          if (ruleData.enabled) rule.enable();
          else rule.disable();
        }
        if (ruleData.circuitState === 'open') {
          // Circuit breaker will be open, stats will be restored on next operation
        }
      }
    }
  }

  /** Reset meta-budget for new step */
  resetMetaBudget(): void {
    this.metaBudget.derivationsThisStep = 0;
    this.metaBudget.currentDepth = 0;
    this.stepScalars = null;
  }

  /**
   * Memory-wide scalars handed to LM rule contexts. `getStatistics` sorts the
   * full concept array and `getBeliefs` materializes every belief, so the
   * whole set is computed at most once per inference step (prompt hints may be
   * a step stale; the values are never load-bearing for admission).
   */
  private stepMemoryScalars(): {
    totalConcepts: number;
    memoryPressure: number;
    conflictCount: number;
  } {
    if (this.stepScalars) return this.stepScalars;
    const stats = this.memory?.getStatistics();
    const beliefs = this.host?.getBeliefs();
    this.stepScalars = {
      totalConcepts: stats?.totalConcepts ?? 0,
      memoryPressure: stats?.memoryPressure ?? 0,
      conflictCount: beliefs ? findConflicts(beliefs).length : 0,
    };
    return this.stepScalars;
  }

  private driveState(): Record<string, number> {
    const driveManager = this.host?.getDriveManager();
    if (!driveManager) return {};
    return Object.fromEntries(
      driveManager.getAllStates().map((ds) => [ds.spec.id, ds.currentIntensity])
    );
  }

  /** Get current meta-budget status */
  getMetaBudgetStatus(): MetaBudgetState {
    return { ...this.metaBudget };
  }

  /** Configure meta-reasoning AIKR bounds */
  configureMetaAikr(bounds: { maxDerivationsPerStep?: number; maxDerivationDepth?: number }): void {
    if (bounds.maxDerivationsPerStep !== undefined) {
      this.metaBudget.maxDerivationsPerStep = bounds.maxDerivationsPerStep;
    }
    if (bounds.maxDerivationDepth !== undefined) {
      this.metaBudget.maxDerivationDepth = bounds.maxDerivationDepth;
    }
  }

  async *processLMRules(
    p1: RuleInput,
    p2?: RuleInput,
    opts?: {
      signal?: AbortSignal;
      singlePremise?: boolean;
    }
  ): AsyncGenerator<RuleResult> {
    yield* this.processLMRulesImpl(p1, p2, opts);
  }

  async *process(premises: AsyncIterable<[RuleInput, RuleInput]>): AsyncGenerator<RuleResult> {
    for await (const [p1, p2] of premises) {
      for (const { ruleResult } of this.applySyncRules(p1, p2)) {
        yield ruleResult;
      }
      yield* this.processLMRulesImpl(p1, p2);
      this.recorder.finish();
    }
  }

  processSync(p1: RuleInput, p2: RuleInput): RuleResult[] {
    this.seenBuffer.clear();
    for (const { conclusion, ruleResult } of this.applySyncRules(p1, p2)) {
      const existing = this.seenBuffer.get(conclusion);
      if (!existing || ruleResult.priority > existing.priority) {
        this.seenBuffer.set(conclusion, ruleResult);
      }
    }
    this.resultBuffer = Array.from(this.seenBuffer.values());
    this.recorder.finish();
    return this.resultBuffer;
  }

  /**
   * The single synchronous rule-application path shared by `process` and
   * `processSync`: meta-budget enforcement, validation, recording, and
   * `rule:applied` / `rule:output-rejected` emission.
   */
  private *applySyncRules(
    p1: RuleInput,
    p2: RuleInput
  ): Generator<{ conclusion: string; ruleResult: RuleResult }> {
    const p1s = p1.term.toString();
    const p2s = p2.term.toString();
    this.recorder.begin(`${p1s}|${p2s}`, p1s);
    const matched = this.ruleIndex.match(p1.term, p2.term);
    const metaActive = this.metaActive(matched);

    for (const rule of matched) {
      if (!rule.sync) continue;
      if (this.isMetaRule(rule)) {
        if (!metaActive) continue;
        if (!this.checkMetaBudget(this.metaBudget.currentDepth + 1)) continue;
      }

      try {
        const result = rule.apply([p1.term, p2.term]);
        if (!result) continue;
        if (!validateRuleOutput(result, [p1.term, p2.term])) {
          this.eventBus?.emit('rule:output-rejected', { ruleId: rule.id, term: result.toString() });
          continue;
        }
        if (this.isMetaRule(rule)) this.recordMetaDerivation(this.metaBudget.currentDepth + 1);
        const conclusion = result.toString();
        if (conclusion === p1s || conclusion === p2s) continue;
        const ruleResult = buildResult(
          result as Term,
          rule.truthFn ?? NEUTRAL_FN,
          p1,
          p2,
          rule.priority
        );
        (ruleResult as RuleResult & { taskType?: RegisteredRule['taskType'] }).taskType =
          rule.taskType;
        this.recorder.record(rule.id, p1, p2, ruleResult);
        // Emit rule:applied event for cost tracking
        this.eventBus?.emit('rule:applied', {
          ruleId: rule.id,
          premises: [p1.term, p2.term],
          conclusion: result as Term,
          truth: ruleResult.truth,
          duration: 0,
          cpuMs: 0,
          lmCalls: 0,
          lmTokens: 0,
        });
        yield { conclusion, ruleResult };
      } catch (error) {
        this.handleRuleError(error, rule.id);
      }
    }
  }

  /** Meta-reasoning activation, computed only when a matched rule is a meta rule. */
  private metaActive(matched: readonly RegisteredRule[]): boolean {
    if (!matched.some((rule) => rule.sync && this.isMetaRule(rule))) return false;
    const driveManager = this.host?.getDriveManager();
    return driveManager ? shouldActivateMetaReasoning(driveManager.getAllStates()) : false;
  }

  /** Check if a rule is a meta-rule (by ID prefix) */
  private isMetaRule(rule: RegisteredRule): boolean {
    return rule.id.startsWith('meta-');
  }

  /** Check if meta-reasoning budget allows another derivation */
  private checkMetaBudget(depth: number): boolean {
    return (
      this.metaBudget.derivationsThisStep < this.metaBudget.maxDerivationsPerStep &&
      depth < this.metaBudget.maxDerivationDepth
    );
  }

  /** Record a meta-derivation */
  private recordMetaDerivation(depth: number): void {
    this.metaBudget.derivationsThisStep++;
    this.metaBudget.currentDepth = Math.max(this.metaBudget.currentDepth, depth);
  }

  private async *processLMRulesImpl(
    p1: RuleInput,
    p2?: RuleInput,
    opts?: {
      signal?: AbortSignal;
      singlePremise?: boolean;
    }
  ): AsyncGenerator<RuleResult> {
    if (this.lmRules.length === 0 || opts?.signal?.aborted) return;

    const isSinglePremise = opts?.singlePremise ?? !p2;
    const effectiveP2 = p2 ?? p1;

    const maxPriority = Math.max(
      this.memory?.getConcept(p1.term)?.priority ?? 0,
      this.memory?.getConcept(effectiveP2.term)?.priority ?? 0
    );

    const selected = this.lmSelector
      ? this.lmSelector.select(this.lmRules, {
          maxRules: this.maxLMRulesPerStep,
          conceptPriority: maxPriority,
          rotationIndex: this.lmRotationIndex,
          premiseCount: isSinglePremise ? 1 : 2,
          focusTerm: p1.term,
        })
      : this.lmRules;

    this.lmRotationIndex = (this.lmRotationIndex + 1) % this.lmRules.length;
    if (selected.length === 0) return;

    const { totalConcepts, memoryPressure, conflictCount } = this.stepMemoryScalars();
    const driveState = this.driveState();

    const ruleContext: Record<string, unknown> = {
      priority: maxPriority,
      conceptPriority: maxPriority,
      taskTerm: p1.term.toString(),
      secondaryTerm: effectiveP2.term.toString(),
      totalConcepts,
      memoryPressure,
      driveState,
      conflictCount,
      truth: {
        f: p1.truth?.f ?? 0.5,
        c: p1.truth?.c ?? 0.5,
      },
      secondaryTruth: {
        f: effectiveP2.truth?.f ?? 0.5,
        c: effectiveP2.truth?.c ?? 0.5,
      },
    };

    const relatedConcepts = this.memory?.getRelatedConcepts(p1.term, 5);
    if (relatedConcepts && relatedConcepts.length > 0) {
      ruleContext.relatedBeliefs = relatedConcepts.flatMap((c) =>
        c
          .getBeliefs()
          .slice(0, 2)
          .map((b) => {
            const truth = formatNarseseTruth(b.truth);
            return `${b.term.toString()}${truth}`;
          })
      );
    }

    const goals = this.memory?.getGoals();
    if (goals && goals.length > 0) {
      ruleContext.activeGoals = goals.slice(0, 5).map((g) => g.term.toString());
    }

    const results = await Promise.all(
      selected.map(async (lmRule) => {
        if (opts?.signal?.aborted) return [];
        const elapsed = stopwatch();
        try {
          const tasks = isSinglePremise
            ? await lmRule.apply(p1.term, p1.term, ruleContext, opts?.signal)
            : await lmRule.apply(p1.term, effectiveP2.term, ruleContext, opts?.signal);
          const derivedStamp = isSinglePremise ? p1.stamp : deriveStamp(p1, effectiveP2);
          const result = tasks.map(
            (task) =>
              ({
                term: task.term,
                truth: task.truth ?? Truth.NEUTRAL,
                stamp: derivedStamp,
                priority: lmRule.priority,
              }) as RuleResult
          );
          // Record LM rule derivations
          for (const r of result) {
            this.recorder.record(lmRule.id, p1, effectiveP2, r);
          }
          pushCapped(
            this.executionLog,
            {
              ruleName: lmRule.name,
              status: result.length > 0 ? 'fired' : 'timeout',
              durationMs: elapsed(),
              tasksProduced: result.length,
              timestamp: Date.now(),
            },
            GATE_LOG_CAPACITY
          );
          return result;
        } catch (error) {
          this.handleRuleError(error, lmRule.id);
          pushCapped(
            this.executionLog,
            {
              ruleName: lmRule.name,
              status: 'timeout',
              durationMs: elapsed(),
              tasksProduced: 0,
              timestamp: Date.now(),
            },
            GATE_LOG_CAPACITY
          );
          return [];
        }
      })
    );
    yield* results.flat();
  }

  private handleRuleError(error: unknown, ruleId: string): void {
    this.eventBus?.emit('error', { error: toError(error), context: { ruleId } });
  }
}
