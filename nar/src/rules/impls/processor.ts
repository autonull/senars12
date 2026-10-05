/**
 * Rule processor for applying inference rules
 */

import {
  CallTallySeries,
  createCallTally,
  formatNarseseTruth,
  keyedBy,
  pushCapped,
  stopwatch,
  takeFirst,
  toError,
  type ModelRuleStats,
} from '@senars/util';
import { findConflicts } from '../../cognitive/impls/conflict-utils.js';
import type { DriveManager } from '../../drives';
import type { ControlBudgetPort } from '../../kernel/control-budgets.js';
import { GATE_LOG_CAPACITY } from '../../kernel/event-ring.js';
import type { MemoryReader } from '../../memory/ports/index.js';
import type { RulePerformance } from '../../strategies/lm-graph/RuleGraph.js';
import type { ModelRuleSelector } from '../../strategies/types.js';
import type { StampType, Term } from '../../terms';
import { Truth, type Truth as TruthType, termDepth, termKey } from '../../terms';
import type { NarEventBus, Task } from '../../types';
import type {
  InferenceTable,
  ModelRule,
  ModelRuleWork,
  ModelRuleWorkSink,
  RegisteredRule,
  RuleInput,
  RulePromptContext,
  RuleResult,
} from '../types.js';
import { loadBuiltinTable } from './builtin-table.js';
import { META_AIKR_BOUNDS, shouldActivateMetaReasoning } from './meta-rules.js';
import { RuleIndex } from './RuleIndex.js';
import { DerivationRecorder } from './recorder.js';
import { buildResult, deriveStamp, NEUTRAL_FN, validateRuleOutput } from './rule-utils.js';

/** Rules whose performance is tallied — a bounded series, not an open-ended map. */
const MAX_TRACKED_RULES = 512;

interface ModelRuleExecutionEntry {
  ruleId: string;
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
  /**
   * How each model rule has fared, and the one place that is recorded.
   *
   * The processor already knows this at the only moment it can be known — the
   * execution itself — and three consumers wanted it: the rule-graph selector
   * weighted its choices by success rate and latency, the metrics collector kept
   * a parallel series, and each rebuilt it from the execution log after the fact.
   * Two of the three were reconstructions of the same fact, and one of them was
   * reconstructed by nobody, so the graph's scoring silently read an empty series
   * while the collector's reported an equally empty one. One owner, keyed by rule
   * id, recorded once per attempt; the readers project.
   */
  readonly #rulePerformance = new CallTallySeries<string>({
    maxSize: MAX_TRACKED_RULES,
    create: createCallTally,
  });
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
    if (config.limitConclusionGrowth !== undefined)
      this.limitConclusionGrowth = config.limitConclusionGrowth;
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

  /** Per-rule success and latency — the read side the selectors score from. */
  get rulePerformance(): RulePerformance {
    return this.#rulePerformance;
  }

  /**
   * One model-rule attempt, recorded once: appended to the ring the self-analysis
   * chain drains, and folded into the tally the selectors read. The two were
   * separate statements at every call site, so a branch that appended without
   * folding (or the reverse) was one forgotten argument away.
   */
  #recordModelRuleExecution(
    rule: { id: string; name: string },
    status: ModelRuleExecutionEntry['status'],
    durationMs: number,
    tasksProduced: number
  ): void {
    pushCapped(
      this.executionLog,
      {
        ruleId: rule.id,
        ruleName: rule.name,
        status,
        durationMs,
        tasksProduced,
        timestamp: Date.now(),
      },
      GATE_LOG_CAPACITY
    );
    if (status !== 'skipped' && status !== 'aborted') {
      this.#rulePerformance.record(rule.id, status === 'fired', durationMs);
    }
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
   * The memory-wide half of a model rule's prompt context. Read once per pump;
   * read per unit of work it was a full-store statistics sweep, a percentile sort
   * and a pairwise conflict scan in front of every premise pair, describing a
   * memory that had not changed between them.
   */
  rulePromptContext(): RulePromptContext {
    const stats = this.memory?.getStatistics();
    const beliefs = this.host?.getBeliefs();
    const driveManager = this.host?.getDriveManager();
    const goals = this.memory?.getGoals();
    return {
      totalConcepts: stats?.totalConcepts ?? 0,
      memoryPressure: stats?.memoryPressure ?? 0,
      conflictCount: beliefs ? findConflicts(beliefs).length : 0,
      driveState: driveManager
        ? keyedBy(
            driveManager.getAllStates(),
            (ds) => ds.spec.id,
            (ds) => ds.currentIntensity
          )
        : {},
      activeGoals: goals ? takeFirst(goals, 5).map((g) => g.term.toString()) : [],
    };
  }

  /** How deep a meta derivation may nest. The *spend* is `control-work`; this is the chain depth. */
  configureMetaAikr(bounds: { maxDerivationDepth?: number }): void {
    if (bounds.maxDerivationDepth !== undefined)
      this.metaDepth.maxDepth = bounds.maxDerivationDepth;
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
  async *applyModelRules(
    work: ModelRuleWork,
    signal?: AbortSignal,
    context?: RulePromptContext
  ): AsyncGenerator<RuleResult> {
    yield* this.applyModelRulesImpl(work.p1, work.p2, {
      signal,
      singlePremise: work.p2 === undefined,
      context,
    });
  }

  async *process(premises: AsyncIterable<[RuleInput, RuleInput]>): AsyncGenerator<RuleResult> {
    // The flush reads the memory-wide half of a model rule's prompt once, at its own
    // boundary, and hands it down: every premise pair in one flush is judged against
    // the same store, and reading it per pair put a statistics sweep, a percentile
    // sort and a pairwise conflict scan in front of each of them.
    const context = this.modelRules.length > 0 ? this.rulePromptContext() : undefined;
    for await (const [p1, p2] of premises) {
      for (const { ruleResult } of this.applySyncRules(p1, p2)) {
        yield ruleResult;
      }
      yield* this.applyModelRules({ p1, p2 }, undefined, context);
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
    // The record names the first premise in its text form; the recorder is opt-in,
    // so the serialization is paid only when something will read it.
    // Premise identity for the whole rule sweep, resolved once: `termKey` is the
    // canonical structural key every other term-keyed container in the engine
    // uses, and it is memoised on the term. The Narsese text form was the older
    // answer and it is lossy — an atom holding `,` re-serialises exactly like a
    // compound — so two distinct terms that print alike could silence each
    // other's rule.
    const p1k = termKey(p1.term);
    const p2k = termKey(p2.term);
    if (this.recorder.isRecording) this.recorder.begin(p1.term.toString());
    const matched = this.table.candidates(p1.term.kind, p2.term.kind);
    const metaActive = this.metaActive(matched);
    // Premise depth is a property of the pair, not of the rule concluding over it.
    const premiseDepth = Math.max(termDepth(p1.term), termDepth(p2.term));

    for (const rule of matched) {
      if (!rule.sync) continue;
      if (this.budgets && !this.budgets.charge('candidate-derivations')) return;
      if (this.isMetaRule(rule)) {
        if (!metaActive) continue;
        if (!this.checkMetaBudget(this.metaDepth.currentDepth + 1)) continue;
      }

      try {
        const result = rule.apply([p1.term, p2.term], [p1, p2]);
        if (!result) continue;
        if (!validateRuleOutput(result, [p1.term, p2.term])) {
          this.eventBus?.emit('rule:output-rejected', { ruleId: rule.id, term: result.toString() });
          continue;
        }
        if (this.isMetaRule(rule)) this.recordMetaDerivation(this.metaDepth.currentDepth + 1);
        const conclusion = termKey(result);
        if (conclusion === p1k || conclusion === p2k) continue;
        if (this.limitConclusionGrowth && termDepth(result as Term) > premiseDepth) continue;
        const ruleResult = buildResult(
          result as Term,
          rule.truthFn ?? NEUTRAL_FN,
          p1,
          p2,
          rule.priority
        );
        (ruleResult as RuleResult & { taskType?: RegisteredRule['taskType'] }).taskType =
          rule.taskType;
        this.recorder.record(rule.id, p1, p2, ruleResult, rule.truthFnName);
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
      context?: RulePromptContext;
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

    const { totalConcepts, memoryPressure, conflictCount, driveState, activeGoals } =
      opts?.context ?? this.rulePromptContext();

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
        takeFirst(c.getBeliefs(), 2).map((b) => {
          const truth = formatNarseseTruth(b.truth);
          return `${b.term.toString()}${truth}`;
        })
      );
    }

    if (activeGoals.length > 0) ruleContext.activeGoals = activeGoals;

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
          this.#recordModelRuleExecution(
            modelRule,
            result.length > 0 ? 'fired' : 'timeout',
            elapsed(),
            result.length
          );
          return result;
        } catch (error) {
          this.handleRuleError(error, modelRule.id);
          this.#recordModelRuleExecution(modelRule, 'timeout', elapsed(), 0);
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
