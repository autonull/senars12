import { createScenarioSpec } from '../harness';

export const contradictionDriveAdaptationScenario = createScenarioSpec({
  name: 'contradiction-drive-adaptation',
  seed: 456,
  clockStart: 3000000,
  steps: [
    { type: 'input', text: '(cat-->animal).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'input', text: '(cat-->--living).', taskType: 'belief', truth: { f: 0.8, c: 0.8 } },
    { type: 'input', text: '(animal-->living).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'run', cycles: 10 },
    { type: 'assert', check: (trace) => {
      if (trace.cycleCount < 1) {
        throw new Error('Expected at least 1 cycle');
      }
    }},
  ],
});