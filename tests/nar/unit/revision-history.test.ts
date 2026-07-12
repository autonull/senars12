import { describe, expect, it } from 'vitest';
import { Memory, TermBuilder, Truth, createBudget, termParser } from '../../../nar/src';
import { SeNARSFactory } from '../../../nar/src/factory.js';

describe('Pillar 1: revision history', () => {
  describe('Memory.getRevisionHistory', () => {
    it('accumulates an entry per belief addition (no dedup)', () => {
      const memory = new Memory();
      const term = TermBuilder.atom('bird');

      memory.addTask(term, 'belief', Truth.create(1, 0.9), createBudget(0.9));
      memory.addTask(term, 'belief', Truth.create(0.2, 0.8), createBudget(0.9));

      const history = memory.getRevisionHistory('bird');
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('returns entries sorted by descending timestamp', () => {
      const memory = new Memory();
      const term = TermBuilder.atom('cat');

      memory.addTask(term, 'belief', Truth.create(1, 0.9), createBudget(0.9));
      memory.addTask(term, 'belief', Truth.create(0.3, 0.8), createBudget(0.9));
      memory.addTask(term, 'belief', Truth.create(0.6, 0.7), createBudget(0.9));

      const history = memory.getRevisionHistory('cat');
      for (let i = 1; i < history.length; i++) {
        expect(history[i]!.timestamp).toBeLessThanOrEqual(history[i - 1]!.timestamp);
      }
    });

    it('latest entry matches the current concept belief', () => {
      const memory = new Memory();
      const term = TermBuilder.atom('dog');

      memory.addTask(term, 'belief', Truth.create(1, 0.9), createBudget(0.9));
      memory.addTask(term, 'belief', Truth.create(0.4, 0.85), createBudget(0.9));

      const history = memory.getRevisionHistory('dog');
      const latest = history[0]!;
      const concept = memory.getConcept(term)!;
      const current = concept.getBeliefs()[0]?.truth;

      expect(latest.truth.frequency).toBeCloseTo(current!.f, 5);
      expect(latest.truth.confidence).toBeCloseTo(current!.c, 5);
    });

    it('source reflects input for direct belief additions', () => {
      const memory = new Memory();
      const term = TermBuilder.atom('fish');
      memory.addTask(term, 'belief', Truth.create(0.9, 0.9), createBudget(0.9));
      const history = memory.getRevisionHistory('fish');
      expect(history[0]!.source).toBe('input');
      expect(history[0]!.stampId).toBeTruthy();
    });

    it('only returns entries for the requested term', () => {
      const memory = new Memory();
      memory.addTask(TermBuilder.atom('a'), 'belief', Truth.create(1, 0.9), createBudget(0.9));
      memory.addTask(TermBuilder.atom('b'), 'belief', Truth.create(0.5, 0.9), createBudget(0.9));
      expect(memory.getRevisionHistory('a').length).toBe(1);
      expect(memory.getRevisionHistory('b').length).toBe(1);
      expect(memory.getRevisionHistory('c').length).toBe(0);
    });

    it('ignores non-belief tasks', () => {
      const memory = new Memory();
      const term = TermBuilder.atom('g');
      memory.addTask(term, 'goal', undefined, createBudget(0.8));
      memory.addTask(term, 'question', undefined, createBudget(0.7));
      expect(memory.getRevisionHistory('g').length).toBe(0);
    });
  });

  describe('NAR.getRevisionHistory', () => {
    it('exposes revision history through the engine', () => {
      const nar = SeNARSFactory.createMinimal();
      nar.believe('<bird --> animal>.');
      nar.believe('<bird --> animal>. %0.3;0.8%');

      const rel = termParser.parse('<bird --> animal>')!;
      const history = nar.getRevisionHistory(rel);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0]!.source).toBe('revision');

      const endpointHistory = nar.getRevisionHistory(TermBuilder.atom('bird'));
      expect(endpointHistory.length).toBe(0);
    });

    it('latest revision entry matches the current concept belief', () => {
      const nar = SeNARSFactory.createMinimal();
      nar.believe('<cat --> animal>.');
      nar.believe('<cat --> animal>. %0.2;0.9%');

      const rel = termParser.parse('<cat --> animal>')!;
      const history = nar.getRevisionHistory(rel);
      const latest = history[0]!;
      const concept = nar.getConcept(rel)!;
      const current = concept.getBeliefs()[0]?.truth;
      expect(latest.truth.frequency).toBeCloseTo(current!.f, 5);
      expect(latest.truth.confidence).toBeCloseTo(current!.c, 5);
    });
  });
});
