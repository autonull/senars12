import {
  anneal,
  BoundedRing,
  maxBy,
  mean,
  nextInt,
  type RandomSource,
  rngFrom,
} from '@senars/util';
import { type Term, TermBuilder, Truth } from '../../../index.js';
import type { NAR } from '../../../nar.js';
import { operationNameOf, operationTerm } from '../../../terms/impls/operation-term.js';
import type { QBeliefStore } from '../QBeliefStore.js';

/**
 * Converts RL actions to NAR goals (native AST form)
 */
export interface RLAction {
  name: string;
  args?: Record<string, unknown>;
}

export interface GoalActionAdapterConfig {
  defaultPriority?: number;
}

interface ResolvedGoalActionAdapterConfig {
  defaultPriority: number;
}

export class GoalActionAdapter {
  private readonly nar: NAR;
  private readonly config: ResolvedGoalActionAdapterConfig;

  constructor(nar: NAR, config: GoalActionAdapterConfig = {}) {
    this.nar = nar;
    this.config = {
      defaultPriority: config.defaultPriority ?? 0.5,
    };
  }

  /** Build a native AST goal term for an action: `name(key --> value, ...)`. */
  buildGoalTerm(action: RLAction): Term {
    return operationTerm(action.name, action.args ?? {});
  }

  /** Propose an action as a goal to NAR */
  async proposeAction(action: RLAction, priority?: number): Promise<void> {
    const goalTerm = this.buildGoalTerm(action);
    const truth = Truth.create(1.0, priority ?? this.config.defaultPriority);
    await this.nar.goal(goalTerm, truth);
  }

  /** Dispatch all pending tool goals through NAR's execution cycle */
  async dispatchPendingGoals(): Promise<any[]> {
    return [];
  }

  /** Execute a single goal through the tool layer */
  async executeGoal(action: RLAction): Promise<any> {
    const goalTerm = this.buildGoalTerm(action);
    return this.nar.tools.executeToolGoal(goalTerm);
  }
}

/**
 * Action selector interface for native SeNARS policies
 */
export interface NativeActionSelector {
  selectAction(
    stateId: string,
    nar: NAR,
    qStore: QBeliefStore,
    actionAdapter: GoalActionAdapter
  ): number;

  onReward(stateId: string, action: number, reward: number): void;

  onEpisodeStart(): void;

  onEpisodeEnd(): void;
}

/** Beliefs weaker than this are eligible for curiosity-driven exploration. */
const LOW_CONFIDENCE = 0.4;
/** How likely an exploration branch is once the estimate is weak. */
const EXPLORE_BIAS = 0.5;
/** Curiosity driven for an arm chosen on low confidence rather than on merit. */
const CURIOSITY_BOOST = 0.05;

/** How an ε-greedy policy selects. The three native policies share every field
 *  except the defaults, so the differences are declared, not inherited. */
export interface ArmQSelectorOptions {
  /** Arms, as operation names. */
  armNames: string[];
  explorationRate: number;
  rng: RandomSource;
  /** How likely the low-confidence branch is once the estimate is weak. */
  exploreBias?: number;
  curiosityBoost?: number;
}

/**
 * Highest-priority pending tool goal naming an operation `accepts`, found by
 * reading the operation rather than by matching its printed form — the printed
 * form used to carry the sigil the policy is now selecting on.
 */
function topPendingOperation(nar: NAR, accepts: (name: string) => boolean): string | undefined {
  const stage = nar.taskManager
    .getPending()
    .filter((task) => task.type === 'goal')
    .map((task) => ({ name: operationNameOf(task.term), priority: task.budget.priority }))
    .filter(
      (c): c is { name: string; priority: number } => c.name !== undefined && accepts(c.name)
    );
  return maxBy(stage, (candidate) => candidate.priority)?.name;
}

/** An arm operation name, which is what the two bandit policies select over. */
const isArmName = (name: string): boolean => /^pull_arm_\d+$/.test(name);

/** The arm an operation name names, or `undefined` when it names none. */
const armIndexOf = (name: string | undefined): number | undefined => {
  const match = name?.match(/^pull_arm_(\d+)$/);
  return match ? Number.parseInt(match[1]!, 10) : undefined;
};

/** The four moves a grid position offers. */
const ACTION_NAMES = ['move_up', 'move_right', 'move_down', 'move_left'];

/** The arm names a bandit of `numArms` arms offers. */
const pullArmNames = (numArms: number): string[] =>
  Array.from({ length: numArms }, (_, i) => `pull_arm_${i}`);

/**
 * ε-greedy over a `QBeliefStore`: exploit the strongest expectation unless the
 * dice say explore, prefer an arm whose belief is still weak, otherwise draw
 * uniformly. Every native policy in this file selects that way — the only
 * things they differ on are which state they read, how their exploration rate
 * moves, and what they override.
 */
abstract class ArmQSelector implements NativeActionSelector {
  protected explorationRate: number;
  protected readonly actions: Term[];
  protected readonly armNames: string[];
  protected readonly rng: RandomSource;
  private readonly exploreBias: number;
  private readonly curiosityBoost: number;

  protected constructor(options: ArmQSelectorOptions) {
    this.armNames = options.armNames;
    this.actions = options.armNames.map((name) => operationTerm(name));
    this.explorationRate = options.explorationRate;
    this.rng = options.rng;
    this.exploreBias = options.exploreBias ?? EXPLORE_BIAS;
    this.curiosityBoost = options.curiosityBoost ?? CURIOSITY_BOOST;
  }

  /** The belief key this policy reads. A bandit has one state; a world has one per position. */
  protected stateTermFor(_stateId: string): Term {
    return TermBuilder.atom('bandit_state');
  }

  /** An action already queued as a goal wins over the policy's own choice. */
  protected pendingOverride(_nar: NAR, _stateId: string): number | undefined {
    return undefined;
  }

  /** Exploration this arm's recent rewards have earned it beyond the base rate. */
  protected driftExploration(_qStore: QBeliefStore, _bestIndex: number): number {
    return 0;
  }

  selectAction(
    stateId: string,
    nar: NAR,
    qStore: QBeliefStore,
    _actionAdapter: GoalActionAdapter
  ): number {
    const pending = this.pendingOverride(nar, stateId);
    if (pending !== undefined) return pending;

    const stateTerm = this.stateTermFor(stateId);
    const actions = this.actions;
    const bestAction = qStore.getBestAction(stateTerm, actions);
    const bestIndex = bestAction ? actions.indexOf(bestAction) : -1;
    const rate = this.explorationRate + this.driftExploration(qStore, bestIndex);

    if (bestIndex >= 0 && this.rng() > rate) return bestIndex;

    const lowConfidence = qStore.getLowConfidenceActions(stateTerm, actions, LOW_CONFIDENCE);
    if (lowConfidence.length > 0 && this.rng() < this.exploreBias) {
      const exploreAction = lowConfidence[nextInt(this.rng, lowConfidence.length)];
      if (!exploreAction) return nextInt(this.rng, actions.length);
      const index = actions.indexOf(exploreAction);
      qStore.stimulateCuriosity(this.curiosityBoost);
      if (index >= 0) return index;
    }

    return nextInt(this.rng, actions.length);
  }

  onReward(_stateId: string, _action: number, _reward: number): void {}

  onEpisodeStart(): void {}

  onEpisodeEnd(): void {}
}

/**
 * Bandit action selector (existing logic extracted)
 */
export interface BanditSelectorOptions {
  numArms?: number;
  explorationRate?: number;
  rng?: RandomSource;
}

export class BanditSelector extends ArmQSelector {
  constructor({
    numArms = 3,
    explorationRate = 0.2,
    rng = Math.random,
  }: BanditSelectorOptions = {}) {
    super({ armNames: pullArmNames(numArms), explorationRate, rng });
  }

  protected override pendingOverride(nar: NAR): number | undefined {
    return armIndexOf(topPendingOperation(nar, isArmName));
  }
}

/**
 * GridWorld action selector - state-dependent policy with 4 actions per state
 */
export interface GridWorldSelectorOptions {
  explorationRate?: number;
  explorationDecay?: number;
  explorationMin?: number;
  seed?: number | RandomSource;
}

export class GridWorldSelector extends ArmQSelector {
  private readonly explorationDecay: number;
  private readonly explorationMin: number;

  constructor({
    explorationRate = 0.3,
    explorationDecay = 0.99,
    explorationMin = 0.01,
    seed = 42,
  }: GridWorldSelectorOptions = {}) {
    super({
      armNames: ACTION_NAMES,
      explorationRate,
      rng: rngFrom(seed, Math.random),
      exploreBias: 0.4,
      curiosityBoost: 0.03,
    });
    this.explorationDecay = explorationDecay;
    this.explorationMin = explorationMin;
  }

  override onEpisodeEnd(): void {
    this.explorationRate = anneal(this.explorationRate, this.explorationDecay, this.explorationMin);
  }

  getExplorationRate(): number {
    return this.explorationRate;
  }

  protected override stateTermFor(stateId: string): Term {
    return TermBuilder.atom(stateId);
  }

  protected override pendingOverride(nar: NAR): number | undefined {
    const pending = topPendingOperation(nar, (name) => this.armNames.includes(name));
    return pending === undefined ? undefined : this.armNames.indexOf(pending);
  }
}

/**
 * Non-stationary bandit selector with change detection via confidence monitoring
 */
export interface NonStationarySelectorOptions {
  numArms?: number;
  changeDetectionThreshold?: number;
  explorationRate?: number;
  rng?: RandomSource;
}

export class NonStationarySelector extends ArmQSelector {
  private readonly changeDetectionThreshold: number;
  private armPullCounts: number[] = [];
  private lastRewards: number[] = [];
  private predictionErrors: BoundedRing<number>[] = [];

  constructor({
    numArms = 2,
    changeDetectionThreshold = 0.3,
    explorationRate = 0.2,
    rng = Math.random,
  }: NonStationarySelectorOptions = {}) {
    super({ armNames: pullArmNames(numArms), explorationRate, rng });
    this.changeDetectionThreshold = changeDetectionThreshold;
    this.armPullCounts = new Array(numArms).fill(0);
    this.lastRewards = new Array(numArms).fill(0);
    this.predictionErrors = Array.from({ length: numArms }, () => new BoundedRing<number>(20));
  }

  protected override driftExploration(qStore: QBeliefStore, bestIndex: number): number {
    const errors = bestIndex >= 0 ? this.predictionErrors[bestIndex] : undefined;
    if (!errors || errors.size() <= 5) return 0;
    if (mean(errors.tail(5)) <= this.changeDetectionThreshold) return 0;
    qStore.stimulateCuriosity(0.1);
    return Math.min(0.5, this.explorationRate * 2) - this.explorationRate;
  }

  override onReward(stateId: string, action: number, reward: number): void {
    this.armPullCounts[action] = (this.armPullCounts[action] ?? 0) + 1;
    this.lastRewards[action] = reward;

    if ((this.armPullCounts[action] ?? 0) > 1) {
      const errors = this.predictionErrors[action] ?? new BoundedRing<number>(20);
      const recentRewards = errors.tail(10);
      if (recentRewards.length > 0) {
        errors.push(Math.abs(reward - mean(recentRewards)));
        this.predictionErrors[action] = errors;
      }
    }
  }
}
