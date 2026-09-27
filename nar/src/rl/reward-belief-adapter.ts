import { type Term, Truth, TermBuilder } from '../index.js';
import type { NAR } from '../nar.js';
import { QBeliefStore } from './q-belief-store.js';

/**
 * Handles reward representation and value updates with TD learning support
 */
export interface RewardBeliefAdapterConfig {
  gamma?: number;
  tdConfidence?: number;
  tdAlpha?: number;
  tdQLearningConfidence?: number;
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
  private rewardHistory: { state: Term; action: Term; reward: number; timestamp: number }[] = [];

  constructor(nar: NAR, config: RewardBeliefAdapterConfig = {}) {
    this.nar = nar;
    this.qStore = new QBeliefStore(nar);
    this.config = {
      gamma: config.gamma ?? 0.99,
      tdConfidence: config.tdConfidence ?? 0.5,
      tdAlpha: config.tdAlpha ?? 0.1,
      tdQLearningConfidence: config.tdQLearningConfidence ?? 0.9,
    };
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

    const rewardLevel = reward > 0 ? 'high' : reward < 0 ? 'low' : 'neutral';
    const rewardTerm = TermBuilder.inheritance(
      TermBuilder.atom(`reward_${rewardLevel}`),
      TermBuilder.atom('achieved')
    );
    if (!rewardTerm) throw new Error(`Invalid inheritance: reward_${rewardLevel} --> achieved`);
    await this.nar.believe(rewardTerm, Truth.create(Math.abs(reward), confidence));
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

    tdTarget = Math.max(0, Math.min(1, tdTarget));

    await this.qStore.updateValueQLearning(
      state,
      action,
      tdTarget,
      this.config.tdAlpha,
      this.config.tdQLearningConfidence
    );

    const rewardLevel = reward > 0 ? 'high' : reward < 0 ? 'low' : 'neutral';
    const rewardTerm = TermBuilder.inheritance(
      TermBuilder.atom(`reward_${rewardLevel}`),
      TermBuilder.atom('achieved')
    );
    if (!rewardTerm) throw new Error(`Invalid inheritance: reward_${rewardLevel} --> achieved`);
    await this.nar.believe(rewardTerm, Truth.create(Math.abs(reward), confidence));
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

    tdTarget = Math.max(0, Math.min(1, tdTarget));
    await this.qStore.updateValueTD(state, action, tdTarget, this.config.tdConfidence);

    const rewardLevel = reward > 0 ? 'high' : reward < 0 ? 'low' : 'neutral';
    const rewardTerm = TermBuilder.inheritance(
      TermBuilder.atom(`reward_${rewardLevel}`),
      TermBuilder.atom('achieved')
    );
    if (!rewardTerm) throw new Error(`Invalid inheritance: reward_${rewardLevel} --> achieved`);
    await this.nar.believe(rewardTerm, Truth.create(Math.abs(reward), confidence));
  }

  /** Create terminal satisfaction signal (goal term for nar.goal()) */
  createSatisfactionSignal(reward: number): Term {
    const rewardLevel = reward > 0 ? 'high' : reward < 0 ? 'low' : 'neutral';
    return TermBuilder.atom(`reward_${rewardLevel}`);
  }

  getQStore(): QBeliefStore {
    return this.qStore;
  }

  getRewardHistory(): typeof this.rewardHistory {
    return [...this.rewardHistory];
  }
}
