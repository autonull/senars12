/**
 * Rule processor for applying inference rules
 */

import type {Term} from '../terms';
import {RuleIndex, RuleRegistry, type TruthFn} from './types.js';
import {Truth, type Truth as TruthType} from '../terms/truth.js';
import {Stamp} from '../terms';
import type {LMRule} from '../lm';
import {EventBus} from '../types';
import './nal.js';

export interface RuleInput {
  term: Term;
  truth: TruthType;
}

export interface RuleResult {
  term: Term;
  truth: TruthType;
  stamp: ReturnType<typeof Stamp.createInput>;
  priority: number;
}

const NEUTRAL_FN = (): TruthType => Truth.NEUTRAL;

export class RuleProcessor {
  private readonly ruleIndex: RuleIndex;
  private readonly lmRules: LMRule[] = [];
  private eventBus: EventBus | null = null;
  private resultBuffer: RuleResult[] = [];

  constructor() {
    this.ruleIndex = new RuleIndex();
    RuleRegistry.getAll().forEach(rule => this.ruleIndex.register(rule));
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
            yield {
              term: result as Term,
              truth: truthFn(p1.truth, p2.truth),
              stamp: Stamp.createInput(),
              priority: rule.priority
            };
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
          this.resultBuffer.push({
            term: result as Term,
            truth: truthFn(p1.truth, p2.truth),
            stamp: Stamp.createInput(),
            priority: rule.priority
          });
        }
      } catch (error) {
        this.handleRuleError(error, rule.id);
      }
    }

    return this.resultBuffer;
  }

  private async* processLMRules(p1: RuleInput, p2: RuleInput): AsyncGenerator<RuleResult> {
    if (this.lmRules.length === 0) return;
    
    const promises = this.lmRules.map(async (lmRule) => {
      try {
        const tasks = await lmRule.apply(p1.term, p2.term);
        return tasks.map(task => ({
          term: task.term,
          truth: task.truth ?? Truth.NEUTRAL,
          stamp: Stamp.createInput(),
          priority: lmRule.priority
        } as RuleResult));
      } catch (error) {
        this.handleRuleError(error, lmRule.id);
        return [];
      }
    });

    const results = await Promise.all(promises);
    for (const result of results.flat()) {
      yield result;
    }
  }

  private handleRuleError(error: unknown, ruleId: string): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.eventBus?.emit('error', {error: err, context: {ruleId}});
  }
}
