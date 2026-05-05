import type { Term } from '../terms/index.js';
import type { RegisteredRule } from './types.js';
import { RuleRegistry, RuleIndex } from './types.js';
import { Truth } from '../terms/truth.js';
import { Stamp } from '../terms/stamp.js';
import type { LMRule } from '../lm/LMRule.js';
import { EventBus } from '../types/events.js';

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
    this.registerAllRules();
  }

  private registerAllRules(): void {
    const rules = RuleRegistry.getAll();
    for (const rule of rules) {
      this.ruleIndex.register(rule);
    }
  }

  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
    for (const lmRule of this.lmRules) {
      lmRule.setEventBus(eventBus);
    }
  }

  registerLMRule(lmRule: LMRule): void {
    this.lmRules.push(lmRule);
    if (this.eventBus) {
      lmRule.setEventBus(this.eventBus);
    }
  }

  async *process(premises: AsyncIterable<[Term, Term]>): AsyncGenerator<RuleResult> {
    for await (const [p1, p2] of premises) {
      const rules = this.ruleIndex.match(p1, p2);

      for (const rule of rules.filter(r => r.sync)) {
        const result = rule.apply([p1, p2]);
        if (result) {
          const truth = Truth.NEUTRAL;
          const stamp = Stamp.createInput();
          yield {
            term: result as Term,
            truth,
            stamp,
            priority: rule.priority
          };
        }
      }

      for (const lmRule of this.lmRules) {
        lmRule.apply(p1, p2).then(tasks => {
          for (const task of tasks) {
            const truth = task.truth ?? Truth.NEUTRAL;
            const stamp = Stamp.createInput();
            this.eventBus?.emit('rule.result', {
              term: task.term,
              truth,
              stamp,
              priority: lmRule.priority,
              source: 'lm'
            });
          }
        }).catch((err: Error) => {
          console.warn('LM rule failed:', err);
        });
      }
    }
  }

  processSync(p1: Term, p2: Term): RuleResult[] {
    const rules = this.ruleIndex.match(p1, p2);
    const results: RuleResult[] = [];

    for (const rule of rules.filter(r => r.sync)) {
      const result = rule.apply([p1, p2]);
      if (result) {
        const truth = Truth.NEUTRAL;
        const stamp = Stamp.createInput();
        results.push({ term: result as Term, truth, stamp, priority: rule.priority });
      }
    }

    return results;
  }
}