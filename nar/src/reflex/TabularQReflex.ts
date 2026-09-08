import {Reflex, ActionProposal, LearningEvent, Perception} from '../focus/Focus.js';

interface QEntry {
  value: number;
  visits: number;
}

export class TabularQReflex<S = unknown, A = unknown> implements Reflex<S, A> {
  readonly id: string;
  private readonly alpha: number;
  private readonly gamma: number;
  private readonly epsilon: number;
  private readonly qTable: Map<string, Map<string, QEntry>> = new Map();

  constructor(
    id: string,
    options: { alpha?: number; gamma?: number; epsilon?: number } = {}
  ) {
    this.id = id;
    this.alpha = options.alpha ?? 0.1;
    this.gamma = options.gamma ?? 0.95;
    this.epsilon = options.epsilon ?? 0.1;
  }

  propose(state: S, legalActions: A[]): ActionProposal[] {
    const stateKey = this.stateToKey(state);
    const qState = this.qTable.get(stateKey) ?? new Map();

    const proposals: ActionProposal[] = [];

    for (const action of legalActions) {
      const actionKey = this.actionToKey(action);
      const entry = qState.get(actionKey) ?? { value: 0, visits: 0 };

      let value = entry.value;
      const confidence = Math.min(1, entry.visits / 10);

      if (Math.random() < this.epsilon && entry.visits < 5) {
        value = Math.random();
      }

      proposals.push({
        action: actionKey,
        value,
        confidence,
        source: this.id,
      });
    }

    return proposals.sort((a, b) => b.value * b.confidence - a.value * a.confidence);
  }

  learn(event: LearningEvent): void {
    if (!event.actionExecuted) return;

    const stateKey = this.perceptionToKey(event.perception);
    const actionKey = event.actionExecuted;

    let qState = this.qTable.get(stateKey);
    if (!qState) {
      qState = new Map();
      this.qTable.set(stateKey, qState);
    }

    const entry = qState.get(actionKey) ?? { value: 0, visits: 0 };
    const oldValue = entry.value;
    const reward = event.reward;
    const nextStateKey = stateKey; // Simplified: using same state for next state max Q
    const maxNextQ = this.getMaxQ(nextStateKey);

    entry.value = oldValue + this.alpha * (reward + this.gamma * maxNextQ - oldValue);
    entry.visits++;
    qState.set(actionKey, entry);
  }

  private getMaxQ(stateKey: string): number {
    const qState = this.qTable.get(stateKey);
    if (!qState || qState.size === 0) return 0;

    let max = -Infinity;
    for (const entry of qState.values()) {
      if (entry.value > max) max = entry.value;
    }
    return max > 0 ? max : 0;
  }

  private stateToKey(state: S): string {
    return typeof state === 'object' && state !== null
      ? JSON.stringify(state)
      : String(state);
  }

  private perceptionToKey(perception: Perception): string {
    return `${perception.stateId}|${JSON.stringify(perception.features ?? {})}`;
  }

  private actionToKey(action: A): string {
    return typeof action === 'object' && action !== null
      ? JSON.stringify(action)
      : String(action);
  }

  getQValue(state: S, action: A): number {
    const stateKey = typeof state === 'object' && state !== null && 'stateId' in state
      ? this.perceptionToKey(state as any)
      : this.stateToKey(state);
    const actionKey = this.actionToKey(action);
    return this.qTable.get(stateKey)?.get(actionKey)?.value ?? 0;
  }

  getVisitCount(state: S, action: A): number {
    const stateKey = typeof state === 'object' && state !== null && 'stateId' in state
      ? this.perceptionToKey(state as any)
      : this.stateToKey(state);
    const actionKey = this.actionToKey(action);
    return this.qTable.get(stateKey)?.get(actionKey)?.visits ?? 0;
  }

  reset(): void {
    this.qTable.clear();
  }
}