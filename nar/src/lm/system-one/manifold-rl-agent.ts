import type { Game, GameOutcome } from '../../game/Game.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type {
  EmbeddingCache,
  EmbeddingPointer,
  EvaluateProposition,
  JudgmentManifold,
} from './types.js';
import type { JudgmentDataset } from './distill.js';
import { recordReflexOutcome } from './reflex-label-source.js';

export interface ManifoldRLAgentOptions {
  cache: EmbeddingCache;
  manifold: JudgmentManifold;
  budget: ReasoningBudget;
  dataset?: JudgmentDataset;
  policy?: 'eps-greedy' | 'ucb';
  epsilon?: number;
  ucbC?: number;
  /** Mask infeasible actions — engages only when the head is fitted (Z2). */
  feasibilityMask?: boolean;
  /** Deny actions whose risk exceeds this floor — engages only when fitted (Z2). */
  riskFloor?: number;
  labelOutcomes?: boolean;
  /** Exploration RNG — injectable for deterministic tests (defaults to Math.random). */
  rng?: () => number;
}

export interface ManifoldRLDecision<A = number> {
  action: A;
  outcome: GameOutcome;
  values: Map<string, number>;
  feasible: Map<string, boolean>;
  risks: Map<string, number>;
  policySource: 'manifold' | 'exploration' | 'fallback';
}

/**
 * Pure-System-One RL agent (C3): drives a `Game` using ONLY the EmbeddingCache,
 * JudgmentManifold and JudgmentDataset — no NAR, no RuleProcessor, no kernel
 * gates. The Judgment Manifold is proven to be a general decision API.
 */
export class ManifoldRLAgent {
  readonly #cache: EmbeddingCache;
  readonly #manifold: JudgmentManifold;
  readonly #budget: ReasoningBudget;
  readonly #dataset?: JudgmentDataset;
  readonly #policy: 'eps-greedy' | 'ucb';
  readonly #epsilon: number;
  readonly #ucbC: number;
  readonly #feasibilityMask: boolean;
  readonly #riskFloor: number;
  readonly #labelOutcomes: boolean;
  readonly #rng: () => number;
  readonly #visits = new Map<string, Map<string, number>>();
  #totalVisits = 0;

  constructor(options: ManifoldRLAgentOptions) {
    this.#cache = options.cache;
    this.#manifold = options.manifold;
    this.#budget = options.budget;
    this.#dataset = options.dataset;
    this.#policy = options.policy ?? 'eps-greedy';
    this.#epsilon = options.epsilon ?? 0.1;
    this.#ucbC = options.ucbC ?? 0.5;
    this.#feasibilityMask = options.feasibilityMask ?? true;
    this.#riskFloor = options.riskFloor ?? 0.8;
    this.#labelOutcomes = options.labelOutcomes ?? true;
    this.#rng = options.rng ?? Math.random;
  }

  /** One joint judgeBatch: reflex_value (per action) + feasibility (mask) + risk (floor). */
  async decide<S, A extends number | string>(
    game: Game<S, A>
  ): Promise<{
    action: A;
    values: Map<string, number>;
    feasible: Map<string, boolean>;
    risks: Map<string, number>;
    pointer: EmbeddingPointer;
    stateId: string;
  }> {
    const observation = game.observe();
    const stateId = observation.stateId;
    const stateDigest = JSON.stringify(observation.features ?? stateId);
    const pointer = await this.#cache.write(stateDigest);

    const legalActions = game.legalActions(game.state());
    const queries = legalActions.flatMap((action) => [
      {
        kind: 'evaluate' as const,
        instruction: `Evaluate value of action ${String(action)}`,
        rubric: 'reflex_value' as const,
        axis: 'teleological' as const,
      },
      {
        kind: 'evaluate' as const,
        instruction: `Assess feasibility of action ${String(action)}`,
        rubric: 'feasibility' as const,
        axis: 'teleological' as const,
      },
      {
        kind: 'evaluate' as const,
        instruction: `Assess risk of action ${String(action)}`,
        rubric: 'risk' as const,
        axis: 'teleological' as const,
      },
    ]);

    const propositions = await this.#manifold.judgeBatch(pointer, queries, this.#budget);

    const values = new Map<string, number>();
    const feasible = new Map<string, boolean>();
    const risks = new Map<string, number>();
    let valuesFitted = false;
    legalActions.forEach((action: A, i: number) => {
      const key = String(action);
      const value = propositions[i * 3] as EvaluateProposition | undefined;
      const feasibility = propositions[i * 3 + 1] as EvaluateProposition | undefined;
      const risk = propositions[i * 3 + 2] as EvaluateProposition | undefined;
      if (value && !value.abstained && value.kind === 'evaluate') {
        values.set(key, value.score);
        valuesFitted = valuesFitted || value.calibration?.fitted === true;
      }
      // Z2: mask/floor engage only when the head reports calibrated weights
      if (
        this.#feasibilityMask &&
        feasibility &&
        !feasibility.abstained &&
        feasibility.kind === 'evaluate' &&
        feasibility.calibration?.fitted === true
      ) {
        feasible.set(key, feasibility.score >= 0.5);
      }
      if (
        this.#riskFloor > 0 &&
        risk &&
        !risk.abstained &&
        risk.kind === 'evaluate' &&
        risk.calibration?.fitted === true
      ) {
        risks.set(key, risk.score);
      }
    });

    const action = this.#select(legalActions, values, feasible, risks, stateId, valuesFitted);
    return { action, values, feasible, risks, pointer, stateId };
  }

  #select<A extends number | string>(
    legalActions: readonly A[],
    values: Map<string, number>,
    feasible: Map<string, boolean>,
    risks: Map<string, number>,
    stateId: string,
    valuesFitted: boolean
  ): A {
    // Z2: unfitted value heads are not load-bearing — uniform exploration
    if (!valuesFitted) {
      return legalActions[Math.floor(this.#rng() * legalActions.length)]!;
    }
    const eligible = legalActions.filter((a) => {
      const key = String(a);
      if (feasible.get(key) === false) return false;
      const risk = risks.get(key);
      return risk === undefined || risk <= this.#riskFloor;
    });
    const candidates = eligible.length > 0 ? eligible : [...legalActions];

    if (this.#rng() < this.#epsilon) {
      return candidates[Math.floor(this.#rng() * candidates.length)]!;
    }

    const scoreOf = (a: A): number => {
      const base = values.get(String(a)) ?? 0;
      if (this.#policy !== 'ucb') return base;
      const total = Math.max(1, this.#totalVisits);
      const visits = this.#visits.get(stateId)?.get(String(a)) ?? 0;
      return base + this.#ucbC * Math.sqrt(Math.log(total) / (1 + visits));
    };

    return candidates.reduce((best, a) => (scoreOf(a) > scoreOf(best) ? a : best));
  }

  /** Step the game with a manifold decision; records outcome labels (C4). */
  async step<S, A extends number | string>(game: Game<S, A>): Promise<ManifoldRLDecision<A>> {
    const { action, values, feasible, risks, pointer, stateId, } = await this.decide(game);
    const outcome = game.step(action);

    const stateVisits = this.#visits.get(stateId) ?? new Map<string, number>();
    stateVisits.set(String(action), (stateVisits.get(String(action)) ?? 0) + 1);
    this.#visits.set(stateId, stateVisits);
    this.#totalVisits++;

    if (this.#dataset && this.#labelOutcomes) {
      recordReflexOutcome(this.#dataset, {
        stateDigest: stateId,
        action: String(action),
        reward: outcome.reward,
        source: 'manifold-rl-agent',
        embedding: this.#cache.read(pointer),
      });
    }
    return { action, outcome, values, feasible, risks, policySource: 'manifold' };
  }

  /** Run one episode; returns cumulative reward. */
  async runEpisode<S, A extends number | string>(
    game: Game<S, A> & { reset?: () => void },
    maxSteps = 100
  ): Promise<number> {
    game.reset?.();
    let totalReward = 0;
    for (let i = 0; i < maxSteps; i++) {
      const decision = await this.step(game);
      totalReward += decision.outcome.reward;
      if (decision.outcome.terminal) break;
    }
    return totalReward;
  }

  getVisitCounts(): ReadonlyMap<string, ReadonlyMap<string, number>> {
    return this.#visits;
  }
}
