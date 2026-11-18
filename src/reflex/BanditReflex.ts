import {
  type ConfidenceCurve,
  type Exploration,
  greedy,
  meanUpdate,
  QTable,
  visitConfidence,
} from '@senars/util';
import { SATURATION_COUNT } from '../constants.js';
import { type ActionProposal, byExpectedValue, type LearningEvent } from './Reflex.js';

export type { QEntry } from '@senars/util';

export interface BanditReflexOptions {
  numArms: number;
}

/**
 * Shared tabular-bandit substrate: per-state Q-vectors, incremental reward
 * updates, and proposal assembly. A subclass contributes two policies and
 * nothing else — the exploration term that turns an estimate into a proposal
 * value, and the curve that turns a visit count into confidence.
 */
export abstract class BanditReflex<O extends BanditReflexOptions = BanditReflexOptions> {
  readonly id: string;
  protected readonly qTable = new QTable(meanUpdate);
  protected readonly explore: Exploration;
  protected readonly confidenceOf: ConfidenceCurve;

  protected constructor(
    id: string,
    options: O,
    explore: Exploration = greedy,
    confidenceOf: ConfidenceCurve = visitConfidence(SATURATION_COUNT)
  ) {
    this.id = id;
    this.explore = explore;
    this.confidenceOf = confidenceOf;
  }

  propose(state: string, legalActions: number[]): ActionProposal[] {
    const { totalVisits } = this.qTable;
    return legalActions
      .map((action) => {
        const entry = this.qTable.read(state, String(action));
        return {
          action: String(action),
          value: this.explore(entry, totalVisits),
          confidence: this.confidenceOf(entry.count),
          source: this.id,
        };
      })
      .sort(byExpectedValue);
  }

  learn(event: LearningEvent): void {
    if (!event.actionExecuted) return;
    this.qTable.observe(event.perception.stateId, event.actionExecuted, event.reward);
  }

  getQValue(state: string, action: number): number {
    return this.qTable.read(state, String(action)).value;
  }

  reset(): void {
    this.qTable.clear();
  }
}
