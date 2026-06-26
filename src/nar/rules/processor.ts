/**
 * Rule processor for applying inference rules
 */

import type {StampType, Term} from '../terms';
import {type RegisteredRule, RuleIndex, RuleRegistry} from './types.js';
import {Truth, type Truth as TruthType} from '../terms/truth.js';
import type {LMRule} from '../lm';
import type {LMRuleStats} from '../lm/types.js';
import type {LMRuleSelector} from '../strategies/types.js';
import {EventBus} from '../types';
import {toError} from '../utils/helpers.js';
import type {Memory} from '../memory/memory.js';
import type {NAR} from '../nar.js';
import {buildResult, deriveStamp, NEUTRAL_FN, validateRuleOutput} from './rule-utils.js';

interface LMRuleExecutionEntry {
    ruleName: string;
    status: 'fired' | 'skipped' | 'timeout' | 'aborted';
    durationMs: number;
    tasksProduced: number;
    timestamp: number;
}

export interface RuleInput {
    term: Term;
    truth: TruthType;
    stamp: StampType;
}

export interface RuleResult {
    term: Term;
    truth: TruthType;
    stamp: StampType;
    priority: number;
}

export class RuleProcessor {
    private readonly ruleIndex: RuleIndex;
    private readonly lmRules: LMRule[] = [];
    private eventBus: EventBus | null = null;
    private resultBuffer: RuleResult[] = [];
    private memory?: Memory;
    private nar?: NAR;
    private lmSelector: LMRuleSelector | null = null;
    private maxLMRulesPerStep = 13;
    private lmRotationIndex = 0;
    private executionLog: LMRuleExecutionEntry[] = [];

    constructor(rules?: RegisteredRule[]) {
        this.ruleIndex = new RuleIndex();
        (rules ?? RuleRegistry.getAll()).forEach(rule => this.ruleIndex.register(rule));
    }

    setConfig(config: { memory?: Memory; nar?: NAR }): void {
        if (config.memory) this.memory = config.memory;
        if (config.nar) this.nar = config.nar;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        this.lmRules.forEach(lmRule => lmRule.setEventBus(eventBus));
    }

    registerLMRule(lmRule: LMRule): void {
        this.lmRules.push(lmRule);
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
        return this.lmRules.find(r => r.id === id);
    }

    getLmRuleStats(): LMRuleStats[] {
        return this.lmRules.map(r => r.getStats());
    }

    clearLMRuleExecutionLog(): void {
        this.executionLog = [];
    }

    serializeLMRules(): { rules: LMRuleStats[] } {
        return {
            rules: this.lmRules.map(r => r.getStats()),
        };
    }

    deserializeLMRules(data: { rules: LMRuleStats[] }): void {
        for (const ruleData of data.rules) {
            const rule = this.lmRules.find(r => r.id === ruleData.id);
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

    async* processLMRules(p1: RuleInput, p2?: RuleInput, opts?: {
        signal?: AbortSignal;
        singlePremise?: boolean
    }): AsyncGenerator<RuleResult> {
        yield* this.processLMRulesImpl(p1, p2, opts);
    }

    async* process(premises: AsyncIterable<[RuleInput, RuleInput]>): AsyncGenerator<RuleResult> {
        for await (const [p1, p2] of premises) {
            for (const rule of this.ruleIndex.match(p1.term, p2.term)) {
                if (!rule.sync) continue;

                try {
                    const result = rule.apply([p1.term, p2.term]);
                    if (result && validateRuleOutput(result, [p1.term, p2.term])) {
                        yield buildResult(result as Term, rule.truthFn ?? NEUTRAL_FN, p1, p2, rule.priority);
                    } else if (result) {
                        this.eventBus?.emit('rule:output-rejected', {ruleId: rule.id, term: result.toString()});
                    }
                } catch (error) {
                    this.handleRuleError(error, rule.id);
                }
            }

            for await (const lmResult of this.processLMRulesImpl(p1, p2)) {
                yield lmResult;
            }
        }
    }

    processSync(p1: RuleInput, p2: RuleInput): RuleResult[] {
        this.resultBuffer = [];
        const matchedRules = this.ruleIndex.match(p1.term, p2.term);
        const seen = new Map<string, RuleResult>();
        const p1s = p1.term.toString(), p2s = p2.term.toString();

        for (const rule of matchedRules) {
            if (!rule.sync) continue;
            try {
                const result = rule.apply([p1.term, p2.term]);
                if (result && validateRuleOutput(result, [p1.term, p2.term])) {
                    const rs = result.toString();
                    // Skip results that duplicate a premise term — prevents revision corruption
                    if (rs === p1s || rs === p2s) continue;
                    const rr = buildResult(result as Term, rule.truthFn ?? NEUTRAL_FN, p1, p2, rule.priority);
                    const existing = seen.get(rs);
                    if (!existing || rule.priority > existing.priority) {
                        seen.set(rs, rr);
                    }
                } else if (result) {
                    this.eventBus?.emit('rule:output-rejected', {ruleId: rule.id, term: result.toString()});
                }
            } catch (error) {
                this.handleRuleError(error, rule.id);
            }
        }

        this.resultBuffer = Array.from(seen.values());
        return this.resultBuffer;
    }

    private async* processLMRulesImpl(p1: RuleInput, p2?: RuleInput, opts?: {
        signal?: AbortSignal;
        singlePremise?: boolean
    }): AsyncGenerator<RuleResult> {
        if (this.lmRules.length === 0 || opts?.signal?.aborted) return;

        const isSinglePremise = opts?.singlePremise ?? !p2;
        const effectiveP2 = p2 ?? p1;

        const maxPriority = Math.max(
            this.memory?.getConcept(p1.term)?.priority ?? 0,
            this.memory?.getConcept(effectiveP2.term)?.priority ?? 0
        );

        const stats = this.memory?.getStatistics();

        // Build drive state from NAR's drive manager
        const driveState: Record<string, number> = {};
        const driveManager = this.nar?.getDriveManager?.();
        if (driveManager) {
            for (const ds of driveManager.getAllStates()) {
                driveState[ds.spec.id] = ds.currentIntensity;
            }
        }

        // Get conflict count from NAR
        let conflictCount = 0;
        if (this.nar) {
            const beliefs = this.nar.getBeliefs?.();
            if (beliefs) {
                const {findConflicts} = await import('../cognitive/conflict-utils.js');
                conflictCount = findConflicts(beliefs).length;
            }
        }

        const ruleContext: Record<string, unknown> = {
            priority: maxPriority,
            conceptPriority: maxPriority,
            taskTerm: p1.term.toString(),
            secondaryTerm: effectiveP2.term.toString(),
            totalConcepts: stats?.totalConcepts ?? 0,
            memoryPressure: stats?.memoryPressure ?? 0,
            driveState,
            conflictCount,
        };

        const relatedConcepts = this.memory?.getRelatedConcepts(p1.term, 5);
        if (relatedConcepts && relatedConcepts.length > 0) {
            ruleContext.relatedBeliefs = relatedConcepts.flatMap(c =>
                c.getBeliefs().slice(0, 2).map((b) => {
                    const truth = b.truth ? ` :${b.truth.f.toFixed(2)}:${b.truth.c.toFixed(2)}` : '';
                    return `${b.term.toString()}${truth}`;
                })
            );
        }

        const goals = this.memory?.getGoals();
        if (goals && goals.length > 0) {
            ruleContext.activeGoals = goals.slice(0, 5).map(g => g.term.toString());
        }

        const selected = this.lmSelector
            ? this.lmSelector.select(this.lmRules, {
                maxRules: this.maxLMRulesPerStep,
                conceptPriority: maxPriority,
                rotationIndex: this.lmRotationIndex,
                premiseCount: isSinglePremise ? 1 : 2
            })
            : this.lmRules;

        const results = await Promise.all(selected.map(async lmRule => {
            if (opts?.signal?.aborted) return [];
            const startTime = Date.now();
            try {
                const tasks = isSinglePremise
                    ? await lmRule.apply(p1.term, p1.term, ruleContext, opts?.signal)
                    : await lmRule.apply(p1.term, effectiveP2.term, ruleContext, opts?.signal);
                const derivedStamp = isSinglePremise ? p1.stamp : deriveStamp(p1, effectiveP2);
                const result = tasks.map(task => ({
                    term: task.term,
                    truth: task.truth ?? Truth.NEUTRAL,
                    stamp: derivedStamp,
                    priority: lmRule.priority
                } as RuleResult));
                this.executionLog.push({
                    ruleName: lmRule.name,
                    status: result.length > 0 ? 'fired' : 'timeout',
                    durationMs: Date.now() - startTime,
                    tasksProduced: result.length,
                    timestamp: Date.now()
                });
                return result;
            } catch (error) {
                this.handleRuleError(error, lmRule.id);
                this.executionLog.push({
                    ruleName: lmRule.name,
                    status: 'timeout',
                    durationMs: Date.now() - startTime,
                    tasksProduced: 0,
                    timestamp: Date.now()
                });
                return [];
            }
        }));
        this.lmRotationIndex = (this.lmRotationIndex + 1) % this.lmRules.length;
        yield* results.flat();
    }

    private handleRuleError(error: unknown, ruleId: string): void {
        this.eventBus?.emit('error', {error: toError(error), context: {ruleId}});
    }
}