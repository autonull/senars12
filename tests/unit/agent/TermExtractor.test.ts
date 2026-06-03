import {describe, it, expect} from '@jest/globals';
import {extractTerms} from '../../../src/agent/request/TermExtractor.js';
import {SeNARSFactory} from '../../../src/nar/index.js';

describe('TermExtractor', () => {
    it('parses narsese atoms', () => {
        const r = extractTerms('(cat --> animal).');
        expect(r.parsed).toEqual(expect.arrayContaining(['cat', 'animal']));
    });

    it('falls back gracefully on plain text', () => {
        const r = extractTerms('Hello world');
        expect(r.parsed).toEqual([]);
        expect(r.fromConcepts).toEqual([]);
    });

    it('intersects parsed terms with live concepts when nar is given', async () => {
        const nar = SeNARSFactory.createDefault();
        await nar.input('(cat --> animal).');
        const r = extractTerms('(cat --> animal).', nar);
        expect(r.fromConcepts).toEqual(expect.arrayContaining(['(cat --> animal)']));
    });

    it('orders parsed terms by priority when nar is given', async () => {
        const nar = SeNARSFactory.createDefault();
        await nar.input('(cat --> animal).');
        await nar.input('(dog --> animal).');
        const r = extractTerms('(cat --> animal). (dog --> animal).', nar);
        expect(r.byPriority.length).toBeGreaterThanOrEqual(2);
        expect(r.byPriority).toEqual(expect.arrayContaining(['(cat --> animal)', '(dog --> animal)']));
    });
});
