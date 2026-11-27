/**
 * Rule processor for applying inference rules
 */
import type { DriveManager } from '../../drives';
import { type ControlBudgetPort } from '../../kernel/control-budgets';
import type { MemoryReader } from '../../memory/ports/index';
import type { RulePerformance } from '../../strategies/lm-graph/RuleGraph';
import type { ModelRuleSelector } from '../../strategies/types';
import type { NarEventBus, Task } from '../../types';
import type { InferenceTable, ModelRule, ModelRuleWork, ModelRuleWorkSink, ModelRuleStats, RegisteredRule, RuleInput, RulePromptContext, RuleResult } from '../types';
import { DerivationRecorder } from './recorder';
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
    /** Optional: the cycle a rule fire belongs to, stamped onto the fire record. */
    getCycleCount?(): number;
    /** Optional: the run correlation a fire belongs to, stamped onto the fire record (C3.1). */
    getCorrelationId?(): string | undefined;
}
export declare class RuleProcessor {
    #private;
    private readonly table;
    private readonly modelRules;
    /** Id index over `modelRules` — O(1) lookup instead of a linear scan per query. */
    private readonly modelRulesById;
    private eventBus;
    private resultBuffer;
    private memory?;
    private host?;
    private readonly recorder;
    private modelRuleSelector;
    private maxModelRulesPerStep;
    private modelRuleRotationIndex;
    private executionLog;
    private readonly seenBuffer;
    private modelRuleWorkSink;
    private limitConclusionGrowth;
    private metaDepth;
    /** TODO29.a §5.7: the declared control budgets. Unwired ⇒ meta derivations are unbudgeted. */
    private budgets;
    /**
     * `rules` builds a table of exactly those rules; omitting it loads the shipped
     * table through the artifact path. Either way the table is *passed in* — the
     * processor no longer reads a module-global, so which rules are loaded is a
     * constructor argument rather than a property of the import graph
     * (TODO29.a §5.10).
     */
    constructor(rules?: readonly RegisteredRule[], table?: InferenceTable);
    getTable(): InferenceTable;
    setConfig(config: {
        memory?: MemoryReader;
        host?: RuleProcessorHost;
        recorderEnabled?: boolean;
        budgets?: ControlBudgetPort;
        limitConclusionGrowth?: boolean;
    }): void;
    getRecorder(): DerivationRecorder;
    setEventBus(eventBus: NarEventBus): void;
    registerModelRule(modelRule: ModelRule): void;
    setModelRuleSelector(selector: ModelRuleSelector, maxRules: number): void;
    getModelRuleExecutionLog(): ModelRuleExecutionEntry[];
    /** Per-rule success and latency — the read side the selectors score from. */
    get rulePerformance(): RulePerformance;
    getModelRule(id: string): ModelRule | undefined;
    getModelRuleStats(): ModelRuleStats[];
    clearModelRuleExecutionLog(): void;
    serializeModelRules(): {
        rules: ModelRuleStats[];
    };
    deserializeModelRules(data: {
        rules: ModelRuleStats[];
    }): void;
    /**
     * The memory-wide half of a model rule's prompt context. Read once per pump;
     * read per unit of work it was a full-store statistics sweep, a percentile sort
     * and a pairwise conflict scan in front of every premise pair, describing a
     * memory that had not changed between them.
     */
    rulePromptContext(): RulePromptContext;
    /** How deep a meta derivation may nest. The *spend* is `control-work`; this is the chain depth. */
    configureMetaAikr(bounds: {
        maxDerivationDepth?: number;
    }): void;
    /**
     * Where staged model-backed work goes. `null` — the no-producer
     * configuration — is a state the processor runs in, not an error.
     */
    setModelRuleWorkSink(sink: ModelRuleWorkSink | null): void;
    /** Stage model-backed rule work. Synchronous: nothing here may await a provider. */
    stageModelRuleWork(p1: RuleInput, p2?: RuleInput): boolean;
    /** Apply one staged unit of model-backed work. Off the cycle path by construction. */
    applyModelRules(work: ModelRuleWork, signal?: AbortSignal, context?: RulePromptContext): AsyncGenerator<RuleResult>;
    /**
     * Core synchronous rule application — shared by both sync and async paths.
     * @param deduplicate Whether to keep only the highest-priority result per conclusion term.
     */
    private applySyncRulesInternal;
    process(premises: AsyncIterable<[RuleInput, RuleInput]>): AsyncGenerator<RuleResult>;
    processSync(p1: RuleInput, p2: RuleInput): RuleResult[];
    /**
     * The single synchronous rule-application path shared by `process` and
     * `processSync`: meta-budget enforcement, validation, recording, and
     * `rule:applied` / `rule:output-rejected` emission.
     */
    private applySyncRules;
    /** Meta-reasoning activation, computed only when a matched rule is a meta rule. */
    private metaActive;
    /** Check if a rule is a meta-rule (by ID prefix) */
    private isMetaRule;
    /** Whether the step may afford another meta derivation, at this nesting depth. */
    private checkMetaBudget;
    /** Record a meta-derivation's nesting depth. */
    private recordMetaDerivation;
    private applyModelRulesImpl;
    private handleRuleError;
}
export {};
//# sourceMappingURL=processor.d.ts.map