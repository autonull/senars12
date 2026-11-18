/**
 * NAR facade port — the subset of NAR that the facade functions need.
 * Extracted to break nar.ts <-> facade/index.ts cycle.
 */

import type { LanguageModel } from 'ai';
import type { Term } from '../terms';
import type { Tool } from '../tools';
import type { LMRule } from '../lm/rule/LMRule.js';
import type { SeNARSRegistry } from '../lm';
import type { SystemOneDispatcher } from '../lm/system-one/types.js';
import type { SystemOneEmbeddingCache } from '../lm/system-one/embedding-cache.js';
import type { SystemOneManifold } from '../lm/system-one/types.js';
import type { SystemEventBus } from '../types/events.js';
import type { Processor } from '../rules';
import type { ToolManager } from '../tools/impls/ToolManager.js';
import type { CognitiveController } from '../cognitive';
import type { RLFPLearner } from '../rlfp';
import type { GovernanceResolver } from '../governance/pipeline.js';
import type { SchemaInductor } from '../learning/schema-induction.js';
import type { SystemOneContrastive } from '../lm/system-one/contrastive.js';
import type { EpisodeConsolidator } from '../memory/episode-consolidator.js';
import type { MiningBag } from '../lm/system-one/hard-negatives.js';
import type { ProofMettaProposer } from '../meta/index.js';
import type { QueryAPI } from '../query/api';
import type { LMClient } from '../lm/lm-service.js';
import type { NARConfig } from './config.js';

export interface NARFacadePort {
  getProviderRegistry(): SeNARSRegistry | undefined;
  input(term: string, type: string, truth?: unknown, correlationId?: string): Promise<void>;
  executeTool(tool: string, args: Record<string, unknown>): Promise<unknown>;
  getSystemOneDispatcher(): SystemOneDispatcher | undefined;
  getCycleCount(): number;
  getSystemOneEmbeddingCache(): SystemOneEmbeddingCache | undefined;
  getSystemOneManifold(): SystemOneManifold | undefined;
  logger: unknown;
  getSystemEventBus(): SystemEventBus;
  getProcessor(): Processor;
  getConfig(): NARConfig;
  tools: ToolManager;
  getRLFP(): RLFPLearner | undefined;
  getController(): CognitiveController | undefined;
  getGovernanceResolver(): GovernanceResolver | undefined;
  getSchemaInductor(): SchemaInductor | undefined;
  getSystemOneContrastive(): SystemOneContrastive | undefined;
  getEpisodeConsolidator(): EpisodeConsolidator | undefined;
  getMiningBag(): MiningBag | undefined;
  getProofMettaProposer(): ProofMettaProposer | undefined;
  getLMClient(): LMClient | undefined;
  query: QueryAPI;
  memory: unknown;
  run(cycles: number): Promise<void>;
}