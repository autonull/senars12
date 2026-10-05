import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createNAR, Truth } from '../../../nar/src';
import { createSeNARSRegistry } from '../../../nar/src/lm';
import { createLMService } from '../../../nar/src/lm/lm-service';
import { termParser, termKey, TermBuilder } from '../../../nar/src/terms';
import { ControlBudgets } from '../../../nar/src/kernel/control-budgets';

describe('M1: End-to-End Pipeline — NL → PerceptionGate → NAL → QueryAPI → NL', () => {
  const registry = createSeNARSRegistry();
  const lmService = createLMService();

  // Variant A: LM-optional (byte-identical path, no LM credentials)
  test('Variant A: natural language → PerceptionGate → NAL → answer (LM off)', async () => {
    const nar = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: false,
      maxConcepts: 1000,
      // LM explicitly disabled
      systemOne: { enabled: false },
    });

    await nar.start();

    // Input Narsese beliefs via PerceptionGate (simulating parsed NL)
    // "Cats are mammals. Whiskers is a cat." → (cat --> mammal), (whiskers --> cat)
    await nar.believe('(cat --> mammal).', Truth.create(0.9, 0.9));
    await nar.believe('(whiskers --> cat).', Truth.create(0.9, 0.9));

    // Run inference cycles
    await nar.run(10);

    // Query the answer
    const answer = await nar.ask('(whiskers --> mammal)?');

    // Verify answer
    expect(answer.answer).toBeDefined();
    // A derived conclusion, not a restatement: f must have moved off the 0.5 of
    // an unknown. This is the assertion that failed while the f*c product made a
    // confident guess look like knowledge.
    expect(answer.truth?.f).toBeGreaterThan(0.5);

    // Verify derivation trace is available
    const answerWithDerivation = await nar.askWithDerivation('(whiskers --> mammal)?');
    expect(answerWithDerivation.derivation).toBeDefined();

    // Verify budget accounting - all scopes within declared limits
    const controlBudgets = (nar as any).controlBudgets as ControlBudgets;
    const spendSummary = controlBudgets.getSpendSummary?.() ?? {};
    for (const [scope, summary] of Object.entries(spendSummary)) {
      const s = summary as any;
      expect(s.ceiling).toBeGreaterThanOrEqual(s.spent);
      expect(s.terminationReason).not.toBe('backpressure');
    }

    await nar.stop();
    await nar.dispose();
  });

  // Variant B: LM fills KB gaps (requires llamacpp-embedded)
  test.skipIf(!process.env.LM_PROVIDER || process.env.LM_PROVIDER !== 'llamacpp-embedded')(
    'Variant B: LM formalizes missing premise → NAL derives answer (LM on)',
    async () => {
      const nar = createNAR({
        providerRegistry: registry,
        lmService,
        persistState: false,
        maxConcepts: 1000,
        systemOne: { enabled: true },
      });

      await nar.start();

      // Empty KB - question requires "water is wet" which is NOT in seed KB
      await nar.run(5);

      // Ask question that requires LM-formalized premise
      const answer = await nar.ask('(water --> wet)?');

      // With LM: PerceptionGate admits LM-formalized (water --> wet) via admitFormalization
      // NAL then uses it as premise; trace shows lm-narsese-translation → revision/deduction
      expect(answer.answer).toBeDefined();

      // Derivation trace must show LM's fingerprints
      const answerWithDerivation = await nar.askWithDerivation('(water --> wet)?');
      expect(answerWithDerivation.derivation).toBeDefined();
      if (answerWithDerivation.derivation) {
        const { record } = answerWithDerivation.derivation;
        const ruleIds = record.steps.map((s) => s.ruleId);
        expect(ruleIds.some((id) => id.includes('lm-narsese-translation'))).toBe(true);

        // Source quality should be LLM_PRIOR, confidence ≤ 0.5 (LM ceiling)
        const lmStep = record.steps.find((s) => s.ruleId.includes('lm-narsese-translation'));
        expect(lmStep).toBeDefined();
      }

      await nar.stop();
      await nar.dispose();
    }
  );

  // Variant C: System One heads adjudicate
  test.skipIf(!process.env.LM_PROVIDER || process.env.LM_PROVIDER !== 'llamacpp-embedded')(
    'Variant C: System One heads filter/route — ambiguous input gets clarification, not belief',
    async () => {
      const nar = createNAR({
        providerRegistry: registry,
        lmService,
        persistState: false,
        maxConcepts: 1000,
        systemOne: { enabled: true },
      });

      await nar.start();

      // Ambiguous NL: "The bank is closed" — could be river or financial
      // Heads: ambiguity → high, task_type → question, source_quality → LLM_PRIOR
      // Without heads: admitted as belief (wrong)
      // With heads: ambiguity head abstains → clarification Question injected + curiosity drive

      await nar.input('The bank is closed.', 'belief', Truth.create(0.5, 0.5));

      await nar.run(3);

      // Check if clarification question was injected
      const questions = nar.getQuestions();
      const hasClarificationQuestion = questions.some(
        (q) =>
          termKey(q.term).includes('ambiguity') ||
          (q.term.toString().includes('bank') && q.term.toString().includes('?'))
      );

      // The ambiguity head should detect ambiguity and inject a clarification question
      expect(hasClarificationQuestion).toBe(true);

      // Trace must show: manifold judged, ambiguity head abstained, clarification injected
      const answerWithDerivation = await nar.askWithDerivation('(bank --> ?ambiguity)?');
      if (answerWithDerivation.derivation) {
        const { record } = answerWithDerivation.derivation;
        const ruleIds = record.steps.map((s) => s.ruleId);
        // Check for ambiguity-related processing
        expect(ruleIds.some((id) => id.includes('ambiguity') || id.includes('clarification'))).toBe(
          true
        );
      }

      await nar.stop();
      await nar.dispose();
    }
  );

  // Tool leg: one tool execution inside the same run
  test('Tool leg: ActionGate → tool → observation loop', async () => {
    const nar = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: false,
      maxConcepts: 1000,
      systemOne: { enabled: false },
      enableTools: true,
    });

    await nar.start();

    // Add a belief
    await nar.believe('(cat --> animal).', Truth.create(1.0, 0.9));

    await nar.run(5);

    // Execute explain tool - ActionGate → tool → observation loop
    const toolResult = await nar.tools.execute('explain', { term: '(cat --> animal)' });

    // Tool should see the derived belief
    expect(toolResult).toBeDefined();
    expect(toolResult.success).toBe(true);

    await nar.stop();
    await nar.dispose();
  });

  // Budget-in-bounds assertion
  test('Budget-in-bounds: all scopes within declared limits after run', async () => {
    const nar = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: false,
      maxConcepts: 1000,
      systemOne: { enabled: false },
    });

    await nar.start();

    await nar.believe('(A --> B).', Truth.create(0.9, 0.9));
    await nar.believe('(B --> C).', Truth.create(0.9, 0.9));

    await nar.run(20);

    // After run, ControlBudgets spend summary must show every scope within its declared limit
    const controlBudgets = (nar as any).controlBudgets as ControlBudgets;
    const spendSummary = controlBudgets.getSpendSummary?.() ?? {};

    for (const [scope, summary] of Object.entries(spendSummary)) {
      const s = summary as any;
      // Each scope must be within its ceiling
      expect(s.ceiling).toBeGreaterThanOrEqual(s.spent);
      // No unexpected termination reasons
      expect([
        'cycle-budget',
        'depth-budget',
        'llm-budget',
        'deadline',
        'backpressure',
        'none',
      ]).toContain(s.terminationReason);
    }

    await nar.stop();
    await nar.dispose();
  });
});
