/**
 * Rule processor for applying inference rules
 */

import type { Term } from '../terms/types.js';
import { RuleRegistry, RuleIndex } from './types.js';
import { Truth } from '../terms/truth.js';
import { Stamp } from '../terms/stamp.js';
import type { LMRule } from '../lm/LMRule.js';
import { EventBus } from '../types/events.js';
import './nal.js';

export interface RuleResult {
  term: Term;
  truth: ReturnType<typeof Truth.create>;
  stamp: ReturnType<typeof Stamp.createInput>;
  priority: number;
}

export class RuleProcessor {
  private ruleIndex: RuleIndex;
  private lmRules: LMRule[] = [];
  private eventBus: EventBus | null = null;

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

  async *process(premises: AsyncIterable<[Term, Term]>): AsyncGenerator<RuleResult> {
    for await (const [p1, p2] of premises) {
      for (const rule of this.ruleIndex.match(p1, p2).filter(r => r.sync)) {
        try {
          const result = rule.apply([p1, p2]);
          if (result) {
            yield {
              term: result as Term,
              truth: Truth.NEUTRAL,
              stamp: Stamp.createInput(),
              priority: rule.priority
            };
          }
        } catch (error) {
          this.handleRuleError(error, rule.id);
        }
      }

      this.lmRules.forEach(lmRule => {
        lmRule.apply(p1, p2)
          .then(tasks => {
            tasks.forEach(task => {
              this.eventBus?.emit('rule.result', {
                term: task.term,
                truth: task.truth ?? Truth.NEUTRAL,
                stamp: Stamp.createInput(),
                priority: lmRule.priority,
                source: 'lm'
              });
            });
          })
          .catch(error => this.handleRuleError(error, lmRule.id));
      });
    }
  }

  private handleRuleError(error: unknown, ruleId: string): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.eventBus?.emit('error', { error: err, context: { ruleId } });
  }

  processSync(p1: Term, p2: Term): RuleResult[] {
    const results: RuleResult[] = [];
    const matchedRules = this.ruleIndex.match(p1, p2);
    for (const rule of matchedRules) {
      if (!rule.sync) continue;
      const result = rule.apply([p1, p2]);
      if (result) {
        results.push({
          term: result as Term,
          truth: Truth.NEUTRAL,
          stamp: Stamp.createInput(),
          priority: rule.priority
        });
      }
    }
    return results;
  }
}
