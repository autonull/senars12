import { CognitiveController, createDefaultRegistry } from '@senars/nar/cognitive';
import { DEFAULT_COGNITIVE_PARAMETERS, type CognitiveParameters } from '@senars/nar/config/cognitive-parameters';
import { MetricsCollector } from '@senars/nar/metrics';
import { RuleProcessor } from '@senars/nar/rules';
import { createRulePattern, type RegisteredRule } from '@senars/nar/rules/types';
import { TermBuilder, getPredicate, getSubject, termsEqual } from '@senars/nar/terms';
import { Truth } from '@senars/nar/terms/impls/Truth.js';
import type { Memory } from '@senars/nar/memory';
import type { RLFPLearner } from '@senars/nar/rlfp';

/**
 * A real `CognitiveController` over a real `RuleProcessor` with no rules
 * registered, so `processSync`/`processLMRules` yield nothing.
 *
 * The tests that used this passed a `Reasoner` built on a hand-rolled mock
 * processor and a hard-coded `BagStrategy` — which is how a NAR built without a
 * registry quietly ignored its configured premise strategy for years. Nothing
 * here is mocked: the controller resolves real strategies from a real registry,
 * and the assertions are about the execution loop around it.
 */
export const createTestController = (
  memory: Memory,
  params: CognitiveParameters = DEFAULT_COGNITIVE_PARAMETERS,
  rlfp?: RLFPLearner,
  processor: RuleProcessor = new RuleProcessor()
): CognitiveController =>
  new CognitiveController(
    createDefaultRegistry(),
    memory,
    processor,
    new MetricsCollector(),
    rlfp,
    params
  );

/**
 * Transitive inheritance: `(a-->b)` and `(b-->c)` give `(a-->c)`.
 *
 * A fresh `RuleProcessor` loads the NAL rules by module side effect, which is
 * convenient but not something a test should depend on — the rule it needs is
 * named here so the assertion is about the inference loop, not about which
 * built-in rules happen to be registered. `apply` receives the two matched
 * premises whole, so the guard (shared middle term) lives here rather than
 * being implied by the pattern.
 */
export const transitivity = (): RegisteredRule => ({
  id: 'test:transitivity',
  pattern: createRulePattern('inheritance', 'inheritance'),
  apply: ([left, right]) => {
    const [s1, p1] = [getSubject(left), getPredicate(left)];
    const [s2, p2] = [getSubject(right), getPredicate(right)];
    return s1 && p1 && s2 && p2 && termsEqual(p1, s2) ? TermBuilder.inheritance(s1, p2) : undefined;
  },
  sync: true,
  priority: 1,
  truthFn: Truth.deduction,
});

/** The defaults with a derivation-depth and throttle override, as the controller reads them. */
export const inferenceParams = (
  maxDerivationDepth: number,
  cpuThrottleMs = 0
): CognitiveParameters => ({
  ...structuredClone(DEFAULT_COGNITIVE_PARAMETERS),
  inference: { ...DEFAULT_COGNITIVE_PARAMETERS.inference, maxDerivationDepth, cpuThrottleMs },
});
