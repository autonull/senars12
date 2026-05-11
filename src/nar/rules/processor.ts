/**
 * Rule processor for applying inference rules
 */

import type {Term} from '../terms';
import type {Stamp, StampType} from '../terms';
import {Stamp as StampFactory} from '../terms';
import {RuleIndex, RuleRegistry, type RegisteredRule} from './types.js';
import {Truth, type Truth as TruthType} from '../terms/truth.js';
import type {LMRule} from '../lm';
import {EventBus} from '../types';

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
                        const truthFn = rule.truthFn ?? NEUTRAL_FN;
                        const derivedStamp = (StampFactory.derive([p1.stamp, p2.stamp]) ?? StampFactory.createInput()) as unknown as StampType;
                        const truth = truthFn(p1.truth, p2.truth) ?? Truth.NEUTRAL;
                        yield { term: result as Term, truth, stamp: derivedStamp, priority: rule.priority };
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
                    const truthFn = rule.truthFn ?? NEUTRAL_FN;
                    const derivedStamp = (StampFactory.derive([p1.stamp, p2.stamp]) ?? StampFactory.createInput()) as unknown as StampType;
                    const truth = truthFn(p1.truth, p2.truth) ?? Truth.NEUTRAL;
                    this.resultBuffer.push({ term: result as Term, truth, stamp: derivedStamp, priority: rule.priority });
                }
            } catch (error) {
                this.handleRuleError(error, rule.id);
            }
        }

        return this.resultBuffer;
    }

    private async* processLMRules(p1: RuleInput, p2: RuleInput): AsyncGenerator<RuleResult> {
        if (this.lmRules.length === 0) return;

        const results = await Promise.all(this.lmRules.map(async lmRule => {
            try {
                const tasks = await lmRule.apply(p1.term, p2.term);
                const derivedStamp = (StampFactory.derive([p1.stamp, p2.stamp]) ?? StampFactory.createInput()) as unknown as StampType;
                return tasks.map(task => ({ term: task.term, truth: task.truth ?? Truth.NEUTRAL, stamp: derivedStamp, priority: lmRule.priority } as RuleResult));
            } catch (error) {
                this.handleRuleError(error, lmRule.id);
                return [];
            }
        }));
        yield* results.flat();
    }

    private handleRuleError(error: unknown, ruleId: string): void {
        const err = error instanceof Error ? error : new Error(String(error));
        this.eventBus?.emit('error', {error: err, context: {ruleId}});
    }
}
