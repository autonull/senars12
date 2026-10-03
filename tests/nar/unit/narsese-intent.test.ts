import { describe, expect, it } from 'vitest';

import { classify, dispatchNarseseIntent } from '@senars/nar/nl';
import { termParser } from '@senars/nar/terms';

describe('the Narsese ingress router', () => {
  it('names the kind from the punctuation', () => {
    expect(dispatchNarseseIntent('(cat --> animal).')).toEqual({ kind: 'belief', text: '(cat --> animal).' });
    expect(dispatchNarseseIntent('(cat --> animal)!')).toEqual({ kind: 'goal', text: '(cat --> animal)!' });
    expect(dispatchNarseseIntent('(whiskers --> ?what)?')).toEqual({ kind: 'question', text: '(whiskers --> ?what)?' });
  });

  it('strips a tense marker the term parser rejects', () => {
    expect(dispatchNarseseIntent('(cat --> animal). :!:', )).toEqual({ kind: 'belief', text: '(cat --> animal).' });
  });

  it('the classifier and the router cannot disagree about the same utterance', () => {
    for (const text of ['(cat --> animal).', '(cat --> animal)!', '(a ==> b)?', '{a --> b}.', 'hello world.']) {
      const intent = dispatchNarseseIntent(text);
      const classified = classify(text);
      if (!intent) {
        expect(classified, text).toBe('nl-implicit');
        continue;
      }
      expect(classified, text).toBe(intent.kind === 'question' ? 'narsese-question' : 'narsese-belief');
    }
  });

  it('Narsese-shaped text the parser rejects goes to the LM path, not to a throw', () => {
    expect(() => termParser.parse('{a --> b}.')).toThrow();
    expect(dispatchNarseseIntent('{a --> b}.')).toBeNull();
  });

  it('routes a statement that only parses once a punctuation is supplied', () => {
    expect(dispatchNarseseIntent('(cat --> animal)')).toEqual({
      kind: 'belief',
      text: '(cat --> animal)',
    });
  });

  it('says "not Narsese" for prose rather than throwing', () => {
    expect(dispatchNarseseIntent('the robin is a bird')).toBeNull();
  });
});
