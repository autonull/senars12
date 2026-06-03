import {describe, it, expect, beforeEach} from '@jest/globals';
import {WorkingMemory, DEFAULT_TTLS} from '../../../src/agent/cognition/WorkingMemory.js';

describe('WorkingMemory — Phase 6 cognition (I7)', () => {
    let wm: WorkingMemory;

    beforeEach(() => {
        wm = new WorkingMemory();
    });

    it('sets and gets a slot', () => {
        wm.set('focus', 'cats');
        expect(wm.get('focus')).toBe('cats');
    });

    it('returns undefined for missing slots', () => {
        expect(wm.get('focus')).toBeUndefined();
    });

    it('clear() removes a slot', () => {
        wm.set('focus', 'cats');
        wm.clear('focus');
        expect(wm.get('focus')).toBeUndefined();
    });

    it('clearAll() removes every slot', () => {
        wm.set('focus', 'a');
        wm.set('goal', 'b');
        wm.append('evidence', 'e1');
        wm.clearAll();
        expect(wm.keys()).toEqual([]);
    });

    it('append() accumulates evidence and deduplicates', () => {
        wm.append('evidence', '(cat --> animal)');
        wm.append('evidence', '(dog --> animal)');
        wm.append('evidence', '(cat --> animal)');
        expect(wm.get<string[]>('evidence')).toEqual(['(cat --> animal)', '(dog --> animal)']);
    });

    it('append() respects the 64-entry cap by default', () => {
        for (let i = 0; i < 100; i++) wm.append('evidence', `e${i}`);
        expect(wm.get<string[]>('evidence')?.length).toBe(64);
        expect(wm.get<string[]>('evidence')?.[63]).toBe('e99');
    });

    it('remove() drops a value from a list slot', () => {
        wm.append('evidence', 'a');
        wm.append('evidence', 'b');
        wm.remove('evidence', 'a');
        expect(wm.get<string[]>('evidence')).toEqual(['b']);
    });

    it('remove() clears the slot when the list becomes empty', () => {
        wm.append('evidence', 'a');
        wm.remove('evidence', 'a');
        expect(wm.has('evidence')).toBe(false);
    });

    it('TTL expires a slot after the duration', () => {
        let nowMs = 1000;
        const w = new WorkingMemory({now: () => nowMs});
        w.set('hypothesis', 'X', 50);
        nowMs += 60;
        expect(w.get('hypothesis')).toBeUndefined();
    });

    it('default TTL for hypothesis is 5 min', () => {
        expect(DEFAULT_TTLS.hypothesis).toBe(5 * 60 * 1000);
    });

    it('default TTL for open_questions is infinity (persistent)', () => {
        expect(DEFAULT_TTLS.open_questions).toBe(Number.POSITIVE_INFINITY);
    });

    it('snapshot() returns a read-only view of live slots', () => {
        wm.set('focus', 'A');
        wm.set('goal', 'B');
        const snap = wm.snapshot();
        expect(snap.focus).toBe('A');
        expect(snap.goal).toBe('B');
    });

    it('fork() creates an independent child', () => {
        wm.set('focus', 'parent');
        const child = wm.fork();
        child.set('focus', 'child');
        expect(wm.get('focus')).toBe('parent');
        expect(child.get('focus')).toBe('child');
    });

    it('toJSON() and fromJSON() round-trip live slots', () => {
        wm.set('focus', 'X');
        wm.append('evidence', 'e1');
        const data = wm.toJSON();
        const restored = new WorkingMemory();
        restored.fromJSON(data);
        expect(restored.get('focus')).toBe('X');
        expect(restored.get<string[]>('evidence')).toEqual(['e1']);
    });

    it('fromJSON() drops expired slots', () => {
        let nowMs = 1000;
        const w = new WorkingMemory({now: () => nowMs});
        w.set('hypothesis', 'X', 50);
        const data = w.toJSON();
        nowMs += 100;
        const restored = new WorkingMemory({now: () => nowMs});
        restored.fromJSON(data);
        expect(restored.has('hypothesis')).toBe(false);
    });

    it('has() reports whether a slot is currently set', () => {
        wm.set('focus', 'A');
        expect(wm.has('focus')).toBe(true);
        wm.clear('focus');
        expect(wm.has('focus')).toBe(false);
    });

    it('keys() only includes live slots', () => {
        let nowMs = 0;
        const w = new WorkingMemory({now: () => nowMs});
        w.set('focus', 'A', 50);
        w.set('goal', 'B', 5_000);
        expect(w.keys().sort()).toEqual(['focus', 'goal']);
        nowMs = 100;
        expect(w.keys()).toEqual(['goal']);
    });
});
