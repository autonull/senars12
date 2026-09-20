import { type Term, TermBuilder, Truth } from '../index.js';
import type { DriveManager } from '../drives/manager.js';
import type { NAR } from '../nar.js';
import { atm, inh, prod } from './terms.js';

/**
 * Stores state-action value beliefs in NAR memory using native Product/Inheritance form
 * ((*, state, ^action) --> predicts_reward) %f;c%
 */
export class QBeliefStore {
  private readonly nar: NAR;
  private readonly predictsRewardAtom = atm('predicts_reward');
  private readonly driveManager?: DriveManager;
  /** Per-state index of action terms with recorded values (X24). */
  private readonly stateActions = new Map<string, Map<string, Term>>();

  constructor(nar: NAR) {
    this.nar = nar;
    this.driveManager = nar.getDriveManager?.();
  }

  private indexValueBelief(state: Term, action: Term): void {
    const stateKey = state.toString();
    const actions = this.stateActions.get(stateKey) ?? new Map<string, Term>();
    actions.set(action.toString(), action);
    this.stateActions.set(stateKey, actions);
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
  async updateValue(state: Term, action: Term, reward: number, confidence: number = 0.5): Promise<void> {
    const product = prod(state, action);
    const valueTerm = inh(product, this.predictsRewardAtom);

    const evidenceTruth = Truth.create(reward, confidence);
    this.indexValueBelief(state, action);

    const current = this.getValue(state, action);
    if (current) {
      const currentTruth = Truth.create(current.f, current.c);
      const revised = Truth.revision(currentTruth, evidenceTruth);
      await this.nar.believe(valueTerm, revised);
    } else {
      await this.nar.believe(valueTerm, evidenceTruth);
    }
  }

  /** Update value belief using TD target (for temporal difference learning) */
  async updateValueTD(state: Term, action: Term, tdTarget: number, confidence: number = 0.5): Promise<void> {
    const product = prod(state, action);
    const valueTerm = inh(product, this.predictsRewardAtom);

    const evidenceTruth = Truth.create(tdTarget, confidence);
    this.indexValueBelief(state, action);

    const current = this.getValue(state, action);
    if (current) {
      const currentTruth = Truth.create(current.f, current.c);
      const revised = Truth.revision(currentTruth, evidenceTruth);
      await this.nar.believe(valueTerm, revised);
    } else {
      await this.nar.believe(valueTerm, evidenceTruth);
    }
  }

  /** Update value belief using Q-learning style convex combination (proper TD learning) */
  async updateValueQLearning(
    state: Term,
    action: Term,
    tdTarget: number,
    alpha: number = 0.1,
    confidence: number = 0.9
  ): Promise<void> {
    const product = prod(state, action);
    const valueTerm = inh(product, this.predictsRewardAtom);
    this.indexValueBelief(state, action);

    const current = this.getValue(state, action);
    let newExpectation: number;

    if (current) {
      const currentExpectation = current.c * (current.f - 0.5) + 0.5;
      newExpectation = (1 - alpha) * currentExpectation + alpha * tdTarget;
    } else {
      newExpectation = tdTarget;
    }

    newExpectation = Math.max(0, Math.min(1, newExpectation));
    const newFrequency = (newExpectation - 0.5) / confidence + 0.5;
    const clampedFrequency = Math.max(0, Math.min(1, newFrequency));

    const newTruth = Truth.create(clampedFrequency, confidence);
    await this.nar.believe(valueTerm, newTruth);
  }

  /** Get max Q-value for a state across available actions */
  getMaxValue(state: Term, availableActions: Term[]): number {
    let maxValue = 0;
    for (const action of availableActions) {
      const value = this.getValue(state, action);
      if (value) {
        const expectation = value.c * (value.f - 0.5) + 0.5;
        if (expectation > maxValue) maxValue = expectation;
      }
    }
    return maxValue;
  }

  /** Get all recorded action values for a state (X24: real implementation). */
  getAllActions(state: Term): Map<string, { f: number; c: number }> {
    const results = new Map<string, { f: number; c: number }>();
    for (const [actionKey, actionTerm] of this.stateActions.get(state.toString()) ?? new Map()) {
      const value = this.getValue(state, actionTerm);
      if (value) results.set(actionKey, value);
    }
    return results;
  }

  /** Get best action for a state based on expected value (f * c) */
  getBestAction(state: Term, availableActions: Term[]): Term | null {
    // Random tie-break among maximal-expectation actions — deterministic
    // first-action ties bias the policy toward the earliest-recorded action
    // (all small rewards clamp to f=0 under Q-convex encoding), latching
    // exploration shut (F4 GridWorld parity root cause).
    let bestAction: Term | null = null;
    let bestExpectation = -Infinity;
    let ties: Term[] = [];

    for (const action of availableActions) {
      const value = this.getValue(state, action);
      if (value) {
        const expectation = value.f * value.c;
        if (expectation > bestExpectation + 1e-9) {
          bestExpectation = expectation;
          ties = [action];
        } else if (Math.abs(expectation - bestExpectation) <= 1e-9) {
          ties.push(action);
        }
      }
    }

    return ties.length > 0 ? (ties[Math.floor(Math.random() * ties.length)] ?? null) : null;
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
