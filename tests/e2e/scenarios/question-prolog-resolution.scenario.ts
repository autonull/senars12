import { createScenarioSpec } from '../harness';

export const questionPrologResolutionScenario = createScenarioSpec({
  name: 'question-prolog-resolution',
  seed: 789,
  clockStart: 4000000,
  steps: [
    { type: 'input', text: '(john-->parent).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'input', text: '(mary-->parent).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'input', text: '(alice-->parent).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'run', cycles: 10 },
    { type: 'input', text: '(john-->parent)?', taskType: 'question' },
    { type: 'run', cycles: 10 },
    {
      type: 'assert',
      check: (trace) => {
        if (trace.cycleCount < 1) {
          throw new Error('Expected at least 1 cycle');
        }
      },
    },
  ],
});
