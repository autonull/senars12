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

// Re-export NAR memory types
export { ConceptGraph, type ConceptGraphOptions, type CoActivationEdge } from '@senars/nar/memory/ConceptGraph.js';
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