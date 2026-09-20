import { type Term, TermBuilder, Truth } from '../index.js';
import type { NAR } from '../nar.js';
import { SeededRNG } from '../game/SeededRNG.js';
import { atm, inh, prod } from './terms.js';
import { RewardBeliefAdapter } from './reward-belief-adapter.js';
import type { QBeliefStore } from './q-belief-store.js';

export interface RLObservation {
  stateId: string;
  features?: Record<string, number>;
  reward?: number;
  terminal?: boolean;
  timestamp?: number;
}

export interface BeliefPerceptionAdapterConfig {
  sensorConfidence?: number;
  featureConfidence?: number;
}

interface ResolvedBeliefPerceptionAdapterConfig {
  sensorConfidence: number;
  featureConfidence: number;
}

export class BeliefPerceptionAdapter {
  private readonly nar: NAR;
  private readonly config: ResolvedBeliefPerceptionAdapterConfig;
  private readonly rng: SeededRNG;

  constructor(nar: NAR, config: BeliefPerceptionAdapterConfig = {}, seed = 1) {
    this.nar = nar;
    this.config = {
      sensorConfidence: config.sensorConfidence ?? 0.95,
      featureConfidence: config.featureConfidence ?? 0.9,
    };
    this.rng = new SeededRNG(seed);
  }

  /** Convert an RL observation to belief tasks and input them to NAR */
  async perceive(observation: RLObservation): Promise<void> {
    // State observation: (self --> state:s_X_Y)
    const stateTerm = atm(observation.stateId);
    const selfTerm = atm('self');
    const stateInheritance = inh(selfTerm, stateTerm);
    await this.nar.believe(stateInheritance, Truth.create(1.0, this.config.sensorConfidence));

    // Feature observations
    if (observation.features) {
      for (const [feature, value] of Object.entries(observation.features)) {
        const featureTerm = atm(`feature:${feature}`);
        const valueTerm = atm(value > 0 ? 'present' : 'absent');
        const featureInheritance = inh(featureTerm, valueTerm);
        await this.nar.believe(featureInheritance, Truth.create(1.0, this.config.featureConfidence));
      }
    }

    // Reward observation if present
    if (observation.reward !== undefined) {
      const rewardLevel =
        observation.reward > 0 ? 'high' : observation.reward < 0 ? 'low' : 'neutral';
      const rewardTerm = inh(atm(`reward:${rewardLevel}`), atm('achieved'));
      const confidence = Math.min(0.95, 0.5 + Math.abs(observation.reward) * 0.4);
      await this.nar.believe(rewardTerm, Truth.create(Math.abs(observation.reward), confidence));
    }

    // Terminal state observation
    if (observation.terminal) {
      const terminalTerm = inh(atm('state:terminal'), atm('reached'));
      await this.nar.believe(terminalTerm, Truth.create(1.0, this.config.sensorConfidence));
    }
  }

  /** Add noisy observation (for testing sensor reliability) */
  async perceiveNoisy(observation: RLObservation, noiseLevel: number): Promise<void> {
    const baseConfidence = this.config.sensorConfidence;
    const noisyConfidence = Math.max(0.1, baseConfidence - noiseLevel * this.rng.next());

    const stateTerm = atm(observation.stateId);
    const selfTerm = atm('self');
    const stateInheritance = inh(selfTerm, stateTerm);
    await this.nar.believe(stateInheritance, Truth.create(1.0, noisyConfidence));
  }

  getNAR(): NAR {
    return this.nar;
  }
}

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
    const opAtom = atm(`^${action.name}`);

    if (action.args && Object.keys(action.args).length > 0) {
      const argTerms: Term[] = [];
      for (const [key, value] of Object.entries(action.args)) {
        const keyTerm = atm(key);
        const valueTerm = atm(String(value));
        const compactInh = inh(valueTerm, keyTerm);
        argTerms.push(compactInh);
      }
      const product = argTerms.length === 1 ? argTerms[0]! : prod(...argTerms);
      return inh(product, opAtom);
    }

    const emptyProduct = atm('true');
    return inh(emptyProduct, opAtom);
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
 * Bandit action selector (existing logic extracted)
 */
export class BanditSelector implements NativeActionSelector {
  private readonly numArms: number;
  private readonly actions: Term[];
  private readonly stateTerm: Term;
  private readonly explorationRate: number;

  constructor(numArms: number = 3, explorationRate: number = 0.2) {
    this.numArms = numArms;
    this.explorationRate = explorationRate;
    this.stateTerm = TermBuilder.atom('bandit_state');
    this.actions = Array.from({ length: numArms }, (_, i) => TermBuilder.atom(`^pull_arm_${i}`));
  }

  selectAction(
    stateId: string,
    nar: NAR,
    qStore: QBeliefStore,
    actionAdapter: GoalActionAdapter
  ): number {
    const pendingGoals = nar.taskManager.getPending();
    const toolGoals = pendingGoals.filter(
      (g) => g.type === 'goal' && g.term.toString().includes('^pull_arm')
    );

    if (toolGoals.length > 0) {
      toolGoals.sort((a, b) => b.budget.priority - a.budget.priority);
      const match = toolGoals[0]!.term.toString().match(/pull_arm_(\d+)/);
      if (match) return parseInt(match[1]!, 10);
    }

    const bestAction = qStore.getBestAction(this.stateTerm, this.actions);
    const lowConfidence = qStore.getLowConfidenceActions(this.stateTerm, this.actions, 0.4);

    if (bestAction && Math.random() > this.explorationRate) {
      const match = bestAction.toString().match(/pull_arm_(\d+)/);
      if (match) return parseInt(match[1]!, 10);
    }

    if (lowConfidence.length > 0 && Math.random() < 0.5) {
      const exploreAction = lowConfidence[Math.floor(Math.random() * lowConfidence.length)];
      if (!exploreAction) return Math.floor(Math.random() * this.numArms);
      const match = exploreAction.toString().match(/pull_arm_(\d+)/);
      qStore.stimulateCuriosity(0.05);
      if (match) return parseInt(match[1]!, 10);
    }

    return Math.floor(Math.random() * this.numArms);
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
  private readonly rng: SeededRNG;

  constructor(
    explorationRate: number = 0.3,
    wallPenalty: number = -0.1,
    explorationDecay: number = 0.99,
    explorationMin: number = 0.01,
    seed: number = 42
  ) {
    this.explorationRate = explorationRate;
    this.explorationDecay = explorationDecay;
    this.explorationMin = explorationMin;
    this.wallPenalty = wallPenalty;
    this.actions = this.actionNames.map((name) => TermBuilder.atom(`^${name}`));
    this.rng = new SeededRNG(seed);
  }

  onEpisodeEnd(): void {
    this.episodeCount++;
    this.explorationRate = Math.max(this.explorationMin, this.explorationRate * this.explorationDecay);
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
    const pendingGoals = nar.taskManager.getPending();
    const toolGoals = pendingGoals.filter(
      (g) => g.type === 'goal' && this.actionNames.some((n) => g.term.toString().includes(`^${n}`))
    );

    if (toolGoals.length > 0) {
      toolGoals.sort((a, b) => b.budget.priority - a.budget.priority);
      for (let i = 0; i < this.actionNames.length; i++) {
        if (toolGoals[0]!.term.toString().includes(`^${this.actionNames[i]}`)) {
          return i;
        }
      }
    }

    const stateTerm = TermBuilder.atom(stateId);

    const bestAction = qStore.getBestAction(stateTerm, this.actions);
    const lowConfidence = qStore.getLowConfidenceActions(stateTerm, this.actions, 0.4);

    let selectedAction = 0;

    if (bestAction && this.rng.next() > this.explorationRate) {
      const match = bestAction.toString().match(/move_(up|right|down|left)/);
      if (match) {
        selectedAction = this.actionNames.indexOf(`move_${match[1]}`);
      }
    } else if (lowConfidence.length > 0 && this.rng.next() < 0.4) {
      const exploreAction = lowConfidence[Math.floor(this.rng.next() * lowConfidence.length)];
      if (!exploreAction) return Math.floor(this.rng.next() * 4);
      const match = exploreAction.toString().match(/move_(up|right|down|left)/);
      if (match) {
        selectedAction = this.actionNames.indexOf(`move_${match[1]}`);
      }
      qStore.stimulateCuriosity(0.03);
    } else {
      selectedAction = Math.floor(this.rng.next() * 4);
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
  private armPullCounts: number[] = [];
  private lastRewards: number[] = [];
  private predictionErrors: number[][] = [];

  constructor(
    numArms: number = 2,
    changeDetectionThreshold: number = 0.3,
    explorationRate: number = 0.2
  ) {
    this.numArms = numArms;
    this.changeDetectionThreshold = changeDetectionThreshold;
    this.explorationRate = explorationRate;
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
    const pendingGoals = nar.taskManager.getPending();
    const toolGoals = pendingGoals.filter(
      (g) => g.type === 'goal' && g.term.toString().includes('^pull_arm')
    );

    if (toolGoals.length > 0) {
      toolGoals.sort((a, b) => b.budget.priority - a.budget.priority);
      const match = toolGoals[0]!.term.toString().match(/pull_arm_(\d+)/);
      if (match) return parseInt(match[1]!, 10);
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

    if (bestAction && Math.random() > effectiveExplorationRate) {
      const match = bestAction.toString().match(/pull_arm_(\d+)/);
      if (match) return parseInt(match[1]!, 10);
    }

    if (lowConfidence.length > 0 && Math.random() < 0.5) {
      const exploreAction = lowConfidence[Math.floor(Math.random() * lowConfidence.length)];
      if (!exploreAction) return Math.floor(Math.random() * this.numArms);
      const match = exploreAction.toString().match(/pull_arm_(\d+)/);
      qStore.stimulateCuriosity(0.05);
      if (match) return parseInt(match[1]!, 10);
    }

    return Math.floor(Math.random() * this.numArms);
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

/**
 * Unified native SeNARS agent for RL parity experiments
 * Encapsulates: perception → NAR.run() → value query → goal dispatch → reward update
 */
export interface NativeSenarsAgentConfig {
  selector: NativeActionSelector;
  maxDerivationsPerStep: number;
  perceptionConfig?: any;
  useTDLearning?: boolean;
  gamma?: number;
}

export class NativeSenarsAgent {
  public readonly nar: NAR;
  public readonly perception: BeliefPerceptionAdapter;
  public readonly actionAdapter: GoalActionAdapter;
  public readonly rewardAdapter: RewardBeliefAdapter;
  public readonly qStore: QBeliefStore;
  protected readonly selector: NativeActionSelector;
  protected readonly maxDerivationsPerStep: number;
  protected readonly useTDLearning: boolean;
  protected readonly gamma: number;
  protected lastState: Term | null = null;
  protected lastAction: Term | null = null;
  protected lastStateId: string | null = null;
  protected lastActionIdx: number | null = null;
  protected lastReward: number = 0;

  constructor(nar: NAR, config: NativeSenarsAgentConfig) {
    this.nar = nar;
    this.selector = config.selector;
    this.maxDerivationsPerStep = config.maxDerivationsPerStep;
    this.useTDLearning = config.useTDLearning ?? true;
    this.gamma = config.gamma ?? 0.99;

    this.perception = new BeliefPerceptionAdapter(nar, config.perceptionConfig);
    this.actionAdapter = new GoalActionAdapter(nar);
    this.rewardAdapter = new RewardBeliefAdapter(nar, { gamma: this.gamma });
    this.qStore = this.rewardAdapter.getQStore();
  }

  /** Run a single step: perceive → reason → act → learn */
  async step(
    env: any,
    stateId: string
  ): Promise<{ action: number; reward: number; done: boolean }> {
    const stateTerm = TermBuilder.atom(stateId);

    // 1. Perceive: convert environment observation to NAR beliefs
    await this.perception.perceive({ stateId, reward: 0 });

    // 2. Reason: run NAR inference cycles
    await this.nar.run(this.maxDerivationsPerStep);

    // 3. Act: select and execute action through NAR goal dispatch
    const action = this.selector.selectAction(stateId, this.nar, this.qStore, this.actionAdapter);
    const actionName = this.getActionName(action);
    const goalTerm = this.actionAdapter.buildGoalTerm({ name: actionName });
    await this.nar.tools.executeToolGoal(goalTerm);

    // 4. Environment step
    const result = env.step(action);

    // 5. Learn: update value beliefs with reward
    const actionTerm = TermBuilder.atom(`^${actionName}`);

    if (this.useTDLearning && this.lastState !== null && this.lastAction !== null) {
      const nextAvailableActions = this.getAvailableActions(env);
      await this.rewardAdapter.processRewardTD(
        this.lastState,
        this.lastAction,
        this.lastReward,
        stateTerm,
        nextAvailableActions,
        result.terminal
      );
    } else {
      await this.rewardAdapter.processReward(stateTerm, actionTerm, result.reward);
    }

    // Store current for next TD update
    this.lastState = stateTerm;
    this.lastAction = actionTerm;
    this.lastStateId = stateId;
    this.lastActionIdx = action;
    this.lastReward = result.reward;

    // Notify selector of reward for change detection/adaptation
    this.selector.onReward(stateId, action, result.reward);

    return { action, reward: result.reward, done: result.terminal };
  }

  /** Get available actions for the environment (override in subclasses) */
  getAvailableActions(env: any): Term[] {
    return [];
  }

  /** Run an episode */
  async runEpisode(env: any, maxSteps: number): Promise<number> {
    this.selector.onEpisodeStart();
    env.reset();
    let totalReward = 0;
    let stateId = this.getInitialStateId(env);

    for (let step = 0; step < maxSteps; step++) {
      const { action, reward, done } = await this.step(env, stateId);
      totalReward += reward;

      if (done) break;

      stateId = this.getStateId(env);
    }

    this.selector.onEpisodeEnd();
    return totalReward;
  }

  /** Register tools for the environment */
  registerTools(toolConfigs: { name: string; execute: () => Promise<any> }[]): void {
    for (const tool of toolConfigs) {
      this.nar.tools.register({
        name: tool.name,
        description: tool.name,
        parameters: { type: 'object', properties: {} },
        execute: tool.execute,
      });
    }
  }

  /** Get initial state ID from environment */
  protected getInitialStateId(env: any): string {
    if (env.state) {
      const state = env.state();
      if (typeof state === 'object' && state !== null && 'row' in state && 'col' in state) {
        return `s_${state.row}_${state.col}`;
      }
    }
    return 'bandit_state';
  }

  /** Get current state ID from environment */
  protected getStateId(env: any): string {
    if (env.state) {
      const state = env.state();
      if (typeof state === 'object' && state !== null && 'row' in state && 'col' in state) {
        return `s_${state.row}_${state.col}`;
      }
    }
    return 'bandit_state';
  }

  /** Map action index to action name */
  protected getActionName(action: number): string {
    return `action_${action}`;
  }
}

/**
 * Bandit-specific native agent
 */
export class BanditNativeAgent extends NativeSenarsAgent {
  private readonly numArms: number;
  private readonly actionTerms: Term[];

  constructor(nar: NAR, numArms: number = 3, maxDerivationsPerStep: number = 3) {
    const selector = new BanditSelector(numArms);
    super(nar, { selector, maxDerivationsPerStep, useTDLearning: true, gamma: 0.99 });
    this.numArms = numArms;
    this.actionTerms = Array.from({ length: numArms }, (_, i) =>
      TermBuilder.atom(`^pull_arm_${i}`)
    );

    const toolConfigs = Array.from({ length: numArms }, (_, i) => ({
      name: `pull_arm_${i}`,
      execute: async () => ({ success: true, content: { arm: i } }),
    }));
    this.registerTools(toolConfigs);
  }

  override getAvailableActions(env: any): Term[] {
    return this.actionTerms;
  }

  protected override getActionName(action: number): string {
    return `pull_arm_${action}`;
  }

  protected override getInitialStateId(env: any): string {
    return 'bandit_state';
  }

  protected override getStateId(env: any): string {
    return 'bandit_state';
  }
}

/**
 * GridWorld-specific native agent
 */
export class GridWorldNativeAgent extends NativeSenarsAgent {
  private readonly actionNames = ['move_up', 'move_right', 'move_down', 'move_left'];
  private readonly actionTerms = this.actionNames.map((name) => TermBuilder.atom(`^${name}`));

  constructor(nar: NAR, maxDerivationsPerStep: number = 3, seed: number = 42) {
    const selector = new GridWorldSelector(0.3, -0.1, 0.99, 0.01, seed);
    super(nar, { selector, maxDerivationsPerStep, useTDLearning: true, gamma: 0.99 });

    const toolConfigs = [
      { name: 'move_up', execute: async () => ({ success: true, content: { dir: 0 } }) },
      { name: 'move_right', execute: async () => ({ success: true, content: { dir: 1 } }) },
      { name: 'move_down', execute: async () => ({ success: true, content: { dir: 2 } }) },
      { name: 'move_left', execute: async () => ({ success: true, content: { dir: 3 } }) },
    ];
    this.registerTools(toolConfigs);
  }

  /** Override step to normalize rewards for NAL truth values (must be in [0, 1]) */
  override async step(
    env: any,
    stateId: string
  ): Promise<{ action: number; reward: number; done: boolean }> {
    const stateTerm = TermBuilder.atom(stateId);

    await this.perception.perceive({ stateId, reward: 0 });
    await this.nar.run(this.maxDerivationsPerStep);

    const action = this.selector.selectAction(stateId, this.nar, this.qStore, this.actionAdapter);
    const actionName = this.getActionName(action);
    const goalTerm = this.actionAdapter.buildGoalTerm({ name: actionName });
    await this.nar.tools.executeToolGoal(goalTerm);

    const result = env.step(action);

    // GridWorld reward range: [-0.01, 1] -> normalize to [0, 1]
    const normalizedReward = (result.reward + 0.01) / 1.01;
    const actionTerm = TermBuilder.atom(`^${actionName}`);

    if (this.useTDLearning && this.lastState !== null && this.lastAction !== null) {
      const nextAvailableActions = this.getAvailableActions(env);
      await this.rewardAdapter.processRewardTD(
        this.lastState,
        this.lastAction,
        this.lastReward,
        stateTerm,
        nextAvailableActions,
        result.terminal
      );
    }

    // Terminal transition: the delayed-TD scheme above only ever credits the
    // previous pair; attribute the terminal reward to the pair that earned it.
    if (result.terminal) {
      await this.rewardAdapter.processRewardTD(
        stateTerm,
        actionTerm,
        normalizedReward,
        stateTerm,
        this.actionTerms,
        true
      );
    }

    this.lastState = stateTerm;
    this.lastAction = actionTerm;
    this.lastStateId = stateId;
    this.lastActionIdx = action;
    this.lastReward = normalizedReward;

    this.selector.onReward(stateId, action, result.reward);

    return { action, reward: result.reward, done: result.terminal };
  }

  override getAvailableActions(env: any): Term[] {
    return this.actionTerms;
  }

  protected override getActionName(action: number): string {
    return this.actionNames[action] || `action_${action}`;
  }

  protected override getInitialStateId(env: any): string {
    const state = env.state();
    return `s_${state.row}_${state.col}`;
  }

  protected override getStateId(env: any): string {
    const state = env.state();
    return `s_${state.row}_${state.col}`;
  }
}

/**
 * Non-stationary bandit native agent
 */
export class NonStationaryNativeAgent extends NativeSenarsAgent {
  private readonly numArms: number;
  private readonly actionTerms: Term[];

  constructor(nar: NAR, numArms: number = 2, maxDerivationsPerStep: number = 3) {
    const selector = new NonStationarySelector(numArms);
    super(nar, { selector, maxDerivationsPerStep, useTDLearning: true, gamma: 0.99 });
    this.numArms = numArms;
    this.actionTerms = Array.from({ length: numArms }, (_, i) =>
      TermBuilder.atom(`^pull_arm_${i}`)
    );

    const toolConfigs = Array.from({ length: numArms }, (_, i) => ({
      name: `pull_arm_${i}`,
      execute: async () => ({ success: true, content: { arm: i } }),
    }));
    this.registerTools(toolConfigs);
  }

  override getAvailableActions(env: any): Term[] {
    return this.actionTerms;
  }

  protected override getActionName(action: number): string {
    return `pull_arm_${action}`;
  }

  protected override getInitialStateId(env: any): string {
    return 'bandit_state';
  }

  protected override getStateId(env: any): string {
    return 'bandit_state';
  }
}