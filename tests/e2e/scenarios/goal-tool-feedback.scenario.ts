import { createScenarioSpec } from '../harness';

export const goalToolFeedbackScenario = createScenarioSpec({
  name: 'goal-tool-feedback',
  seed: 123,
  clockStart: 2000000,
  steps: [
    { type: 'input', text: '(search --> tool).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'input', text: '(weather --> search).', taskType: 'belief', truth: { f: 0.8, c: 0.8 } },
    { type: 'input', text: 'weather.', taskType: 'goal', truth: { f: 0.9, c: 0.9 } },
    { type: 'run', cycles: 10 },
    { type: 'assert', check: (trace) => {
      if (trace.cycleCount < 1) {
        throw new Error('Expected at least 1 cycle');
      }
    }},
  ],
});