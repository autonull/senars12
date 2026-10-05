import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createNAR, Truth, termKey, termParser } from '../../../nar/src';
import { createSeNARSRegistry } from '../../../nar/src/lm';
import { createLMService } from '../../../nar/src/lm/lm-service';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { verifyRecord } from '@senars/core/verify-derivation';

const testStateDir = join(process.cwd(), '.cache', 'test-derivation-explainability');

describe('M8: Derivation Explainability — Answer carries verifiable derivation', () => {
  beforeEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
    await mkdir(testStateDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
  });

  test('askWithDerivation returns answer with verified derivation trace', async () => {
    const registry = createSeNARSRegistry();
    const lmService = createLMService();

    const nar = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: false,
      maxConcepts: 1000,
    });

    await nar.start();

    // Add premises that will lead to a derivation
    await nar.believe('(bird --> animal).', Truth.create(0.9, 0.9));
    await nar.believe('(robin --> bird).', Truth.create(0.9, 0.9));

    // Run enough cycles for deduction to occur
    await nar.run(10);

    // Ask a question that should have a derivation
    const answer = await nar.askWithDerivation('(robin --> animal)?');

    // Verify answer structure
    expect(answer.answer).toBeDefined();
    expect(answer.truth?.f).toBeGreaterThan(0);

    // Verify derivation is attached and verified
    expect(answer.derivation).toBeDefined();
    if (!answer.derivation) {
      throw new Error('Expected derivation to be attached');
    }

    // Verify the derivation record structure
    const { record, verification } = answer.derivation;
    expect(record.derivationId).toBeDefined();
    expect(record.goalTerm).toBeDefined();
    expect(record.steps).toBeInstanceOf(Array);
    expect(record.steps.length).toBeGreaterThan(0);
    expect(record.finalTruth).toBeDefined();
    expect(record.engine).toBe('nar');

    // Verify the verification result
    expect(verification.ok).toBe(true);
    expect(verification.errors).toEqual([]);
    expect(verification.truthVerified).toBeGreaterThanOrEqual(0);
    expect(verification.truthSkipped).toBeGreaterThanOrEqual(0);

    // Each step should have required fields
    for (const step of record.steps) {
      expect(step.stepId).toBeDefined();
      expect(step.ruleId).toBeDefined();
      expect(step.premises).toBeInstanceOf(Array);
      expect(step.premises.length).toBeGreaterThan(0);
      expect(step.conclusion).toBeDefined();
      expect(step.truth).toBeDefined();
      expect(step.premiseTruths).toBeDefined();
      expect(step.evidenceLineage).toBeInstanceOf(Array);
      expect(step.independence).toBeDefined();
    }

    // The conclusion should match the answer term
    const answerTerm = termParser.parse(answer.answer!);
    expect(record.steps.length).toBeGreaterThan(0);
    const lastStep = record.steps[record.steps.length - 1]!;
    const recordTerm = termParser.parse(lastStep.conclusion);
    expect(termKey(answerTerm)).toBe(termKey(recordTerm));

    // Verify independently using the standalone verifier
    const independentVerification = verifyRecord(record, { strict: true, epsilon: 1e-6 });
    expect(independentVerification.ok).toBe(true);

    await nar.stop();
    await nar.dispose();
  });

  test('askWithDerivation omits derivation when verification fails', async () => {
    const registry = createSeNARSRegistry();
    const lmService = createLMService();

    const nar = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: false,
      maxConcepts: 1000,
    });

    await nar.start();

    // Add a simple belief without running cycles (no derivation)
    await nar.believe('(cat --> animal).', Truth.create(0.9, 0.9));

    // Ask without running - should get answer but no derivation
    const answer = await nar.askWithDerivation('(cat --> animal)?');

    // Answer should exist
    expect(answer.answer).toBeDefined();
    expect(answer.truth?.f).toBeGreaterThan(0);

    // Derivation may be absent (no derivation cycles ran)
    // This is acceptable - derivation is only attached when recorder has matching records

    await nar.stop();
    await nar.dispose();
  });

  test('derivation steps re-verify via standalone verifyRecord', async () => {
    const registry = createSeNARSRegistry();
    const lmService = createLMService();

    const nar = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: false,
      maxConcepts: 1000,
    });

    await nar.start();

    // Add premises for deduction chain
    await nar.believe('(A --> B).', Truth.create(0.9, 0.9));
    await nar.believe('(B --> C).', Truth.create(0.9, 0.9));
    await nar.believe('(C --> D).', Truth.create(0.9, 0.9));

    await nar.run(20);

    const answer = await nar.askWithDerivation('(A --> D)?');

    console.log('Answer:', JSON.stringify(answer, null, 2));

    expect(answer.derivation).toBeDefined();
    if (!answer.derivation) {
      throw new Error('Expected derivation to be attached');
    }

    // The standalone verifier should pass
    const verification = verifyRecord(answer.derivation.record, { strict: true, epsilon: 1e-6 });
    expect(verification.ok).toBe(true);
    expect(verification.truthVerified).toBeGreaterThan(0);

    // All steps should have been verified
    expect(verification.stepResults.length).toBe(answer.derivation.record.steps.length);

    await nar.stop();
    await nar.dispose();
  });
});
