import { createScenarioSpec } from '../harness';

/**
 * The autonomy loop under the determinism gate (CORE.19 C8.4). `stepping` is
 * caller-driven, so the heartbeat, curiosity and consolidation policies run only
 * on `autonomyTick()`; the injected clock freezes the wall-clock window, so the
 * only bound in play is the cycle budget. Two seeded runs must agree on every id
 * and on the state hash.
 */
export const autonomySteppingScenario = createScenarioSpec({
  name: 'autonomy-stepping',
  seed: 4242,
  clockStart: 1000000,
  config: {
    autonomy: {
      enabled: true,
      mode: 'stepping',
      maxCyclesPerWindow: 20,
      policies: { heartbeat: true, curiosity: true, consolidation: true },
      curiosity: { maxConfidence: 0.99, maxQuestionsPerWindow: 5 },
      consolidation: { intervalCycles: 1 },
    },
  },
  steps: [
    { type: 'input', text: '(a --> b).', taskType: 'belief', truth: { f: 0.5, c: 0.5 } },
    { type: 'input', text: '(b --> c).', taskType: 'belief', truth: { f: 0.5, c: 0.5 } },
    { type: 'autonomy', ticks: 6 },
    {
      type: 'assert',
      check: (trace) => {
        const channels = trace.events.map((event) => event.channel);
        if (!channels.some((channel) => channel.startsWith('autonomy:'))) {
          throw new Error('expected the autonomy loop to announce at least one event');
        }
      },
    },
  ],
});
