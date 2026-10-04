import { 
  ambientRng,
  anneal,
  lerpUpdate,
  maxScore,
  type QEntry,
  QTable,
  rampConfidence,
  type RandomSource,
  shuffleInPlace,
 } from '@senars/util';
import type { Perception } from '../game/Game.js';
import type { ActionProposal, LearningEvent, Reflex } from './Reflex.js';
import { byExpectedValue } from './Reflex.js';

interface TabularQReflexOptions {
  alpha?: number;
  gamma?: number;
  epsilon?: number;
  confidenceScale?: number;
  epsilonDecay?: number;
  epsilonMin?: number;
  /** §5s: injectable RNG for exploration. */
  rng?: RandomSource;
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
  private readonly confidenceOf: (count: number) => number;
  private readonly epsilonDecay: number;
  private readonly epsilonMin: number;
  private readonly rng: RandomSource;
  private episodeCount = 0;
  private readonly qTable: QTable;

  constructor(id: string, options: TabularQReflexOptions = {}) {
    this.id = id;
    this.alpha = options.alpha ?? 0.1;
    this.gamma = options.gamma ?? 0.95;
    this.epsilon = options.epsilon ?? 0.1;
    this.confidenceOf = rampConfidence(options.confidenceScale ?? 5);
    this.epsilonDecay = options.epsilonDecay ?? 0.99;
    this.epsilonMin = options.epsilonMin ?? 0.01;
    this.rng = options.rng ?? ambientRng;
    this.qTable = new QTable(lerpUpdate(this.alpha));
  }

  propose(state: S, legalActions: A[]): ActionProposal[] {
    const stateKey = this.stateToKey(state);
    const proposals = legalActions.map((action) => {
      const entry = this.qTable.read(stateKey, this.actionToKey(action));
      return {
        action: this.actionToKey(action),
        value: entry.value,
        confidence: this.confidenceOf(entry.count),
        source: this.id,
      };
    });

    // Epsilon-greedy: with probability epsilon, randomize the order
    if (this.rng() < this.epsilon) {
      shuffleInPlace(proposals, this.rng);
    } else {
      // Sort by value * confidence for exploitation
      proposals.sort(byExpectedValue);
    }

    return proposals;
  }

  learn(event: LearningEvent): void {
    if (!event.actionExecuted || !event.previousPerception) return;

    const stateKey = this.perceptionToKey(event.previousPerception);
    const nextStateKey = this.perceptionToKey(event.perception);
    const maxNextQ = event.terminal ? 0 : this.getMaxQ(nextStateKey);

    this.qTable.revise(stateKey, event.actionExecuted, event.reward + this.gamma * maxNextQ);
  }

  private getMaxQ(stateKey: string): number {
    return maxScore(this.qTable.arms(stateKey).values(), (e) => e.value);
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
    return this.qTable.read(this.stateToKey(state), this.actionToKey(action)).value;
  }

  getVisitCount(state: S, action: A): number {
    return this.qTable.read(this.stateToKey(state), this.actionToKey(action)).count;
  }

  reset(): void {
    this.qTable.clear();
  }

  getQTable(): QTable {
    return this.qTable;
  }

  /** Call at the end of each episode to decay epsilon */
  onEpisodeEnd(): void {
    this.episodeCount++;
    this.epsilon = anneal(this.epsilon, this.epsilonDecay, this.epsilonMin);
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
    return {
      id: this.id,
      alpha: this.alpha,
      gamma: this.gamma,
      epsilon: this.epsilon,
      epsilonDecay: this.epsilonDecay,
      epsilonMin: this.epsilonMin,
      episodeCount: this.episodeCount,
      qTable: this.qTable.toJSON(),
    };
  }

  /** Deserialize Q-table from persistence */
  deserialize(data: SerializedQTable): void {
    this.qTable.loadJSON(data.qTable);
    this.epsilon = data.epsilon;
    this.episodeCount = data.episodeCount;
  }
}
