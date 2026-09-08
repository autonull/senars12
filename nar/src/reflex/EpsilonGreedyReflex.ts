import {Reflex, ActionProposal, LearningEvent} from './Reflex.js';

interface QEntry {
  value: number;
  count: number;
}

export class EpsilonGreedyReflex implements Reflex<string, number> {
  readonly id: string;
  private readonly numArms: number;
  private readonly epsilon: number;
  private readonly qTable: Map<string, QEntry[]> = new Map();

  constructor(
    id: string,
    options: { numArms: number; epsilon?: number; initialValue?: number } = { numArms: 10 }
  ) {
    this.id = id;
    this.numArms = options.numArms;
    this.epsilon = options.epsilon ?? 0.1;
  }

  propose(state: string, legalActions: number[]): ActionProposal[] {
    const qState = this.qTable.get(state) ?? this.initializeState();

    const proposals: ActionProposal[] = [];

    for (const action of legalActions) {
      // Ensure entry exists (legalActions may exceed initialized arms)
      if (!qState[action]) {
        qState[action] = { value: 0, count: 0 };
      }
      const entry = qState[action];
      let value = entry.value;
      const confidence = Math.min(1, entry.count / 10);

      if (Math.random() < this.epsilon && entry.count < 5) {
        value = Math.random();
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

    let entry = qState[action];
    if (!entry) {
      entry = { value: 0, count: 0 };
      qState[action] = entry;
    }
    const reward = event.reward;
    entry.value += (reward - entry.value) / (entry.count + 1);
    entry.count++;
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
  }
}