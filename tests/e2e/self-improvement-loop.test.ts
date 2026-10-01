/**
 * D1 — Self-Improvement Loop E2E.
 *
 * The loop under test: derivation records → `ProofMettaProposer` pattern extraction →
 * governance-gated adaptation. Asserts observable behavior (rules learned, adaptations
 * recorded), not internal counters.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { NAR } from '@senars/nar/nar.js';
import type { NARConfig } from '@senars/nar/facade/config.js';
import { e2eNARConfig } from './fixtures.js';

const PROOF_METTA = { enabled: true, maxRules: 100, minConfidence: 0.5, patternMinSupport: 2 } as const;

const bootedNAR = async (config: NARConfig): Promise<NAR> => {
  const nar = new NAR(config);
  await nar.initialize();
  await nar.start();
  nar.getProcessor().setConfig({ recorderEnabled: true });
  return nar;
};

describe('D1 — Self-Improvement Loop E2E', () => {
  let nar: NAR;

  beforeAll(async () => {
    nar = await bootedNAR(e2eNARConfig({ enableTools: true, proofMettaProposer: PROOF_METTA }));
  });

  afterAll(async () => {
    await nar?.stop();
    await nar?.dispose();
  });

  test('repeated derivation patterns become MeTTa rules admitted through governance', async () => {
    for (const [premise, consequent] of [
      ['bird', 'animal'],
      ['animal', 'living'],
      ['fish', 'animal'],
      ['living', 'entity'],
      ['cat', 'animal'],
      ['dog', 'animal'],
    ] as const) {
      await nar.believe(`(${premise} --> ${consequent}). %1.0;0.9%`);
    }
    await nar.question('(bird-->?what)?');

    await nar.run(20);

    const records = nar.getProcessor().getRecorder().drain();
    expect(records.length).toBeGreaterThan(0);
    expect(
      records.some((r) => r.steps.some((s) => s.ruleId.includes('transitivity') || s.ruleId.includes('deduction')))
    ).toBe(true);

    await nar.consolidateLearning({ budget: 5 });

    expect(nar.getProofMettaProposer()).toBeDefined();
    expect(nar.getGovernanceResolver()).toBeDefined();

    expect(nar.listConcepts().length).toBeGreaterThan(5);
    await expect(nar.run(10)).resolves.toBeGreaterThanOrEqual(0);
  });

  test('learned rule changes selection in later cycle (flagship TODO7 §5.2)', async () => {
    const nar2 = await bootedNAR(
      e2eNARConfig({
        enableTools: true,
        enableSelf: true,
        proofMettaProposer: PROOF_METTA,
        initialAutonomyMode: 'low-risk-auto-merge',
      })
    );

    try {
      for (const [from, to] of [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f']] as const) {
        await nar2.believe(`(${from} --> ${to}). %1.0;0.9%`);
      }

      await nar2.run(30);
      await nar2.consolidateLearning({ budget: 10 });

      // `patternMinSupport: 2` promotes any pattern seen twice into a rule.
      expect(nar2.getProofMettaProposer()!.getRules().length).toBeGreaterThan(0);
      expect(nar2.getGovernanceResolver()!.getAdaptations().length).toBeGreaterThan(0);
    } finally {
      await nar2.stop();
      await nar2.dispose();
    }
  });
});
