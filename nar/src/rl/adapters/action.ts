import { SeededRNG } from '../../game/SeededRNG.js';
import { type Term, TermBuilder, Truth } from '../../index.js';
import type { NAR } from '../../nar.js';
import type { RandomSource } from '../../types/primitives.js';
import type { QBeliefStore } from '../q-belief-store.js';

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

  /** Build a native AST goal term for an action: Inheritance(Product(args...), Atom('^action')) */
  buildGoalTerm(action: RLAction): Term {
    const opAtom = TermBuilder.atom(`^${action.name}`);

    if (action.args && Object.keys(action.args).length > 0) {
      const argTerms: Term[] = [];
      for (const [key, value] of Object.entries(action.args)) {
        const keyTerm = TermBuilder.atom(key);
        const valueTerm = TermBuilder.atom(String(value));
        const compactInh = TermBuilder.inheritance(valueTerm, keyTerm);
        if (compactInh) argTerms.push(compactInh);
      }
      const product = argTerms.length === 1 ? argTerms[0]! : TermBuilder.product(...argTerms);
      const result = TermBuilder.inheritance(product, opAtom);
      if (!result) throw new Error(`Invalid inheritance: ${product} --> ${opAtom}`);
      return result;
    }

    const emptyProduct = TermBuilder.atom('true');
    const result = TermBuilder.inheritance(emptyProduct, opAtom);
    if (!result) throw new Error(`Invalid inheritance: ${emptyProduct} --> ${opAtom}`);
    return result;
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

/** Highest-priority pending tool goal matching `pattern`, as a term string. */
function topPendingGoal(nar: NAR, pattern: string | RegExp): string | undefined {
  const toolGoals = nar.taskManager
    .getPending()
    .filter((g) => g.type === 'goal' && g.term.toString().match(pattern));
  toolGoals.sort((a, b) => b.budget.priority - a.budget.priority);
  return toolGoals[0]?.term.toString();
}

function armIndexOf(termStr: string): number | undefined {
  const match = termStr.match(/pull_arm_(\d+)/);
  return match ? parseInt(match[1]!, 10) : undefined;
}

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
    this.actions = Array.from({ length: numArms }, (_, i) => TermBuilder.atom(`^pull_arm_${i}`));
  }

  selectAction(
    stateId: string,
    nar: NAR,
    qStore: QBeliefStore,
    actionAdapter: GoalActionAdapter
  ): number {
    const pending = topPendingGoal(nar, /pull_arm_\d+/);
    if (pending) {
      const idx = armIndexOf(pending);
      if (idx !== undefined) return idx;
    }

    const bestAction = qStore.getBestAction(this.stateTerm, this.actions);
    const lowConfidence = qStore.getLowConfidenceActions(this.stateTerm, this.actions, 0.4);

    if (bestAction && this.rng() > this.explorationRate) {
      const idx = armIndexOf(bestAction.toString());
      if (idx !== undefined) return idx;
    }

    if (lowConfidence.length > 0 && this.rng() < 0.5) {
      const exploreAction = lowConfidence[Math.floor(this.rng() * lowConfidence.length)];
      if (!exploreAction) return Math.floor(this.rng() * this.numArms);
      const idx = armIndexOf(exploreAction.toString());
      qStore.stimulateCuriosity(0.05);
      if (idx !== undefined) return idx;
    }

    return Math.floor(this.rng() * this.numArms);
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
    this.actions = this.actionNames.map((name) => TermBuilder.atom(`^${name}`));
    if (typeof seed === 'function') {
      this.rng = seed;
    } else {
      const seeded = new SeededRNG(seed);
      this.rng = () => seeded.next();
    }
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
    const pending = topPendingGoal(nar, /^.*\^(move_up|move_right|move_down|move_left)/);
    if (pending) {
      for (let i = 0; i < this.actionNames.length; i++) {
        if (pending.includes(`^${this.actionNames[i]}`)) {
          return i;
        }
      }
    }

    const stateTerm = TermBuilder.atom(stateId);

    const bestAction = qStore.getBestAction(stateTerm, this.actions);
    const lowConfidence = qStore.getLowConfidenceActions(stateTerm, this.actions, 0.4);

    let selectedAction = 0;

    if (bestAction && this.rng() > this.explorationRate) {
      const match = bestAction.toString().match(/move_(up|right|down|left)/);
      if (match) {
        selectedAction = this.actionNames.indexOf(`move_${match[1]}`);
      }
    } else if (lowConfidence.length > 0 && this.rng() < 0.4) {
      const exploreAction = lowConfidence[Math.floor(this.rng() * lowConfidence.length)];
      if (!exploreAction) return Math.floor(this.rng() * 4);
      const match = exploreAction.toString().match(/move_(up|right|down|left)/);
      if (match) {
        selectedAction = this.actionNames.indexOf(`move_${match[1]}`);
      }
      qStore.stimulateCuriosity(0.03);
    } else {
      selectedAction = Math.floor(this.rng() * 4);
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
  private predictionErrors: number[][] = [];

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
    this.actions = Array.from({ length: numArms }, (_, i) => TermBuilder.atom(`^pull_arm_${i}`));
    this.armPullCounts = new Array(numArms).fill(0);
    this.lastRewards = new Array(numArms).fill(0);
    this.predictionErrors = Array.from({ length: numArms }, () => []);
  }

  selectAction(
    stateId: string,
    nar: NAR,
    qStore: QBeliefStore,
    actionAdapter: GoalActionAdapter
  ): number {
    const pending = topPendingGoal(nar, /pull_arm_\d+/);
    if (pending) {
      const idx = armIndexOf(pending);
      if (idx !== undefined) return idx;
    }

    const bestAction = qStore.getBestAction(this.stateTerm, this.actions);
    const lowConfidence = qStore.getLowConfidenceActions(this.stateTerm, this.actions, 0.4);

    let effectiveExplorationRate = this.explorationRate;
    if (bestAction) {
      const bestIdx = this.actions.indexOf(bestAction);
      const bestErrors = bestIdx >= 0 ? this.predictionErrors[bestIdx] : undefined;
      if (bestErrors && bestErrors.length > 5) {
        const recentErrors = bestErrors.slice(-5);
        const avgError = recentErrors.reduce((a, b) => a + b, 0) / recentErrors.length;
        if (avgError > this.changeDetectionThreshold) {
          effectiveExplorationRate = Math.min(0.5, this.explorationRate * 2);
          qStore.stimulateCuriosity(0.1);
        }
      }
    }

    if (bestAction && this.rng() > effectiveExplorationRate) {
      const idx = armIndexOf(bestAction.toString());
      if (idx !== undefined) return idx;
    }

    if (lowConfidence.length > 0 && this.rng() < 0.5) {
      const exploreAction = lowConfidence[Math.floor(this.rng() * lowConfidence.length)];
      if (!exploreAction) return Math.floor(this.rng() * this.numArms);
      const idx = armIndexOf(exploreAction.toString());
      qStore.stimulateCuriosity(0.05);
      if (idx !== undefined) return idx;
    }

    return Math.floor(this.rng() * this.numArms);
  }

  onReward(stateId: string, action: number, reward: number): void {
    this.armPullCounts[action] = (this.armPullCounts[action] ?? 0) + 1;
    this.lastRewards[action] = reward;

    if ((this.armPullCounts[action] ?? 0) > 1) {
      const errors = this.predictionErrors[action] ?? [];
      const recentRewards = errors.slice(-10);
      if (recentRewards.length > 0) {
        const avgRecent = recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length;
        const error = Math.abs(reward - avgRecent);
        errors.push(error);
        if (errors.length > 20) errors.shift();
        this.predictionErrors[action] = errors;
      }
    }
  }

  onEpisodeStart(): void {}

  onEpisodeEnd(): void {}
}
