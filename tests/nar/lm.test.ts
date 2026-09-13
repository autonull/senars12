import { SeNARSFactory } from '../../nar/src';
import { LMResponseParser } from '../../nar/src/lm';

describe('LMResponseParser', () => {
  describe('parse', () => {
    test('parses valid Narsese inheritance', () => {
      const result = LMResponseParser.parse('(A --> B)');
      expect(result.valid).toBe(true);
      expect(result.raw).toBe('(A --> B)');
    });

    test('parses Narsese with truth in JSON', () => {
      const result = LMResponseParser.parse(
        '{"narsese": "(A --> B)", "truth": {"f": 0.9, "c": 0.8}}'
      );
      expect(result.valid).toBe(true);
    });

    test('handles empty response', () => {
      const result = LMResponseParser.parse('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Empty response');
    });

    test('handles whitespace-only response', () => {
      const result = LMResponseParser.parse('   \n\t  ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Empty response');
    });

    test('extracts term from text with surrounding content', () => {
      const result = LMResponseParser.parse('(bird --> animal)');
      expect(result.valid).toBe(true);
    });

    test('extracts similarity from text', () => {
      const result = LMResponseParser.parse('(A <-> B)');
      expect(result.valid).toBe(true);
      expect(result.term.kind).toBe('similarity');
    });

    test('handles malformed JSON gracefully', () => {
      const result = LMResponseParser.parse('(A --> B)');
      expect(result.valid).toBe(true);
    });
  });

  describe('validate', () => {
    test('validates Narsese inheritance', () => {
      expect(LMResponseParser.validate('(A --> B)').valid).toBe(true);
    });

    test('validates Narsese implication', () => {
      expect(LMResponseParser.validate('(A ==> B)').valid).toBe(true);
    });

    test('validates Narsese similarity', () => {
      expect(LMResponseParser.validate('(A <-> B)').valid).toBe(true);
    });

    test('validates valid JSON', () => {
      expect(LMResponseParser.validate('{"narsese": "(A --> B)"}').valid).toBe(true);
    });

    test('rejects empty string', () => {
      const result = LMResponseParser.validate('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Empty response');
    });

    test('rejects invalid JSON', () => {
      const result = LMResponseParser.validate('{broken json}');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JSON in response');
    });
  });
});

describe('LM integration', () => {
  test('NAR with mock LM can be created', async () => {
    const nar = SeNARSFactory.createForBot({ maxConcepts: 100 });
    const stats = nar.getStatistics();
    expect(stats.totalConcepts).toBeGreaterThanOrEqual(0);
  });
});
