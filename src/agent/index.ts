/**
 * Agent — NAR agent and builder (migrated from @senars/nar/agent).
 */

export type { NARConfig } from '@senars/nar';
export { NAR } from '@senars/nar';
export type { BinAgentApi as Agent } from '@senars/nar/agent';
export { createAgent } from '@senars/nar/agent';
export { NARBuilder } from '@senars/nar/agent/builder';
export type { ExtendedAgent } from '@senars/nar/agent';
export type { WiredNAR } from '@senars/nar/agent/builder';
export { createNAR } from '@senars/nar';
export { createBotNAR, createMinimalNAR, createTestNAR } from '@senars/nar';
export { DEFAULT_CONFIG } from '@senars/nar';
export { DEFAULT_NAR_STATE_PATH, readPersistedBoundary } from '@senars/nar';
export { createLMService, createSeNARSRegistry } from '@senars/nar/lm';
export type { NAREventMap } from '@senars/nar/types';
export { coreCommands, episodesCommands, lmCommands, memoryCommands, narCommands, rlfpCommands, selfCommands } from '@senars/nar/commands';
export type { ScenarioProfile } from '@senars/nar/imagination';
export { CognitiveTreadmill, ScenarioGenerator } from '@senars/nar/imagination';
export { ArchitectureDriver } from '@senars/nar/self';
export type { ToolSpec as Tool, ToolResult, ToolSchema, ToolSchemaProperty } from '@senars/util/types/tools';
export type { ChatStreamEvent } from '@senars/util/types/cognitive';
export { withinWorkspace } from '@senars/core';
export { Truth } from '@senars/nar/terms';

// Re-export core Agent class as CoreAgent
export { Agent as CoreAgent, type AgentOptions } from '@senars/core';

// Re-export NAR engine
export { NAREngine } from '@senars/nar/engine';
export { BaseEngine } from '@senars/core';
export { KernelBudgetGate, KernelPerceptionGate, KernelActionGate, KernelRewardGate, KernelLedger } from '@senars/nar/kernel';
export { TaskManager } from '@senars/nar/task/index.js';
export { GameRegistry, createArcadeRegistry, type GameSpec, UnknownGameError } from '@senars/nar/game/registry.js';
export { ActionRegistry, ComponentRegistry, createCognitionRegistries, RewardRegistry, SensorRegistry } from '@senars/nar/game/registries.js';
// Strategy is re-exported from strategies below

// Re-export Log types for compatibility
export { InMemoryEventLog, LogStoreEventLog, createLogStoreEventLog } from '@senars/log/EventLogAdapter.js';

// Re-export NAR memory types
export { ConceptGraph, type ConceptGraphOptions, type CoActivationEdge } from '@senars/nar/memory/ConceptGraph.js';
export { EpisodicMemory } from '@senars/nar/memory/episodic';
export { EpisodeConsolidator, symbolicSummary } from '@senars/nar/memory/episode-consolidator.js';
export type { ConsolidationResult, EpisodeConsolidatorOptions } from '@senars/nar/memory/episode-consolidator.js';
export { Memory } from '@senars/nar/memory/index.js';
export type { ConceptTaskType, MemoryConfig } from '@senars/nar/memory/index.js';
export { PriorityBag } from '@senars/nar/bag/Bag.js';
export { ToolManager } from '@senars/nar/tools/impls/ToolManager.js';

// Re-export NAR game types
export type { Game, GameOutcome, MetaGame, Perception, SelfMetaGame } from '@senars/nar/game/Game.js';
export type { ArithmeticGameConfig, ArithmeticState } from '@senars/nar/game/impls/ArithmeticGame.js';
export { ArithmeticGame, createArithmeticGame } from '@senars/nar/game/impls/ArithmeticGame.js';
export type { BanditDriftConfig, BanditGameConfig } from '@senars/nar/game/impls/BanditGame.js';
export { BanditGame, createBanditGame } from '@senars/nar/game/impls/BanditGame.js';
export type { CatchGameConfig, CatchState } from '@senars/nar/game/impls/CatchGame.js';
export { CatchGame, createCatchGame } from '@senars/nar/game/impls/CatchGame.js';
export type { ConversationAction, ConversationState } from '@senars/nar/game/impls/ConversationGame.js';
export { ConversationGame } from '@senars/nar/game/impls/ConversationGame.js';
export type { Game2048Config, Game2048State, Move2048 } from '@senars/nar/game/impls/Game2048.js';
export { createGame2048, Game2048 } from '@senars/nar/game/impls/Game2048.js';
export type { GridAction, GridWorldConfig, GridWorldState } from '@senars/nar/game/impls/GridWorldGame.js';
export { createGridWorldGame, GridWorldGame } from '@senars/nar/game/impls/GridWorldGame.js';
export { createMetaGame, MetaGame as MetaGameClass } from '@senars/nar/game/impls/MetaGame.js';
export type { ReasoningGameOptions, ReasoningGameSpec, ReasoningState, ReasoningTask } from '@senars/nar/game/impls/ReasoningGame.js';
export { createReasoningGame, REASONING_SPECS, ReasoningGame } from '@senars/nar/game/impls/ReasoningGame.js';
export { ReasoningMetaGame } from '@senars/nar/game/impls/ReasoningMetaGame.js';
export type { RPSGameConfig, RPSState } from '@senars/nar/game/impls/RPSGame.js';
export { createRPSGame, RPSGame } from '@senars/nar/game/impls/RPSGame.js';
export type { KnobConfig, SelfMetaGameConfig } from '@senars/nar/game/impls/SelfMetaGame.js';
export { createSelfMetaGame, SelfMetaGameImpl } from '@senars/nar/game/impls/SelfMetaGame.js';
export type { Cell, Direction, SnakeGameConfig, SnakeState } from '@senars/nar/game/impls/SnakeGame.js';
export { createSnakeGame, SnakeGame } from '@senars/nar/game/impls/SnakeGame.js';
export type { TetrisGameConfig, TetrisPlacement, TetrisState } from '@senars/nar/game/impls/TetrisGame.js';
export { createTetrisGame, TetrisGame } from '@senars/nar/game/impls/TetrisGame.js';
export type { Player as TicTacToePlayer, TicTacToeAction, TicTacToeConfig, TicTacToeState } from '@senars/nar/game/impls/TicTacToe.js';
export { createTicTacToeGame, minimax, TicTacToeGame } from '@senars/nar/game/impls/TicTacToe.js';

// Re-export NAR cognitive types
export { CognitiveController } from '@senars/nar/cognitive/impls/CognitiveController.js';
export { runCounterfactual } from '@senars/nar/cognitive/impls/counterfactual.js';
export {
  CognitiveRegistry,
  createDefaultRegistry,
  resolveSlot,
} from '@senars/nar/cognitive/impls/CognitiveRegistry.js';

// Re-export NAR strategies/attention types
export {
  AllSelector,
  AnytimeDerivation,
  CompositeAttention,
  DefaultDerivation,
  DiverseSampling,
  DiverseSelector,
  FocusedDerivation,
  GoalBiasedSampling,
  GoalRelevanceAttention,
  NullAttentionModel,
  NoveltySampling,
  PrioritySampling,
  PrioritySelector,
  RotationSelector,
  SampledDerivation,
  SimpleAttention,
  SpreadingActivation,
} from '@senars/nar/strategies/index.js';
export type {
  AttentionContext,
  AttentionModel,
  ComponentMetadata,
  DerivationContext,
  DerivationStrategy,
  ModelRuleSelectionContext,
  ModelRuleSelector,
  MetricsSummary,
  SamplingStrategy,
  SearchSpace,
  SearchSpaceParam,
  Strategy,
  StrategyType,
} from '@senars/nar/strategies/types.js';
export type {
  StrategyCatalog,
  StrategyConfig,
  StrategyFactoryDeps,
  StrategyRegistration,
  StrategyRegistry,
  StrategySpec,
} from '@senars/nar/strategies/registration.js';