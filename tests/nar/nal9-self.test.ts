import { describe, expect, test } from '@jest/globals';
import { NALExtendedRules, TermBuilder } from '../../nar/src';

describe('NAL9 Self/Control Rules', () => {
  const { inheritance, operation, predictive: _predictive, similarity, atom } = TermBuilder;

  // DISABLED: BOT7 §1.1 — embeds operations in inheritance predicates
  describe('strategyEffectiveness', () => {
    test('is disabled to prevent operation misuse', () => {
      expect(NALExtendedRules.strategyEffectiveness).toBeUndefined();
    });
  });

  // DISABLED: BOT7 §1.1 — embeds operations in inheritance predicates
  describe('resourceAllocation', () => {
    test('is disabled to prevent operation misuse', () => {
      expect(NALExtendedRules.resourceAllocation).toBeUndefined();
    });
  });

  // DISABLED: BOT7 §1.1 — creates spurious predictive negations
  describe('errorPatternDetection', () => {
    test('is disabled to prevent spurious predictive negations', () => {
      expect(NALExtendedRules.errorPatternDetection).toBeUndefined();
    });
  });

  // DISABLED: BOT7 §1.1 — embeds operations in inheritance predicates
  describe('utilityEstimation', () => {
    test('is disabled to prevent operation misuse', () => {
      expect(NALExtendedRules.utilityEstimation).toBeUndefined();
    });
  });

  // DISABLED: BOT7 §1.1 — produces operations as subject/predicate
  describe('metacognitiveRevision', () => {
    test('is disabled to prevent operation misuse', () => {
      expect(NALExtendedRules.metacognitiveRevision).toBeUndefined();
    });
  });

  // DISABLED: BOT7 §1.1 — produces operations inside similarity
  describe('selfModelConsistency', () => {
    test('is disabled to prevent operation misuse', () => {
      expect(NALExtendedRules.selfModelConsistency).toBeUndefined();
    });
  });

  describe('metacognitive term creation', () => {
    test('creates operation terms for metacognition', () => {
      const meta = operation(atom('meta'), atom('analyze'));
      expect(meta.toString()).toBe('(meta ^ analyze)');
    });

    test('handles complex metacognitive structures', () => {
      const self = atom('self');
      const model = operation(atom('model'), self);
      const consistency = similarity(model, operation(atom('reality'), atom('check')));

      expect(consistency.toString()).toContain('<->');
    });
  });
});
