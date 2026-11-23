/**
 * Habitat Pack — world definition for seeded, replayable scenarios.
 *
 * A habitat is a self-contained world with deterministic initialization,
 * explicit state transitions, and verifiable outcomes.
 */

import type { Term } from '../kernel/terms/term';
import type { TruthValue } from '../kernel/truth';
import type { Task, TaskType } from '../kernel/types';

/** Habitat identifier. */
export type HabitatId = string & { readonly __brand: unique symbol };

/** Habitat kind. */
export const HABITAT_KINDS = [
  'gridworld',
  'bandit',
  'dialogue',
  'logic',
  'composite',
  'focus',
] as const;

export type HabitatKind = (typeof HABITAT_KINDS)[number];

/** Habitat configuration. */
export interface HabitatConfig {
  /** Unique habitat ID. */
  id: HabitatId;
  /** Human-readable name. */
  name: string;
  /** Kind of habitat. */
  kind: HabitatKind;
  /** Random seed for deterministic replay. */
  seed: number;
  /** Maximum steps per episode. */
  maxSteps: number;
  /** Initial state specification. */
  initialState: HabitatState;
  /** Transition function name (registered in registry). */
  transition: string;
  /** Reward function name (registered in registry). */
  reward: string;
  /** Termination condition. */
  termination: TerminationCondition;
  /** Metadata. */
  metadata: Record<string, unknown>;
}

/** Habitat state snapshot. */
export interface HabitatState {
  /** Step counter. */
  step: number;
  /** Episode counter. */
  episode: number;
  /** Grid/entities state (kind-specific). */
  entities: Map<string, EntityState>;
  /** Agent state. */
  agent: AgentState;
  /** Environment variables. */
  env: Map<string, unknown>;
  /** Random state for replay. */
  rngState: string;
}

/** Entity in the habitat. */
export interface EntityState {
  /** Entity type. */
  type: string;
  /** Position (for gridworlds). */
  position?: { x: number; y: number };
  /** Properties. */
  properties: Map<string, unknown>;
  /** Active flags. */
  active: boolean;
}

/** Agent state in habitat. */
export interface AgentState {
  /** Current position. */
  position?: { x: number; y: number };
  /** Inventory. */
  inventory: string[];
  /** Energy/health. */
  energy: number;
  /** Internal state. */
  internal: Map<string, unknown>;
}

/** Termination condition. */
export interface TerminationCondition {
  /** Max steps reached. */
  maxSteps?: boolean;
  /** Goal achieved. */
  goalAchieved?: boolean;
  /** Energy depleted. */
  energyDepleted?: boolean;
  /** Custom condition function name. */
  custom?: string;
}

/** Habitat step result. */
export interface HabitatStepResult {
  /** Next state. */
  state: HabitatState;
  /** Reward received. */
  reward: number;
  /** Whether episode terminated. */
  terminated: boolean;
  /** Termination reason. */
  reason?: string;
  /** Info for debugging. */
  info: Record<string, unknown>;
}

/** Habitat action. */
export interface HabitatAction {
  /** Action type. */
  type: string;
  /** Parameters. */
  params: Record<string, unknown>;
  /** Source task ID (for tracing). */
  taskId?: string;
}

/** Habitat registry for transitions and rewards. */
import { KeyedRegistry } from '../util/keyed-collection';

/** Transition function signature. */
export type TransitionFn = (
  state: HabitatState,
  action: HabitatAction,
  config: HabitatConfig
) => HabitatState;

/** Reward function signature. */
export type RewardFn = (
  state: HabitatState,
  action: HabitatAction,
  nextState: HabitatState,
  config: HabitatConfig
) => number;

/** Termination function signature. */
export type TerminationFn = (
  state: HabitatState,
  config: HabitatConfig
) => { terminated: boolean; reason?: string };

/** Function registration with metadata. */
interface FunctionRegistration<Fn> {
  readonly name: string;
  readonly fn: Fn;
}

/** Habitat registry using KeyedRegistry for each function type. */
export class HabitatRegistry {
  readonly transitions: KeyedRegistry<FunctionRegistration<TransitionFn>>;
  readonly rewards: KeyedRegistry<FunctionRegistration<RewardFn>>;
  readonly terminations: KeyedRegistry<FunctionRegistration<TerminationFn>>;

  constructor() {
    this.transitions = new KeyedRegistry<FunctionRegistration<TransitionFn>>({
      keyOf: (r) => r.name,
      onDuplicate: (name) => { throw new Error(`Transition '${name}' already registered`); },
    });
    this.rewards = new KeyedRegistry<FunctionRegistration<RewardFn>>({
      keyOf: (r) => r.name,
      onDuplicate: (name) => { throw new Error(`Reward '${name}' already registered`); },
    });
    this.terminations = new KeyedRegistry<FunctionRegistration<TerminationFn>>({
      keyOf: (r) => r.name,
      onDuplicate: (name) => { throw new Error(`Termination '${name}' already registered`); },
    });
  }

  /** Register a transition function. */
  registerTransition(name: string, fn: TransitionFn): void {
    this.transitions.register({ name, fn });
  }

  /** Register a reward function. */
  registerReward(name: string, fn: RewardFn): void {
    this.rewards.register({ name, fn });
  }

  /** Register a termination function. */
  registerTermination(name: string, fn: TerminationFn): void {
    this.terminations.register({ name, fn });
  }

  /** Get a transition function by name. */
  getTransition(name: string): TransitionFn | undefined {
    return this.transitions.get(name)?.fn;
  }

  /** Get a reward function by name. */
  getReward(name: string): RewardFn | undefined {
    return this.rewards.get(name)?.fn;
  }

  /** Get a termination function by name. */
  getTermination(name: string): TerminationFn | undefined {
    return this.terminations.get(name)?.fn;
  }

  /** Get all registered transition names. */
  getTransitionNames(): string[] {
    return this.transitions.keys();
  }

  /** Get all registered reward names. */
  getRewardNames(): string[] {
    return this.rewards.keys();
  }

  /** Get all registered termination names. */
  getTerminationNames(): string[] {
    return this.terminations.keys();
  }

  /** Clear all registrations. */
  clear(): void {
    this.transitions.clear();
    this.rewards.clear();
    this.terminations.clear();
  }
}

/** Create a habitat registry instance. */
export function createHabitatRegistry(): HabitatRegistry {
  return new HabitatRegistry();
}

/** Create initial habitat state from config. */
export function createInitialState(config: HabitatConfig): HabitatState {
  return {
    step: 0,
    episode: 0,
    entities: new Map(config.initialState.entities),
    agent: { ...config.initialState.agent },
    env: new Map(config.initialState.env),
    rngState: config.seed.toString(),
  };
}

/** Execute one habitat step. */
export function stepHabitat(
  config: HabitatConfig,
  state: HabitatState,
  action: HabitatAction,
  registry: HabitatRegistry
): HabitatStepResult {
  const transition = registry.getTransition(config.transition);
  const rewardFn = registry.getReward(config.reward);
  const termination = registry.getTermination(config.termination.custom ?? 'default');

  if (!transition) {
    throw new Error(`Transition function not found: ${config.transition}`);
  }
  if (!rewardFn) {
    throw new Error(`Reward function not found: ${config.reward}`);
  }

  const nextState = transition(state, action, config);
  nextState.step = state.step + 1;

  const reward = rewardFn(state, action, nextState, config);

  let terminated = false;
  let reason: string | undefined;

  if (config.termination.maxSteps && nextState.step >= config.maxSteps) {
    terminated = true;
    reason = 'maxSteps';
  }

  if (!terminated && termination) {
    const termResult = termination(nextState, config);
    terminated = termResult.terminated;
    reason = termResult.reason;
  }

  if (terminated) {
    nextState.episode = state.episode + 1;
    nextState.step = 0;
  }

  return {
    state: nextState,
    reward,
    terminated,
    reason,
    info: { action: action.type },
  };
}

/** Serialize habitat state for logging/replay. */
export function serializeState(state: HabitatState): string {
  return JSON.stringify({
    step: state.step,
    episode: state.episode,
    entities: Object.fromEntries(state.entities),
    agent: state.agent,
    env: Object.fromEntries(state.env),
    rngState: state.rngState,
  });
}

/** Deserialize habitat state. */
export function deserializeState(data: string): HabitatState {
  const obj = JSON.parse(data);
  return {
    step: obj.step,
    episode: obj.episode,
    entities: new Map(Object.entries(obj.entities).map(([k, v]: [string, any]) => [
      k,
      { ...v, properties: new Map(Object.entries(v.properties ?? {})) },
    ])),
    agent: { ...obj.agent, internal: new Map(Object.entries(obj.agent.internal ?? {})) },
    env: new Map(Object.entries(obj.env)),
    rngState: obj.rngState,
  };
}

/** Habitat pack — collection of habitats for a curriculum. */
export interface HabitatPack {
  /** Pack identifier. */
  id: string;
  /** Habitats in this pack. */
  habitats: HabitatConfig[];
  /** Ordering for curriculum. */
  order: HabitatId[];
  /** Pack metadata. */
  metadata: Record<string, unknown>;
}

/** Create a habitat pack. */
export function createHabitatPack(
  id: string,
  habitats: HabitatConfig[],
  order?: HabitatId[]
): HabitatPack {
  return {
    id,
    habitats,
    order: order ?? habitats.map(h => h.id),
    metadata: {},
  };
}