import { BoundedRing, maxBy, mean, nextInt, type RandomSource, rngFrom } from '@senars/util';
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

/**
 * Bandit action selector (existing logic extracted)
 */
export class BanditSelector implements NativeActionSelector {
  private readonly numArms: number;
  private readonly actions: Term[];
  private readonly stateTerm: Term;
  private readonly explorationRate: number;
  private readonly rng: RandomSource;

  constructor(numArms: number = 3, explorationRate: number = 0.2, rng: RandomSource = Math.random) {
    this.numArms = numArms;
    this.explorationRate = explorationRate;
    this.rng = rng;
    this.stateTerm = TermBuilder.atom('bandit_state');
    this.actions = Array.from({ length: numArms }, (_, i) => operationTerm(`pull_arm_${i}`));
  }

  selectAction(
    stateId: string,
    nar: NAR,
    qStore: QBeliefStore,
    actionAdapter: GoalActionAdapter
  ): number {
    const pending = armIndexOf(topPendingOperation(nar, isArmName));
    if (pending !== undefined) return pending;

    const bestAction = qStore.getBestAction(this.stateTerm, this.actions);
    const lowConfidence = qStore.getLowConfidenceActions(this.stateTerm, this.actions, 0.4);

    if (bestAction && this.rng() > this.explorationRate) {
      const idx = this.actions.indexOf(bestAction);
      if (idx >= 0) return idx;
    }

    if (lowConfidence.length > 0 && this.rng() < 0.5) {
      const exploreAction = lowConfidence[nextInt(this.rng, lowConfidence.length)];
      if (!exploreAction) return nextInt(this.rng, this.numArms);
      const idx = this.actions.indexOf(exploreAction);
      qStore.stimulateCuriosity(0.05);
      if (idx >= 0) return idx;
    }

    return nextInt(this.rng, this.numArms);
  }

  onReward(stateId: string, action: number, reward: number): void {}

  onEpisodeStart(): void {}

  onEpisodeEnd(): void {}
}

/**
 * GridWorld action selector - state-dependent policy with 4 actions per state
 */
export class GridWorldSelector implements NativeActionSelector {
  private readonly actions: Term[];
  private readonly actionNames = ['move_up', 'move_right', 'move_down', 'move_left'];
  private explorationRate: number;
  private readonly explorationDecay: number;
  private readonly explorationMin: number;
  private readonly wallPenalty: number;
  private lastStateId: string | null = null;
  private lastAction: number | null = null;
  private episodeCount: number = 0;
  private readonly rng: RandomSource;

  constructor(
    explorationRate: number = 0.3,
    wallPenalty: number = -0.1,
    explorationDecay: number = 0.99,
    explorationMin: number = 0.01,
    seed: number | RandomSource = 42
  ) {
    this.explorationRate = explorationRate;
    this.explorationDecay = explorationDecay;
    this.explorationMin = explorationMin;
    this.wallPenalty = wallPenalty;
    this.actions = this.actionNames.map((name) => operationTerm(name));
    this.rng = rngFrom(seed, Math.random);
  }

  onEpisodeEnd(): void {
    this.episodeCount++;
    this.explorationRate = Math.max(
      this.explorationMin,
      this.explorationRate * this.explorationDecay
    );
  }

  getExplorationRate(): number {
    return this.explorationRate;
  }

  selectAction(
    stateId: string,
    nar: NAR,
    qStore: QBeliefStore,
    actionAdapter: GoalActionAdapter
  ): number {
    const pending = topPendingOperation(nar, (name) => this.actionNames.includes(name));
    if (pending !== undefined) {
      return this.actionNames.indexOf(pending);
    }

    const stateTerm = TermBuilder.atom(stateId);

    const bestAction = qStore.getBestAction(stateTerm, this.actions);
    const lowConfidence = qStore.getLowConfidenceActions(stateTerm, this.actions, 0.4);

    let selectedAction = 0;

    if (bestAction && this.rng() > this.explorationRate) {
      selectedAction = Math.max(0, this.actions.indexOf(bestAction));
    } else if (lowConfidence.length > 0 && this.rng() < 0.4) {
      const exploreAction = lowConfidence[nextInt(this.rng, lowConfidence.length)];
      if (!exploreAction) return nextInt(this.rng, 4);
      selectedAction = Math.max(0, this.actions.indexOf(exploreAction));
      qStore.stimulateCuriosity(0.03);
    } else {
      selectedAction = nextInt(this.rng, 4);
    }

    this.lastStateId = stateId;
    this.lastAction = selectedAction;
    return selectedAction;
  }

  onReward(stateId: string, action: number, reward: number): void {
    if (reward === this.wallPenalty && this.lastStateId && this.lastAction !== null) {
      // Could add additional logic here for wall learning
    }
  }

  onEpisodeStart(): void {
    this.lastStateId = null;
    this.lastAction = null;
  }
}

/**
 * Non-stationary bandit selector with change detection via confidence monitoring
 */
export class NonStationarySelector implements NativeActionSelector {
  private readonly numArms: number;
  private readonly actions: Term[];
  private readonly stateTerm: Term;
  private readonly changeDetectionThreshold: number;
  private readonly explorationRate: number;
  private readonly rng: RandomSource;
  private armPullCounts: number[] = [];
  private lastRewards: number[] = [];
  private predictionErrors: BoundedRing<number>[] = [];

  constructor(
    numArms: number = 2,
    changeDetectionThreshold: number = 0.3,
    explorationRate: number = 0.2,
    rng: RandomSource = Math.random
  ) {
    this.numArms = numArms;
    this.changeDetectionThreshold = changeDetectionThreshold;
    this.explorationRate = explorationRate;
    this.rng = rng;
    this.stateTerm = TermBuilder.atom('bandit_state');
    this.actions = Array.from({ length: numArms }, (_, i) => operationTerm(`pull_arm_${i}`));
    this.armPullCounts = new Array(numArms).fill(0);
    this.lastRewards = new Array(numArms).fill(0);
    this.predictionErrors = Array.from({ length: numArms }, () => new BoundedRing<number>(20));
  }

  selectAction(
    stateId: string,
    nar: NAR,
    qStore: QBeliefStore,
    actionAdapter: GoalActionAdapter
  ): number {
    const pending = armIndexOf(topPendingOperation(nar, isArmName));
    if (pending !== undefined) return pending;

    const bestAction = qStore.getBestAction(this.stateTerm, this.actions);
    const lowConfidence = qStore.getLowConfidenceActions(this.stateTerm, this.actions, 0.4);

    let effectiveExplorationRate = this.explorationRate;
    if (bestAction) {
      const bestIdx = this.actions.indexOf(bestAction);
      const bestErrors = bestIdx >= 0 ? this.predictionErrors[bestIdx] : undefined;
      if (bestErrors && bestErrors.size > 5) {
        const recentErrors = bestErrors.tail(5);
        const avgError = mean(recentErrors);
        if (avgError > this.changeDetectionThreshold) {
          effectiveExplorationRate = Math.min(0.5, this.explorationRate * 2);
          qStore.stimulateCuriosity(0.1);
        }
      }
    }

    if (bestAction && this.rng() > effectiveExplorationRate) {
      const idx = this.actions.indexOf(bestAction);
      if (idx >= 0) return idx;
    }

    if (lowConfidence.length > 0 && this.rng() < 0.5) {
      const exploreAction = lowConfidence[nextInt(this.rng, lowConfidence.length)];
      if (!exploreAction) return nextInt(this.rng, this.numArms);
      const idx = this.actions.indexOf(exploreAction);
      qStore.stimulateCuriosity(0.05);
      if (idx >= 0) return idx;
    }

    return nextInt(this.rng, this.numArms);
  }

  onReward(stateId: string, action: number, reward: number): void {
    this.armPullCounts[action] = (this.armPullCounts[action] ?? 0) + 1;
    this.lastRewards[action] = reward;

    if ((this.armPullCounts[action] ?? 0) > 1) {
      const errors = this.predictionErrors[action] ?? new BoundedRing<number>(20);
      const recentRewards = errors.tail(10);
      if (recentRewards.length > 0) {
        const avgRecent = mean(recentRewards);
        errors.push(Math.abs(reward - avgRecent));
        this.predictionErrors[action] = errors;
      }
    }
  }

  onEpisodeStart(): void {}

  onEpisodeEnd(): void {}
}
