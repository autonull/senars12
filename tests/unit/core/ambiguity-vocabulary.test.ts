import {
  AMBIGUITY_SEVERITIES,
  AMBIGUITY_SEVERITY,
  AMBIGUITY_TYPES,
  AmbiguityFlagSchema,
  AmbiguityReportSchema,
  ambiguitySeverityOf,
} from '@senars/core/schemas';
import { AmbiguitySchema, TaskBatchSchema } from '@senars/nar/nl/schemas';
import { detectAmbiguityFlags, toFormalizationBatch } from '@senars/nar/nl/understanding';
import { describe, expect, it } from 'vitest';

/**
 * An ambiguity is *what* was ambiguous; its severity is what the kernel thinks that
 * kind of ambiguity costs the parse.
 *
 * The two producers disagreed on both halves. The LM's schema named four of the
 * kernel's eight kinds, so quantifier/modal/temporal/negation ambiguity was
 * unreportable through the NL path — while `detectAmbiguityFlags`, which reads the
 * same four sentences a user actually types, reported exactly those four. And the LM
 * path declared no severity at all, so `toFormalizationBatch` supplied `'medium'`
 * for whatever the model had said: a negation the detector rates `high` was admitted
 * as `medium`, and a `low` one was inflated to match.
 */
const report = (type: string) => ({
  type,
  description: 'd',
  options: ['a', 'b'],
  confidence: 0.5,
});

describe('ambiguity vocabulary', () => {
  it('lets the LM report every kind the kernel weighs', () => {
    for (const type of AMBIGUITY_TYPES) {
      expect(AmbiguitySchema.safeParse(report(type)).success, type).toBe(true);
      expect(AmbiguityReportSchema.safeParse(report(type)).success, type).toBe(true);
      expect(AmbiguityFlagSchema.safeParse({ ...report(type), severity: 'low' }).success).toBe(
        true
      );
    }
  });

  it('carries no severity of its own, so the kernel weighs the kind', () => {
    const reported = AmbiguityReportSchema.safeParse(report('negation'));
    expect(reported.success && 'severity' in reported.data).toBe(false);
    // A severity the model volunteers is stripped rather than honoured: the field is
    // not in the report schema, so the kernel's own value is the only one that survives.
    const volunteered = AmbiguityReportSchema.safeParse({ ...report('negation'), severity: 'low' });
    expect(volunteered.success && 'severity' in volunteered.data).toBe(false);
  });

  it('weighs every kind, so a new kind cannot arrive unweighed', () => {
    expect(Object.keys(AMBIGUITY_SEVERITY).sort()).toEqual([...AMBIGUITY_TYPES].sort());
    for (const type of AMBIGUITY_TYPES) {
      expect(AMBIGUITY_SEVERITIES, type).toContain(ambiguitySeverityOf(type));
    }
    expect(ambiguitySeverityOf('negation')).toBe('high');
    expect(ambiguitySeverityOf('reference')).toBe('low');
  });

  it('rates what the detector finds, from the table rather than beside the pattern', () => {
    expect(detectAmbiguityFlags('Cats may eat unless served fish')).toEqual([
      expect.objectContaining({ type: 'negation', severity: 'high' }),
      expect.objectContaining({ type: 'modal', severity: 'medium' }),
    ]);
    for (const flag of detectAmbiguityFlags('all of them may arrive before noon, unless it rains'))
      expect(flag.severity).toBe(ambiguitySeverityOf(flag.type));
  });

  it('carries the severity its kind carries into the batch, not a hardcoded medium', () => {
    const batch = {
      beliefs: [{ narsese: '-->.', source: 'user' as const }],
      questions: [],
      goals: [],
      meta: {
        detectedIntent: 'chat' as const,
        ambiguities: [
          { ...report('negation'), confidence: 0.6, severity: 'low' },
          { ...report('reference'), confidence: 0.2, severity: 'high' },
        ] as never,
        coreferences: [],
        implicitContext: [],
      },
    };
    expect(TaskBatchSchema.safeParse(batch).success).toBe(true);

    const formalized = toFormalizationBatch('it was not the cat', batch);
    expect(formalized.globalAmbiguities?.map((a) => a.severity)).toEqual(['high', 'low']);
  });
});
