import { TermBuilder, type Term } from '../index.js';

export type RewardLevel = 'high' | 'neutral' | 'low';

export const rewardLevel = (reward: number): RewardLevel =>
  reward > 0 ? 'high' : reward < 0 ? 'low' : 'neutral';

/** `reward_<level> --> achieved` — the epistemic representation of a realized reward. */
export const rewardBeliefTerm = (reward: number): Term => {
  const level = rewardLevel(reward);
  const term = TermBuilder.inheritance(
    TermBuilder.atom(`reward_${level}`),
    TermBuilder.atom('achieved')
  );
  if (!term) throw new Error(`Invalid inheritance: reward_${level} --> achieved`);
  return term;
};
