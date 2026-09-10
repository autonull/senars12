import { describe, expect, it } from 'vitest';
import { locateSpan, toFormalizationBatch } from '../../nar/src/nl/understanding.js';

const meta = { detectedIntent: 'learning' as const, ambiguities: [], coreferences: [], implicitContext: [] };

describe('todo7: per-candidate source spans', () => {
  it('locateSpan finds verbatim substrings; falls back to whole input', () => {
    expect(locateSpan('Cats are mammals. Dogs bark.', 'Dogs bark.')).toEqual({ start: 18, end: 28, text: 'Dogs bark.' });
    expect(locateSpan('abc', 'missing')).toEqual({ start: 0, end: 3, text: 'abc' });
    expect(locateSpan('abc')).toEqual({ start: 0, end: 3, text: 'abc' });
    expect(locateSpan('abc', '')).toEqual({ start: 0, end: 3, text: 'abc' });
  });
  it('candidates carry narrowed spans and span-local flags', () => {
    const input = 'Cats may be mammals. Dogs bark.';
    const batch = toFormalizationBatch(input, {
      beliefs: [
        { narsese: '(cat --> mammal)', source: 'user', sourceText: 'Cats may be mammals.' },
        { narsese: '(dog --> barker)', source: 'user', sourceText: 'Dogs bark.' },
      ],
      questions: [], goals: [], meta,
    });
    const [modal, plain] = batch.candidates;
    expect(modal?.sourceSpans).toEqual([{ start: 0, end: 20, text: 'Cats may be mammals.' }]);
    expect(plain?.sourceSpans).toEqual([{ start: 21, end: 31, text: 'Dogs bark.' }]);
    expect(modal?.ambiguityFlags.map((f) => f.type)).toContain('modal');
    expect(plain?.ambiguityFlags.map((f) => f.type)).not.toContain('modal');
  });
  it('items without sourceText keep whole-input span (backward compatible)', () => {
    const batch = toFormalizationBatch('Cats sleep.', {
      beliefs: [{ narsese: '(cat --> sleeper)', source: 'user' }],
      questions: [], goals: [], meta,
    });
    expect(batch.candidates[0]?.sourceSpans).toEqual([{ start: 0, end: 11, text: 'Cats sleep.' }]);
  });
});
