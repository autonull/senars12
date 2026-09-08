import { SeededRNG } from '../environments/RLEnvironments';
import { TermBuilder, Truth, type Term, type TruthType } from '../../../../nar/src';
import { NAR } from '../../../../nar/src/nar';

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

export class BeliefPerceptionAdapter {
  private readonly nar: NAR;
  private readonly config: BeliefPerceptionAdapterConfig;
  private readonly rng: SeededRNG;

  constructor(nar: NAR, config: BeliefPerceptionAdapterConfig = {}, seed = 1) {
    this.nar = nar;
    this.config = {
      sensorConfidence: config.sensorConfidence ?? 0.95,
      featureConfidence: config.featureConfidence ?? 0.90,
    };
    this.rng = new SeededRNG(seed);
  }

  /** Convert an RL observation to belief tasks and input them to NAR */
  perceive(observation: RLObservation): void {
    // State observation: (self --> state:s_X_Y)
    const stateTerm = TermBuilder.atom(observation.stateId);
    const selfTerm = TermBuilder.atom('self');
    const stateInheritance = TermBuilder.inheritance(selfTerm, stateTerm);
    this.nar.believe(stateInheritance, Truth.create(1.0, this.config.sensorConfidence));

    // Feature observations
    if (observation.features) {
      for (const [feature, value] of Object.entries(observation.features)) {
        const featureTerm = TermBuilder.atom(`feature:${feature}`);
        const valueTerm = TermBuilder.atom(value > 0 ? 'present' : 'absent');
        const featureInheritance = TermBuilder.inheritance(featureTerm, valueTerm);
        this.nar.believe(featureInheritance, Truth.create(1.0, this.config.featureConfidence));
      }
    }

    // Reward observation if present
    if (observation.reward !== undefined) {
      const rewardLevel = observation.reward > 0 ? 'high' : observation.reward < 0 ? 'low' : 'neutral';
      const rewardTerm = TermBuilder.inheritance(
        TermBuilder.atom(`reward:${rewardLevel}`),
        TermBuilder.atom('achieved')
      );
      // Confidence proportional to reward magnitude
      const confidence = Math.min(0.95, 0.5 + Math.abs(observation.reward) * 0.4);
      this.nar.believe(rewardTerm, Truth.create(Math.abs(observation.reward), confidence));
    }

    // Terminal state observation
    if (observation.terminal) {
      const terminalTerm = TermBuilder.inheritance(
        TermBuilder.atom('state:terminal'),
        TermBuilder.atom('reached')
      );
      this.nar.believe(terminalTerm, Truth.create(1.0, this.config.sensorConfidence));
    }
  }

  /** Add noisy observation (for testing sensor reliability) */
  perceiveNoisy(observation: RLObservation, noiseLevel: number): void {
    // Add noise to confidence
    const baseConfidence = this.config.sensorConfidence;
    const noisyConfidence = Math.max(0.1, baseConfidence - noiseLevel * this.rng.next());

    const stateTerm = TermBuilder.atom(observation.stateId);
    const selfTerm = TermBuilder.atom('self');
    const stateInheritance = TermBuilder.inheritance(selfTerm, stateTerm);
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

export class GoalActionAdapter {
  private readonly nar: NAR;
  private readonly config: GoalActionAdapterConfig;

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
      // Build Product of arguments
      const argTerms: Term[] = [];
      for (const [key, value] of Object.entries(action.args)) {
        // Use compact form: key:value -> Inheritance(value, key)
        const keyTerm = TermBuilder.atom(key);
        const valueTerm = TermBuilder.atom(String(value));
        const compactInh = TermBuilder.inheritance(valueTerm, keyTerm);
        argTerms.push(compactInh);
      }
      const product = argTerms.length === 1 ? argTerms[0] : TermBuilder.product(...argTerms);
      return TermBuilder.inheritance(product, opAtom);
    }

    // Simple operation without arguments
    return opAtom;
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
  private readonly predictsRewardAtom = TermBuilder.atom('predicts_reward');

  constructor(nar: NAR) {
    this.nar = nar;
  }

  /** Get value belief for state-action pair */
  getValue(state: Term, action: Term): { f: number; c: number } | null {
    const product = TermBuilder.product(state, action);
    const valueTerm = TermBuilder.inheritance(product, this.predictsRewardAtom);
    const concept = this.nar.getConcept(valueTerm);
    if (!concept) return null;

    const beliefs = concept.getBeliefs();
    if (beliefs.length === 0) return null;

    return { f: beliefs[0].truth.f, c: beliefs[0].truth.c };
  }

  /** Update value belief using Truth.revision */
  updateValue(state: Term, action: Term, reward: number, confidence: number = 0.5): void {
    const product = TermBuilder.product(state, action);
    const valueTerm = TermBuilder.inheritance(product, this.predictsRewardAtom);

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
}

/**
 * Handles reward representation and value updates
 */
export class RewardBeliefAdapter {
  private readonly nar: NAR;
  private readonly qStore: QBeliefStore;
  private rewardHistory: { state: Term; action: Term; reward: number; timestamp: number }[] = [];

  constructor(nar: NAR) {
    this.nar = nar;
    this.qStore = new QBeliefStore(nar);
  }

  /** Process reward and update value beliefs */
  processReward(state: Term, action: Term, reward: number, confidence: number = 0.5): void {
    // Record in history
    this.rewardHistory.push({
      state,
      action,
      reward,
      timestamp: Date.now(),
    });

    // Update value belief
    this.qStore.updateValue(state, action, reward, confidence);

    // Also store reward belief directly
    const rewardLevel = reward > 0 ? 'high' : reward < 0 ? 'low' : 'neutral';
    const rewardTerm = TermBuilder.inheritance(
      TermBuilder.atom(`reward:${rewardLevel}`),
      TermBuilder.atom('achieved')
    );
    this.nar.believe(rewardTerm, Truth.create(Math.abs(reward), confidence));
  }

  /** Create terminal satisfaction signal */
  createSatisfactionSignal(reward: number): Term {
    const rewardLevel = reward > 0 ? 'high' : reward < 0 ? 'low' : 'neutral';
    const goal = TermBuilder.atom(`reward:${rewardLevel}`);
    goal.punctuation = '!';
    return goal;
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
  computePolicyAgreement(
    baselineQ: Map<string, number[]>,
    senarsQ: Map<string, number[]>
  ): number {
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
        baselineVals.push(baselineQVals[i]);
        senarsVals.push(senarsQVals[i]);
      }
    }

    if (baselineVals.length < 2) return 0;

    // Pearson correlation
    const n = baselineVals.length;
    const sumX = baselineVals.reduce((a, b) => a + b, 0);
    const sumY = senarsVals.reduce((a, b) => a + b, 0);
    const sumXY = baselineVals.reduce((a, b, i) => a + b * senarsVals[i], 0);
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