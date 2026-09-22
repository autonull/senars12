import { type Term, TermBuilder } from '../../index.js';
import type { NAR } from '../../nar.js';
import type { QBeliefStore } from '../q-belief-store.js';
import { RewardBeliefAdapter } from '../reward-belief-adapter.js';
import {
  BanditSelector,
  GoalActionAdapter,
  GridWorldSelector,
  type NativeActionSelector,
  NonStationarySelector,
  type RLAction,
} from './action.js';
import { BeliefPerceptionAdapter, type RLObservation } from './perception.js';

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
    return gridStateId(env) ?? 'bandit_state';
  }

  /** Get current state ID from environment */
  protected getStateId(env: any): string {
    return gridStateId(env) ?? 'bandit_state';
  }

  /** Map action index to action name */
  protected getActionName(action: number): string {
    return `action_${action}`;
  }
}

/** `s_row_col` when the env exposes a grid state, else null. */
function gridStateId(env: any): string | null {
  if (env.state) {
    const state = env.state();
    if (typeof state === 'object' && state !== null && 'row' in state && 'col' in state) {
      return `s_${state.row}_${state.col}`;
    }
  }
  return null;
}

function armTools(numArms: number): { name: string; execute: () => Promise<any> }[] {
  return Array.from({ length: numArms }, (_, i) => ({
    name: `pull_arm_${i}`,
    execute: async () => ({ success: true, content: { arm: i } }),
  }));
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

    this.registerTools(armTools(numArms));
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

    this.registerTools(armTools(numArms));
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
