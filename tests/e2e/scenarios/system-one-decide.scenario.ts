import { createScenarioSpec } from '../harness';

/**
 * System One's decision path under the determinism/hermetic gates (CORE.19 C8.4).
 *
 * No golden scenario drove the manifold, so the one subsystem with a real
 * encoder was outside both gates. Here System One is enabled (the embedder
 * resolves to the mock in CI and to the real GGUF locally — both deterministic),
 * the kernel advances, and a `decide` call runs the manifold end-to-end. Two
 * seeded runs must agree on the projected decision; under the hermetic spy an
 * unthreaded ambient draw in the manifold or embedder fails by throwing.
 */
export const systemOneDecideScenario = createScenarioSpec({
  name: 'system-one-decide',
  seed: 6060,
  clockStart: 7000000,
  config: {
    systemOne: { enabled: true },
  },
  steps: [
    { type: 'input', text: '(cat --> animal).', taskType: 'belief', truth: { f: 1, c: 0.9 } },
    { type: 'input', text: '(animal --> living).', taskType: 'belief', truth: { f: 1, c: 0.9 } },
    { type: 'run', cycles: 3 },
    {
      type: 'decide',
      context: 'the cat sat on the mat',
      queries: [
        {
          kind: 'evaluate',
          instruction: 'is the context grounded in the accepted beliefs',
          rubric: 'groundedness',
          axis: 'epistemic',
        },
        {
          kind: 'evaluate',
          instruction: 'is the context plausible',
          rubric: 'plausibility',
          axis: 'epistemic',
        },
      ],
    },
    {
      type: 'assert',
      check: (trace) => {
        if (trace.decisions.length !== 1) throw new Error('expected one decision');
        const decision = trace.decisions[0]!;
        if (decision.verdicts.length !== 2) throw new Error('expected a verdict per query');
        if (!/^[0-9a-f]{64}$/.test(decision.inputDigest)) throw new Error('missing input digest');
      },
    },
  ],
});
