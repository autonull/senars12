import { BoundedRing, clamp01 } from '@senars/util';
import { type Term, Truth, TermBuilder } from '../../index.js';
import type { NAR } from '../../nar.js';
import type { RandomSource } from '../../types/primitives.js';
import { QBeliefStore } from './QBeliefStore.js';
import { rewardBeliefTerm, rewardLevel } from './reward-term.js';

/**
 * Handles reward representation and value updates with TD learning support
 */
export interface RewardBeliefAdapterConfig {
  gamma?: number;
  tdConfidence?: number;
  tdAlpha?: number;
  tdQLearningConfidence?: number;
  /** Injected randomness for value-belly exploration (default `ambientRng`). */
  rng?: RandomSource;
  /** Reward transitions retained for retrospective analysis (default 1000). */
  maxHistory?: number;
}

/** One recorded `(state, action, reward)` transition. */
export interface RewardHistoryEntry {
  state: Term;
  action: Term;
  reward: number;
  timestamp: number;
}

export class RewardBeliefAdapter {
  private readonly nar: NAR;
  private readonly qStore: QBeliefStore;
  private readonly config: {
    gamma: number;
    tdConfidence: number;
    tdAlpha: number;
    tdQLearningConfidence: number;
  };
  private readonly rewardHistory: BoundedRing<RewardHistoryEntry>;

  constructor(nar: NAR, config: RewardBeliefAdapterConfig = {}) {
    this.nar = nar;
    this.qStore = new QBeliefStore(nar, config.rng);
    this.config = {
      gamma: config.gamma ?? 0.99,
      tdConfidence: config.tdConfidence ?? 0.5,
      tdAlpha: config.tdAlpha ?? 0.1,
      tdQLearningConfidence: config.tdQLearningConfidence ?? 0.9,
    };
    this.rewardHistory = new BoundedRing<RewardHistoryEntry>(config.maxHistory ?? 1000);
  }

  private async believeReward(reward: number, confidence: number): Promise<void> {
    await this.nar.believe(rewardBeliefTerm(reward), Truth.create(Math.abs(reward), confidence));
  }

  /** Process reward and update value beliefs (immediate reward only) */
  async processReward(
    state: Term,
    action: Term,
    reward: number,
    confidence: number = 0.5
  ): Promise<void> {
    this.rewardHistory.push({ state, action, reward, timestamp: Date.now() });
    await this.qStore.updateValue(state, action, reward, confidence);

    await this.believeReward(reward, confidence);
  }

  /** Process reward with TD learning (Q-learning style: uses max next-state value) */
  async processRewardTD(
    state: Term,
    action: Term,
    reward: number,
    nextState: Term,
    nextAvailableActions: Term[],
    done: boolean,
    confidence: number = 0.5
  ): Promise<void> {
    this.rewardHistory.push({ state, action, reward, timestamp: Date.now() });

    let tdTarget: number;

    if (done) {
      tdTarget = reward;
    } else {
      const nextMaxValue = this.qStore.getMaxValue(nextState, nextAvailableActions);
      tdTarget = reward + this.config.gamma * nextMaxValue;
    }

    tdTarget = clamp01(tdTarget);

    await this.qStore.updateValueQLearning(
      state,
      action,
      tdTarget,
      this.config.tdAlpha,
      this.config.tdQLearningConfidence
    );

    await this.believeReward(reward, confidence);
  }

  /** Process reward with SARSA (on-policy: uses next action's value) */
  async processRewardSARSA(
    state: Term,
    action: Term,
    reward: number,
    nextState: Term,
    nextAction: Term,
    done: boolean,
    confidence: number = 0.5
  ): Promise<void> {
    this.rewardHistory.push({ state, action, reward, timestamp: Date.now() });

    let tdTarget: number;

    if (done) {
      tdTarget = reward;
    } else {
      const nextValue = this.qStore.getValue(nextState, nextAction);
      const nextQ = nextValue ? nextValue.f : 0;
      tdTarget = reward + this.config.gamma * nextQ;
    }

    tdTarget = clamp01(tdTarget);
    await this.qStore.updateValueTD(state, action, tdTarget, this.config.tdConfidence);

    await this.believeReward(reward, confidence);
  }

  /** Create terminal satisfaction signal (goal term for nar.goal()) */
  createSatisfactionSignal(reward: number): Term {
    return TermBuilder.atom(`reward_${rewardLevel(reward)}`);
  }

  getQStore(): QBeliefStore {
    return this.qStore;
  }

  getRewardHistory(): RewardHistoryEntry[] {
    return this.rewardHistory.toArray();
  }
}
