import type {Task} from '../../types/core.js';
import type {RuleProcessor} from '../../rules/processor.js';
import type {DerivationContext} from '../types.js';
import {DefaultDerivation} from './DefaultDerivation.js';

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
