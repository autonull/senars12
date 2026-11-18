/**
 * NAR facade port — the subset of NAR that the facade functions need.
 * Extracted to break nar.ts <-> facade/index.ts cycle.
 */

import type { LanguageModel } from 'ai';
import type { Term } from '../terms';
import type { Tool } from '../tools';
import type { LMRule } from '../lm/rule/LMRule.js';
import type { SeNARSRegistry } from '../lm';
import type { CognitiveDispatcher, JudgmentManifold } from '../lm/system-one/types.js';
import type { EmbeddingCache } from '../lm/system-one/embedding-cache.js';
import type { NarEventBus } from '../types/events.js';
import type { RuleProcessor } from '../rules/impls/processor.js';
import type { ToolManager } from '../tools/impls/ToolManager.js';
import type { CognitiveController } from '../cognitive';
import type { RLFPLearner } from '../rlfp';
import type { GovernanceResolver } from '../governance/pipeline.js';
import type { SchemaInductor } from '../learning/schema-induction.js';
import type { ContrastiveMemory } from '../lm/system-one/contrastive.js';
import type { EpisodeConsolidator } from '../memory/episode-consolidator.js';
import type { Memory } from '../memory';
import type { MiningBag } from '../lm/system-one/hard-negatives.js';
import type { ProofMettaProposer } from '../meta/index.js';
import type { QueryAPI } from '../query/api';
import type { LMService } from '../lm/lm-service.js';
import type { NARConfig } from './config.js';
import type { TaskType, TruthType, Task } from '../types';
import type { NARExecution } from '../nar-execution.js';
import type { GateRegistry } from '../kernel/GateRegistry.js';

export interface NARFacadePort {
  getProviderRegistry(): SeNARSRegistry | undefined;
  input(input: string | Term, type?: TaskType, truth?: TruthType, correlationId?: string): Promise<void>;
  executeTool(tool: string, args: Record<string, unknown>): Promise<unknown>;
  getSystemOneDispatcher(): CognitiveDispatcher | undefined;
  getCycleCount(): number;
  getSystemOneEmbeddingCache(): EmbeddingCache | undefined;
  getSystemOneManifold(): JudgmentManifold | undefined;
  logger: import('@senars/util').ScopedLogger | undefined;
  getSystemEventBus(): NarEventBus;
  getProcessor(): RuleProcessor;
  getConfig(): NARConfig;
  tools: ToolManager;
  getRLFP(): RLFPLearner | undefined;
  getController(): CognitiveController | undefined;
  getGovernanceResolver(): GovernanceResolver | undefined;
  getSchemaInductor(): SchemaInductor | undefined;
  getSystemOneContrastive(correlationId?: string): ContrastiveMemory | undefined;
  getEpisodeConsolidator(): EpisodeConsolidator | undefined;
  getMiningBag(): MiningBag | undefined;
  getProofMettaProposer(): ProofMettaProposer | undefined;
  getLMClient(): LMService | undefined;
  query: QueryAPI;
  memory: Memory;
  run(cycles: number, signal?: AbortSignal, correlationId?: string): Promise<number>;
  step(signal?: AbortSignal, correlationId?: string): Promise<number>;
  pause(): void;
  resume(): void;
  getControlState(): import('@senars/core/schemas').KernelControlState;
  getAutonomyConfig(): import('../autonomy').AutonomyConfig;
  getEventBus(): NarEventBus;
  getRuleTable(): import('../rules/impls/rule-table.js').RuleTableStore;
  getProposalLog(): readonly import('@senars/core/schemas').CognitiveEvent[];
  getFocusBag(): import('../focus/FocusBag.js').FocusBag;
  getAttachedGames(): string[];
  getSelfMetaGame(): import('../game/impls/SelfMetaGame.js').SelfMetaGameImpl;
  getMetricsCollector(): import('../metrics').MetricsCollector;
  getExecution(): NARExecution | undefined;
  gates: GateRegistry;
  checkConstitutionViolation(belief: Task): boolean;
  getConstitution(): Task[];
}