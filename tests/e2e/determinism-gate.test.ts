import { describe, it, expect } from 'vitest';
import { runScenario } from './harness';
import { beliefDerivationAskScenario } from './scenarios/belief-derivation-ask.scenario';
import { goalToolFeedbackScenario } from './scenarios/goal-tool-feedback.scenario';
import { contradictionDriveAdaptationScenario } from './scenarios/contradiction-drive-adaptation.scenario';
import { questionPrologResolutionScenario } from './scenarios/question-prolog-resolution.scenario';
import { lmRuleFallbackScenario } from './scenarios/lm-rule-fallback.scenario';

const GOLDEN_SCENARIOS = [
  beliefDerivationAskScenario,
  goalToolFeedbackScenario,
  contradictionDriveAdaptationScenario,
  questionPrologResolutionScenario,
  lmRuleFallbackScenario,
];

/**
 * Determinism gate: runs each golden scenario N times and verifies
 * all runs produce byte-identical state hashes.
 * This is the CI gate that enforces C27 (whole-system determinism).
 */
describe('Determinism gate (C27)', () => {
  const RUNS = 2; // CI runs each scenario twice

  for (const scenario of GOLDEN_SCENARIOS) {
    it(`produces identical traces across ${RUNS} runs: ${scenario.name}`, async () => {
      const traces: string[] = [];

      for (let i = 0; i < RUNS; i++) {
        const result = await runScenario(scenario);
        expect(result.passed).toBe(true);
        expect(result.trace.stateHash).toBeTruthy();
        traces.push(result.trace.stateHash);
      }

      // All runs must produce identical state hashes
      const firstHash = traces[0];
      for (let i = 1; i < traces.length; i++) {
        expect(traces[i]).toBe(firstHash);
      }
    }, 60000);
  }
});

/**
 * Quarantine protocol: if a scenario fails determinism check,
 * it's marked for investigation rather than failing the build immediately.
 * This test can be run separately to identify flaky scenarios.
 */
describe('Determinism quarantine check', () => {
  for (const scenario of GOLDEN_SCENARIOS) {
    it(`quarantine check: ${scenario.name}`, async () => {
      const result = await runScenario(scenario);
      expect(result.passed).toBe(true);
      expect(result.trace.stateHash).toBeTruthy();
    }, 30000);
  }
});
