/**
 * Rule processor for applying inference rules
 */

import type { ModelRuleStats } from '@senars/util';
import { formatNarseseTruth, pushCapped, stopwatch, toError } from '@senars/util';
import { findConflicts } from '../../cognitive/impls/conflict-utils.js';
import type { DriveManager } from '../../drives';
import type { ControlBudgetPort } from '../../kernel/control-budgets.js';
import { GATE_LOG_CAPACITY } from '../../kernel/event-ring.js';
import type { MemoryReader } from '../../memory/ports/index.js';
import type { ModelRuleSelector } from '../../strategies/types.js';
import type { StampType, Term } from '../../terms';
import { termDepth, Truth, type Truth as TruthType } from '../../terms';
import type { NarEventBus, Task } from '../../types';
import type {
  InferenceTable,
  ModelRule,
  ModelRuleWork,
  ModelRuleWorkSink,
  RegisteredRule,
  RuleInput,
  RuleResult,
} from '../types.js';
import { META_AIKR_BOUNDS, shouldActivateMetaReasoning } from './meta-rules.js';
import { RuleIndex } from './RuleIndex.js';
import { DerivationRecorder } from './recorder.js';
import { loadBuiltinTable } from './builtin-table.js';
import { buildResult, deriveStamp, NEUTRAL_FN, validateRuleOutput } from './rule-utils.js';

interface ModelRuleExecutionEntry {
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

/**
 * Meta-reasoning nesting. A high-water mark rather than a spend: the number a
 * meta derivation is *at* in the chain, which is structural. The spend — how
 * many meta derivations a step may make — is the `control-work` scope (A7), so
 * there is one place that answers "how much" and this only answers "how deep".
 */
interface MetaDepthState {
  currentDepth: number;
  maxDepth: number;
}

export class RuleProcessor {
  private readonly table: InferenceTable;
  private readonly modelRules: ModelRule[] = [];
  /** Id index over `modelRules` — O(1) lookup instead of a linear scan per query. */
  private readonly modelRulesById = new Map<string, ModelRule>();
  private eventBus: NarEventBus | null = null;
  private resultBuffer: RuleResult[] = [];
  private memory?: MemoryReader;
  private host?: RuleProcessorHost;
  private readonly recorder: DerivationRecorder = new DerivationRecorder();
  private modelRuleSelector: ModelRuleSelector | null = null;
  private maxModelRulesPerStep = 13;
  private modelRuleRotationIndex = 0;
  private executionLog: ModelRuleExecutionEntry[] = [];
  // Reusable buffers to avoid allocations in hot paths
  private readonly seenBuffer = new Map<string, RuleResult>();

  private modelRuleWorkSink: ModelRuleWorkSink | null = null;
  private limitConclusionGrowth = false;
  private metaDepth: MetaDepthState = {
    currentDepth: 0,
    maxDepth: META_AIKR_BOUNDS.maxMetaDerivationDepth,
  };
  /** TODO29.a §5.7: the declared control budgets. Absent ⇒ meta derivations are unbudgeted. */
  private budgets?: ControlBudgetPort;

  /**
   * `rules` builds a table of exactly those rules; omitting it loads the shipped
   * table through the artifact path. Either way the table is *passed in* — the
   * processor no longer reads a module-global, so which rules are loaded is a
   * constructor argument rather than a property of the import graph
   * (TODO29.a §5.10).
   */
  constructor(rules?: readonly RegisteredRule[], table?: InferenceTable) {
    this.table = table ?? (rules ? new RuleIndex() : loadBuiltinTable().index());
    for (const rule of rules ?? []) this.table.register(rule);
  }

  getTable(): InferenceTable {
    return this.table;
  }

  setConfig(config: {
    memory?: MemoryReader;
    host?: RuleProcessorHost;
    recorderEnabled?: boolean;
    budgets?: ControlBudgetPort;
    limitConclusionGrowth?: boolean;
  }): void {
    if (config.memory) this.memory = config.memory;
    if (config.host) this.host = config.host;
    if (config.budgets) this.budgets = config.budgets;
    if (config.limitConclusionGrowth !== undefined) this.limitConclusionGrowth = config.limitConclusionGrowth;
    if (config.recorderEnabled !== undefined) this.recorder.setEnabled(config.recorderEnabled);
  }

  getRecorder(): DerivationRecorder {
    return this.recorder;
  }

  setEventBus(eventBus: NarEventBus): void {
    this.eventBus = eventBus;
    this.modelRules.forEach((modelRule) => {
      modelRule.setEventBus(eventBus);
    });
  }

  registerModelRule(modelRule: ModelRule): void {
    this.modelRules.push(modelRule);
    this.modelRulesById.set(modelRule.id, modelRule);
    if (this.eventBus) modelRule.setEventBus(this.eventBus);
  }

  setModelRuleSelector(selector: ModelRuleSelector, maxRules: number): void {
    this.modelRuleSelector = selector;
    this.maxModelRulesPerStep = maxRules;
  }

  getModelRuleExecutionLog(): ModelRuleExecutionEntry[] {
    return [...this.executionLog];
  }

  getModelRule(id: string): ModelRule | undefined {
    return this.modelRulesById.get(id);
  }

  getModelRuleStats(): ModelRuleStats[] {
    return this.modelRules.map((r) => r.getStats());
  }

  clearModelRuleExecutionLog(): void {
    this.executionLog = [];
  }

  serializeModelRules(): { rules: ModelRuleStats[] } {
    return {
      rules: this.modelRules.map((r) => r.getStats()),
    };
  }

  deserializeModelRules(data: { rules: ModelRuleStats[] }): void {
    for (const ruleData of data.rules) {
      const rule = this.modelRulesById.get(ruleData.id);
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

  /**
   * Memory-wide scalars handed to model-backed rule contexts. Prompt hints, never
   * load-bearing for admission, and read on the off-cycle pass only — which is
   * why there is no per-step memo: the memo's invalidator was never called
   * (§4 row 7), so it was a process-stale cache, and the cycle it cost is gone.
   */
  private ruleContextScalars(): {
    totalConcepts: number;
    memoryPressure: number;
    conflictCount: number;
  } {
    const stats = this.memory?.getStatistics();
    const beliefs = this.host?.getBeliefs();
    return {
      totalConcepts: stats?.totalConcepts ?? 0,
      memoryPressure: stats?.memoryPressure ?? 0,
      conflictCount: beliefs ? findConflicts(beliefs).length : 0,
    };
  }

  private driveState(): Record<string, number> {
    const driveManager = this.host?.getDriveManager();
    if (!driveManager) return {};
    return Object.fromEntries(
      driveManager.getAllStates().map((ds) => [ds.spec.id, ds.currentIntensity])
    );
  }

  /** How deep a meta derivation may nest. The *spend* is `control-work`; this is the chain depth. */
  configureMetaAikr(bounds: { maxDerivationDepth?: number }): void {
    if (bounds.maxDerivationDepth !== undefined) this.metaDepth.maxDepth = bounds.maxDerivationDepth;
  }

  /**
   * Where staged model-backed work goes. `null` — the no-producer
   * configuration — is a state the processor runs in, not an error.
   */
  setModelRuleWorkSink(sink: ModelRuleWorkSink | null): void {
    this.modelRuleWorkSink = sink;
  }

  /** Stage model-backed rule work. Synchronous: nothing here may await a provider. */
  stageModelRuleWork(p1: RuleInput, p2?: RuleInput): boolean {
    return this.modelRuleWorkSink?.stage({ p1, p2 }) ?? false;
  }

  /** Apply one staged unit of model-backed work. Off the cycle path by construction. */
  async *applyModelRules(work: ModelRuleWork, signal?: AbortSignal): AsyncGenerator<RuleResult> {
    yield* this.applyModelRulesImpl(work.p1, work.p2, {
      signal,
      singlePremise: work.p2 === undefined,
    });
  }

  async *process(premises: AsyncIterable<[RuleInput, RuleInput]>): AsyncGenerator<RuleResult> {
    for await (const [p1, p2] of premises) {
      for (const { ruleResult } of this.applySyncRules(p1, p2)) {
        yield ruleResult;
      }
      yield* this.applyModelRules({ p1, p2 });
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
    const matched = this.table.candidates(p1.term.kind, p2.term.kind);
    const metaActive = this.metaActive(matched);

    for (const rule of matched) {
      if (!rule.sync) continue;
      if (this.budgets && !this.budgets.charge('candidate-derivations')) return;
      if (this.isMetaRule(rule)) {
        if (!metaActive) continue;
        if (!this.checkMetaBudget(this.metaDepth.currentDepth + 1)) continue;
      }

      try {
        const result = rule.apply([p1.term, p2.term]);
        if (!result) continue;
        if (!validateRuleOutput(result, [p1.term, p2.term])) {
          this.eventBus?.emit('rule:output-rejected', { ruleId: rule.id, term: result.toString() });
          continue;
        }
        if (this.isMetaRule(rule)) this.recordMetaDerivation(this.metaDepth.currentDepth + 1);
        const conclusion = result.toString();
        if (conclusion === p1s || conclusion === p2s) continue;
        if (
          this.limitConclusionGrowth &&
          termDepth(result as Term) > Math.max(termDepth(p1.term), termDepth(p2.term))
        )
          continue;
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

  /** Whether the step may afford another meta derivation, at this nesting depth. */
  private checkMetaBudget(depth: number): boolean {
    return depth < this.metaDepth.maxDepth && (this.budgets?.charge('control-work') ?? true);
  }

  /** Record a meta-derivation's nesting depth. */
  private recordMetaDerivation(depth: number): void {
    this.metaDepth.currentDepth = Math.max(this.metaDepth.currentDepth, depth);
  }

  private async *applyModelRulesImpl(
    p1: RuleInput,
    p2?: RuleInput,
    opts?: {
      signal?: AbortSignal;
      singlePremise?: boolean;
    }
  ): AsyncGenerator<RuleResult> {
    if (this.modelRules.length === 0 || opts?.signal?.aborted) return;

    const isSinglePremise = opts?.singlePremise ?? !p2;
    const effectiveP2 = p2 ?? p1;

    const maxPriority = Math.max(
      this.memory?.getConcept(p1.term)?.priority ?? 0,
      this.memory?.getConcept(effectiveP2.term)?.priority ?? 0
    );

    const selected = this.modelRuleSelector
      ? this.modelRuleSelector.select(this.modelRules, {
          maxRules: this.maxModelRulesPerStep,
          conceptPriority: maxPriority,
          rotationIndex: this.modelRuleRotationIndex,
          premiseCount: isSinglePremise ? 1 : 2,
          focusTerm: p1.term,
        })
      : this.modelRules;

    this.modelRuleRotationIndex = (this.modelRuleRotationIndex + 1) % this.modelRules.length;
    if (selected.length === 0) return;

    const { totalConcepts, memoryPressure, conflictCount } = this.ruleContextScalars();
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
      selected.map(async (modelRule) => {
        if (opts?.signal?.aborted) return [];
        const elapsed = stopwatch();
        try {
          const tasks = isSinglePremise
            ? await modelRule.apply(p1.term, p1.term, ruleContext, opts?.signal)
            : await modelRule.apply(p1.term, effectiveP2.term, ruleContext, opts?.signal);
          const derivedStamp = isSinglePremise ? p1.stamp : deriveStamp(p1, effectiveP2);
          const result = tasks.map(
            (task) =>
              ({
                term: task.term,
                truth: task.truth ?? Truth.NEUTRAL,
                stamp: derivedStamp,
                priority: modelRule.priority,
              }) as RuleResult
          );
          // Record model-backed rule derivations
          for (const r of result) {
            this.recorder.record(modelRule.id, p1, effectiveP2, r);
          }
          pushCapped(
            this.executionLog,
            {
              ruleName: modelRule.name,
              status: result.length > 0 ? 'fired' : 'timeout',
              durationMs: elapsed(),
              tasksProduced: result.length,
              timestamp: Date.now(),
            },
            GATE_LOG_CAPACITY
          );
          return result;
        } catch (error) {
          this.handleRuleError(error, modelRule.id);
          pushCapped(
            this.executionLog,
            {
              ruleName: modelRule.name,
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
