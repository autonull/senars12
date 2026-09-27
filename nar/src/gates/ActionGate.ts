import type { Focus, FocusTask } from '../focus/Focus.js';
import type { ActionProposal } from '../reflex/Reflex.js';
import { actionTerm, focusTask } from './tasks.js';

export class ActionGate {
  constructor(private readonly focus: Focus) {}

  toGoals(proposals: ActionProposal[]): FocusTask[] {
    const now = Date.now();
    return proposals.map((proposal) =>
      focusTask({
        id: `goal-${proposal.action}-${now}`,
        term: actionTerm(proposal.action, proposal.args ?? {}),
        type: 'goal',
        priority: proposal.value * proposal.confidence,
        f: proposal.value,
        c: proposal.confidence,
        stamp: `reflex-${proposal.source}-${now}`,
      })
    );
  }
}
