/**
 * Rule processor for applying inference rules
 */

import type {StampType, Term} from '../terms';
import {Stamp as StampFactory, getSubject, getPredicate, isOperation, isTautology} from '../terms';
import {type RegisteredRule, RuleIndex, RuleRegistry, type TruthFn} from './types.js';
import {Truth, type Truth as TruthType} from '../terms/truth.js';
import type {LMRule} from '../lm';
import {EventBus} from '../types';
import {toError} from '../utils/helpers.js';
import type {Memory} from '../memory/memory.js';

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

const deriveStamp = (p1: RuleInput, p2: RuleInput): StampType =>
    (StampFactory.derive([p1.stamp, p2.stamp]) ?? StampFactory.createInput()) as unknown as StampType;

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
    private priorityThreshold = 0;

    constructor(rules?: RegisteredRule[]) {
        this.ruleIndex = new RuleIndex();
        (rules ?? RuleRegistry.getAll()).forEach(rule => this.ruleIndex.register(rule));
    }

    setConfig(config: {memory?: Memory; priorityThreshold?: number}): void {
        if (config.memory) this.memory = config.memory;
        if (config.priorityThreshold !== undefined) this.priorityThreshold = config.priorityThreshold;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        this.lmRules.forEach(lmRule => lmRule.setEventBus(eventBus));
    }

    registerLMRule(lmRule: LMRule): void {
        this.lmRules.push(lmRule);
        if (this.eventBus) lmRule.setEventBus(this.eventBus);
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

        for (const rule of matchedRules) {
            if (!rule.sync) continue;
            try {
                const result = rule.apply([p1.term, p2.term]);
                if (result && validateRuleOutput(result, [p1.term, p2.term])) {
                    this.resultBuffer.push(this.buildResult(result as Term, rule.truthFn ?? NEUTRAL_FN, p1, p2, rule.priority));
                } else if (result) {
                    this.eventBus?.emit('rule:output-rejected', {ruleId: rule.id, term: result.toString()});
                }
            } catch (error) {
                this.handleRuleError(error, rule.id);
            }
        }

        return this.resultBuffer;
    }

    private buildResult(term: Term, truthFn: TruthFn, p1: RuleInput, p2: RuleInput, priority: number): RuleResult {
        const truth = truthFn(p1.truth, p2.truth) ?? Truth.NEUTRAL;
        return {term, truth, stamp: deriveStamp(p1, p2), priority};
    }

    private async* processLMRules(p1: RuleInput, p2: RuleInput): AsyncGenerator<RuleResult> {
        if (this.lmRules.length === 0) return;

        const p1Concept = this.memory?.getConcept(p1.term)
        const p2Concept = this.memory?.getConcept(p2.term)
        const maxPriority = Math.max(p1Concept?.priority ?? 0, p2Concept?.priority ?? 0)

        if (maxPriority < this.priorityThreshold) return

        const context = { priority: maxPriority }

        const results = await Promise.all(this.lmRules.map(async lmRule => {
            try {
                const tasks = await lmRule.apply(p1.term, p2.term, context);
                const derivedStamp = deriveStamp(p1, p2);
                return tasks.map(task => ({
                    term: task.term,
                    truth: task.truth ?? Truth.NEUTRAL,
                    stamp: derivedStamp,
                    priority: lmRule.priority
                } as RuleResult));
            } catch (error) {
                this.handleRuleError(error, lmRule.id);
                return [];
            }
        }));
        yield* results.flat();
    }

    private handleRuleError(error: unknown, ruleId: string): void {
        this.eventBus?.emit('error', {error: toError(error), context: {ruleId}});
    }
}