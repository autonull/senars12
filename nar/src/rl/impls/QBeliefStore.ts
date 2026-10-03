import { clamp01, LruCache, lerp, maxScore, nextInt, type RandomSource } from '@senars/util';
import type { DriveManager } from '../../drives/impls/DriveManager.js';
import { atom, type Term, TermBuilder, TermSet, Truth, termKey } from '../../index.js';
import type { NAR } from '../../nar.js';

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
 * `Truth.expectation` — `E = c * (f - 0.5) + 0.5`. Every read path must go
 * through this, and the arithmetic itself must stay the engine's: the previous
 * mix of `f * c` (greedy policy) and the correct decode (max-value, blending)
 * ranked the same table under two different orderings.
 */
export const decodeQExpectation = Truth.expectation;

/**
 * Stores state-action value beliefs in NAR memory using native Product/Inheritance form
 * ((*, state, ^action) --> predicts_reward) %f;c%
 */
export class QBeliefStore {
  private readonly nar: NAR;
  private readonly predictsRewardAtom = atom('predicts_reward');
  private readonly driveManager?: DriveManager;
  /**
   * Per-state index of action terms with recorded values (X24), bounded in states
   * by LRU. Both levels key on `termKey`, the canonical structural identity, so
   * a value belief cannot be filed under a state that merely serializes alike.
   */
  private readonly stateActions: LruCache<string, TermSet>;
  private readonly rng: RandomSource;

  constructor(nar: NAR, rng: RandomSource = Math.random, options: QBeliefStoreOptions = {}) {
    this.nar = nar;
    this.rng = rng;
    this.stateActions = new LruCache({ maxSize: options.capacity ?? DEFAULT_QBELIEF_CAPACITY });
    this.driveManager = nar.getDriveManager?.();
  }

  private indexValueBelief(state: Term, action: Term): void {
    const key = termKey(state);
    const actions = this.stateActions.peek(key) ?? new TermSet();
    actions.add(action);
    this.stateActions.set(key, actions);
  }

  /** Get value belief for state-action pair */
  getValue(state: Term, action: Term): Truth | null {
    this.stateActions.get(termKey(state)); // recency: a read marks the state live
    const product = TermBuilder.product(state, action);
    const valueTerm = TermBuilder.inheritance(product, this.predictsRewardAtom);
    if (!valueTerm) return null;
    const concept = this.nar.getConcept(valueTerm);
    if (!concept) return null;

    const beliefs = concept.getBeliefs();
    return beliefs[0]?.truth ?? null;
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
  async #writeValue(
    state: Term,
    action: Term,
    expectation: number,
    confidence: number
  ): Promise<void> {
    const valueTerm = this.#valueTerm(state, action);
    if (!valueTerm) return;
    this.indexValueBelief(state, action);

    const clamped = clamp01(expectation);
    const frequency = clamp01((clamped - 0.5) / confidence + 0.5);
    await this.nar.believe(valueTerm, Truth.create(frequency, confidence));
  }

  /** Update value belief using Truth.revision with immediate reward */
  updateValue(state: Term, action: Term, reward: number, confidence: number = 0.5): Promise<void> {
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
      current ? lerp(decodeQExpectation(current), tdTarget, alpha) : tdTarget,
      confidence
    );
  }

  /** Get max Q-value for a state across available actions */
  getMaxValue(state: Term, availableActions: Term[]): number {
    return maxScore(availableActions, (action) => {
      const value = this.getValue(state, action);
      return value ? decodeQExpectation(value) : 0;
    });
  }

  /** Get all recorded action values for a state (X24: real implementation), keyed by `termKey`. */
  getAllActions(state: Term): Map<string, Truth> {
    const results = new Map<string, Truth>();
    for (const action of this.stateActions.peek(termKey(state))?.values() ?? []) {
      const value = this.getValue(state, action);
      if (value) results.set(termKey(action), value);
    }
    return results;
  }

  /** Get best action for a state by highest decoded Q-expectation. */
  getBestAction(state: Term, availableActions: Term[]): Term | null {
    // Random tie-break among maximal-expectation actions — deterministic
    // first-action ties bias the policy toward the earliest-recorded action
    // (all small rewards clamp near f=0.5 under the Q-convex encoding),
    // latching exploration shut (F4 GridWorld parity root cause).
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

    return ties.length > 0 ? (ties[nextInt(this.rng, ties.length)] ?? null) : null;
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

  /** Current capacity bound (for diagnostics/tests). */
  get capacity(): number {
    return this.stateActions.maxSize;
  }

  /** Current number of tracked states (for diagnostics/tests). */
  get size(): number {
    return this.stateActions.size();
  }
}
