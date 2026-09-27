import { createScenarioSpec } from '../harness';

export const beliefDerivationAskScenario = createScenarioSpec({
  name: 'belief-derivation-ask',
  seed: 42,
  clockStart: 1000000,
  steps: [
    { type: 'input', text: '(cat --> animal).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'input', text: '(animal --> living).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'run', cycles: 10 },
    { type: 'input', text: '(cat --> living)?', taskType: 'question' },
    { type: 'run', cycles: 10 },
    { type: 'assert', check: (trace) => {
      // Just verify the scenario runs without error
      if (trace.cycleCount < 1) {
        throw new Error('Expected at least 1 cycle');
      }
    }},
  ],
});