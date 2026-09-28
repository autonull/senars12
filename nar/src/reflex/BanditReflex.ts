import { getOrInsert } from '@senars/util';
import { type ActionProposal, byExpectedValue, type LearningEvent } from './Reflex.js';

/** Incremental mean estimator for one (state, action) pair. */
export interface QEntry {
  value: number;
  count: number;
}

export interface BanditReflexOptions {
  numArms: number;
  initialValue?: number;
}

/**
 * Shared tabular-bandit substrate: per-state Q-vectors, incremental reward
 * updates, and proposal assembly. Subclasses supply only the exploration term
 * that turns an estimate into a proposal value.
 */
export abstract class BanditReflex<O extends BanditReflexOptions = BanditReflexOptions> {
  readonly id: string;
  protected readonly numArms: number;
  protected totalSteps = 0;
  private readonly qTable = new Map<string, QEntry[]>();

  protected constructor(
    id: string,
    protected readonly options: O
  ) {
    this.id = id;
    this.numArms = options.numArms;
  }

  /** Exploration-adjusted value for one arm's current estimate. */
  protected abstract explore(entry: QEntry, state: string, action: number): number;

  /** Proposal confidence from visit count — optimistic floors live in subclasses. */
  protected confidenceOf(entry: QEntry): number {
    return Math.min(1, entry.count / 10);
  }

  protected entryFor(state: string, action: number): QEntry {
    const qState = getOrInsert(this.qTable, state, () =>
      Array.from({ length: this.numArms }, () => ({ value: 0, count: 0 }))
    );
    qState[action] ??= { value: 0, count: 0 };
    return qState[action]!;
  }

  propose(state: string, legalActions: number[]): ActionProposal[] {
    return legalActions
      .map((action) => {
        const entry = this.entryFor(state, action);
        return {
          action: String(action),
          value: this.explore(entry, state, action),
          confidence: this.confidenceOf(entry),
          source: this.id,
        };
      })
      .sort(byExpectedValue);
  }

  learn(event: LearningEvent): void {
    if (!event.actionExecuted) return;
    const entry = this.entryFor(event.perception.stateId, Number.parseInt(event.actionExecuted, 10));
    entry.value += (event.reward - entry.value) / (entry.count + 1);
    entry.count++;
    this.totalSteps++;
  }

  getQValue(state: string, action: number): number {
    return this.qTable.get(state)?.[action]?.value ?? 0;
  }

  reset(): void {
    this.qTable.clear();
    this.totalSteps = 0;
  }
}
