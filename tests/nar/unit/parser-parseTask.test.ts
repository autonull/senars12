import {describe, it, expect} from '@jest/globals';
import {termParser} from '../../../src/nar/terms/index.js';

describe('termParser.parseTask()', () => {
    it('parses (cat --> animal). as belief', () => {
        const r = termParser.parseTask('(cat --> animal).');
        expect(r).not.toBeNull();
        expect(r!.taskType).toBe('belief');
        expect(r!.punctuation).toBe('.');
        expect(r!.term.toString()).toContain('cat');
    });

    it('parses (cat --> ?)? as question', () => {
        const r = termParser.parseTask('(cat --> ?)?');
        expect(r).not.toBeNull();
        expect(r!.taskType).toBe('question');
        expect(r!.punctuation).toBe('?');
    });

    it('parses (call_mom)! as goal', () => {
        const r = termParser.parseTask('(call_mom)!');
        expect(r).not.toBeNull();
        expect(r!.taskType).toBe('goal');
        expect(r!.punctuation).toBe('!');
    });

    it('parses (;do) as command', () => {
        const r = termParser.parseTask('(do);');
        expect(r).not.toBeNull();
        expect(r!.taskType).toBe('command');
        expect(r!.punctuation).toBe(';');
    });

    it('parses with truth values: (cat --> animal). %0.9;0.8%', () => {
        const r = termParser.parseTask('(cat --> animal). %0.9;0.8%');
        expect(r).not.toBeNull();
        expect(r!.taskType).toBe('belief');
        expect(r!.truth).toBeDefined();
        expect(r!.truth!.f).toBeCloseTo(0.9);
        expect(r!.truth!.c).toBeCloseTo(0.8);
    });

    it('returns null for natural language', () => {
        expect(termParser.parseTask('hello world')).toBeNull();
        expect(termParser.parseTask('what is a cat?')).toBeNull();
    });

    it('returns null for empty input', () => {
        expect(termParser.parseTask('')).toBeNull();
        expect(termParser.parseTask('   ')).toBeNull();
    });

    it('returns null for invalid Narsese', () => {
        expect(termParser.parseTask('(unclosed')).toBeNull();
        expect(termParser.parseTask('(a --> b)X')).toBeNull();
    });
});
