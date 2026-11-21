/**
 * Loop Selection — action selection for the cognitive loop.
 *
 * Implements multiple selection strategies: utility-based, VoI-based, epsilon-greedy, etc.
 */

import type { Term } from '../kernel/terms/term.js';
import type { Truth } from '../kernel/truth.js';
import type { Task, TimestampMs } from '../kernel/types.js';
import type { FacultyOutput } from '../faculties/specs.js';
import type { RNG, Clock } from '../kernel/env.js';

/** Selection strategies. */
export const SELECTION_STRATEGIES = [
  'utility',
  'voi',
  'epsilon_greedy',
  'thompson',
  'ucb',
  'softmax',
  'priority',
] as const;

export type SelectionStrategy = (typeof SELECTION_STRATEGIES)[number];

/** Selection context. */
export interface SelectionContext {
  /** Available actions/candidates. */
  candidates: SelectionCandidate[];
  /** Current beliefs. */
  beliefs: Task[];
  /** Current goals. */
  goals: Task[];
  /** Available budget. */
  budget: number;
  /** Urgency (0-1). */
  urgency: number;
  /** Risk tolerance (0-1). */
  riskTolerance: number;
  /** Iteration number. */
  iteration: number;
  /** Previous selections. */
  history: SelectionRecord[];
  /** Metadata. */
  metadata?: Record<string, unknown>;
}

/** Selection candidate. */
export interface SelectionCandidate {
  /** Unique ID. */
  id: string;
  /** The proposed action/task. */
  action: Task;
  /** Expected utility. */
  utility: number;
  /** Value of Information. */
  voi: number;
  /** Confidence in estimates. */
  confidence: number;
  /** Source faculty. */
  sourceFaculty: string;
  /** Evidence. */
  evidence: SelectionEvidence[];
  /** Cost estimate. */
  cost: number;
  /** Risk estimate. */
  risk: number;
  /** Priority. */
  priority: number;
}

/** Selection evidence. */
export interface SelectionEvidence {
  /** Source. */
  source: 'faculty' | 'oracle' | 'memory' | 'rule';
  /** Description. */
  description: string;
  /** Strength. */
  strength: number;
}

/** Selection record for history. */
export interface SelectionRecord {
  /** Iteration. */
  iteration: number;
  /** Selected candidate ID. */
  candidateId: string;
  /** Strategy used. */
  strategy: SelectionStrategy;
  /** Actual outcome. */
  outcome?: SelectionOutcome;
}

/** Selection outcome. */
export interface SelectionOutcome {
  /** Success. */
  success: boolean;
  /** Actual utility achieved. */
  actualUtility: number;
  /** Actual cost. */
  actualCost: number;
  /** Reward. */
  reward: number;
}

/** Selection result. */
export interface SelectionResult {
  /** Selected candidate. */
  selected: SelectionCandidate | null;
  /** All candidates with scores. */
  scored: ScoredCandidate[];
  /** Strategy used. */
  strategy: SelectionStrategy;
  /** Selection metadata. */
  metadata: SelectionMetadata;
}

/** Scored candidate. */
export interface ScoredCandidate {
  candidate: SelectionCandidate;
  score: number;
  rank: number;
}

/** Selection metadata. */
export interface SelectionMetadata {
  /** Number of candidates considered. */
  candidatesConsidered: number;
  /** Time taken (ms). */
  durationMs: number;
  /** Whether exploration was used. */
  explored: boolean;
  /** Temperature/epsilon used. */
  explorationParam: number;
}

/** Selector configuration. */
export interface SelectorConfig {
  /** Default strategy. */
  defaultStrategy: SelectionStrategy;
  /** Strategy weights for ensemble. */
  strategyWeights?: Record<SelectionStrategy, number>;
  /** Epsilon for epsilon-greedy. */
  epsilon?: number;
  /** Temperature for softmax. */
  temperature?: number;
  /** Exploration decay. */
  explorationDecay?: number;
  /** Minimum exploration. */
  minExploration?: number;
}

/** Default selector configuration. */
export const defaultSelectorConfig: SelectorConfig = {
  defaultStrategy: 'utility',
  strategyWeights: {
    utility: 0.3,
    voi: 0.2,
    epsilon_greedy: 0.15,
    thompson: 0.1,
    ucb: 0.1,
    softmax: 0.1,
    priority: 0.05,
  },
  epsilon: 0.1,
  temperature: 1.0,
  explorationDecay: 0.999,
  minExploration: 0.01,
};

/** Action selector. */
export class ActionSelector {
  private config: SelectorConfig;
  private currentEpsilon: number;
  private currentTemperature: number;
  private selectionCounts = new Map<string, number>();
  private rewardSums = new Map<string, number>();
  private rewardCounts = new Map<string, number>();
  private readonly rng: RNG;
  private readonly clock: Clock;

  constructor(
    config: Partial<SelectorConfig> = {},
    options: { rng?: RNG; clock?: Clock } = {}
  ) {
    this.config = { ...defaultSelectorConfig, ...config };
    this.currentEpsilon = config.epsilon ?? 0.1;
    this.currentTemperature = config.temperature ?? 1.0;
    this.rng = options.rng ?? { next: () => Math.random(), nextInt: (max: number) => Math.floor(Math.random() * max), nextBytes: (length: number) => crypto.getRandomValues(new Uint8Array(length)), setSeed: () => {}, getSeed: () => 0 };
    this.clock = options.clock ?? { now: () => Date.now() as TimestampMs, setTime: () => {}, advance: () => {} };
  }

  /** Select an action. */
  async select(context: SelectionContext): Promise<SelectionResult> {
    const startTs = this.clock.now();

    // Filter candidates by budget
    const affordable = context.candidates.filter(c => c.cost <= context.budget);
    const candidates = affordable.length > 0 ? affordable : context.candidates;

    if (candidates.length === 0) {
      return this.emptyResult(context, startTs);
    }

    // Score candidates using selected strategy
    const strategy = this.chooseStrategy(context);
    const scored = await this.scoreCandidates(candidates, context, strategy);

    // Select based on scores
    const selected = this.selectFromScored(scored, strategy, context);

    // Update exploration parameters
    this.updateExploration();

    return {
      selected,
      scored,
      strategy,
      metadata: {
        candidatesConsidered: candidates.length,
        durationMs: this.clock.now() - startTs,
        explored: strategy !== 'utility' && strategy !== 'priority',
        explorationParam: strategy === 'epsilon_greedy' ? this.currentEpsilon :
                         strategy === 'softmax' ? this.currentTemperature : 0,
      },
    };
  }

  /** Choose strategy based on context. */
  private chooseStrategy(context: SelectionContext): SelectionStrategy {
    // Use default strategy for now
    // Could implement meta-selection based on context
    return this.config.defaultStrategy;
  }

  /** Score candidates using a strategy. */
  private async scoreCandidates(
    candidates: SelectionCandidate[],
    context: SelectionContext,
    strategy: SelectionStrategy
  ): Promise<ScoredCandidate[]> {
    const scored: ScoredCandidate[] = [];

    for (const candidate of candidates) {
      let score = 0;

      switch (strategy) {
        case 'utility':
          score = candidate.utility;
          break;
        case 'voi':
          score = candidate.voi;
          break;
        case 'epsilon_greedy':
          score = candidate.utility;
          break;
        case 'thompson':
          score = this.thompsonScore(candidate);
          break;
        case 'ucb':
          score = this.ucbScore(candidate, context.iteration);
          break;
        case 'softmax':
          score = candidate.utility; // Will be transformed later
          break;
        case 'priority':
          score = candidate.priority;
          break;
      }

      scored.push({ candidate, score, rank: 0 });
    }

    // Apply strategy-specific transformations
    if (strategy === 'softmax') {
      return this.applySoftmax(scored);
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    for (let i = 0; i < scored.length; i++) {
      scored[i]!.rank = i + 1;
    }

    return scored;
  }

  /** Apply softmax transformation. */
  private applySoftmax(scored: ScoredCandidate[]): ScoredCandidate[] {
    const utilities = scored.map(s => s.score);
    const maxU = Math.max(...utilities);
    const expSum = utilities.reduce((sum, u) => sum + Math.exp((u - maxU) / this.currentTemperature), 0);

    for (const s of scored) {
      s.score = Math.exp((s.score - maxU) / this.currentTemperature) / expSum;
    }

    scored.sort((a, b) => b.score - a.score);
    for (let i = 0; i < scored.length; i++) {
      scored[i]!.rank = i + 1;
    }
    return scored;
  }

  /** Thompson sampling score. */
  private thompsonScore(candidate: SelectionCandidate): number {
    const id = candidate.id;
    const successes = this.rewardSums.get(id) ?? 0;
    const trials = this.rewardCounts.get(id) ?? 0;

    if (trials === 0) {
      return this.rng.next(); // Explore
    }

    // Beta distribution sample
    const alpha = successes + 1;
    const beta = trials - successes + 1;
    return this.sampleBeta(alpha, beta);
  }

  /** UCB score. */
  private ucbScore(candidate: SelectionCandidate, iteration: number): number {
    const id = candidate.id;
    const count = this.selectionCounts.get(id) ?? 0;

    if (count === 0) {
      return Infinity; // Force exploration
    }

    const avgReward = (this.rewardSums.get(id) ?? 0) / count;
    const exploration = Math.sqrt(2 * Math.log(iteration) / count);
    return avgReward + exploration;
  }

  /** Sample from Beta distribution (approximation). */
  private sampleBeta(alpha: number, beta: number): number {
    // Simple approximation using gamma
    const gammaAlpha = this.sampleGamma(alpha, 1);
    const gammaBeta = this.sampleGamma(beta, 1);
    return gammaAlpha / (gammaAlpha + gammaBeta);
  }

  /** Sample from Gamma distribution (Marsaglia's method). */
  private sampleGamma(shape: number, scale: number): number {
    if (shape >= 1) {
      const d = shape - 1/3;
      const c = 1 / Math.sqrt(9 * d);
      while (true) {
        let x: number, v: number;
        do {
          x = this.normalRandom();
          v = 1 + c * x;
        } while (v <= 0);
        v = v * v * v;
        const u = this.rng.next();
        if (u < 1 - 0.0331 * x * x * x * x) return d * v * scale;
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
      }
    } else {
      return this.sampleGamma(shape + 1, scale) * Math.pow(this.rng.next(), 1 / shape);
    }
  }

  /** Generate normal random (Box-Muller). */
  private normalRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = this.rng.next();
    while (v === 0) v = this.rng.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Select from scored candidates. */
  private selectFromScored(
    scored: ScoredCandidate[],
    strategy: SelectionStrategy,
    context: SelectionContext
  ): SelectionCandidate | null {
    if (scored.length === 0) return null;

    switch (strategy) {
      case 'epsilon_greedy':
        return this.epsilonGreedySelect(scored, context);
      case 'softmax':
        return this.softmaxSelect(scored);
      case 'thompson':
      case 'ucb':
        return scored[0]!.candidate; // Already sorted by score
      default:
        return scored[0]!.candidate; // Greedy
    }
  }

  /** Epsilon-greedy selection. */
  private epsilonGreedySelect(scored: ScoredCandidate[], _context: SelectionContext): SelectionCandidate {
    if (this.rng.next() < this.currentEpsilon) {
      // Explore: pick randomly (weighted by score)
      const total = scored.reduce((sum, s) => sum + s.score, 0);
      let r = this.rng.next() * total;
      for (const s of scored) {
        r -= s.score;
        if (r <= 0) return s.candidate;
      }
    }
    return scored[0]!.candidate; // Exploit
  }

  /** Softmax selection. */
  private softmaxSelect(scored: ScoredCandidate[]): SelectionCandidate {
    // Already softmax-transformed, sample from distribution
    let r = this.rng.next();
    for (const s of scored) {
      r -= s.score;
      if (r <= 0) return s.candidate;
    }
    return scored[0]!.candidate;
  }

  /** Update exploration parameters. */
  private updateExploration(): void {
    this.currentEpsilon = Math.max(
      this.config.minExploration ?? 0.01,
      this.currentEpsilon * (this.config.explorationDecay ?? 0.999)
    );
    this.currentTemperature = Math.max(
      0.1,
      this.currentTemperature * (this.config.explorationDecay ?? 0.999)
    );
  }

  /** Record selection outcome for learning. */
  recordOutcome(candidateId: string, reward: number): void {
    const count = (this.selectionCounts.get(candidateId) ?? 0) + 1;
    this.selectionCounts.set(candidateId, count);

    const sum = (this.rewardSums.get(candidateId) ?? 0) + reward;
    this.rewardSums.set(candidateId, sum);

    const rcount = (this.rewardCounts.get(candidateId) ?? 0) + 1;
    this.rewardCounts.set(candidateId, rcount);
  }

  /** Get selection statistics. */
  getStats(): {
    totalSelections: number;
    candidateStats: Record<string, { count: number; avgReward: number }>;
    currentEpsilon: number;
    currentTemperature: number;
  } {
    const candidateStats: Record<string, { count: number; avgReward: number }> = {};
    for (const [id, count] of this.selectionCounts) {
      candidateStats[id] = {
        count,
        avgReward: count > 0 ? (this.rewardSums.get(id) ?? 0) / count : 0,
      };
    }

    return {
      totalSelections: Array.from(this.selectionCounts.values()).reduce((a, b) => a + b, 0),
      candidateStats,
      currentEpsilon: this.currentEpsilon,
      currentTemperature: this.currentTemperature,
    };
  }

  /** Empty result. */
  private emptyResult(context: SelectionContext, startTs: number): SelectionResult {
    return {
      selected: null,
      scored: [],
      strategy: this.config.defaultStrategy,
      metadata: {
        candidatesConsidered: context.candidates.length,
        durationMs: this.clock.now() - startTs,
        explored: false,
        explorationParam: 0,
      },
    };
  }
}

/** Create an action selector. */
export function createActionSelector(
  config?: Partial<SelectorConfig>,
  options?: { rng?: RNG; clock?: Clock }
): ActionSelector {
  return new ActionSelector(config, options);
}

/** Global action selector instance (non-deterministic; prefer {@link createActionSelector}). */
export const actionSelector = createActionSelector();

/** VoI (Value of Information) calculator. */
export class VoICalculator {
  /** Calculate VoI for a candidate. */
  static calculate(
    candidate: SelectionCandidate,
    beliefs: Task[],
    goals: Task[]
  ): number {
    let voi = 0;

    // VoI from reducing uncertainty about goals
    for (const goal of goals) {
      const alignment = this.computeAlignment(candidate.action, goal);
      const uncertainty = 1 - candidate.confidence;
      voi += alignment * uncertainty * goal.truth.c; // Weight by goal confidence
    }

    // VoI from belief update potential
    for (const belief of beliefs) {
      const relevance = this.computeRelevance(candidate.action, belief);
      const surprise = this.computeSurprise(candidate, belief);
      voi += relevance * surprise;
    }

    // Normalize
    const maxVoi = goals.length + beliefs.length;
    return maxVoi > 0 ? voi / maxVoi : 0;
  }

  /** Compute alignment between action and goal. */
  private static computeAlignment(action: Task, goal: Task): number {
    const actionStr = action.term.toString();
    const goalStr = goal.term.toString();
    if (actionStr.includes(goalStr) || goalStr.includes(actionStr)) return 1.0;
    // Simple string similarity
    const common = this.commonSubstring(actionStr, goalStr);
    return common / Math.max(actionStr.length, goalStr.length);
  }

  /** Compute relevance of action to belief. */
  private static computeRelevance(action: Task, belief: Task): number {
    const actionStr = action.term.toString();
    const beliefStr = belief.term.toString();
    if (actionStr.includes(beliefStr) || beliefStr.includes(actionStr)) return 1.0;
    const common = this.commonSubstring(actionStr, beliefStr);
    return common / Math.max(actionStr.length, beliefStr.length);
  }

  /** Compute surprise potential. */
  private static computeSurprise(candidate: SelectionCandidate, belief: Task): number {
    // High surprise if action contradicts belief
    const actionStr = candidate.action.term.toString();
    const beliefStr = belief.term.toString();
    if (actionStr.startsWith('~') && actionStr.substring(1) === beliefStr) return 1.0;
    if (beliefStr.startsWith('~') && beliefStr.substring(1) === actionStr) return 1.0;
    return 0.5; // Default moderate surprise
  }

  /** Common substring helper. */
  private static commonSubstring(a: string, b: string): number {
    let maxLen = 0;
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        let len = 0;
        while (i + len < a.length && j + len < b.length && a[i + len] === b[j + len]) {
          len++;
        }
        maxLen = Math.max(maxLen, len);
      }
    }
    return maxLen;
  }
}