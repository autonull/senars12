import { maxScore, pearson, SeededRNG, safeRatio } from '@senars/util';

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

      const baselineAction = baselineQVals.indexOf(maxScore(baselineQVals, (q) => q));
      const senarsAction = senarsQVals.indexOf(maxScore(senarsQVals, (q) => q));

      if (baselineAction === senarsAction) agreements++;
      total++;
    }

    return safeRatio(agreements, total);
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

    return pearson(baselineVals, senarsVals);
  }

  getRNG(): SeededRNG {
    return this.rng;
  }
}
