import type {Task} from '../types/core.js';
import {createBudget} from '../types/core.js';
import type {RuleProcessor, RuleResult, RuleInput} from '../rules/processor.js';
import type {DerivationStrategy, DerivationContext} from './types';

const toTask = (r: RuleResult): Task => ({
  term: r.term, type: 'belief', truth: r.truth, budget: createBudget(r.priority), stamp: r.stamp, occurrenceTime: Date.now(), derived: true
});

export class DefaultDerivation implements DerivationStrategy {
  readonly metadata = { name: 'default', description: 'Iterate all secondaries, fire sync+LM per pair' };

  async *derive(primary: Task, secondaries: Task[], processor: RuleProcessor, ctx: DerivationContext): AsyncGenerator<Task> {
    if (secondaries.length > 0) {
      for (const secondary of secondaries) {
        if (ctx.signal?.aborted) return;
        const p1: RuleInput = { term: primary.term, truth: primary.truth, stamp: primary.stamp };
        const p2: RuleInput = { term: secondary.term, truth: secondary.truth, stamp: secondary.stamp };

        for (const result of processor.processSync(p1, p2)) yield toTask(result);
        for await (const result of processor.processLMRulesExternal(p1, p2, ctx.signal)) yield toTask(result);
      }
    } else if (ctx.singlePremiseEnabled) {
      const p1: RuleInput = { term: primary.term, truth: primary.truth, stamp: primary.stamp };
      for await (const result of processor.processLMRulesSingle(p1, ctx.signal)) yield toTask(result);
    }
  }
}

export class AnytimeDerivation implements DerivationStrategy {
  readonly metadata = { name: 'anytime', description: 'Yield as results become available, stop early if signal aborted' };

  async *derive(primary: Task, secondaries: Task[], processor: RuleProcessor, ctx: DerivationContext): AsyncGenerator<Task> {
    if (ctx.signal?.aborted) return;
    if (secondaries.length > 0) {
      for (const secondary of secondaries) {
        if (ctx.signal?.aborted) return;
        const p1: RuleInput = { term: primary.term, truth: primary.truth, stamp: primary.stamp };
        const p2: RuleInput = { term: secondary.term, truth: secondary.truth, stamp: secondary.stamp };

        for (const result of processor.processSync(p1, p2)) yield toTask(result);
        for await (const result of processor.processLMRulesExternal(p1, p2, ctx.signal)) yield toTask(result);
      }
    } else if (ctx.singlePremiseEnabled) {
      const p1: RuleInput = { term: primary.term, truth: primary.truth, stamp: primary.stamp };
      for await (const result of processor.processLMRulesSingle(p1, ctx.signal)) yield toTask(result);
    }
  }
}

export class FocusedDerivation extends DefaultDerivation {
  override readonly metadata = { name: 'focused', description: 'Prioritize high-relevance secondaries' };

  override async *derive(primary: Task, secondaries: Task[], processor: RuleProcessor, ctx: DerivationContext): AsyncGenerator<Task> {
    const sorted = [...secondaries].sort((a, b) => {
      const scoreA = a.budget.priority + this.sharedAtomScore(primary, a);
      const scoreB = b.budget.priority + this.sharedAtomScore(primary, b);
      return scoreB - scoreA;
    });
    yield* super.derive(primary, sorted, processor, ctx);
  }

  private sharedAtomScore(a: Task, b: Task): number {
    const aStr = a.term.toString();
    const bStr = b.term.toString();
    const aWords = new Set(aStr.toLowerCase().split(/[\s_()<>]+/).filter(Boolean));
    const bWords = new Set(bStr.toLowerCase().split(/[\s_()<>]+/).filter(Boolean));
    let overlap = 0;
    for (const w of aWords) { if (bWords.has(w)) overlap++; }
    return overlap / Math.max(aWords.size, bWords.size, 1);
  }
}

export class SampledDerivation extends DefaultDerivation {
  override readonly metadata = { name: 'sampled', description: 'Random subset of secondaries' };

  override async *derive(primary: Task, secondaries: Task[], processor: RuleProcessor, ctx: DerivationContext): AsyncGenerator<Task> {
    const maxPairs = Math.min(secondaries.length, Math.max(1, Math.ceil(secondaries.length * 0.3)));
    const shuffled = [...secondaries].sort(() => Math.random() - 0.5).slice(0, maxPairs);
    yield* super.derive(primary, shuffled, processor, ctx);
  }
}
