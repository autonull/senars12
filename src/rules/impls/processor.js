/**
 * Rule processor for applying inference rules
 */
import { CallTallySeries, createCallTally } from '@senars/util/tally';
import { formatNarseseTruth } from '@senars/types/truth';
import { keyedBy, pushCapped, takeFirst } from '@senars/util/collections';
import { stopwatch } from '@senars/util/async';
import { toError } from '@senars/util/error';
import { countContradictions } from '../../cognitive/impls/conflict-utils';
import { UNBUDGETED } from '../../kernel/control-budgets';
import { GATE_LOG_CAPACITY } from '../../kernel/event-ring';
import { TermMap, Truth, termDepth, termKey } from '../../terms';
import { loadBuiltinTable } from './builtin-table';
import { META_AIKR_BOUNDS, shouldActivateMetaReasoning } from './meta-rules';
import { RuleIndex } from './RuleIndex';
import { DerivationRecorder } from './recorder';
import { buildResult, deriveStamp, NEUTRAL_FN, validateRuleOutput } from './rule-utils';
/** Rules whose performance is tallied — a bounded series, not an open-ended map. */
const MAX_TRACKED_RULES = 512;
export class RuleProcessor {
    table;
    modelRules = [];
    /** Id index over `modelRules` — O(1) lookup instead of a linear scan per query. */
    modelRulesById = new Map();
    eventBus = null;
    resultBuffer = [];
    memory;
    host;
    recorder = new DerivationRecorder();
    modelRuleSelector = null;
    maxModelRulesPerStep = 13;
    modelRuleRotationIndex = 0;
    executionLog = [];
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
    #rulePerformance = new CallTallySeries({
        maxSize: MAX_TRACKED_RULES,
        create: createCallTally,
    });
    // Reusable buffers to avoid allocations in hot paths
    seenBuffer = new TermMap();
    modelRuleWorkSink = null;
    limitConclusionGrowth = false;
    metaDepth = {
        currentDepth: 0,
        maxDepth: META_AIKR_BOUNDS.maxMetaDerivationDepth,
    };
    /** TODO29.a §5.7: the declared control budgets. Unwired ⇒ meta derivations are unbudgeted. */
    budgets = UNBUDGETED;
    /**
     * `rules` builds a table of exactly those rules; omitting it loads the shipped
     * table through the artifact path. Either way the table is *passed in* — the
     * processor no longer reads a module-global, so which rules are loaded is a
     * constructor argument rather than a property of the import graph
     * (TODO29.a §5.10).
     */
    constructor(rules, table) {
        this.table = table ?? (rules ? new RuleIndex() : loadBuiltinTable().index());
        for (const rule of rules ?? [])
            this.table.register(rule);
    }
    getTable() {
        return this.table;
    }
    setConfig(config) {
        if (config.memory)
            this.memory = config.memory;
        if (config.host)
            this.host = config.host;
        if (config.budgets)
            this.budgets = config.budgets;
        if (config.limitConclusionGrowth !== undefined)
            this.limitConclusionGrowth = config.limitConclusionGrowth;
        if (config.recorderEnabled !== undefined)
            this.recorder.setEnabled(config.recorderEnabled);
    }
    getRecorder() {
        return this.recorder;
    }
    setEventBus(eventBus) {
        this.eventBus = eventBus;
        this.modelRules.forEach((modelRule) => {
            modelRule.setEventBus(eventBus);
        });
    }
    registerModelRule(modelRule) {
        this.modelRules.push(modelRule);
        this.modelRulesById.set(modelRule.id, modelRule);
        if (this.eventBus)
            modelRule.setEventBus(this.eventBus);
    }
    setModelRuleSelector(selector, maxRules) {
        this.modelRuleSelector = selector;
        this.maxModelRulesPerStep = maxRules;
    }
    getModelRuleExecutionLog() {
        return [...this.executionLog];
    }
    /** Per-rule success and latency — the read side the selectors score from. */
    get rulePerformance() {
        return this.#rulePerformance;
    }
    /**
     * One model-rule attempt, recorded once: appended to the ring the self-analysis
     * chain drains, and folded into the tally the selectors read. The two were
     * separate statements at every call site, so a branch that appended without
     * folding (or the reverse) was one forgotten argument away.
     */
    #recordModelRuleExecution(rule, status, durationMs, tasksProduced) {
        pushCapped(this.executionLog, {
            ruleId: rule.id,
            ruleName: rule.name,
            status,
            durationMs,
            tasksProduced,
            timestamp: Date.now(),
        }, GATE_LOG_CAPACITY);
        if (status !== 'skipped' && status !== 'aborted') {
            this.#rulePerformance.record(rule.id, status === 'fired', durationMs);
        }
    }
    getModelRule(id) {
        return this.modelRulesById.get(id);
    }
    getModelRuleStats() {
        return this.modelRules.map((r) => r.getStats());
    }
    clearModelRuleExecutionLog() {
        this.executionLog = [];
    }
    serializeModelRules() {
        return {
            rules: this.modelRules.map((r) => r.getStats()),
        };
    }
    deserializeModelRules(data) {
        for (const ruleData of data.rules) {
            const rule = this.modelRulesById.get(ruleData.id);
            if (rule) {
                if (ruleData.enabled !== undefined) {
                    if (ruleData.enabled)
                        rule.enable();
                    else
                        rule.disable();
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
    rulePromptContext() {
        const stats = this.memory?.getStatistics();
        const beliefs = this.host?.getBeliefs();
        const driveManager = this.host?.getDriveManager();
        const goals = this.memory?.getGoals();
        return {
            totalConcepts: stats?.totalConcepts ?? 0,
            memoryPressure: stats?.memoryPressure ?? 0,
            conflictCount: beliefs ? countContradictions(beliefs) : 0,
            driveState: driveManager
                ? keyedBy(driveManager.getAllStates(), (ds) => ds.spec.id, (ds) => ds.currentIntensity)
                : {},
            activeGoals: goals ? takeFirst(goals, 5).map((g) => g.term.toString()) : [],
        };
    }
    /** How deep a meta derivation may nest. The *spend* is `control-work`; this is the chain depth. */
    configureMetaAikr(bounds) {
        if (bounds.maxDerivationDepth !== undefined)
            this.metaDepth.maxDepth = bounds.maxDerivationDepth;
    }
    /**
     * Where staged model-backed work goes. `null` — the no-producer
     * configuration — is a state the processor runs in, not an error.
     */
    setModelRuleWorkSink(sink) {
        this.modelRuleWorkSink = sink;
    }
    /** Stage model-backed rule work. Synchronous: nothing here may await a provider. */
    stageModelRuleWork(p1, p2) {
        return this.modelRuleWorkSink?.stage({ p1, p2 }) ?? false;
    }
    /** Apply one staged unit of model-backed work. Off the cycle path by construction. */
    async *applyModelRules(work, signal, context) {
        yield* this.applyModelRulesImpl(work.p1, work.p2, {
            signal,
            singlePremise: work.p2 === undefined,
            context,
        });
    }
    /**
     * Core synchronous rule application — shared by both sync and async paths.
     * @param deduplicate Whether to keep only the highest-priority result per conclusion term.
     */
    *applySyncRulesInternal(p1, p2, deduplicate) {
        this.seenBuffer.clear();
        for (const { term, ruleResult } of this.applySyncRules(p1, p2)) {
            if (deduplicate) {
                const existing = this.seenBuffer.get(term);
                if (!existing || ruleResult.priority > existing.priority) {
                    this.seenBuffer.set(term, ruleResult);
                }
            }
            else {
                yield ruleResult;
            }
        }
        if (deduplicate) {
            yield* this.seenBuffer.values();
        }
    }
    async *process(premises) {
        const context = this.modelRules.length > 0 ? this.rulePromptContext() : undefined;
        for await (const [p1, p2] of premises) {
            yield* this.applySyncRulesInternal(p1, p2, false);
            yield* this.applyModelRules({ p1, p2 }, undefined, context);
            this.#finishRecord();
        }
    }
    processSync(p1, p2) {
        this.resultBuffer.length = 0;
        for (const result of this.applySyncRulesInternal(p1, p2, true)) {
            this.resultBuffer.push(result);
        }
        this.#finishRecord();
        return this.resultBuffer;
    }
    /**
     * Close the open record and put the completed chain on the one bus (CORE.19
     * C3.4) — the kernel owns the emission, so a consumer drains nothing to get a
     * `derivation.record`. The record's own drain (a one-shot handoff) still works.
     */
    #finishRecord() {
        const record = this.recorder.finish();
        if (record)
            this.eventBus?.emit('derivation:record', record);
    }
    /**
     * The single synchronous rule-application path shared by `process` and
     * `processSync`: meta-budget enforcement, validation, recording, and
     * `rule:applied` / `rule:output-rejected` emission.
     */
    *applySyncRules(p1, p2) {
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
        const cycle = this.host?.getCycleCount?.() ?? 0;
        if (this.recorder.isRecording)
            this.recorder.begin(p1.term.toString(), cycle, this.host?.getCorrelationId?.());
        const matched = this.table.candidates(p1.term.kind, p2.term.kind);
        const metaActive = this.metaActive(matched);
        // Premise depth is a property of the pair, not of the rule concluding over it.
        // Behind the flag: `termDepth` is a tree descent that is not memoised, and
        // the growth limit is off by default, so the walk decided nothing.
        const premiseDepth = this.limitConclusionGrowth
            ? Math.max(termDepth(p1.term), termDepth(p2.term))
            : 0;
        // The premises are a property of the pair, not of the rule concluding over
        // it. Built here because every entry sweeps up to 21 rules in the hottest
        // dispatch cell and each was allocating its own copy of the same two arrays.
        const premises = [p1.term, p2.term];
        const inputs = [p1, p2];
        for (const rule of matched) {
            if (!rule.sync)
                continue;
            if (!this.budgets.charge('candidate-derivations'))
                return;
            if (this.isMetaRule(rule)) {
                if (!metaActive)
                    continue;
                if (!this.checkMetaBudget(this.metaDepth.currentDepth + 1))
                    continue;
            }
            try {
                const result = rule.apply(premises, inputs);
                if (!result)
                    continue;
                if (!validateRuleOutput(result)) {
                    this.eventBus?.emit('rule:output-rejected', { ruleId: rule.id, term: result.toString() });
                    continue;
                }
                if (this.isMetaRule(rule))
                    this.recordMetaDerivation(this.metaDepth.currentDepth + 1);
                const conclusion = termKey(result);
                if (conclusion === p1k || conclusion === p2k)
                    continue;
                if (this.limitConclusionGrowth && termDepth(result) > premiseDepth)
                    continue;
                const ruleResult = buildResult(result, rule.truthFn ?? NEUTRAL_FN, p1, p2, rule.priority);
                ruleResult.taskType =
                    rule.taskType;
                const step = this.recorder.record(rule.id, p1, p2, ruleResult, rule.truthFnName);
                // Emit rule:applied event for cost tracking
                this.eventBus?.emit('rule:applied', {
                    ruleId: rule.id,
                    premises: [p1.term, p2.term],
                    conclusion: result,
                    truth: ruleResult.truth,
                    duration: 0,
                    cpuMs: 0,
                    lmCalls: 0,
                    lmTokens: 0,
                    cycle,
                });
                // The durable, provenance-carrying form of the same fire (CORE.19 C1.3).
                if (step)
                    this.#emitDerivationAccepted(step);
                yield { term: result, ruleResult };
            }
            catch (error) {
                this.handleRuleError(error, rule.id);
            }
        }
    }
    /** Meta-reasoning activation, computed only when a matched rule is a meta rule. */
    metaActive(matched) {
        if (!matched.some((rule) => rule.sync && this.isMetaRule(rule)))
            return false;
        const driveManager = this.host?.getDriveManager();
        return driveManager ? shouldActivateMetaReasoning(driveManager.getAllStates()) : false;
    }
    /** Check if a rule is a meta-rule (by ID prefix) */
    isMetaRule(rule) {
        return rule.id.startsWith('meta-');
    }
    /** Whether the step may afford another meta derivation, at this nesting depth. */
    checkMetaBudget(depth) {
        return depth < this.metaDepth.maxDepth && this.budgets.charge('control-work');
    }
    /** Record a meta-derivation's nesting depth. */
    recordMetaDerivation(depth) {
        this.metaDepth.currentDepth = Math.max(this.metaDepth.currentDepth, depth);
    }
    async *applyModelRulesImpl(p1, p2, opts) {
        if (this.modelRules.length === 0 || opts?.signal?.aborted)
            return;
        const isSinglePremise = opts?.singlePremise ?? !p2;
        const effectiveP2 = p2 ?? p1;
        const maxPriority = Math.max(this.memory?.getConcept(p1.term)?.priority ?? 0, this.memory?.getConcept(effectiveP2.term)?.priority ?? 0);
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
        if (selected.length === 0)
            return;
        const { totalConcepts, memoryPressure, conflictCount, driveState, activeGoals } = opts?.context ?? this.rulePromptContext();
        const ruleContext = {
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
            ruleContext.relatedBeliefs = relatedConcepts.flatMap((c) => takeFirst(c.getBeliefs(), 2).map((b) => {
                const truth = formatNarseseTruth(b.truth);
                return `${b.term.toString()}${truth}`;
            }));
        }
        if (activeGoals.length > 0)
            ruleContext.activeGoals = activeGoals;
        const results = await Promise.all(selected.map(async (modelRule) => {
            if (opts?.signal?.aborted)
                return [];
            const elapsed = stopwatch();
            try {
                const tasks = isSinglePremise
                    ? await modelRule.apply(p1.term, p1.term, ruleContext, opts?.signal)
                    : await modelRule.apply(p1.term, effectiveP2.term, ruleContext, opts?.signal);
                const derivedStamp = isSinglePremise ? p1.stamp : deriveStamp(p1, effectiveP2);
                const result = tasks.map((task) => ({
                    term: task.term,
                    truth: task.truth ?? Truth.NEUTRAL,
                    stamp: derivedStamp,
                    priority: modelRule.priority,
                }));
                // Record model-backed rule derivations
                for (const r of result) {
                    const step = this.recorder.record(modelRule.id, p1, effectiveP2, r);
                    if (step)
                        this.#emitDerivationAccepted(step);
                }
                this.#recordModelRuleExecution(modelRule, result.length > 0 ? 'fired' : 'timeout', elapsed(), result.length);
                return result;
            }
            catch (error) {
                this.handleRuleError(error, modelRule.id);
                this.#recordModelRuleExecution(modelRule, 'timeout', elapsed(), 0);
                return [];
            }
        }));
        yield* results.flat();
    }
    /**
     * Emit the durable form of one rule fire (CORE.19 C1.3) without its wall-clock
     * stamp: the seeded trace compares payloads verbatim (D13), and the durable
     * append stamps the log's own timestamp anyway.
     */
    #emitDerivationAccepted(step) {
        const { timestamp: _timestamp, ...accepted } = step;
        this.eventBus?.emit('derivation:accepted', accepted);
    }
    handleRuleError(error, ruleId) {
        this.eventBus?.emit('error', { error: toError(error), context: { ruleId } });
    }
}
