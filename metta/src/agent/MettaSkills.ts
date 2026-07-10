import type { GroundedOp } from '../core/ops.js';
import { registerOp, getOp } from '../core/ops.js';
import type { MeTTaAtom } from '../types/ast.js';
import type { SkillFeedback } from './MettaTypes.js';

export class MettaSkills {
  #feedback = new Map<string, SkillFeedback>();

  register(name: string, op: GroundedOp): void {
    registerOp(name, op);
  }

  get(name: string): GroundedOp | undefined {
    return getOp(name);
  }

  execute(name: string, ...args: MeTTaAtom[]): MeTTaAtom {
    const op = getOp(name);
    if (!op) throw new Error(`Unknown skill: ${name}`);

    const start = Date.now();
    const result = op.execute(...args);
    const duration = Date.now() - start;

    const prev = this.#feedback.get(name);
    const callCount = (prev?.callCount ?? 0) + 1;
    const successRate = prev ? (prev.successRate * (callCount - 1) + 1) / callCount : 1;
    this.#feedback.set(name, {
      skill: name,
      lastResult: String(result),
      successRate,
      callCount,
    });

    return result;
  }

  getFeedback(name: string): SkillFeedback | undefined {
    return this.#feedback.get(name);
  }

  getAllFeedback(): SkillFeedback[] {
    return [...this.#feedback.values()];
  }

  getRecentResults(limit: number): string {
    return [...this.#feedback.values()]
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, limit)
      .map(f => `${f.skill}: ${f.lastResult}`)
      .join('\n');
  }

  clear(): void {
    this.#feedback.clear();
  }
}