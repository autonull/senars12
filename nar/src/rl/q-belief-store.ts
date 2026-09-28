import { clamp01 } from '@senars/util';
import type { DriveManager } from '../drives/manager.js';
import { type Term, TermBuilder, Truth, atom } from '../index.js';
import type { NAR } from '../nar.js';
import type { RandomSource } from '../types/primitives.js';

/**
 * Stores state-action value beliefs in NAR memory using native Product/Inheritance form
 * ((*, state, ^action) --> predicts_reward) %f;c%
 */
export interface QBeliefStoreOptions {
  /** Maximum states in memory (AIKR bound; default 1000). LRU eviction applies. */
  capacity?: number;
}

export const DEFAULT_QBELIEF_CAPACITY = 1000;

/**
 * Decode a stored value belief back to the Q expectation it encodes.
 *
 * `updateValueQLearning` writes `f = (E - 0.5) / c + 0.5`, so the inverse is
 * `E = c * (f - 0.5) + 0.5`. Every read path must go through this — the previous
 * mix of `f * c` (greedy policy) and the correct decode (max-value, blending)
 * ranked the same table under two different orderings.
 */
export const decodeQExpectation = ({ f, c }: { f: number; c: number }): number => c * (f - 0.5) + 0.5;

/**
 * Stores state-action value beliefs in NAR memory using native Product/Inheritance form
 * ((*, state, ^action) --> predicts_reward) %f;c%
 */
export class QBeliefStore {
  private readonly nar: NAR;
  private readonly predictsRewardAtom = atom('predicts_reward');
  private readonly driveManager?: DriveManager;
  /** Per-state index of action terms with recorded values (X24). */
  /** Map insertion order is the LRU order: `#touchState` re-inserts, eviction takes the first key. */
  private readonly stateActions = new Map<string, Map<string, Term>>();
  private readonly rng: RandomSource;
  readonly #capacity: number;

  constructor(nar: NAR, rng: RandomSource = Math.random, options: QBeliefStoreOptions = {}) {
    this.nar = nar;
    this.rng = rng;
    this.#capacity = options.capacity ?? DEFAULT_QBELIEF_CAPACITY;
    this.driveManager = nar.getDriveManager?.();
  }

  /** LRU touch — moves state to most-recently-used position. */
  #touchState(stateKey: string): void {
    const actions = this.stateActions.get(stateKey);
    if (actions === undefined) return;
    this.stateActions.delete(stateKey);
    this.stateActions.set(stateKey, actions);
    this.#evictIfNeeded();
  }

  /** Evict LRU states if over capacity. */
  #evictIfNeeded(): void {
    while (this.stateActions.size > this.#capacity) {
      const lru = this.stateActions.keys().next().value;
      if (lru === undefined) break;
      this.stateActions.delete(lru);
    }
  }

  private indexValueBelief(state: Term, action: Term): void {
    const stateKey = state.toString();
    const actions = this.stateActions.get(stateKey) ?? new Map<string, Term>();
    actions.set(action.toString(), action);
    this.stateActions.set(stateKey, actions);
    this.#touchState(stateKey);
  }

  /** Get value belief for state-action pair */
  getValue(state: Term, action: Term): { f: number; c: number } | null {
    const stateKey = state.toString();
    this.#touchState(stateKey);
    const product = TermBuilder.product(state, action);
    const valueTerm = TermBuilder.inheritance(product, this.predictsRewardAtom);
    if (!valueTerm) return null;
    const concept = this.nar.getConcept(valueTerm);
    if (!concept) return null;

    const beliefs = concept.getBeliefs();
    const belief = beliefs[0];
    if (!belief?.truth) return null;

    return { f: belief.truth.f, c: belief.truth.c };
  }

  /** Value-belief term for a (state, action) pair, or null if unbuildable. */
  #valueTerm(state: Term, action: Term): Term | null {
    const product = TermBuilder.product(state, action);
    return TermBuilder.inheritance(product, this.predictsRewardAtom) ?? null;
  }

  /** Revise the stored value belief with `evidence` as new evidence. */
  async #reviseValue(state: Term, action: Term, evidence: Truth): Promise<void> {
    const valueTerm = this.#valueTerm(state, action);
    if (!valueTerm) return;
    this.indexValueBelief(state, action);

    const current = this.getValue(state, action);
    await this.nar.believe(
      valueTerm,
      current ? Truth.revision(Truth.create(current.f, current.c), evidence) : evidence
    );
  }

  /** Write a value belief by assignment, encoding expectation `expectation`. */
  async #writeValue(state: Term, action: Term, expectation: number, confidence: number): Promise<void> {
    const valueTerm = this.#valueTerm(state, action);
    if (!valueTerm) return;
    this.indexValueBelief(state, action);

    const clamped = clamp01(expectation);
    const frequency = clamp01((clamped - 0.5) / confidence + 0.5);
    await this.nar.believe(valueTerm, Truth.create(frequency, confidence));
  }

  /** Update value belief using Truth.revision with immediate reward */
  updateValue(
    state: Term,
    action: Term,
    reward: number,
    confidence: number = 0.5
  ): Promise<void> {
    return this.#reviseValue(state, action, Truth.create(reward, confidence));
  }

  /** Update value belief using TD target (for temporal difference learning) */
  updateValueTD(
    state: Term,
    action: Term,
    tdTarget: number,
    confidence: number = 0.5
  ): Promise<void> {
    return this.#reviseValue(state, action, Truth.create(tdTarget, confidence));
  }

  /** Update value belief using Q-learning style convex combination (proper TD learning) */
  updateValueQLearning(
    state: Term,
    action: Term,
    tdTarget: number,
    alpha: number = 0.1,
    confidence: number = 0.9
  ): Promise<void> {
    const current = this.getValue(state, action);
    return this.#writeValue(
      state,
      action,
      current ? (1 - alpha) * decodeQExpectation(current) + alpha * tdTarget : tdTarget,
      confidence
    );
  }

  /** Get max Q-value for a state across available actions */
  getMaxValue(state: Term, availableActions: Term[]): number {
    const stateKey = state.toString();
    this.#touchState(stateKey);
    let maxValue = 0;
    for (const action of availableActions) {
      const value = this.getValue(state, action);
      if (value) {
        const expectation = decodeQExpectation(value);
        if (expectation > maxValue) maxValue = expectation;
      }
    }
    return maxValue;
  }

  /** Get all recorded action values for a state (X24: real implementation). */
  getAllActions(state: Term): Map<string, { f: number; c: number }> {
    const stateKey = state.toString();
    this.#touchState(stateKey);
    const results = new Map<string, { f: number; c: number }>();
    for (const [actionKey, actionTerm] of this.stateActions.get(stateKey) ?? new Map()) {
      const value = this.getValue(state, actionTerm);
      if (value) results.set(actionKey, value);
    }
    return results;
  }

  /** Get best action for a state by highest decoded Q-expectation. */
  getBestAction(state: Term, availableActions: Term[]): Term | null {
    const stateKey = state.toString();
    this.#touchState(stateKey);
    // Random tie-break among maximal-expectation actions — deterministic
    // first-action ties bias the policy toward the earliest-recorded action
    // (all small rewards clamp near f=0.5 under the Q-convex encoding),
    // latching exploration shut (F4 GridWorld parity root cause).
    const bestAction: Term | null = null;
    let bestExpectation = -Infinity;
    let ties: Term[] = [];

    for (const action of availableActions) {
      const value = this.getValue(state, action);
      if (value) {
        const expectation = decodeQExpectation(value);
        if (expectation > bestExpectation + 1e-9) {
          bestExpectation = expectation;
          ties = [action];
        } else if (Math.abs(expectation - bestExpectation) <= 1e-9) {
          ties.push(action);
        }
      }
    }

    return ties.length > 0 ? (ties[Math.floor(this.rng() * ties.length)] ?? null) : null;
  }

  /** Get low-confidence actions for curiosity-driven exploration */
  getLowConfidenceActions(
    state: Term,
    availableActions: Term[],
    confidenceThreshold: number = 0.5
  ): Term[] {
    const stateKey = state.toString();
    this.#touchState(stateKey);
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

  /** Current capacity bound (for diagnostics/tests). */
  get capacity(): number {
    return this.#capacity;
  }

  /** Current number of tracked states (for diagnostics/tests). */
  get size(): number {
    return this.stateActions.size;
  }
}
