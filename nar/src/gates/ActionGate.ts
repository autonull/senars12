import {Focus, FocusTask} from '../focus/Focus.js';
import {ActionProposal} from '../reflex/Reflex.js';

export class ActionGate {
  constructor(private readonly focus: Focus) {}

  toGoals(proposals: ActionProposal[]): FocusTask[] {
    const goals: FocusTask[] = [];
    const now = Date.now();

    for (const proposal of proposals) {
      const goal: FocusTask = {
        id: `goal-${proposal.action}-${now}`,
        priority: proposal.value * proposal.confidence,
        term: this.actionToTerm(proposal),
        type: 'goal',
        truth: { f: proposal.value, c: proposal.confidence },
        budget: { priority: proposal.value * proposal.confidence, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
        stamp: `reflex-${proposal.source}-${now}`,
        derived: false,
      };
      goals.push(goal);
    }

    return goals;
  }

  private actionToTerm(proposal: ActionProposal): any {
    const args = proposal.args ? Object.entries(proposal.args).map(([k, v]) => ({
      kind: 'compound',
      operator: k,
      args: [{ kind: 'atom', value: String(v) }],
    })) : [];

    return {
      kind: 'compound',
      operator: '^',
      args: [
        { kind: 'atom', value: proposal.action },
        ...args,
      ],
    };
  }
}