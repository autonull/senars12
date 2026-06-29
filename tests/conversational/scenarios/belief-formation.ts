import type { Scenario } from '../framework.js';

const beliefFormation: Scenario = {
  name: 'belief-formation',
  description: 'NL input translated to NAR beliefs, then queried',
  probes: [
    {
      input: 'All cats are animals',
      expect: {
        responseContainsAny: ['cat', 'animal', 'belief', 'recorded'],
        maxDurationMs: 30_000,
      },
    },
    {
      input: '(cat --> ?)?',
      expect: {
        expectNarseseParsed: true,
        maxDurationMs: 30_000,
      },
    },
    {
      input: 'What did I just tell you about cats?',
      expect: {
        responseContainsAny: ['cat', 'animal'],
        maxDurationMs: 30_000,
      },
    },
  ],
};

export default beliefFormation;
