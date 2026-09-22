import { SeededRNG } from '../../game/SeededRNG.js';
import { Truth } from '../../index.js';
import type { NAR } from '../../nar.js';
import { atm, inh } from '../terms.js';

export interface RLObservation {
  stateId: string;
  features?: Record<string, number>;
  reward?: number;
  terminal?: boolean;
  timestamp?: number;
}

export interface BeliefPerceptionAdapterConfig {
  sensorConfidence?: number;
  featureConfidence?: number;
}

interface ResolvedBeliefPerceptionAdapterConfig {
  sensorConfidence: number;
  featureConfidence: number;
}

export class BeliefPerceptionAdapter {
  private readonly nar: NAR;
  private readonly config: ResolvedBeliefPerceptionAdapterConfig;
  private readonly rng: SeededRNG;

  constructor(nar: NAR, config: BeliefPerceptionAdapterConfig = {}, seed = 1) {
    this.nar = nar;
    this.config = {
      sensorConfidence: config.sensorConfidence ?? 0.95,
      featureConfidence: config.featureConfidence ?? 0.9,
    };
    this.rng = new SeededRNG(seed);
  }

  /** Convert an RL observation to belief tasks and input them to NAR */
  async perceive(observation: RLObservation): Promise<void> {
    // State observation: (self --> state:s_X_Y)
    const stateTerm = atm(observation.stateId);
    const selfTerm = atm('self');
    const stateInheritance = inh(selfTerm, stateTerm);
    await this.nar.believe(stateInheritance, Truth.create(1.0, this.config.sensorConfidence));

    // Feature observations
    if (observation.features) {
      for (const [feature, value] of Object.entries(observation.features)) {
        const featureTerm = atm(`feature:${feature}`);
        const valueTerm = atm(value > 0 ? 'present' : 'absent');
        const featureInheritance = inh(featureTerm, valueTerm);
        await this.nar.believe(
          featureInheritance,
          Truth.create(1.0, this.config.featureConfidence)
        );
      }
    }

    // Reward observation if present
    if (observation.reward !== undefined) {
      const rewardLevel =
        observation.reward > 0 ? 'high' : observation.reward < 0 ? 'low' : 'neutral';
      const rewardTerm = inh(atm(`reward:${rewardLevel}`), atm('achieved'));
      const confidence = Math.min(0.95, 0.5 + Math.abs(observation.reward) * 0.4);
      await this.nar.believe(rewardTerm, Truth.create(Math.abs(observation.reward), confidence));
    }

    // Terminal state observation
    if (observation.terminal) {
      const terminalTerm = inh(atm('state:terminal'), atm('reached'));
      await this.nar.believe(terminalTerm, Truth.create(1.0, this.config.sensorConfidence));
    }
  }

  /** Add noisy observation (for testing sensor reliability) */
  async perceiveNoisy(observation: RLObservation, noiseLevel: number): Promise<void> {
    const baseConfidence = this.config.sensorConfidence;
    const noisyConfidence = Math.max(0.1, baseConfidence - noiseLevel * this.rng.next());

    const stateTerm = atm(observation.stateId);
    const selfTerm = atm('self');
    const stateInheritance = inh(selfTerm, stateTerm);
    await this.nar.believe(stateInheritance, Truth.create(1.0, noisyConfidence));
  }

  getNAR(): NAR {
    return this.nar;
  }
}
