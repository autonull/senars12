/**
 * Rule processor for applying inference rules
 */

import type {StampType, Term} from '../terms';
import {Stamp as StampFactory, getSubject, getPredicate, isOperation, isTautology} from '../terms';
import {type RegisteredRule, RuleIndex, RuleRegistry, type TruthFn} from './types.js';
import {Truth, type Truth as TruthType} from '../terms/truth.js';
import type {LMRule} from '../lm';
import type {LMRuleSelector} from '../strategies/types.js';
import {EventBus} from '../types';
import {toError} from '../utils/helpers.js';
import type {Memory} from '../memory/memory.js';

interface LMRuleExecutionEntry {
    ruleName: string;
    status: 'fired' | 'skipped' | 'timeout' | 'aborted';
    durationMs: number;
    tasksProduced: number;
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

const deriveStamp = (p1: RuleInput, p2: RuleInput): StampType => {
    const stamps = [p1.stamp, p2.stamp].filter((s): s is NonNullable<typeof s> => s != null);
    return (StampFactory.derive(stamps) ?? StampFactory.createInput()) as unknown as StampType;
};

const NEUTRAL_FN = (): TruthType => Truth.NEUTRAL;

const validateRuleOutput = (term: Term, premises: [Term, Term]): boolean => {
    if (isTautology(term)) return false;
    if (term.args && term.args.length > 0) {
        const argCount = term.args.length;
        if ((term.kind === 'inheritance' || term.kind === 'similarity' || term.kind === 'implication' || term.kind === 'equivalence') && argCount !== 2) return false;
        if ((term.kind === 'negation' || term.kind === 'instance' || term.kind === 'property') && argCount !== 1) return false;
    }
    if (term.kind === 'inheritance' || term.kind === 'similarity') {
        const s = getSubject(term), p = getPredicate(term);
        if (s && isOperation(s)) return false;
        if (p && isOperation(p)) return false;
    }
    return true;
};

export class RuleProcessor {
    private readonly ruleIndex: RuleIndex;
    private readonly lmRules: LMRule[] = [];
    private eventBus: EventBus | null = null;
    private resultBuffer: RuleResult[] = [];
    private memory?: Memory;
    private lmSelector: LMRuleSelector | null = null;
    private maxLMRulesPerStep = 13;
    private lmRotationIndex = 0;
    private executionLog: LMRuleExecutionEntry[] = [];

    constructor(rules?: RegisteredRule[]) {
        this.ruleIndex = new RuleIndex();
        (rules ?? RuleRegistry.getAll()).forEach(rule => this.ruleIndex.register(rule));
    }

    setConfig(config: {memory?: Memory}): void {
        if (config.memory) this.memory = config.memory;
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

    clearLMRuleExecutionLog(): void {
        this.executionLog = [];
    }

    async* process(premises: AsyncIterable<[RuleInput, RuleInput]>): AsyncGenerator<RuleResult> {
        for await (const [p1, p2] of premises) {
            for (const rule of this.ruleIndex.match(p1.term, p2.term)) {
                if (!rule.sync) continue;

                try {
                    const result = rule.apply([p1.term, p2.term]);
                    if (result && validateRuleOutput(result, [p1.term, p2.term])) {
                        yield this.buildResult(result as Term, rule.truthFn ?? NEUTRAL_FN, p1, p2, rule.priority);
                    } else if (result) {
                        this.eventBus?.emit('rule:output-rejected', {ruleId: rule.id, term: result.toString()});
                    }
                } catch (error) {
                    this.handleRuleError(error, rule.id);
                }
            }

            for await (const lmResult of this.processLMRules(p1, p2)) {
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
                    const rr = this.buildResult(result as Term, rule.truthFn ?? NEUTRAL_FN, p1, p2, rule.priority);
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

    private buildResult(term: Term, truthFn: TruthFn, p1: RuleInput, p2: RuleInput, priority: number): RuleResult {
        const truth = truthFn(p1.truth, p2.truth) ?? Truth.NEUTRAL;
        return {term, truth, stamp: deriveStamp(p1, p2), priority};
    }

    private async* processLMRules(p1: RuleInput, p2: RuleInput): AsyncGenerator<RuleResult> {
        if (this.lmRules.length === 0) return;

        const maxPriority = Math.max(
            this.memory?.getConcept(p1.term)?.priority ?? 0,
            this.memory?.getConcept(p2.term)?.priority ?? 0
        );

        const selected = this.lmSelector
            ? this.lmSelector.select(this.lmRules, {
                maxRules: this.maxLMRulesPerStep,
                conceptPriority: maxPriority,
                rotationIndex: this.lmRotationIndex,
                premiseCount: 2
            })
            : this.lmRules;

        const results = await Promise.all(selected.map(async lmRule => {
            const startTime = Date.now();
            try {
                const tasks = await lmRule.apply(p1.term, p2.term, {priority: maxPriority});
                const derivedStamp = deriveStamp(p1, p2);
                const result = tasks.map(task => ({
                    term: task.term,
                    truth: task.truth ?? Truth.NEUTRAL,
                    stamp: derivedStamp,
                    priority: lmRule.priority
                } as RuleResult));
                this.executionLog.push({ruleName: lmRule.name, status: 'fired', durationMs: Date.now() - startTime, tasksProduced: tasks.length});
                return result;
            } catch (error) {
                this.handleRuleError(error, lmRule.id);
                this.executionLog.push({ruleName: lmRule.name, status: 'timeout', durationMs: Date.now() - startTime, tasksProduced: 0});
                return [];
            }
        }));
        this.lmRotationIndex = (this.lmRotationIndex + 1) % this.lmRules.length;
        yield* results.flat();
    }

    async* processLMRulesExternal(p1: RuleInput, p2: RuleInput, signal?: AbortSignal): AsyncGenerator<RuleResult> {
        if (this.lmRules.length === 0 || signal?.aborted) return;

        const maxPriority = Math.max(
            this.memory?.getConcept(p1.term)?.priority ?? 0,
            this.memory?.getConcept(p2.term)?.priority ?? 0
        );

        const selected = this.lmSelector
            ? this.lmSelector.select(this.lmRules, {
                maxRules: this.maxLMRulesPerStep,
                conceptPriority: maxPriority,
                rotationIndex: this.lmRotationIndex,
                premiseCount: 2
            })
            : this.lmRules;

        const results = await Promise.all(selected.map(async lmRule => {
            if (signal?.aborted) return [];
            const startTime = Date.now();
            try {
                const tasks = await lmRule.apply(p1.term, p2.term, {priority: maxPriority});
                const derivedStamp = deriveStamp(p1, p2);
                const result = tasks.map(task => ({
                    term: task.term,
                    truth: task.truth ?? Truth.NEUTRAL,
                    stamp: derivedStamp,
                    priority: lmRule.priority
                } as RuleResult));
                this.executionLog.push({ruleName: lmRule.name, status: 'fired', durationMs: Date.now() - startTime, tasksProduced: tasks.length});
                return result;
            } catch (error) {
                this.handleRuleError(error, lmRule.id);
                this.executionLog.push({ruleName: lmRule.name, status: 'timeout', durationMs: Date.now() - startTime, tasksProduced: 0});
                return [];
            }
        }));
        this.lmRotationIndex = (this.lmRotationIndex + 1) % this.lmRules.length;
        yield* results.flat();
    }

    async* processLMRulesSingle(p1: RuleInput, signal?: AbortSignal): AsyncGenerator<RuleResult> {
        if (this.lmRules.length === 0 || signal?.aborted) return;

        const results = await Promise.all(this.lmRules.map(async lmRule => {
            if (signal?.aborted) return [];
            const startTime = Date.now();
            try {
                const tasks = await lmRule.apply(p1.term, p1.term);
                const derivedStamp = p1.stamp;
                this.executionLog.push({ruleName: lmRule.name, status: tasks.length > 0 ? 'fired' : 'fired', durationMs: Date.now() - startTime, tasksProduced: tasks.length});
                return tasks.map(task => ({
                    term: task.term,
                    truth: task.truth ?? Truth.NEUTRAL,
                    stamp: derivedStamp,
                    priority: lmRule.priority
                } as RuleResult));
            } catch (error) {
                this.handleRuleError(error, lmRule.id);
                this.executionLog.push({ruleName: lmRule.name, status: 'timeout', durationMs: Date.now() - startTime, tasksProduced: 0});
                return [];
            }
        }));
        yield* results.flat();
    }

    private handleRuleError(error: unknown, ruleId: string): void {
        this.eventBus?.emit('error', {error: toError(error), context: {ruleId}});
    }
}