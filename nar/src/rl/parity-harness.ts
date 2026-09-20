import { SeededRNG } from '../game/SeededRNG.js';

/**
 * Main harness for running RL parity experiments
 */
export interface RLParityHarnessConfig {
  seed: number;
  maxEpisodes: number;
  maxStepsPerEpisode: number;
  narConfig?: any;
}

export interface ParityMetrics {
  baselineRewards: number[];
  senarsRewards: number[];
  avgBaselineReward: number;
  avgSenarsReward: number;
  policyAgreement: number;
  valueCorrelation: number;
}

export class RLParityHarness {
  private readonly config: RLParityHarnessConfig;
  private readonly rng: SeededRNG;

  constructor(config: RLParityHarnessConfig) {
    this.config = config;
    this.rng = new SeededRNG(config.seed);
  }

  /** Run baseline algorithm on environment */
  async runBaseline<Env, Agent>(
    env: Env,
    agent: Agent,
    runEpisode: (env: Env, agent: Agent) => number
  ): Promise<number[]> {
    const rewards: number[] = [];
    for (let ep = 0; ep < this.config.maxEpisodes; ep++) {
      const reward = runEpisode(env, agent);
      rewards.push(reward);
    }
    return rewards;
  }

  /** Compute policy agreement between two agents */
  computePolicyAgreement(baselineQ: Map<string, number[]>, senarsQ: Map<string, number[]>): number {
    let agreements = 0;
    let total = 0;

    for (const [stateKey, baselineQVals] of baselineQ) {
      const senarsQVals = senarsQ.get(stateKey);
      if (!senarsQVals) continue;

      const baselineAction = baselineQVals.indexOf(Math.max(...baselineQVals));
      const senarsAction = senarsQVals.indexOf(Math.max(...senarsQVals));

      if (baselineAction === senarsAction) agreements++;
      total++;
    }

    return total > 0 ? agreements / total : 0;
  }

  /** Compute value correlation between two Q-tables */
  computeValueCorrelation(
    baselineQ: Map<string, number[]>,
    senarsQ: Map<string, number[]>
  ): number {
    const baselineVals: number[] = [];
    const senarsVals: number[] = [];

    for (const [stateKey, baselineQVals] of baselineQ) {
      const senarsQVals = senarsQ.get(stateKey);
      if (!senarsQVals) continue;

      for (let i = 0; i < baselineQVals.length; i++) {
        const bv = baselineQVals[i];
        const sv = senarsQVals[i];
        if (bv === undefined || sv === undefined) continue;
        baselineVals.push(bv);
        senarsVals.push(sv);
      }
    }

    if (baselineVals.length < 2) return 0;

    const n = baselineVals.length;
    const sumX = baselineVals.reduce((a, b) => a + b, 0);
    const sumY = senarsVals.reduce((a, b) => a + b, 0);
    const sumXY = baselineVals.reduce((a, b, i) => a + b * (senarsVals[i] ?? 0), 0);
    const sumX2 = baselineVals.reduce((a, b) => a + b * b, 0);
    const sumY2 = senarsVals.reduce((a, b) => a + b * b, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  getRNG(): SeededRNG {
    return this.rng;
  }
}
