import { createScenarioSpec } from '../harness';

/**
 * The learning-maintenance pass under the determinism gate (CORE.19 C8.4).
 *
 * `consolidateLearning` is the only path that reaches the episode consolidator
 * and the governance pipeline (learned MeTTa rules → `GovernanceResolver`), so
 * the other golden scenarios never touch them. Two seeded runs must agree on the
 * state hash while those subsystems are live.
 */
export const consolidationGovernanceScenario = createScenarioSpec({
  name: 'consolidation-governance',
  seed: 5150,
  clockStart: 6000000,
  config: {
    enableTools: true,
    enableSelf: true,
    initialAutonomyMode: 'low-risk-auto-merge',
    episodeConsolidation: { enabled: true, capacity: 16, budget: 4 },
    proofMettaProposer: { enabled: true, maxRules: 50, minConfidence: 0.5, patternMinSupport: 2 },
  },
  steps: [
    { type: 'input', text: '(bird --> animal).', taskType: 'belief', truth: { f: 1, c: 0.9 } },
    { type: 'input', text: '(animal --> living).', taskType: 'belief', truth: { f: 1, c: 0.9 } },
    { type: 'input', text: '(fish --> animal).', taskType: 'belief', truth: { f: 1, c: 0.9 } },
    { type: 'input', text: '(living --> entity).', taskType: 'belief', truth: { f: 1, c: 0.9 } },
    { type: 'input', text: '(cat --> animal).', taskType: 'belief', truth: { f: 1, c: 0.9 } },
    { type: 'input', text: '(dog --> animal).', taskType: 'belief', truth: { f: 1, c: 0.9 } },
    { type: 'input', text: '(bird-->?what)?', taskType: 'question' },
    { type: 'run', cycles: 20 },
    { type: 'consolidate', budget: 10 },
    {
      type: 'assert',
      check: (trace) => {
        if (trace.cycleCount < 20) throw new Error('expected the scenario to advance the kernel');
      },
    },
  ],
});
