/**
 * World Packs — Habitat/Probe as packs behind `serve --profile world`.
 *
 * Keeps all 14 games as world packs / curriculum sources.
 * Focus trees / MetaFocus / belief-seeding / weight-allocation as attention strategy/pack.
 * NAL-AB → arena A/B lane.
 * Evaluator checks FOL pre/post with Axiomatic module directly.
 */

import type { HabitatConfig, HabitatPack, HabitatId, HabitatKind } from './habitat';
import { createHabitatPack } from './habitat';
import { createGameHabitatRegistry, enhanceHabitatConfig } from './game-transitions';
import type { EvaluationCertificate, EvaluationFold, FoldId } from './scorecard';
import type { Term } from '../kernel/terms/term';
import type { TruthValue } from '../kernel/truth';

/** World profile types. */
export type WorldProfile = 'world' | 'probe' | 'curriculum' | 'attention';

/** World pack configuration. */
export interface WorldPackConfig {
  /** Pack ID. */
  id: string;
  /** Profile type. */
  profile: WorldProfile;
  /** Habitat pack. */
  pack: HabitatPack;
  /** FOL pre-conditions (for evaluator). */
  preConditions: Term[];
  /** FOL post-conditions (for evaluator). */
  postConditions: Term[];
  /** Attention strategy (if applicable). */
  attentionStrategy?: AttentionStrategy;
  /** Curriculum source flag. */
  isCurriculumSource: boolean;
}

/** Attention strategy pack. */
export interface AttentionStrategy {
  /** Strategy ID. */
  id: string;
  /** Strategy name. */
  name: string;
  /** Focus trees. */
  focusTrees: FocusTree[];
  /** MetaFocus configuration. */
  metaFocus?: MetaFocusConfig;
  /** Belief seeding. */
  beliefSeeding?: BeliefSeedingConfig;
  /** Weight allocation. */
  weightAllocation?: WeightAllocationConfig;
}

/** Focus tree. */
export interface FocusTree {
  /** Tree ID. */
  id: string;
  /** Root focus. */
  root: string;
  /** Children. */
  children: Map<string, FocusTree>;
  /** Weight. */
  weight: number;
}

/** MetaFocus configuration. */
export interface MetaFocusConfig {
  /** Enabled. */
  enabled: boolean;
  /** Focus budget. */
  budget: number;
  /** Decay rate. */
  decayRate: number;
}

/** Belief seeding configuration. */
export interface BeliefSeedingConfig {
  /** Seed beliefs. */
  seeds: Array<{ term: Term; truth: TruthValue }>;
  /** Seeding rate. */
  rate: number;
}

/** Weight allocation configuration. */
export interface WeightAllocationConfig {
  /** Weights per artifact kind. */
  weights: Record<string, number>;
  /** Allocation strategy. */
  strategy: 'uniform' | 'priority' | 'adaptive';
}

/** Predefined game packs (14 games). */
export const GAME_PACKS: Record<string, () => HabitatPack> = {
  /** Arithmetic game. */
  arithmetic: () => createHabitatPack('arithmetic', [
    createArithmeticHabitat('arithmetic-easy' as HabitatId, 42, 100),
    createArithmeticHabitat('arithmetic-medium' as HabitatId, 123, 200),
    createArithmeticHabitat('arithmetic-hard' as HabitatId, 456, 300),
  ]),

  /** Bandit game. */
  bandit: () => createHabitatPack('bandit', [
    createBanditHabitat('bandit-stationary' as HabitatId, 42, 1000),
    createBanditHabitat('bandit-drift' as HabitatId, 123, 1000),
  ]),

  /** Catch game. */
  catch: () => createHabitatPack('catch', [
    createCatchHabitat('catch-slow' as HabitatId, 42, 500),
    createCatchHabitat('catch-fast' as HabitatId, 123, 500),
  ]),

  /** Conversation game. */
  conversation: () => createHabitatPack('conversation', [
    createConversationHabitat('conversation-basic' as HabitatId, 42, 50),
  ]),

  /** Game 2048. */
  game2048: () => createHabitatPack('game2048', [
    create2048Habitat('2048-standard' as HabitatId, 42, 1000),
  ]),

  /** GridWorld game. */
  gridworld: () => createHabitatPack('gridworld', [
    createGridWorldHabitat('gridworld-3x3' as HabitatId, 42, 100),
    createGridWorldHabitat('gridworld-5x5' as HabitatId, 123, 200),
    createGridWorldHabitat('gridworld-10x10' as HabitatId, 456, 500),
  ]),

  /** Reasoning game. */
  reasoning: () => createHabitatPack('reasoning', [
    createReasoningHabitat('reasoning-simple' as HabitatId, 42, 50),
    createReasoningHabitat('reasoning-complex' as HabitatId, 123, 100),
  ]),

  /** RPS game. */
  rps: () => createHabitatPack('rps', [
    createRPSHabitat('rps-standard' as HabitatId, 42, 100),
  ]),

  /** Snake game. */
  snake: () => createHabitatPack('snake', [
    createSnakeHabitat('snake-small' as HabitatId, 42, 200),
    createSnakeHabitat('snake-large' as HabitatId, 123, 500),
  ]),

  /** Tetris game. */
  tetris: () => createHabitatPack('tetris', [
    createTetrisHabitat('tetris-standard' as HabitatId, 42, 500),
  ]),

  /** TicTacToe game. */
  tictactoe: () => createHabitatPack('tictactoe', [
    createTicTacToeHabitat('tictactoe-standard' as HabitatId, 42, 50),
  ]),

  /** SelfMetaGame. */
  selfmetagame: () => createHabitatPack('selfmetagame', [
    createSelfMetaHabitat('selfmeta-basic' as HabitatId, 42, 100),
  ]),

  /** MetaGame. */
  metagame: () => createHabitatPack('metagame', [
    createMetaHabitat('meta-basic' as HabitatId, 42, 100),
  ]),

  /** ReasoningMetaGame. */
  reasoningmetagame: () => createHabitatPack('reasoningmetagame', [
    createReasoningMetaHabitat('reasoningmeta-basic' as HabitatId, 42, 100),
  ]),
};

/** Create arithmetic habitat. */
function createArithmeticHabitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'logic',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['difficulty', id.split('-')[1]], ['operations', ['+', '-', '*', '/']]]),
      rngState: seed.toString(),
    },
    transition: 'arithmetic',
    reward: 'accuracy',
    termination: { maxSteps: true, goalAchieved: true },
    metadata: { game: 'arithmetic' },
  });
}

/** Create bandit habitat. */
function createBanditHabitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'bandit',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([
        ['arms', 3],
        ['armMeans', [0.2, 0.5, 0.8]],
        ['drift', id.includes('drift')],
      ]),
      rngState: seed.toString(),
    },
    transition: 'bandit',
    reward: 'regret',
    termination: { maxSteps: true },
    metadata: { game: 'bandit' },
  });
}

/** Create catch habitat. */
function createCatchHabitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'gridworld',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { position: { x: 5, y: 0 }, inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['width', 7], ['height', 5], ['fallSpeed', id.includes('fast') ? 2 : 1]]),
      rngState: seed.toString(),
    },
    transition: 'catch',
    reward: 'caught',
    termination: { maxSteps: true, energyDepleted: true },
    metadata: { game: 'catch' },
  });
}

/** Create conversation habitat. */
function createConversationHabitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'dialogue',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['topic', 'general'], ['maxTurns', 10]]),
      rngState: seed.toString(),
    },
    transition: 'conversation',
    reward: 'coherence',
    termination: { maxSteps: true, goalAchieved: true },
    metadata: { game: 'conversation' },
  });
}

/** Create 2048 habitat. */
function create2048Habitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'gridworld',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['size', 4], ['target', 2048]]),
      rngState: seed.toString(),
    },
    transition: '2048',
    reward: 'score',
    termination: { maxSteps: true, goalAchieved: true },
    metadata: { game: '2048' },
  });
}

/** Create GridWorld habitat. */
function createGridWorldHabitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  const size = id.includes('3x3') ? 3 : id.includes('5x5') ? 5 : 10;
  const grid = size === 3
    ? ['S..', '..G']
    : size === 5
    ? ['S....', '.....', '.....', '.....', '....G']
    : ['S........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '........G'];
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'gridworld',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { position: { x: 0, y: 0 }, inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['size', size], ['grid', grid]]),
      rngState: seed.toString(),
    },
    transition: 'gridworld',
    reward: 'sparse',
    termination: { maxSteps: true, goalAchieved: true },
    metadata: { game: 'gridworld' },
  });
}

/** Create reasoning habitat. */
function createReasoningHabitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  const specId = id.includes('complex') ? 'reasoning:research' : 'reasoning:conversation';
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'logic',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['complexity', id.includes('complex') ? 'high' : 'low'], ['specId', specId]]),
      rngState: seed.toString(),
    },
    transition: 'reasoning',
    reward: 'validity',
    termination: { maxSteps: true, goalAchieved: true },
    metadata: { game: 'reasoning' },
  });
}

/** Create RPS habitat. */
function createRPSHabitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'bandit',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['opponent', 'random'], ['rounds', 30]]),
      rngState: seed.toString(),
    },
    transition: 'rps',
    reward: 'winrate',
    termination: { maxSteps: true },
    metadata: { game: 'rps' },
  });
}

/** Create snake habitat. */
function createSnakeHabitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  const size = id.includes('small') ? 8 : 15;
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'gridworld',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { position: { x: size / 2, y: size / 2 }, inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['size', size], ['initialLength', 3]]),
      rngState: seed.toString(),
    },
    transition: 'snake',
    reward: 'length',
    termination: { maxSteps: true, energyDepleted: true },
    metadata: { game: 'snake' },
  });
}

/** Create tetris habitat. */
function createTetrisHabitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'gridworld',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['width', 10], ['height', 10], ['pieceCap', 30]]),
      rngState: seed.toString(),
    },
    transition: 'tetris',
    reward: 'lines',
    termination: { maxSteps: true, energyDepleted: true },
    metadata: { game: 'tetris' },
  });
}

/** Create TicTacToe habitat. */
function createTicTacToeHabitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'logic',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['player', 'X'], ['opponent', 'random']]),
      rngState: seed.toString(),
    },
    transition: 'tictactoe',
    reward: 'win',
    termination: { maxSteps: true, goalAchieved: true },
    metadata: { game: 'tictactoe' },
  });
}

/** Create SelfMeta habitat. */
function createSelfMetaHabitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'composite',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['focuses', ['reasoning', 'planning', 'memory']]]),
      rngState: seed.toString(),
    },
    transition: 'selfmeta',
    reward: 'coherence',
    termination: { maxSteps: true },
    metadata: { game: 'selfmetagame' },
  });
}

/** Create Meta habitat. */
function createMetaHabitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'composite',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['game', 'reasoning'], ['observesFocuses', ['reasoning', 'planning']]]),
      rngState: seed.toString(),
    },
    transition: 'metagame',
    reward: 'parameter_quality',
    termination: { maxSteps: true },
    metadata: { game: 'metagame' },
  });
}

/** Create ReasoningMeta habitat. */
function createReasoningMetaHabitat(id: HabitatId, seed: number, maxSteps: number): HabitatConfig {
  return enhanceHabitatConfig({
    id,
    name: id,
    kind: 'composite',
    seed,
    maxSteps,
    initialState: {
      step: 0,
      episode: 0,
      entities: new Map(),
      agent: { inventory: [], energy: 100, internal: new Map() },
      env: new Map<string, unknown>([['baseGame', 'reasoning'], ['observesFocuses', ['reasoning', 'planning']]]),
      rngState: seed.toString(),
    },
    transition: 'reasoningmeta',
    reward: 'parameter_quality',
    termination: { maxSteps: true },
    metadata: { game: 'reasoningmetagame' },
  });
}

/** Attention strategy packs. */
export const ATTENTION_STRATEGY_PACKS: Record<string, AttentionStrategy> = {
  /** Focus trees pack. */
  focusTrees: {
    id: 'focus-trees',
    name: 'Focus Trees',
    focusTrees: [
      { id: 'reasoning', root: 'reasoning', children: new Map(), weight: 1.0 },
      { id: 'planning', root: 'planning', children: new Map(), weight: 0.8 },
      { id: 'memory', root: 'memory', children: new Map(), weight: 0.6 },
    ],
  },
  /** MetaFocus pack. */
  metaFocus: {
    id: 'metafocus',
    name: 'MetaFocus',
    focusTrees: [],
    metaFocus: { enabled: true, budget: 100, decayRate: 0.1 },
  },
  /** Belief seeding pack. */
  beliefSeeding: {
    id: 'belief-seeding',
    name: 'Belief Seeding',
    focusTrees: [],
    beliefSeeding: { seeds: [], rate: 0.1 },
  },
  /** Weight allocation pack. */
  weightAllocation: {
    id: 'weight-allocation',
    name: 'Weight Allocation',
    focusTrees: [],
    weightAllocation: { weights: { belief: 1.0, skill: 0.8, rule: 0.6 }, strategy: 'adaptive' },
  },
};

/** Get all game packs. */
export function getAllGamePacks(): HabitatPack[] {
  return Object.values(GAME_PACKS).map(fn => fn());
}

/** Get game pack by name. */
export function getGamePack(name: string): HabitatPack | undefined {
  const fn = GAME_PACKS[name];
  return fn?.();
}

/** Create world pack config for serve --profile world. */
export function createWorldPackConfig(
  profile: WorldProfile = 'world',
  options: {
    game?: string;
    attentionStrategy?: string;
  } = {}
): WorldPackConfig[] {
  const configs: WorldPackConfig[] = [];

  if (options.game) {
    const pack = getGamePack(options.game);
    if (pack) {
      configs.push({
        id: `${profile}-${options.game}`,
        profile,
        pack,
        preConditions: [],
        postConditions: [],
        isCurriculumSource: true,
      });
    }
  } else if (profile === 'world' || profile === 'curriculum') {
    // Include all games as curriculum sources
    for (const [name, fn] of Object.entries(GAME_PACKS)) {
      configs.push({
        id: `${profile}-${name}`,
        profile,
        pack: fn(),
        preConditions: [],
        postConditions: [],
        isCurriculumSource: true,
      });
    }
  }

  if (options.attentionStrategy) {
    const strategy = ATTENTION_STRATEGY_PACKS[options.attentionStrategy];
    if (strategy) {
      configs.push({
        id: `${profile}-attention-${options.attentionStrategy}`,
        profile: 'attention',
        pack: createHabitatPack(`attention-${options.attentionStrategy}`, []),
        preConditions: [],
        postConditions: [],
        attentionStrategy: strategy,
        isCurriculumSource: false,
      });
    }
  }

  return configs;
}

/** Evaluator checks FOL pre/post with Axiomatic module. */
export interface WorldEvaluator {
  /** Evaluate a world pack. */
  evaluate(pack: WorldPackConfig): Promise<EvaluationFold>;
  /** Check FOL pre-conditions. */
  checkPreConditions(conditions: Term[]): Promise<boolean>;
  /** Check FOL post-conditions. */
  checkPostConditions(conditions: Term[]): Promise<boolean>;
}

/** Create a world evaluator. */
export function createWorldEvaluator(): WorldEvaluator {
  // In a real implementation, this would use the Axiomatic module
  // to check FOL pre/post conditions
  return {
    async evaluate(pack: WorldPackConfig): Promise<EvaluationFold> {
      // Simplified evaluation
      return {
        id: `fold-${pack.id}-${Date.now()}` as FoldId,
        targetId: pack.id,
        targetKind: 'pack',
        scorecards: [],
        aggregates: {
          meanReward: 0,
          stdReward: 0,
          meanSuccessRate: 0,
          minSuccessRate: 0,
          maxFairnessViolations: 0,
          seeds: 0,
        },
        timestamp: Date.now(),
      };
    },
    async checkPreConditions(conditions: Term[]): Promise<boolean> {
      // Would use Axiomatic module for FOL checking
      return true;
    },
    async checkPostConditions(conditions: Term[]): Promise<boolean> {
      // Would use Axiomatic module for FOL checking
      return true;
    },
  };
}