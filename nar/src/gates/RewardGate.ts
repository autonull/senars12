import type { GameOutcome } from '../game/Game.js';
import type { Focus, FocusTask } from '../focus/Focus.js';
import { focusTask, rewardTerm, stateTerm } from './tasks.js';

export class RewardGate {
  constructor(private readonly focus: Focus) {}

  toBeliefs(outcome: GameOutcome): FocusTask[] {
    const now = Date.now();
    const magnitude = Math.min(1, Math.abs(outcome.reward) + 0.1);

    const beliefs: FocusTask[] = [
      focusTask({
        id: `reward-${outcome.reward >= 0 ? 'pos' : 'neg'}-${now}`,
        term: rewardTerm(outcome.reward),
        type: 'belief',
        priority: magnitude,
        f: outcome.reward >= 0 ? 1.0 : 0.0,
        c: magnitude,
        stamp: `reward-${now}`,
      }),
    ];

    if (outcome.terminal) {
      beliefs.push(
        focusTask({
          id: `terminal-${now}`,
          term: stateTerm('terminal'),
          type: 'belief',
          priority: 0.9,
          f: 1.0,
          c: 0.9,
          stamp: `reward-${now}`,
        })
      );
    }

    return beliefs;
  }
}
