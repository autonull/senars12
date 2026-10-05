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

describe('Golden characterization scenarios (Tier 1)', () => {
  for (const scenario of GOLDEN_SCENARIOS) {
    it(`runs deterministically: ${scenario.name}`, async () => {
      const run1 = await runScenario(scenario);
      const run2 = await runScenario(scenario);

      expect(run1.passed).toBe(true);
      expect(run2.passed).toBe(true);

      expect(run1.trace.stateHash).toBe(run2.trace.stateHash);
      expect(run1.trace.tasks.length).toBe(run2.trace.tasks.length);
      expect(run1.trace.derivations.length).toBe(run2.trace.derivations.length);
      expect(run1.trace.budgetEvents.length).toBe(run2.trace.budgetEvents.length);
      expect(run1.trace.adaptations.length).toBe(run2.trace.adaptations.length);

      for (let i = 0; i < run1.trace.tasks.length; i++) {
        expect(run1.trace.tasks[i]).toEqual(run2.trace.tasks[i]);
      }
      for (let i = 0; i < run1.trace.derivations.length; i++) {
        expect(run1.trace.derivations[i]).toEqual(run2.trace.derivations[i]);
      }
      for (let i = 0; i < run1.trace.budgetEvents.length; i++) {
        expect(run1.trace.budgetEvents[i]).toEqual(run2.trace.budgetEvents[i]);
      }
      for (let i = 0; i < run1.trace.adaptations.length; i++) {
        expect(run1.trace.adaptations[i]).toEqual(run2.trace.adaptations[i]);
      }
    }, 30000);
  }
});

describe('Golden scenario snapshots', () => {
  for (const scenario of GOLDEN_SCENARIOS) {
    it(`produces stable snapshot: ${scenario.name}`, async () => {
      const result = await runScenario(scenario);
      expect(result.passed).toBe(true);
      expect(result.trace.stateHash).toBeTruthy();
    }, 30000);
  }
});
