import type { Perception } from '../game/Game.js';
import type { Focus, FocusTask } from '../focus/Focus.js';
import { featureTerm, focusTask, stateTerm } from './tasks.js';

export class PerceptionGate {
  constructor(private readonly focus: Focus) {}

  toBeliefs(perception: Perception): FocusTask[] {
    const now = Date.now();
    const confidence = perception.confidence ?? 0.9;

    const beliefs: FocusTask[] = [
      focusTask({
        id: `percept-state-${perception.stateId}-${now}`,
        term: stateTerm(perception.stateId),
        type: 'belief',
        priority: confidence,
        f: 1.0,
        c: confidence,
        stamp: `perception-${now}`,
      }),
    ];

    for (const [feature, value] of Object.entries(perception.features ?? {})) {
      const magnitude = Math.abs(Number(value));
      beliefs.push(
        focusTask({
          id: `percept-feature-${feature}-${now}`,
          term: featureTerm(feature, Number(value)),
          type: 'belief',
          priority: magnitude * (perception.confidence ?? 0.5),
          budgetPriority: magnitude,
          f: Math.min(1, magnitude),
          c: perception.confidence ?? 0.5,
          stamp: `perception-${now}`,
        })
      );
    }

    return beliefs;
  }
}
