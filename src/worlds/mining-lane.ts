/**
 * Mining Lane — schema induction as a fold query over the event log.
 *
 * Registers the SchemaMiner as a mining lane in the worlds system.
 * Runs AIKR-bounded induction on derivation chains from the log.
 */

export {
  SchemaMiner,
  createSchemaMiner,
  type MiningContext,
  type SchemaMiningConfig,
  type MiningEvent,
  type SurpriseEvent,
  type PatternEvent,
  detectSurprise,
  findPatterns,
  createMiningProcessor,
  type MiningAikrConfig,
} from '../mining/schema-mining';

export {
  SchemaInductor,
  createSchemaInductor,
  type SchemaPattern,
  type InductionResult,
  type SchemaInductionConfig,
  type DerivationChainItem,
} from '../learning/schema-induction';

/** Mining lane configuration for world packs. */
export interface MiningLaneConfig {
  /** Lane identifier. */
  id: string;
  /** Mining configuration. */
  config: Partial<SchemaMiningConfig>;
  /** Whether to run continuously. */
  continuous: boolean;
  /** Mining interval in ms. */
  intervalMs: number;
}

/** Default mining lane configuration. */
export const DEFAULT_MINING_LANE_CONFIG: MiningLaneConfig = {
  id: 'schema-induction',
  config: {
    enableSchemaInduction: true,
    enableSurprise: true,
    minDerivationSteps: 3,
    minConfidenceForInduction: 0.6,
    maxSchemas: 50,
    inductionIntervalMs: 300_000,
    capacity: 256,
    pressureThreshold: 0.7,
    surpriseThreshold: 0.5,
    domainLearners: [],
  },
  continuous: true,
  intervalMs: 60_000,
};

/** Create a mining lane from a mining context. */
export function createMiningLane(
  context: MiningContext,
  config: Partial<MiningLaneConfig> = {}
): { miner: SchemaMiner; laneConfig: MiningLaneConfig } {
  const laneConfig = { ...DEFAULT_MINING_LANE_CONFIG, ...config };
  const miner = createSchemaMiner(context, laneConfig.config);
  return { miner, laneConfig };
}

/** Run a mining cycle. */
export async function runMiningCycle(
  miner: SchemaMiner
): Promise<{
  schemas: InductionResult[];
  events: MiningEvent[];
  surpriseCount: number;
}> {
  return miner.runCycle();
}

/** Admit a derivation chain for induction. */
export function admitDerivationChain(
  miner: SchemaMiner,
  chain: readonly Task[]
): void {
  miner.admitDerivationChain(chain);
}

import type { Task } from '../types/task';
import type { InductionResult } from '../learning/schema-induction';
import type { MiningEvent } from '../mining/schema-mining';
import { SchemaMiner, createSchemaMiner, type MiningContext, type SchemaMiningConfig, type MiningEvent } from '../mining/schema-mining';
import { SchemaInductor, createSchemaInductor, type SchemaInductionConfig, type DerivationChainItem, type SchemaPattern, type InductionResult } from '../learning/schema-induction';