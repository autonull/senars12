/**
 * Rule processor for applying inference rules
 */

import type {StampType, Term} from '../terms';
import {Stamp as StampFactory} from '../terms';
import {type RegisteredRule, RuleIndex, RuleRegistry, type TruthFn} from './types.js';
import {Truth, type Truth as TruthType} from '../terms/truth.js';
import type {LMRule} from '../lm';
import {EventBus} from '../types';
import {toError} from '../utils/helpers.js';

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

export class RuleProcessor {
    private readonly ruleIndex: RuleIndex;
    private readonly lmRules: LMRule[] = [];
    private eventBus: EventBus | null = null;
    private resultBuffer: RuleResult[] = [];

    constructor(rules?: RegisteredRule[]) {
        this.ruleIndex = new RuleIndex();
        (rules ?? RuleRegistry.getAll()).forEach(rule => this.ruleIndex.register(rule));
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
                    if (result) {
                        yield this.buildResult(result as Term, rule.truthFn ?? NEUTRAL_FN, p1, p2, rule.priority);
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
                if (result) {
                    this.resultBuffer.push(this.buildResult(result as Term, rule.truthFn ?? NEUTRAL_FN, p1, p2, rule.priority));
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

        const results = await Promise.all(this.lmRules.map(async lmRule => {
            try {
                const tasks = await lmRule.apply(p1.term, p2.term);
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