import type { Scenario } from '../framework.js';

const toolUse: Scenario = {
  name: 'tool-use',
  description: 'LM dispatches agent tools (know, calculate, etc.)',
  probes: [
    {
      input: 'Remember that my favorite color is blue',
      expect: {
        responseContainsAny: ['favorite color', 'blue', 'remember', 'stored'],
        maxDurationMs: 30_000,
      },
    },
    {
      input: 'What is my favorite color?',
      expect: {
        responseContainsAny: ['blue', 'color', 'favorite'],
        maxDurationMs: 30_000,
      },
    },
    {
      input: 'Calculate 15 * 3',
      expect: {
        responseContains: ['45'],
        maxDurationMs: 30_000,
      },
    },
  ],
};

export default toolUse;
