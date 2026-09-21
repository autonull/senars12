import type { Perception } from '../game/Game.js';
import type { ActionProposal, LearningEvent, Reflex } from './Reflex.js';

interface QEntry {
  value: number;
  visits: number;
}

interface TabularQReflexOptions {
  alpha?: number;
  gamma?: number;
  epsilon?: number;
  confidenceScale?: number;
  epsilonDecay?: number;
  epsilonMin?: number;
}

export interface SerializedQTable {
  id: string;
  alpha: number;
  gamma: number;
  epsilon: number;
  epsilonDecay: number;
  epsilonMin: number;
  episodeCount: number;
  qTable: Record<string, Record<string, QEntry>>;
}

export class TabularQReflex<S = unknown, A = unknown> implements Reflex<S, A> {
  readonly id: string;
  private readonly alpha: number;
  private readonly gamma: number;
  private epsilon: number;
  private readonly confidenceScale: number;
  private readonly epsilonDecay: number;
  private readonly epsilonMin: number;
  private episodeCount: number = 0;
  private readonly qTable: Map<string, Map<string, QEntry>> = new Map();

  constructor(id: string, options: TabularQReflexOptions = {}) {
    this.id = id;
    this.alpha = options.alpha ?? 0.1;
    this.gamma = options.gamma ?? 0.95;
    this.epsilon = options.epsilon ?? 0.1;
    this.confidenceScale = options.confidenceScale ?? 5;
    this.epsilonDecay = options.epsilonDecay ?? 0.99;
    this.epsilonMin = options.epsilonMin ?? 0.01;
  }

  propose(state: S, legalActions: A[]): ActionProposal[] {
    const stateKey = this.stateToKey(state);
    const qState = this.qTable.get(stateKey) ?? new Map();

    const proposals: ActionProposal[] = [];

    for (const action of legalActions) {
      const actionKey = this.actionToKey(action);
      const entry = qState.get(actionKey) ?? { value: 0, visits: 0 };

      const value = entry.value;
      // Confidence based on visit count (more visits = more confident)
      const confidence = 1 - Math.exp(-entry.visits / this.confidenceScale);

      proposals.push({
        action: actionKey,
        value,
        confidence,
        source: this.id,
      });
    }

    // Epsilon-greedy: with probability epsilon, randomize the order
    if (Math.random() < this.epsilon) {
      // Shuffle to simulate exploration
      for (let i = proposals.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [proposals[i]!, proposals[j]!] = [proposals[j]!, proposals[i]!];
      }
    } else {
      // Sort by value * confidence for exploitation
      proposals.sort((a, b) => b.value * b.confidence - a.value * a.confidence);
    }

    return proposals;
  }

  learn(event: LearningEvent): void {
    if (!event.actionExecuted || !event.previousPerception) return;

    const stateKey = this.perceptionToKey(event.previousPerception);
    const nextStateKey = this.perceptionToKey(event.perception);
    const actionKey = event.actionExecuted;

    let qState = this.qTable.get(stateKey);
    if (!qState) {
      qState = new Map();
      this.qTable.set(stateKey, qState);
    }

    const entry = qState.get(actionKey) ?? { value: 0, visits: 0 };
    const oldValue = entry.value;
    const reward = event.reward;
    const maxNextQ = event.terminal ? 0 : this.getMaxQ(nextStateKey);

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
    if (typeof state === 'object' && state !== null) {
      // If state has row/col (GridWorldState), use "row,col" format
      if ('row' in state && 'col' in state) {
        return `${(state as any).row},${(state as any).col}`;
      }
      // If state has stateId (Perception-like), align with perceptionToKey (learn)
      if ('stateId' in state) {
        return (state as { stateId: string }).stateId;
      }
      return JSON.stringify(state);
    }
    return String(state);
  }

  private perceptionToKey(perception: Perception): string {
    return perception.stateId;
  }

  private actionToKey(action: A): string {
    return typeof action === 'object' && action !== null ? JSON.stringify(action) : String(action);
  }

  getQValue(state: S, action: A): number {
    const stateKey =
      typeof state === 'object' && state !== null && 'stateId' in state
        ? this.perceptionToKey(state as any)
        : this.stateToKey(state);
    const actionKey = this.actionToKey(action);
    return this.qTable.get(stateKey)?.get(actionKey)?.value ?? 0;
  }

  getVisitCount(state: S, action: A): number {
    const stateKey =
      typeof state === 'object' && state !== null && 'stateId' in state
        ? this.perceptionToKey(state as any)
        : this.stateToKey(state);
    const actionKey = this.actionToKey(action);
    return this.qTable.get(stateKey)?.get(actionKey)?.visits ?? 0;
  }

  reset(): void {
    this.qTable.clear();
  }

  getQTable(): Map<string, Map<string, QEntry>> {
    return this.qTable;
  }

  /** Call at the end of each episode to decay epsilon */
  onEpisodeEnd(): void {
    this.episodeCount++;
    this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
  }

  /** Get current epsilon value */
  getEpsilon(): number {
    return this.epsilon;
  }

  /** Get number of episodes completed */
  getEpisodeCount(): number {
    return this.episodeCount;
  }

  /** Reset epsilon to initial value (useful for testing) */
  resetEpsilon(initialEpsilon?: number): void {
    this.epsilon = initialEpsilon ?? this.epsilon;
    this.episodeCount = 0;
  }

  /** Serialize Q-table for persistence */
  serialize(): SerializedQTable {
    const qTableObj: Record<string, Record<string, QEntry>> = {};
    for (const [stateKey, actionMap] of this.qTable) {
      const actionsObj: Record<string, QEntry> = {};
      for (const [actionKey, entry] of actionMap) {
        actionsObj[actionKey] = { value: entry.value, visits: entry.visits };
      }
      qTableObj[stateKey] = actionsObj;
    }
    return {
      id: this.id,
      alpha: this.alpha,
      gamma: this.gamma,
      epsilon: this.epsilon,
      epsilonDecay: this.epsilonDecay,
      epsilonMin: this.epsilonMin,
      episodeCount: this.episodeCount,
      qTable: qTableObj,
    };
  }

  /** Deserialize Q-table from persistence */
  deserialize(data: SerializedQTable): void {
    this.qTable.clear();
    for (const [stateKey, actionsObj] of Object.entries(data.qTable)) {
      const actionMap = new Map<string, QEntry>();
      for (const [actionKey, entry] of Object.entries(actionsObj)) {
        actionMap.set(actionKey, { value: entry.value, visits: entry.visits });
      }
      this.qTable.set(stateKey, actionMap);
    }
    this.epsilon = data.epsilon;
    this.episodeCount = data.episodeCount;
  }
}
