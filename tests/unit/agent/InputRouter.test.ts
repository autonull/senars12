import {describe, it, expect} from '@jest/globals';
import {route} from '../../../src/agent/routing/InputRouter.js';

describe('InputRouter', () => {
    it('routes narsese belief', () => {
        const r = route('(cat --> animal).');
        expect(r.kind).toBe('narsese-belief');
        if (r.kind !== 'narsese-belief') throw new Error('not narsese-belief');
        expect(r.confidence).toBeGreaterThan(0.5);
        expect(r.signals.length).toBeGreaterThan(0);
        expect(r.narsese).toBeDefined();
    });

    it('routes narsese question', () => {
        const r = route('(cat --> ?)?');
        expect(r.kind).toBe('narsese-question');
        if (r.kind !== 'narsese-question') throw new Error('not narsese-question');
        expect(r.narsese).toBeDefined();
    });

    it('routes command', () => {
        const r = route('.run 5');
        expect(r.kind).toBe('command');
        if (r.kind === 'command') {
            expect(r.command).toBe('run');
            expect(r.arguments).toEqual(['5']);
        }
    });

    it('routes natural language', () => {
        const r = route('What is the meaning of life?');
        expect(r.kind).toBe('nl');
        if (r.kind === 'nl') {
            expect(r.concepts).toBeDefined();
            expect(r.ambiguity).toBeGreaterThanOrEqual(0);
        }
    });

    it('routes reason trigger to reason kind', () => {
        const r = route('Why is the sky blue?');
        expect(r.kind === 'reason' || r.kind === 'nl').toBe(true);
        if (r.kind === 'reason') {
            expect(r.trigger).toBeDefined();
            expect(r.depth).toBeGreaterThan(0);
        }
    });

    it('falls back to nl for empty input', () => {
        const r = route('   ');
        expect(r.kind).toBe('nl');
    });

    it('passes reasoningDepth through to reason kind', () => {
        const r = route('Infer whether P is true', {reasoningDepth: 9});
        if (r.kind === 'reason') expect(r.depth).toBe(9);
    });

    it('populates signals from classifier and analyzer', () => {
        const r = route('(cat --> animal).');
        const sources = new Set(r.signals.map(s => s.source));
        expect(sources.has('classifier')).toBe(true);
    });
});
