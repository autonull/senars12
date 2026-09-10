import { describe, expect, it } from 'vitest';
import { verifyRecord } from '../../scripts/verify-derivation.js';
import type { DerivationRecord } from '@senars/kernel/schemas';

const taskId = '11111111-1111-4111-8111-111111111111';
const step = (overrides: Record<string, unknown>): DerivationRecord['steps'][number] => ({
  stepId: '22222222-2222-4222-8222-222222222222',
  ruleId: 'deduction',
  ruleCategory: 'logic',
  premises: ['(a --> b)', '(b --> c)'],
  conclusion: '(a --> c)',
  truth: { frequency: 0.72, confidence: 0.72 },
  premiseTruths: [
    { frequency: 0.8, confidence: 0.9 },
    { frequency: 0.9, confidence: 0.8 },
  ],
  evidenceLineage: [taskId],
  independence: 'independent',
  ...overrides,
} as DerivationRecord['steps'][number]);

const record = (steps: DerivationRecord['steps'], finalTruth = { frequency: 0.72, confidence: 0.72 }): DerivationRecord => ({
  derivationId: '33333333-3333-4333-8333-333333333333',
  taskId,
  goalTerm: '(a --> c)',
  steps,
  finalTruth,
  totalCycles: 1,
  maxDepthReached: 1,
  timestamp: Date.now(),
  engine: 'nar',
});

describe('standalone derivation verifier', () => {
  it('accepts a valid deduction record', () => {
    const result = verifyRecord(record([step({})]));
    expect(result.passed).toBe(true);
    expect(result.truthVerified).toBe(1);
  });

  it('rejects tampered truth values', () => {
    const bad = step({ truth: { frequency: 0.99, confidence: 0.99 } });
    const result = verifyRecord(record([bad], { frequency: 0.99, confidence: 0.99 }));
    expect(result.passed).toBe(false);
    expect(result.findings.some((f) => f.check === 'truth-algebra')).toBe(true);
  });

  it('verifies revision and negation algebra', () => {
    const revision = step({
      stepId: '44444444-4444-4444-8444-444444444444',
      ruleId: 'revision',
      ruleCategory: 'core',
      truth: { frequency: 9.6 / 13, confidence: 13 / 14 },
      premiseTruths: [
        { frequency: 0.8, confidence: 0.9 },
        { frequency: 0.6, confidence: 0.8 },
      ],
    });
    const negation = step({
      stepId: '55555555-5555-4555-8555-555555555555',
      ruleId: 'negation-intro',
      ruleCategory: 'propositional',
      premises: ['(a --> b)'],
      conclusion: '(- (a --> b))',
      truth: { frequency: 0.2, confidence: 0.9 },
      premiseTruths: [{ frequency: 0.8, confidence: 0.9 }],
      evidenceLineage: ['44444444-4444-4444-8444-444444444444'],
    });
    const result = verifyRecord(record([revision, negation], { frequency: 0.2, confidence: 0.9 }));
    expect(result.findings).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it('flags revision with unknown independence', () => {
    const result = verifyRecord(record([step({ ruleId: 'revision', independence: 'unknown' })]));
    expect(result.findings.some((f) => f.check === 'evidence-independence')).toBe(true);
  });

  it('flags dangling lineage and final-truth mismatch', () => {
    const dangling = step({ evidenceLineage: ['99999999-9999-4999-8999-999999999999'] });
    const result = verifyRecord(record([dangling], { frequency: 0.1, confidence: 0.1 }));
    expect(result.findings.some((f) => f.check === 'lineage-dag')).toBe(true);
    expect(result.findings.some((f) => f.check === 'final-truth')).toBe(true);
  });

  it('flags bad substitutions, passes unknown rules unless strict', () => {
    const badSub = step({
      substitution: { '?x': 'robin' },
      conclusion: '(tweety --> bird)',
    });
    const unknownRule = step({
      stepId: '66666666-6666-4666-8666-666666666666',
      ruleId: 'future-hyper-rule',
      truth: { frequency: 0.72, confidence: 0.72 },
    });
    const lax = verifyRecord(record([badSub, unknownRule]));
    expect(lax.findings.some((f) => f.check === 'substitution-premise')).toBe(true);
    expect(lax.findings.some((f) => f.check === 'unknown-rule')).toBe(false);
    const strict = verifyRecord(record([unknownRule], { frequency: 0.72, confidence: 0.72 }), { strict: true });
    expect(strict.findings.some((f) => f.check === 'unknown-rule')).toBe(true);
  });
});
