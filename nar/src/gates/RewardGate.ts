import {Focus, FocusTask} from '../focus/Focus.js';
import type {GameOutcome} from '../game/Game.js';

export class RewardGate {
  constructor(private readonly focus: Focus) {}

  toBeliefs(outcome: GameOutcome): FocusTask[] {
    const beliefs: FocusTask[] = [];
    const now = Date.now();

    const rewardBelief: FocusTask = {
      id: `reward-${outcome.reward >= 0 ? 'pos' : 'neg'}-${now}`,
      priority: Math.min(1, Math.abs(outcome.reward) + 0.1),
      term: this.rewardToTerm(outcome.reward),
      type: 'belief',
      truth: { f: outcome.reward >= 0 ? 1.0 : 0.0, c: Math.min(1, Math.abs(outcome.reward) + 0.1) },
      budget: { priority: Math.abs(outcome.reward), durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
      stamp: `reward-${now}`,
      derived: false,
    };
    beliefs.push(rewardBelief);

    if (outcome.terminal) {
      const terminalBelief: FocusTask = {
        id: `terminal-${now}`,
        priority: 0.9,
        term: { kind: 'atom', value: 'terminal' } as any,
        type: 'belief',
        truth: { f: 1.0, c: 0.9 },
        budget: { priority: 0.9, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
        stamp: `reward-${now}`,
        derived: false,
      };
      beliefs.push(terminalBelief);
    }

    return beliefs;
  }

  private rewardToTerm(reward: number): any {
    return {
      kind: 'compound',
      operator: 'reward',
      args: [{ kind: 'atom', value: reward >= 0 ? 'positive' : 'negative' }],
    };
  }
}