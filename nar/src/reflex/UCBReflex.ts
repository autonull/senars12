import {Reflex, ActionProposal, LearningEvent} from './Reflex.js';

interface QEntry {
  value: number;
  count: number;
}

export class UCBReflex implements Reflex<string, number> {
  readonly id: string;
  private readonly numArms: number;
  private readonly c: number;
  private readonly qTable: Map<string, QEntry[]> = new Map();
  private totalSteps = 0;

  constructor(
    id: string,
    options: { numArms: number; c?: number; initialValue?: number } = { numArms: 10 }
  ) {
    this.id = id;
    this.numArms = options.numArms;
    this.c = options.c ?? 1.414;
  }

  propose(state: string, legalActions: number[]): ActionProposal[] {
    let qState = this.qTable.get(state);
    if (!qState) {
      qState = this.initializeState();
      this.qTable.set(state, qState);
    }

    const proposals: ActionProposal[] = [];

    for (const action of legalActions) {
const entry = qState[action] ?? { value: 0, count: 0 };
      let value: number;
      let confidence: number;

      if (entry.count === 0) {
        value = 1.0;
        confidence = 0.1;
      } else {
        const ucbValue = entry.value + this.c * Math.sqrt(Math.log(this.totalSteps + 1) / entry.count);
        value = ucbValue;
        confidence = Math.min(1, entry.count / 10);
      }

      proposals.push({
        action: String(action),
        value,
        confidence,
        source: this.id,
      });
    }

    return proposals.sort((a, b) => b.value * b.confidence - a.value * a.confidence);
  }

  learn(event: LearningEvent): void {
    if (!event.actionExecuted) return;

    const stateKey = event.perception.stateId;
    const action = parseInt(event.actionExecuted, 10);

    let qState = this.qTable.get(stateKey);
    if (!qState) {
      qState = this.initializeState();
      this.qTable.set(stateKey, qState);
    }

    // Ensure entry exists
    if (!qState[action]) {
      qState[action] = { value: 0, count: 0 };
    }
    const entry = qState[action];
    const reward = event.reward;
    entry.value += (reward - entry.value) / (entry.count + 1);
    entry.count++;
    this.totalSteps++;
  }

  private initializeState(): QEntry[] {
    return Array.from({ length: this.numArms }, () => ({ value: 0, count: 0 }));
  }

  getQValue(state: string, action: number): number {
    const qState = this.qTable.get(state);
    return qState?.[action]?.value ?? 0;
  }

  reset(): void {
    this.qTable.clear();
    this.totalSteps = 0;
  }
}