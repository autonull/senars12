export { SeededRNG } from '@senars/util';
export {
  ASK_LM,
  actionsForTier,
  CLARIFY,
  CONSOLIDATE,
  CYCLE,
  DEFAULT_ACTIONS,
  REST,
  REVISE,
  SPAWN_SUBGOAL,
  tuneAction,
} from './actions.js';
export type { Game, GameOutcome, MetaGame, Perception, SelfMetaGame } from './Game.js';
export type { ArithmeticGameConfig, ArithmeticState } from './impls/ArithmeticGame.js';
export { ArithmeticGame, createArithmeticGame } from './impls/ArithmeticGame.js';
export type { BanditDriftConfig, BanditGameConfig } from './impls/BanditGame.js';
export { BanditGame, createBanditGame } from './impls/BanditGame.js';
export type { CatchGameConfig, CatchState } from './impls/CatchGame.js';
export { CatchGame, createCatchGame } from './impls/CatchGame.js';
export type { Game2048Config, Game2048State, Move2048 } from './impls/Game2048.js';
export { createGame2048, Game2048 } from './impls/Game2048.js';
export type { GridAction, GridWorldConfig, GridWorldState } from './impls/GridWorldGame.js';
export { createGridWorldGame, GridWorldGame } from './impls/GridWorldGame.js';
export { createMetaGame, MetaGame as MetaGameClass } from './impls/MetaGame.js';
export type {
  ReasoningGameOptions,
  ReasoningGameSpec,
  ReasoningState,
  ReasoningTask,
} from './impls/ReasoningGame.js';
// ReasoningGame exports (from former cognition/)
export { createReasoningGame, REASONING_SPECS, ReasoningGame } from './impls/ReasoningGame.js';
export type { RPSGameConfig, RPSState } from './impls/RPSGame.js';
export { createRPSGame, RPSGame } from './impls/RPSGame.js';
export type { KnobConfig, SelfMetaGameConfig } from './impls/SelfMetaGame.js';
export { createSelfMetaGame, SelfMetaGameImpl } from './impls/SelfMetaGame.js';
export type { Cell, Direction, SnakeGameConfig, SnakeState } from './impls/SnakeGame.js';
export { createSnakeGame, SnakeGame } from './impls/SnakeGame.js';
export type { TetrisGameConfig, TetrisPlacement, TetrisState } from './impls/TetrisGame.js';
export { createTetrisGame, TetrisGame } from './impls/TetrisGame.js';
export type {
  Player as TicTacToePlayer,
  TicTacToeAction,
  TicTacToeConfig,
  TicTacToeState,
} from './impls/TicTacToe.js';
export { createTicTacToeGame, minimax, TicTacToeGame } from './impls/TicTacToe.js';
export { describeMetaGameActions, FOCUS_WEIGHT_STEPS, KNOB_SET_VALUES } from './meta-spec.js';
export {
  ActionRegistry,
  ComponentRegistry,
  createCognitionRegistries,
  RewardRegistry,
  SensorRegistry,
} from './registries.js';
export type { GameSpec } from './registry.js';
export { createArcadeRegistry, GameRegistry, UnknownGameError } from './registry.js';
export { renderGame } from './render.js';
export {
  AMBIGUITY_REDUCTION_REWARD,
  CONSOLIDATION_REWARD,
  composeReward,
  DEFAULT_REWARDS,
  GROUNDEDNESS_REWARD,
  SPEND_EFFICIENCY_REWARD,
  TASK_SETTLED_REWARD,
  VETO_PENALTY,
} from './rewards.js';
export {
  BagPressureSensor,
  DEFAULT_SENSORS,
  DerivationBacklogSensor,
  GovernanceQueueSensor,
  HeadHealthSensor,
  SpendSensor,
  TaskTypeMixSensor,
  VetoHandoverRateSensor,
} from './sensors.js';
export type {
  ActionExecutionContext,
  CognitionAction,
  CognitionContext,
  NARState,
  Reward,
  RewardClassification,
  Sensor,
  SensorReading,
} from './types.js';
export { clamp01, failClosed } from './types.js';
