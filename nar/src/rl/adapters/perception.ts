import { SeededRNG } from '../../game/SeededRNG.js';
import { Truth } from '../../index.js';
import type { NAR } from '../../nar.js';
import { TermBuilder } from '../../terms/index.js';

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
    const sanitizedStateId = observation.stateId.replace(/:/g, '_');
    const stateTerm = TermBuilder.atom(sanitizedStateId);
    const selfTerm = TermBuilder.atom('self');
    const stateInheritance = TermBuilder.inheritance(selfTerm, stateTerm);
    if (!stateInheritance) throw new Error(`Invalid inheritance: ${selfTerm} --> ${stateTerm}`);
    await this.nar.believe(stateInheritance, Truth.create(1.0, this.config.sensorConfidence));

    // Feature observations
    if (observation.features) {
      for (const [feature, value] of Object.entries(observation.features)) {
        const featureTerm = TermBuilder.atom(`feature_${feature}`);
        const valueTerm = TermBuilder.atom(value > 0 ? 'present' : 'absent');
        const featureInheritance = TermBuilder.inheritance(featureTerm, valueTerm);
        if (!featureInheritance) throw new Error(`Invalid inheritance: ${featureTerm} --> ${valueTerm}`);
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
      const rewardTerm = TermBuilder.inheritance(
        TermBuilder.atom(`reward_${rewardLevel}`),
        TermBuilder.atom('achieved')
      );
      if (!rewardTerm) throw new Error(`Invalid inheritance: reward:${rewardLevel} --> achieved`);
      const confidence = Math.min(0.95, 0.5 + Math.abs(observation.reward) * 0.4);
      await this.nar.believe(rewardTerm, Truth.create(Math.abs(observation.reward), confidence));
    }

    // Terminal state observation
    if (observation.terminal) {
      const terminalTerm = TermBuilder.inheritance(
        TermBuilder.atom('state_terminal'),
        TermBuilder.atom('reached')
      );
      if (!terminalTerm) throw new Error(`Invalid inheritance: state:terminal --> reached`);
      await this.nar.believe(terminalTerm, Truth.create(1.0, this.config.sensorConfidence));
    }
  }

  /** Add noisy observation (for testing sensor reliability) */
  async perceiveNoisy(observation: RLObservation, noiseLevel: number): Promise<void> {
    const baseConfidence = this.config.sensorConfidence;
    const noisyConfidence = Math.max(0.1, baseConfidence - noiseLevel * this.rng.next());

    const sanitizedStateId = observation.stateId.replace(/:/g, '_');
    const stateTerm = TermBuilder.atom(sanitizedStateId);
    const selfTerm = TermBuilder.atom('self');
    const stateInheritance = TermBuilder.inheritance(selfTerm, stateTerm);
    if (!stateInheritance) throw new Error(`Invalid inheritance: ${selfTerm} --> ${stateTerm}`);
    await this.nar.believe(stateInheritance, Truth.create(1.0, noisyConfidence));
  }

  getNAR(): NAR {
    return this.nar;
  }
}
