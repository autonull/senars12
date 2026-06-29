/**
 * RLFP Service
 * Handles RLFP (Reinforcement Learning from Policy Feedback) state
 */

import type { NAR } from '../../../nar/src';
import type { Logger } from '../../../nar/src/logger';
import { createLogger } from '../../../nar/src/logger';

export interface RLFPState {
  enabled: boolean;
  policy: Record<string, number>;
  qValues: Record<string, number>;
  explorationRate: number;
  totalRewards: number;
  totalSteps: number;
}

export interface RLFPServiceConfig {
  nar?: NAR;
  logger?: Logger;
}

export class RLFPService {
  private readonly nar?: NAR;
  private readonly logger: Logger;

  constructor(config: RLFPServiceConfig = {}) {
    this.nar = config.nar;
    this.logger = config.logger ?? createLogger({ scope: 'agent:rlfp' });
  }

  getState(): RLFPState | null {
    const rlfp = this.nar?.getRLFP?.() as unknown as {
      policyOptimizerPublic?: {
        getAllStrategies?: () => string[];
        getStrategyStats?: (s: string) => { priority: number };
        config?: { explorationRate?: number };
      };
      trajectoryCount?: number;
    };

    if (!rlfp) return null;

    const policyOptimizer = rlfp.policyOptimizerPublic;
    return {
      enabled: true,
      policy: Object.fromEntries(
        policyOptimizer
          ?.getAllStrategies?.()
          .map((s: string) => [s, policyOptimizer.getStrategyStats?.(s)?.priority ?? 1]) ?? []
      ),
      qValues: {},
      explorationRate: policyOptimizer?.config?.explorationRate ?? 0.1,
      totalRewards: rlfp.trajectoryCount ?? 0,
      totalSteps: rlfp.trajectoryCount ?? 0,
    };
  }

  reset(): void {
    const rlfp = this.nar?.getRLFP?.() as unknown as { reset?: () => void };
    if (rlfp?.reset) {
      rlfp.reset();
      this.logger.info('RLFP reset');
    }
  }

  provideFeedback(reward: number, context?: string): void {
    const rlfp = this.nar?.getRLFP?.() as unknown as {
      reward?: (reward: number, context?: string) => void;
    };
    if (rlfp?.reward) {
      rlfp.reward(reward, context);
      this.logger.debug('RLFP feedback provided', { reward, context });
    }
  }
}
