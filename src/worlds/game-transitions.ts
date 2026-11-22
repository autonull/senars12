/**
 * Game Transitions & Rewards — Habitat registry entries for all 14 games.
 *
 * Bridges the `Game` interface to the `Habitat` interface by mapping:
 * - Game state → Habitat entities/agent/env
 * - Game actions → Habitat actions
 * - Game rewards → Habitat rewards
 */

import type { HabitatRegistry, HabitatState, HabitatAction, HabitatConfig, EntityState, AgentState } from './habitat';
import type { Game, GameOutcome, Perception } from '../game/Game';
import { createArithmeticGame, ArithmeticState } from '../game/impls/ArithmeticGame';
import { createBanditGame } from '../game/impls/BanditGame';
import { createCatchGame, CatchState } from '../game/impls/CatchGame';
import { createGame2048, Game2048State } from '../game/impls/Game2048';
import { createGridWorldGame, GridWorldState } from '../game/impls/GridWorldGame';
import { createReasoningGame, ReasoningState, generateEvalTasks } from '../game/impls/ReasoningGame';
import { createRPSGame, RPSState } from '../game/impls/RPSGame';
import { createSnakeGame, SnakeState } from '../game/impls/SnakeGame';
import { createTetrisGame, TetrisState } from '../game/impls/TetrisGame';
import { createTicTacToeGame, TicTacToeState } from '../game/impls/TicTacToe';
import { createConversationGame, ConversationState } from '../game/impls/ConversationGame';
import { createMetaGame, MetaGameState } from '../game/impls/MetaGame';
import { createSelfMetaGame, SelfMetaGameConfig } from '../game/impls/SelfMetaGame';
import { SeededRNG } from '@senars/util/random';

/** Internal game instance stored in habitat entities. */
interface GameEntity extends EntityState {
  properties: Map<string, unknown> & {
    gameInstance: Game<any, any>;
    gameType: string;
  };
}

type GameEntityProps = Map<string, unknown> & { gameInstance: Game<any, any>; gameType: string };

/** Get or create game instance from habitat state. */
function getGameInstance(state: HabitatState, habitatId: string): Game<any, any> {
  const entity = state.entities.get(habitatId);
  if (!entity || !entity.properties) {
    throw new Error(`Game entity not found: ${habitatId}`);
  }
  const props = entity.properties as GameEntityProps;
  return props.gameInstance;
}

/** Create initial habitat state for a game. */
function createGameInitialState(config: HabitatConfig, game: Game<any, any>): HabitatState {
  const perception = game.observe();
  const gameState = game.state();

  const props = new Map<string, unknown>([
    ['gameInstance', game],
    ['gameType', config.metadata.game],
    ['perception', perception],
    ['gameState', gameState],
  ]) as GameEntityProps;

  const entity: GameEntity = {
    type: 'game',
    position: { x: 0, y: 0 },
    properties: props,
    active: true,
  };

  return {
    step: 0,
    episode: 0,
    entities: new Map([[config.id, entity]]),
    agent: { inventory: [], energy: 100, internal: new Map() },
    env: new Map(Object.entries(config.initialState.env)),
    rngState: config.seed.toString(),
  };
}

/** Arithmetic transition. */
function arithmeticTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  const game = getGameInstance(state, config.id) as Game<ArithmeticState, number>;
  const outcome = game.step(action.params.action as number);
  const perception = game.observe();
  const gameState = game.state();

  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  props.set('perception', perception);
  props.set('gameState', gameState);

  return {
    ...state,
    step: state.step + 1,
    entities: new Map(state.entities).set(config.id, entity),
  };
}

/** Arithmetic reward. */
function arithmeticReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  const entity = nextState.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  const gameState = props.get('gameState') as ArithmeticState;
  return gameState.questionIndex > (props.get('prevQuestionIndex') as number) ? 1 : 0;
}

/** Bandit transition. */
function banditTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  const game = getGameInstance(state, config.id);
  const outcome = game.step(action.params.action as number);
  const perception = game.observe();
  const gameState = game.state();

  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  props.set('perception', perception);
  props.set('gameState', gameState);

  return { ...state, step: state.step + 1, entities: new Map(state.entities).set(config.id, entity) };
}

/** Bandit reward (regret = optimal - actual). */
function banditReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  const entity = nextState.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  const gameState = props.get('gameState') as { stepCount: number; pulls: number[]; rewardSum: number[]; armMeans?: number[] };
  const armMeans = props.get('armMeans') as number[];
  if (!armMeans) return 0;
  const optimal = Math.max(...armMeans);
  const actionIdx = action.params.action as number;
  const actual = armMeans[actionIdx] ?? 0;
  return optimal - actual; // regret
}

/** Catch transition. */
function catchTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  const game = getGameInstance(state, config.id) as Game<CatchState, 0 | 1 | 2>;
  const outcome = game.step(action.params.action as 0 | 1 | 2);
  const perception = game.observe();
  const gameState = game.state();

  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  props.set('perception', perception);
  props.set('gameState', gameState);

  return { ...state, step: state.step + 1, entities: new Map(state.entities).set(config.id, entity) };
}

/** Catch reward (caught = +1, missed = -1). */
function catchReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  const entity = nextState.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  const gameState = props.get('gameState') as CatchState;
  // Reward is determined by whether target was caught at bottom row
  return gameState.targetR === gameState.step ? 1 : -1;
}

/** 2048 transition. */
function game2048Transition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  const game = getGameInstance(state, config.id) as Game<Game2048State, 0 | 1 | 2 | 3>;
  const outcome = game.step(action.params.action as 0 | 1 | 2 | 3);
  const perception = game.observe();
  const gameState = game.state();

  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  props.set('perception', perception);
  props.set('gameState', gameState);

  return { ...state, step: state.step + 1, entities: new Map(state.entities).set(config.id, entity) };
}

/** 2048 reward (score based on merges). */
function game2048Reward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  const entity = nextState.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  const gameState = props.get('gameState') as Game2048State;
  // Reward based on max tile achieved
  const maxTile = Math.max(...gameState.board.flat());
  return Math.log2(maxTile) / 11; // normalize to ~1 at 2048
}

/** GridWorld transition. */
function gridworldTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  const game = getGameInstance(state, config.id) as Game<GridWorldState, 0 | 1 | 2 | 3>;
  const outcome = game.step(action.params.action as 0 | 1 | 2 | 3);
  const perception = game.observe();
  const gameState = game.state();

  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  props.set('perception', perception);
  props.set('gameState', gameState);

  return { ...state, step: state.step + 1, entities: new Map(state.entities).set(config.id, entity) };
}

/** GridWorld reward (sparse: +1 at goal, -0.01 per step). */
function gridworldReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  const entity = nextState.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  const gameState = props.get('gameState') as GridWorldState;
  if (gameState.terminal) {
    return gameState.row === gameState.goalRow && gameState.col === gameState.goalCol ? 1 : 0;
  }
  return -0.01;
}

/** Reasoning transition. */
function reasoningTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  const game = getGameInstance(state, config.id) as Game<ReasoningState, string>;
  const outcome = game.step(action.params.action as string);
  const perception = game.observe();
  const gameState = game.state();

  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  props.set('perception', perception);
  props.set('gameState', gameState);

  return { ...state, step: state.step + 1, entities: new Map(state.entities).set(config.id, entity) };
}

/** Reasoning reward (validity = composed reward). */
function reasoningReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  const entity = nextState.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  const gameState = props.get('gameState') as ReasoningState;
  return gameState.settled / Math.max(1, gameState.taskIndex);
}

/** RPS transition. */
function rpsTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  const game = getGameInstance(state, config.id) as Game<RPSState, number>;
  const outcome = game.step(action.params.action as number);
  const perception = game.observe();
  const gameState = game.state();

  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  props.set('perception', perception);
  props.set('gameState', gameState);

  return { ...state, step: state.step + 1, entities: new Map(state.entities).set(config.id, entity) };
}

/** RPS reward (winrate: +1 win, 0 draw, -1 loss). */
function rpsReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  const entity = nextState.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  const gameState = props.get('gameState') as RPSState;
  // The reward is already computed in step()
  return 0; // placeholder - actual reward comes from game step
}

/** Snake transition. */
function snakeTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  const game = getGameInstance(state, config.id) as Game<SnakeState, 0 | 1 | 2 | 3>;
  const outcome = game.step(action.params.action as 0 | 1 | 2 | 3);
  const perception = game.observe();
  const gameState = game.state();

  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  props.set('perception', perception);
  props.set('gameState', gameState);

  return { ...state, step: state.step + 1, entities: new Map(state.entities).set(config.id, entity) };
}

/** Snake reward (length: +1 per apple). */
function snakeReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  const entity = nextState.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  const gameState = props.get('gameState') as SnakeState;
  return gameState.snake.length > (props.get('prevLength') as number) ? 1 : 0;
}

/** Tetris transition. */
function tetrisTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  const game = getGameInstance(state, config.id) as Game<TetrisState, string>;
  const outcome = game.step(action.params.action as string);
  const perception = game.observe();
  const gameState = game.state();

  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  props.set('perception', perception);
  props.set('gameState', gameState);

  return { ...state, step: state.step + 1, entities: new Map(state.entities).set(config.id, entity) };
}

/** Tetris reward (lines: per lines cleared). */
function tetrisReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  const entity = nextState.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  const gameState = props.get('gameState') as TetrisState;
  return gameState.linesCleared / 10; // normalize
}

/** TicTacToe transition. */
function tictactoeTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  const game = getGameInstance(state, config.id) as Game<TicTacToeState, number>;
  const outcome = game.step(action.params.action as number);
  const perception = game.observe();
  const gameState = game.state();

  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  props.set('perception', perception);
  props.set('gameState', gameState);

  return { ...state, step: state.step + 1, entities: new Map(state.entities).set(config.id, entity) };
}

/** TicTacToe reward (win: +1 win, 0 draw, -1 loss). */
function tictactoeReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  const entity = nextState.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  const gameState = props.get('gameState') as TicTacToeState;
  if (gameState.terminal) {
    return gameState.winner === 'X' ? 1 : gameState.winner === 'draw' ? 0 : -1;
  }
  return 0;
}

/** Conversation transition. */
function conversationTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  const game = getGameInstance(state, config.id) as Game<ConversationState, any>;
  const outcome = game.step(action.params.action);
  const perception = game.observe();
  const gameState = game.state();

  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  props.set('perception', perception);
  props.set('gameState', gameState);

  return { ...state, step: state.step + 1, entities: new Map(state.entities).set(config.id, entity) };
}

/** Conversation reward (coherence). */
function conversationReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  const entity = nextState.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  const gameState = props.get('gameState') as ConversationState;
  // Reward based on history coherence
  return Math.min(1, gameState.history.length * 0.1);
}

/** Focus transition — attention allocation with focus trees. */
function focusTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  // Focus habitat doesn't use a game instance; it simulates attention allocation
  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  const treeType = config.initialState.env.get('treeType') as string;
  const budget = config.initialState.env.get('budget') as number;
  
  // Simulate focus allocation step
  const focusAllocated = Math.min(budget, state.step + 1);
  props.set('focusAllocated', focusAllocated);
  props.set('treeType', treeType);
  
  return { ...state, step: state.step + 1, entities: new Map(state.entities).set(config.id, entity) };
}

/** Focus reward (attention efficiency). */
function focusReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  const entity = nextState.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  const focusAllocated = props.get('focusAllocated') as number;
  const budget = config.initialState.env.get('budget') as number;
  // Reward based on focus efficiency (allocated / budget)
  return budget > 0 ? Math.min(1, focusAllocated / budget) : 0;
}

/** MetaGame transition. */
function metagameTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  const game = getGameInstance(state, config.id) as Game<MetaGameState, string>;
  const outcome = game.step(action.params.action as string);
  const perception = game.observe();
  const gameState = game.state();

  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  props.set('perception', perception);
  props.set('gameState', gameState);

  return { ...state, step: state.step + 1, entities: new Map(state.entities).set(config.id, entity) };
}

/** MetaGame reward (parameter_quality). */
function metagameReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  // MetaGame rewards are 0 by default; quality is assessed externally
  return 0;
}

/** SelfMetaGame transition. */
function selfmetagameTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  const game = getGameInstance(state, config.id) as Game<MetaGameState, string>;
  const outcome = game.step(action.params.action as string);
  const perception = game.observe();
  const gameState = game.state();

  const entity = state.entities.get(config.id)!;
  const props = entity.properties as GameEntityProps;
  props.set('perception', perception);
  props.set('gameState', gameState);

  return { ...state, step: state.step + 1, entities: new Map(state.entities).set(config.id, entity) };
}

/** SelfMetaGame reward (coherence). */
function selfmetagameReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  return 0;
}

/** ReasoningMetaGame transition (same as MetaGame). */
function reasoningmetagameTransition(
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
): HabitatState {
  return metagameTransition(state, action, config);
}

/** ReasoningMetaGame reward. */
function reasoningmetagameReward(
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
): number {
  return 0;
}

/** Create a game instance from habitat config. */
function createGameFromConfig(config: HabitatConfig): Game<any, any> {
  const gameType = config.metadata.game as string;
  const seed = config.seed;

  switch (gameType) {
    case 'arithmetic':
      return createArithmeticGame({ seed, id: config.id });
    case 'bandit': {
      const env = config.initialState.env;
      return createBanditGame({
        seed,
        id: config.id,
        numArms: (env.get('numArms') as number) ?? 3,
        armMeans: (env.get('armMeans') as number[]) ?? [0.2, 0.5, 0.8],
      });
    }
    case 'catch':
      return createCatchGame({ seed, id: config.id });
    case 'game2048':
      return createGame2048({ seed, id: config.id });
    case 'gridworld': {
      const env = config.initialState.env;
      const grid = (env.get('grid') as string[]) ?? ['S..', '..G'];
      return createGridWorldGame({ id: config.id, grid, seed });
    }
    case 'reasoning': {
      const env = config.initialState.env;
      const specId = (env.get('specId') as string) ?? 'reasoning:conversation';
      const spec = (globalThis as any).REASONING_SPECS?.[specId];
      if (!spec) throw new Error(`Reasoning spec not found: ${specId}`);
      const tasks = generateEvalTasks(spec, seed);
      return createReasoningGame(spec, seed, tasks);
    }
    case 'rps':
      return createRPSGame({ seed, id: config.id });
    case 'snake':
      return createSnakeGame({ seed, id: config.id });
    case 'tetris':
      return createTetrisGame({ seed, id: config.id });
    case 'tictactoe':
      return createTicTacToeGame({ seed, id: config.id });
    case 'conversation':
      return createConversationGame();
    case 'metagame': {
      const env = config.initialState.env;
      const observesFocuses = (env.get('observesFocuses') as string[]) ?? [];
      return createMetaGame({ id: config.id, observesFocuses });
    }
    case 'selfmetagame': {
      // SelfMetaGame requires focusBag, gameFocuses, gates - use minimal config for habitat
      const env = config.initialState.env;
      const observesFocuses = (env.get('observesFocuses') as string[]) ?? [];
      return createMetaGame({ id: config.id, observesFocuses }); // Fallback to MetaGame
    }
    case 'reasoningmetagame': {
      const env = config.initialState.env;
      const observesFocuses = (env.get('observesFocuses') as string[]) ?? [];
      return createMetaGame({ id: config.id, observesFocuses });
    }
    default:
      throw new Error(`Unknown game type: ${gameType}`);
  }
}

/** Register all game transitions and rewards. */
export function registerGameTransitions(registry: HabitatRegistry): void {
  // Transitions
  registry.transitions.set('arithmetic', arithmeticTransition);
  registry.transitions.set('bandit', banditTransition);
  registry.transitions.set('catch', catchTransition);
  registry.transitions.set('2048', game2048Transition);
  registry.transitions.set('gridworld', gridworldTransition);
  registry.transitions.set('reasoning', reasoningTransition);
  registry.transitions.set('rps', rpsTransition);
  registry.transitions.set('snake', snakeTransition);
  registry.transitions.set('tetris', tetrisTransition);
  registry.transitions.set('tictactoe', tictactoeTransition);
  registry.transitions.set('conversation', conversationTransition);
  registry.transitions.set('focus', focusTransition);
  registry.transitions.set('metagame', metagameTransition);
  registry.transitions.set('selfmeta', selfmetagameTransition);
  registry.transitions.set('reasoningmeta', reasoningmetagameTransition);

  // Rewards
  registry.rewards.set('accuracy', arithmeticReward);
  registry.rewards.set('regret', banditReward);
  registry.rewards.set('caught', catchReward);
  registry.rewards.set('score', game2048Reward);
  registry.rewards.set('sparse', gridworldReward);
  registry.rewards.set('validity', reasoningReward);
  registry.rewards.set('winrate', rpsReward);
  registry.rewards.set('length', snakeReward);
  registry.rewards.set('lines', tetrisReward);
  registry.rewards.set('win', tictactoeReward);
  registry.rewards.set('coherence', conversationReward);
  registry.rewards.set('attention-efficiency', focusReward);
  registry.rewards.set('parameter_quality', metagameReward);
  registry.rewards.set('coherence', selfmetagameReward);
  registry.rewards.set('parameter_quality', reasoningmetagameReward);

  // Terminations (use default)
  registry.terminations.set('default', (state: HabitatState) => ({
    terminated: state.step >= 1000,
    reason: 'maxSteps',
  }));
}

/** Create a habitat registry with all game transitions registered. */
export function createGameHabitatRegistry(): HabitatRegistry {
  const registry = {
    transitions: new Map<string, any>(),
    rewards: new Map<string, any>(),
    terminations: new Map<string, any>(),
  };
  registerGameTransitions(registry);
  return registry;
}

/** Enhance habitat config with game instance. */
export function enhanceHabitatConfig(config: HabitatConfig): HabitatConfig {
  const game = createGameFromConfig(config);
  const initialState = createGameInitialState(config, game);

  // Store armMeans for bandit reward
  if (config.metadata.game === 'bandit') {
    const entity = initialState.entities.get(config.id);
    if (entity) {
      const props = entity.properties as GameEntityProps;
      const env = config.initialState.env;
      props.set('armMeans', (env.get('armMeans') as number[]) ?? [0.2, 0.5, 0.8]);
    }
  }

  return {
    ...config,
    initialState,
  };
}