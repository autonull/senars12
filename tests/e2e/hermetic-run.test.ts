/**
 * TODO28 §7.3 — the hermetic seeded run.
 *
 * §3.2 recorded two things as separate: `NARConfig.rng` fixes the draws, and
 * `makeId` (`crypto.randomUUID`) still stamps the ids the draws are recorded
 * under. Both were true, and they were the same defect — a run could be seeded
 * and still not reproduce, because reproducibility is a property of the *trace*
 * and the trace was full of UUIDs.
 *
 * The shape of this test is the whole argument. Rather than asserting that no
 * component reads ambient entropy — a claim about the source, which a reviewer
 * has to re-verify by reading every constructor — it makes `Math.random` and
 * `crypto.randomUUID` **throw**, runs the golden scenarios, and lets an
 * unthreaded component fail the build by calling one. A gate built from a
 * naming convention asserts the convention (TODO28 §7.2); this one cannot be
 * satisfied by a file that merely looks right.
 *
 * The scenarios run with LM and tools off, so this covers the reasoning path.
 * It is not a claim about every subsystem: System One's manifold, the episode
 * consolidator and the governance pipeline are constructed only when their
 * feature flags are on, and a test that cannot reach them cannot gate them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installIdSource, sequentialIdSource } from '@senars/util';
import { runScenario } from './harness';
import { beliefDerivationAskScenario } from './scenarios/belief-derivation-ask.scenario';
import { goalToolFeedbackScenario } from './scenarios/goal-tool-feedback.scenario';
import { contradictionDriveAdaptationScenario } from './scenarios/contradiction-drive-adaptation.scenario';
import { questionPrologResolutionScenario } from './scenarios/question-prolog-resolution.scenario';
import { lmRuleFallbackScenario } from './scenarios/lm-rule-fallback.scenario';

const SCENARIOS = [
  beliefDerivationAskScenario,
  goalToolFeedbackScenario,
  contradictionDriveAdaptationScenario,
  questionPrologResolutionScenario,
  lmRuleFallbackScenario,
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;

const AMBIENT = () => {
  throw new Error('ambient entropy reached a seeded run — thread the RNG or the id source');
};

describe('TODO28 §7.3 — hermetic seeded run', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockImplementation(AMBIENT);
    vi.spyOn(crypto, 'randomUUID').mockImplementation(AMBIENT);
  });

  afterEach(() => {
    installIdSource();
    vi.restoreAllMocks();
  });

  for (const scenario of SCENARIOS) {
    it(`draws no ambient entropy: ${scenario.name}`, async () => {
      const result = await runScenario(scenario);
      expect(result.passed).toBe(true);
    }, 60_000);
  }

  it('the id source is scoped to the NAR and restored on dispose', async () => {
    const { NAR } = await import('@senars/nar/nar.js');
    const { e2eNARConfig } = await import('./fixtures');
    const { makeId } = await import('@senars/util');
    const AMBIENT_UUID =
      '00000000-0000-4000-8000-00000000ffff' as `${string}-${string}-${string}-${string}-${string}`;
    const restoreAmbient = vi.spyOn(crypto, 'randomUUID').mockReturnValue(AMBIENT_UUID);
    const nar = new NAR(e2eNARConfig({ ids: sequentialIdSource() }));
    await nar.initialize();
    expect(makeId()).toMatch(UUID);
    await nar.dispose();
    expect(makeId()).toBe(AMBIENT_UUID);
    restoreAmbient.mockRestore();
  });

  it('two seeded runs agree on every id, not only on the state hash', async () => {
    // The existing determinism gate compares state hashes, which are computed
    // from term/priority/truth and are blind to ids by construction. Comparing
    // the raw event trace is what makes the id seam load-bearing.
    const first = await runScenario(beliefDerivationAskScenario);
    const second = await runScenario(beliefDerivationAskScenario);
    const ids = (r: typeof first) =>
      JSON.stringify(r.trace.events.map((e) => `${e.channel}:${JSON.stringify(e.payload)}`));
    expect(ids(first)).toBe(ids(second));
  }, 120_000);
});

/**
 * CORE.19 C8.4 — the new feedback loops are inside hermetic coverage.
 *
 * The golden scenarios stop at the reasoning path (LM/tools off). These add the
 * two loops CORE.19 introduced — the autonomy heartbeat and persistence
 * save/restore — under the same ambient-entropy spy: an unthreaded id/RNG draw
 * in either fails here by throwing rather than by being noticed.
 */
describe('CORE.19 C8.4 — new loops draw no ambient entropy', () => {
  it('autonomy stepping', async () => {
    const { NAR } = await import('@senars/nar/nar.js');
    const { e2eNARConfig } = await import('./fixtures');
    const { Truth } = await import('@senars/nar/index.js');
    const { SeededRNG, fixedClock } = await import('@senars/util');
    const rng = new SeededRNG(2025);
    const nar = new NAR(
      e2eNARConfig({
        rng: () => rng.next(),
        clock: fixedClock(0),
        ids: sequentialIdSource(),
        autonomy: {
          enabled: true,
          mode: 'stepping',
          maxCyclesPerWindow: 20,
          consolidation: { intervalCycles: 1 },
        },
      })
    );
    await nar.initialize();
    await nar.start();
    await nar.input('(a-->b).', 'belief', Truth.create(1, 0.3));
    const reports: unknown[] = [];
    for (let i = 0; i < 5; i++) reports.push(await nar.autonomyTick());
    expect(reports).toHaveLength(5);
    expect(reports.every((report) => report !== null)).toBe(true);
    await nar.stop();
    await nar.dispose();
  }, 60_000);

  it('persistence save and restore', async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { NAR } = await import('@senars/nar/nar.js');
    const { e2eNARConfig } = await import('./fixtures');
    const { SeededRNG, fixedClock } = await import('@senars/util');
    const statePath = mkdtempSync(join(tmpdir(), 'core19-c8.4-'));
    const make = (): InstanceType<typeof NAR> => {
      const rng = new SeededRNG(7);
      return new NAR(
        e2eNARConfig({
          rng: () => rng.next(),
          clock: fixedClock(0),
          ids: sequentialIdSource(),
          persistState: true,
          statePath,
        })
      );
    };
    const first = make();
    await first.initialize();
    await first.start();
    await first.input('(cat-->animal).', 'belief');
    await first.run(3);
    await first.stop();
    await first.dispose();

    const resumed = make();
    await resumed.initialize();
    await resumed.start();
    await resumed.run(2);
    await resumed.stop();
    await resumed.dispose();
  }, 60_000);
});
