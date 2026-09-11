import { type AtomicTerm, type Term, TermBuilder, Truth } from '../../../../nar/src';
import type { DriveManager } from '../../../../nar/src/drives';
import type { NAR } from '../../../../nar/src/nar';
import { SeededRNG } from '../environments/RLEnvironments';

/** Safe term builder that asserts non-null for valid RL term constructions */
function inh(subj: Term, pred: Term): Term {
  const result = TermBuilder.inheritance(subj, pred);
  if (!result) throw new Error(`Invalid inheritance: ${subj} --> ${pred}`);
  return result;
}

function prod(...terms: Term[]): Term {
  const first = terms[0];
  if (!first) throw new Error('Invalid product: no terms');
  if (terms.length === 1) return first;
  const result = TermBuilder.product(...terms);
  if (!result) throw new Error(`Invalid product: ${terms.map((t) => t.toString()).join(' * ')}`);
  return result;
}

function atm(symbol: string): AtomicTerm {
  return TermBuilder.atom(symbol);
}

/**
 * Converts RL environment observations to NAR belief tasks
 */
export interface RLObservation {
  stateId: string;
  features?: Record<string, number>;
  reward?: number;
  terminal?: boolean;
  timestamp?: number;
}

export interface BeliefPerceptionAdapterConfig {
  sensorConfidence?: number; // Default confidence for observations
  featureConfidence?: number; // Confidence for feature observations
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
  perceive(observation: RLObservation): void {
    // State observation: (self --> state:s_X_Y)
    const stateTerm = atm(observation.stateId);
    const selfTerm = atm('self');
    const stateInheritance = inh(selfTerm, stateTerm);
    this.nar.believe(stateInheritance, Truth.create(1.0, this.config.sensorConfidence));

    // Feature observations
    if (observation.features) {
      for (const [feature, value] of Object.entries(observation.features)) {
        const featureTerm = atm(`feature:${feature}`);
        const valueTerm = atm(value > 0 ? 'present' : 'absent');
        const featureInheritance = inh(featureTerm, valueTerm);
        this.nar.believe(featureInheritance, Truth.create(1.0, this.config.featureConfidence));
      }
    }

    // Reward observation if present
    if (observation.reward !== undefined) {
      const rewardLevel =
        observation.reward > 0 ? 'high' : observation.reward < 0 ? 'low' : 'neutral';
      const rewardTerm = inh(atm(`reward:${rewardLevel}`), atm('achieved'));
      // Confidence proportional to reward magnitude
      const confidence = Math.min(0.95, 0.5 + Math.abs(observation.reward) * 0.4);
      this.nar.believe(rewardTerm, Truth.create(Math.abs(observation.reward), confidence));
    }

    // Terminal state observation
    if (observation.terminal) {
      const terminalTerm = inh(atm('state:terminal'), atm('reached'));
      this.nar.believe(terminalTerm, Truth.create(1.0, this.config.sensorConfidence));
    }
  }

  /** Add noisy observation (for testing sensor reliability) */
  perceiveNoisy(observation: RLObservation, noiseLevel: number): void {
    // Add noise to confidence
    const baseConfidence = this.config.sensorConfidence;
    const noisyConfidence = Math.max(0.1, baseConfidence - noiseLevel * this.rng.next());

    const stateTerm = atm(observation.stateId);
    const selfTerm = atm('self');
    const stateInheritance = inh(selfTerm, stateTerm);
    this.nar.believe(stateInheritance, Truth.create(1.0, noisyConfidence));
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
      // Build Product of arguments
      const argTerms: Term[] = [];
      for (const [key, value] of Object.entries(action.args)) {
        // Use compact form: key:value -> Inheritance(value, key)
        const keyTerm = atm(key);
        const valueTerm = atm(String(value));
        const compactInh = inh(valueTerm, keyTerm);
        argTerms.push(compactInh);
      }
      const product = argTerms.length === 1 ? argTerms[0]! : prod(...argTerms);
      return inh(product, opAtom);
    }

    // Simple operation without arguments: use empty Product (Atom('true') as placeholder)
    const emptyProduct = atm('true');
    return inh(emptyProduct, opAtom);
  }

  /** Propose an action as a goal to NAR */
  proposeAction(action: RLAction, priority?: number): void {
    const goalTerm = this.buildGoalTerm(action);
    const truth = Truth.create(1.0, priority ?? this.config.defaultPriority);
    this.nar.goal(goalTerm, truth);
  }

  /** Dispatch all pending tool goals through NAR's execution cycle */
  async dispatchPendingGoals(): Promise<any[]> {
    // This will be called after nar.run() which internally calls dispatchToolGoals
    // The actual execution happens in NARExecution.run()
    return [];
  }

  /** Execute a single goal through the tool layer */
  async executeGoal(action: RLAction): Promise<any> {
    const goalTerm = this.buildGoalTerm(action);
    return this.nar.tools.executeToolGoal(goalTerm);
  }
}

/**
 * Stores state-action value beliefs in NAR memory using native Product/Inheritance form
 * ((*, state, ^action) --> predicts_reward) %f;c%
 */
export class QBeliefStore {
  private readonly nar: NAR;
  private readonly predictsRewardAtom = atm('predicts_reward');
  private readonly driveManager?: DriveManager;

  constructor(nar: NAR) {
    this.nar = nar;
    this.driveManager = nar.getDriveManager?.();
  }

  /** Get value belief for state-action pair */
  getValue(state: Term, action: Term): { f: number; c: number } | null {
    const product = prod(state, action);
    const valueTerm = inh(product, this.predictsRewardAtom);
    const concept = this.nar.getConcept(valueTerm);
    if (!concept) return null;

    const beliefs = concept.getBeliefs();
    const belief = beliefs[0];
    if (!belief?.truth) return null;

    return { f: belief.truth.f, c: belief.truth.c };
  }

  /** Update value belief using Truth.revision with immediate reward */
  updateValue(state: Term, action: Term, reward: number, confidence: number = 0.5): void {
    const product = prod(state, action);
    const valueTerm = inh(product, this.predictsRewardAtom);

    // Create evidence truth from reward
    const evidenceTruth = Truth.create(reward, confidence);

    // Get current belief
    const current = this.getValue(state, action);
    if (current) {
      // Revise with new evidence
      const currentTruth = Truth.create(current.f, current.c);
      const revised = Truth.revision(currentTruth, evidenceTruth);
      this.nar.believe(valueTerm, revised);
    } else {
      // First observation
      this.nar.believe(valueTerm, evidenceTruth);
    }
  }

  /** Update value belief using TD target (for temporal difference learning) */
  updateValueTD(state: Term, action: Term, tdTarget: number, confidence: number = 0.5): void {
    const product = prod(state, action);
    const valueTerm = inh(product, this.predictsRewardAtom);

    // Create evidence truth from TD target
    const evidenceTruth = Truth.create(tdTarget, confidence);

    // Get current belief
    const current = this.getValue(state, action);
    if (current) {
      // Revise with TD target
      const currentTruth = Truth.create(current.f, current.c);
      const revised = Truth.revision(currentTruth, evidenceTruth);
      this.nar.believe(valueTerm, revised);
    } else {
      // First observation
      this.nar.believe(valueTerm, evidenceTruth);
    }
  }

  /** Get max Q-value for a state across available actions */
  getMaxValue(state: Term, availableActions: Term[]): number {
    let maxValue = 0;
    for (const action of availableActions) {
      const value = this.getValue(state, action);
      if (value) {
        const expectation = value.f * value.c; // Truth.expectation approximation
        if (expectation > maxValue) {
          maxValue = expectation;
        }
      }
    }
    return maxValue;
  }

  /** Get all action values for a state */
  getAllActions(state: Term): Map<string, { f: number; c: number }> {
    const results = new Map<string, { f: number; c: number }>();
    const concept = this.nar.getConcept(state);
    if (!concept) return results;

    // This is a simplified version - in practice would need to query all concepts
    // matching the pattern ((*, state, ^action) --> predicts_reward)
    // For now, we'd need to iterate all concepts or maintain an index
    return results;
  }

  /** Get best action for a state based on expected value (f * c) */
  getBestAction(state: Term, availableActions: Term[]): Term | null {
    let bestAction: Term | null = null;
    let bestExpectation = -Infinity;

    for (const action of availableActions) {
      const value = this.getValue(state, action);
      if (value) {
        const expectation = value.f * value.c; // Truth.expectation approximation
        if (expectation > bestExpectation) {
          bestExpectation = expectation;
          bestAction = action;
        }
      }
    }

    return bestAction;
  }

  /** Get low-confidence actions for curiosity-driven exploration */
  getLowConfidenceActions(
    state: Term,
    availableActions: Term[],
    confidenceThreshold: number = 0.5
  ): Term[] {
    const lowConfidence: Term[] = [];
    for (const action of availableActions) {
      const value = this.getValue(state, action);
      if (!value || value.c < confidenceThreshold) {
        lowConfidence.push(action);
      }
    }
    return lowConfidence;
  }

  /** Check if curiosity drive should trigger exploration */
  shouldExplore(curiosityThreshold: number = 0.3): boolean {
    if (!this.driveManager) return false;
    const curiosityState = this.driveManager.getState('curiosity');
    return curiosityState ? curiosityState.currentIntensity > curiosityThreshold : false;
  }

  /** Get curiosity drive intensity */
  getCuriosityIntensity(): number {
    if (!this.driveManager) return 0;
    const curiosityState = this.driveManager.getState('curiosity');
    return curiosityState ? curiosityState.currentIntensity : 0;
  }

  /** Stimulate curiosity drive (call when encountering novel/uncertain situations) */
  stimulateCuriosity(amount: number = 0.1): void {
    this.driveManager?.stimulate('curiosity', amount);
  }
}

/**
 * Handles reward representation and value updates with TD learning support
 */
export interface RewardBeliefAdapterConfig {
  gamma?: number; // Discount factor
  tdConfidence?: number; // Confidence for TD target
}

export class RewardBeliefAdapter {
  private readonly nar: NAR;
  private readonly qStore: QBeliefStore;
  private readonly config: { gamma: number; tdConfidence: number };
  private rewardHistory: { state: Term; action: Term; reward: number; timestamp: number }[] = [];

  constructor(nar: NAR, config: RewardBeliefAdapterConfig = {}) {
    this.nar = nar;
    this.qStore = new QBeliefStore(nar);
    this.config = {
      gamma: config.gamma ?? 0.99,
      tdConfidence: config.tdConfidence ?? 0.5,
    };
  }

  /** Process reward and update value beliefs (immediate reward only) */
  processReward(state: Term, action: Term, reward: number, confidence: number = 0.5): void {
    // Record in history
    this.rewardHistory.push({
      state,
      action,
      reward,
      timestamp: Date.now(),
    });

    // Update value belief with immediate reward
    this.qStore.updateValue(state, action, reward, confidence);

    // Also store reward belief directly
    const rewardLevel = reward > 0 ? 'high' : reward < 0 ? 'low' : 'neutral';
    const rewardTerm = inh(atm(`reward:${rewardLevel}`), atm('achieved'));
    this.nar.believe(rewardTerm, Truth.create(Math.abs(reward), confidence));
  }

  /** Process reward with TD learning (Q-learning style: uses max next-state value) */
  processRewardTD(
    state: Term,
    action: Term,
    reward: number,
    nextState: Term,
    nextAvailableActions: Term[],
    done: boolean,
    confidence: number = 0.5
  ): void {
    // Record in history
    this.rewardHistory.push({
      state,
      action,
      reward,
      timestamp: Date.now(),
    });

    let tdTarget: number;

    if (done) {
      // Terminal state: TD target is just the reward
      tdTarget = reward;
    } else {
      // Non-terminal: TD target = reward + gamma * max_a' Q(nextState, a')
      const nextMaxValue = this.qStore.getMaxValue(nextState, nextAvailableActions);
      tdTarget = reward + this.config.gamma * nextMaxValue;
    }

    // Clamp TD target to [0, 1] for Truth frequency
    tdTarget = Math.max(0, Math.min(1, tdTarget));

    // Update value belief using TD target as evidence
    this.qStore.updateValueTD(state, action, tdTarget, this.config.tdConfidence);

    // Also store reward belief directly
    const rewardLevel = reward > 0 ? 'high' : reward < 0 ? 'low' : 'neutral';
    const rewardTerm = inh(atm(`reward:${rewardLevel}`), atm('achieved'));
    this.nar.believe(rewardTerm, Truth.create(Math.abs(reward), confidence));
  }

  /** Process reward with SARSA (on-policy: uses next action's value) */
  processRewardSARSA(
    state: Term,
    action: Term,
    reward: number,
    nextState: Term,
    nextAction: Term,
    done: boolean,
    confidence: number = 0.5
  ): void {
    this.rewardHistory.push({
      state,
      action,
      reward,
      timestamp: Date.now(),
    });

    let tdTarget: number;

    if (done) {
      tdTarget = reward;
    } else {
      // SARSA: TD target = reward + gamma * Q(nextState, nextAction)
      const nextValue = this.qStore.getValue(nextState, nextAction);
      const nextQ = nextValue ? nextValue.f : 0;
      tdTarget = reward + this.config.gamma * nextQ;
    }

    tdTarget = Math.max(0, Math.min(1, tdTarget));
    this.qStore.updateValueTD(state, action, tdTarget, this.config.tdConfidence);

    const rewardLevel = reward > 0 ? 'high' : reward < 0 ? 'low' : 'neutral';
    const rewardTerm = inh(atm(`reward:${rewardLevel}`), atm('achieved'));
    this.nar.believe(rewardTerm, Truth.create(Math.abs(reward), confidence));
  }

  /** Create terminal satisfaction signal (goal term for nar.goal()) */
  createSatisfactionSignal(reward: number): Term {
    const rewardLevel = reward > 0 ? 'high' : reward < 0 ? 'low' : 'neutral';
    return atm(`reward:${rewardLevel}`);
  }

  getQStore(): QBeliefStore {
    return this.qStore;
  }

  getRewardHistory(): typeof this.rewardHistory {
    return [...this.rewardHistory];
  }
}

/**
 * Main harness for running RL parity experiments
 */
export interface RLParityHarnessConfig {
  seed: number;
  maxEpisodes: number;
  maxStepsPerEpisode: number;
  narConfig?: any;
}

export interface ParityMetrics {
  baselineRewards: number[];
  senarsRewards: number[];
  avgBaselineReward: number;
  avgSenarsReward: number;
  policyAgreement: number;
  valueCorrelation: number;
}

export class RLParityHarness {
  private readonly config: RLParityHarnessConfig;
  private readonly rng: SeededRNG;

  constructor(config: RLParityHarnessConfig) {
    this.config = config;
    this.rng = new SeededRNG(config.seed);
  }

  /** Run baseline algorithm on environment */
  async runBaseline<Env, Agent>(
    env: Env,
    agent: Agent,
    runEpisode: (env: Env, agent: Agent) => number
  ): Promise<number[]> {
    const rewards: number[] = [];
    for (let ep = 0; ep < this.config.maxEpisodes; ep++) {
      const reward = runEpisode(env, agent);
      rewards.push(reward);
    }
    return rewards;
  }

  /** Compute policy agreement between two agents */
  computePolicyAgreement(baselineQ: Map<string, number[]>, senarsQ: Map<string, number[]>): number {
    let agreements = 0;
    let total = 0;

    for (const [stateKey, baselineQVals] of baselineQ) {
      const senarsQVals = senarsQ.get(stateKey);
      if (!senarsQVals) continue;

      const baselineAction = baselineQVals.indexOf(Math.max(...baselineQVals));
      const senarsAction = senarsQVals.indexOf(Math.max(...senarsQVals));

      if (baselineAction === senarsAction) agreements++;
      total++;
    }

    return total > 0 ? agreements / total : 0;
  }

  /** Compute value correlation between two Q-tables */
  computeValueCorrelation(
    baselineQ: Map<string, number[]>,
    senarsQ: Map<string, number[]>
  ): number {
    const baselineVals: number[] = [];
    const senarsVals: number[] = [];

    for (const [stateKey, baselineQVals] of baselineQ) {
      const senarsQVals = senarsQ.get(stateKey);
      if (!senarsQVals) continue;

      for (let i = 0; i < baselineQVals.length; i++) {
        const bv = baselineQVals[i];
        const sv = senarsQVals[i];
        if (bv === undefined || sv === undefined) continue;
        baselineVals.push(bv);
        senarsVals.push(sv);
      }
    }

    if (baselineVals.length < 2) return 0;

    // Pearson correlation
    const n = baselineVals.length;
    const sumX = baselineVals.reduce((a, b) => a + b, 0);
    const sumY = senarsVals.reduce((a, b) => a + b, 0);
    const sumXY = baselineVals.reduce((a, b, i) => a + b * (senarsVals[i] ?? 0), 0);
    const sumX2 = baselineVals.reduce((a, b) => a + b * b, 0);
    const sumY2 = senarsVals.reduce((a, b) => a + b * b, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  getRNG(): SeededRNG {
    return this.rng;
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
    // Check for NAR-derived tool goals first
    const pendingGoals = nar.taskManager.getPending();
    const toolGoals = pendingGoals.filter(
      (g) => g.type === 'goal' && g.term.toString().includes('^pull_arm')
    );

    if (toolGoals.length > 0) {
      toolGoals.sort((a, b) => b.budget.priority - a.budget.priority);
      const match = toolGoals[0]!.term.toString().match(/pull_arm_(\d+)/);
      if (match) return parseInt(match[1]!, 10);
    }

    // Use value-based selection with curiosity-driven exploration
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

  onReward(stateId: string, action: number, reward: number): void {
    // QBeliefStore handles value updates via RewardBeliefAdapter
  }

  onEpisodeStart(): void {}

  onEpisodeEnd(): void {}
}

/**
 * GridWorld action selector - state-dependent policy with 4 actions per state
 */
export class GridWorldSelector implements NativeActionSelector {
  private readonly actions: Term[];
  private readonly actionNames = ['move_up', 'move_right', 'move_down', 'move_left'];
  private readonly explorationRate: number;
  private readonly wallPenalty: number;
  private lastStateId: string | null = null;
  private lastAction: number | null = null;

  constructor(explorationRate: number = 0.3, wallPenalty: number = -0.1) {
    this.explorationRate = explorationRate;
    this.wallPenalty = wallPenalty;
    this.actions = this.actionNames.map((name) => TermBuilder.atom(`^${name}`));
  }

  selectAction(
    stateId: string,
    nar: NAR,
    qStore: QBeliefStore,
    actionAdapter: GoalActionAdapter
  ): number {
    // Check for NAR-derived tool goals first
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

    // Get best action based on learned values
    const bestAction = qStore.getBestAction(stateTerm, this.actions);
    const lowConfidence = qStore.getLowConfidenceActions(stateTerm, this.actions, 0.4);

    let selectedAction = 0;

    if (bestAction && Math.random() > this.explorationRate) {
      // Exploit: use highest expected value action
      const match = bestAction.toString().match(/move_(up|right|down|left)/);
      if (match) {
        selectedAction = this.actionNames.indexOf(`move_${match[1]}`);
      }
    } else if (lowConfidence.length > 0 && Math.random() < 0.4) {
      // Curiosity-driven exploration of low-confidence actions
      const exploreAction = lowConfidence[Math.floor(Math.random() * lowConfidence.length)];
      if (!exploreAction) return Math.floor(Math.random() * 4);
      const match = exploreAction.toString().match(/move_(up|right|down|left)/);
      if (match) {
        selectedAction = this.actionNames.indexOf(`move_${match[1]}`);
      }
      qStore.stimulateCuriosity(0.03);
    } else {
      // Random exploration
      selectedAction = Math.floor(Math.random() * 4);
    }

    this.lastStateId = stateId;
    this.lastAction = selectedAction;
    return selectedAction;
  }

  onReward(stateId: string, action: number, reward: number): void {
    // Apply wall penalty if the agent tried to move into a wall (reward = wallPenalty)
    // The RewardBeliefAdapter will handle the actual value update
    if (reward === this.wallPenalty && this.lastStateId && this.lastAction !== null) {
      // Could add additional logic here for wall learning
    }
  }

  onEpisodeStart(): void {
    this.lastStateId = null;
    this.lastAction = null;
  }

  onEpisodeEnd(): void {}
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
    // Check for NAR-derived tool goals first
    const pendingGoals = nar.taskManager.getPending();
    const toolGoals = pendingGoals.filter(
      (g) => g.type === 'goal' && g.term.toString().includes('^pull_arm')
    );

    if (toolGoals.length > 0) {
      toolGoals.sort((a, b) => b.budget.priority - a.budget.priority);
      const match = toolGoals[0]!.term.toString().match(/pull_arm_(\d+)/);
      if (match) return parseInt(match[1]!, 10);
    }

    // Check for change detection: high prediction error on best arm suggests drift
    const bestAction = qStore.getBestAction(this.stateTerm, this.actions);
    const lowConfidence = qStore.getLowConfidenceActions(this.stateTerm, this.actions, 0.4);

    // If we have a best action but its confidence is dropping, increase exploration
    let effectiveExplorationRate = this.explorationRate;
    if (bestAction) {
      const bestIdx = this.actions.indexOf(bestAction);
      const bestErrors = bestIdx >= 0 ? this.predictionErrors[bestIdx] : undefined;
      if (bestErrors && bestErrors.length > 5) {
        const recentErrors = bestErrors.slice(-5);
        const avgError = recentErrors.reduce((a, b) => a + b, 0) / recentErrors.length;
        if (avgError > this.changeDetectionThreshold) {
          effectiveExplorationRate = Math.min(0.5, this.explorationRate * 2); // Increase exploration
          qStore.stimulateCuriosity(0.1); // Boost curiosity drive
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

    // Track prediction error for change detection
    // We'd need access to the predicted value - for now track reward variance
    if ((this.armPullCounts[action] ?? 0) > 1) {
      const errors = this.predictionErrors[action] ?? [];
      // Simple heuristic: if reward differs significantly from recent average
      const recentRewards = errors.slice(-10);
      if (recentRewards.length > 0) {
        const avgRecent = recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length;
        const error = Math.abs(reward - avgRecent);
        errors.push(error);
        // Keep only recent errors
        if (errors.length > 20) {
          errors.shift();
        }
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
  useTDLearning?: boolean; // Enable temporal difference learning
  gamma?: number; // Discount factor for TD learning
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
    this.perception.perceive({ stateId, reward: 0 });

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
      // TD learning: update previous state-action with TD target
      // TD target = reward + gamma * max_a' Q(nextState, a')
      const nextAvailableActions = this.getAvailableActions(env);
      this.rewardAdapter.processRewardTD(
        this.lastState,
        this.lastAction,
        this.lastReward,
        stateTerm,
        nextAvailableActions,
        result.done
      );
    } else {
      // Fallback: immediate reward only (for first step or if TD disabled)
      this.rewardAdapter.processReward(stateTerm, actionTerm, result.reward);
    }

    // Store current for next TD update
    this.lastState = stateTerm;
    this.lastAction = actionTerm;
    this.lastStateId = stateId;
    this.lastActionIdx = action;
    this.lastReward = result.reward;

    // Notify selector of reward for change detection/adaptation
    this.selector.onReward(stateId, action, result.reward);

    return { action, reward: result.reward, done: result.done };
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

      // Get next state ID
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
    if (env.getState) {
      const state = env.getState();
      if (typeof state === 'object' && state !== null && 'row' in state && 'col' in state) {
        return `s_${state.row}_${state.col}`;
      }
    }
    return 'bandit_state';
  }

  /** Get current state ID from environment */
  protected getStateId(env: any): string {
    if (env.getState) {
      const state = env.getState();
      if (typeof state === 'object' && state !== null && 'row' in state && 'col' in state) {
        return `s_${state.row}_${state.col}`;
      }
    }
    return 'bandit_state';
  }

  /** Map action index to action name */
  protected getActionName(action: number): string {
    // Override in subclasses or use selector-specific logic
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

    // Register arm-pulling tools
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

  constructor(nar: NAR, maxDerivationsPerStep: number = 3) {
    const selector = new GridWorldSelector();
    super(nar, { selector, maxDerivationsPerStep, useTDLearning: true, gamma: 0.99 });

    // Register movement tools
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

    // 1. Perceive: convert environment observation to NAR beliefs
    this.perception.perceive({ stateId, reward: 0 });

    // 2. Reason: run NAR inference cycles
    await this.nar.run(this.maxDerivationsPerStep);

    // 3. Act: select and execute action through NAR goal dispatch
    const action = this.selector.selectAction(stateId, this.nar, this.qStore, this.actionAdapter);
    const actionName = this.getActionName(action);
    const goalTerm = this.actionAdapter.buildGoalTerm({ name: actionName });
    await this.nar.tools.executeToolGoal(goalTerm);

    // 4. Environment step
    const result = env.step(action);

    // 5. Learn: update value beliefs with NORMALIZED reward
    // GridWorld reward range: [-0.01, 1] -> normalize to [0, 1]
    const normalizedReward = (result.reward + 0.01) / 1.01;
    const actionTerm = TermBuilder.atom(`^${actionName}`);

    if (this.useTDLearning && this.lastState !== null && this.lastAction !== null) {
      // TD learning: update previous state-action with TD target
      // TD target = reward + gamma * max_a' Q(nextState, a')
      const nextAvailableActions = this.getAvailableActions(env);
      this.rewardAdapter.processRewardTD(
        this.lastState,
        this.lastAction,
        this.lastReward, // Use normalized reward
        stateTerm,
        nextAvailableActions,
        result.done
      );
    } else {
      // Fallback: immediate reward only (for first step or if TD disabled)
      this.rewardAdapter.processReward(stateTerm, actionTerm, normalizedReward);
    }

    // Store current for next TD update (use normalized reward for TD target)
    this.lastState = stateTerm;
    this.lastAction = actionTerm;
    this.lastStateId = stateId;
    this.lastActionIdx = action;
    this.lastReward = normalizedReward;

    // Notify selector of reward for change detection/adaptation (use original reward)
    this.selector.onReward(stateId, action, result.reward);

    return { action, reward: result.reward, done: result.done };
  }

  /** Get available actions for TD learning */
  override getAvailableActions(env: any): Term[] {
    return this.actionTerms;
  }

  protected override getActionName(action: number): string {
    return this.actionNames[action] || `action_${action}`;
  }

  protected override getInitialStateId(env: any): string {
    const state = env.getState();
    return `s_${state.row}_${state.col}`;
  }

  protected override getStateId(env: any): string {
    const state = env.getState();
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
