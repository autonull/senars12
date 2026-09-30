import type { Perception } from '../game/Game.js';
import type { FocusTask } from '../focus/Focus.js';
import { clamp01 } from '@senars/util';
import { featureTerm, focusTask, stateTerm } from './tasks.js';

const DEFAULT_PERCEPTION_CONFIDENCE = 0.9;

export class PerceptionGate {
  toBeliefs(perception: Perception): FocusTask[] {
    const now = Date.now();
    const confidence = perception.confidence ?? DEFAULT_PERCEPTION_CONFIDENCE;

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
          priority: magnitude * confidence,
          budgetPriority: magnitude,
          f: clamp01(magnitude),
          c: confidence,
          stamp: `perception-${now}`,
        })
      );
    }

    return beliefs;
  }
}
