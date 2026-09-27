import { createScenarioSpec } from '../harness';

export const lmRuleFallbackScenario = createScenarioSpec({
  name: 'lm-rule-fallback',
  seed: 999,
  clockStart: 5000000,
  config: {
    enableLMRules: true,
    lmService: undefined,
  },
  steps: [
    { type: 'input', text: '(cat --> animal).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'input', text: '(a --> b).', taskType: 'belief', truth: { f: 0.8, c: 0.8 } },
    { type: 'input', text: 'c.', taskType: 'goal', truth: { f: 0.9, c: 0.9 } },
    { type: 'run', cycles: 10 },
    { type: 'assert', check: (trace) => {
      if (trace.cycleCount < 1) {
        throw new Error('Expected at least 1 cycle');
      }
    }},
  ],
});