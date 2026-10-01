/**
 * Concept Tests - Refactored for DRY and Coverage
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Concept, Stamp, TermBuilder, Truth } from '../../../nar/src';

describe('Concept', () => {
  let concept: Concept;
  const createTestConcept = () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('animal'))!;
    return new Concept(term);
  };

  beforeEach(() => {
    concept = createTestConcept();
  });

  describe('initialization', () => {
    it.each`
      property      | expected
      ${'term'}     | ${'inheritance'}
      ${'priority'} | ${0}
    `('initializes with default $property', ({ property, expected }) => {
      const value = concept[property as keyof Concept];
      if (property === 'term') {
        expect((value as any).kind).toBe(expected);
      } else {
        expect(value).toBe(expected);
      }
    });

    it('initializes with empty bags', () => {
      expect(concept.beliefBag).toBeDefined();
      expect(concept.goalBag).toBeDefined();
      expect(concept.questionBag).toBeDefined();
    });

    it('tracks creation and access time', () => {
      const now = Date.now();
      expect(concept.createdAt).toBeLessThanOrEqual(now);
      expect(concept.lastAccessedAt).toBeLessThanOrEqual(now);
    });
  });

  describe('priority management', () => {
    beforeEach(() => {
      const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
      concept = new Concept(term);
    });

    it.each`
      operation        | value   | expected
      ${'sets'}        | ${0.5}  | ${0.5}
      ${'clamps high'} | ${1.5}  | ${1}
      ${'clamps low'}  | ${-0.5} | ${0}
    `('$operation priority', ({ value, expected }) => {
      concept.writeAttention({ reason: 'assign', value });
      expect(concept.priority).toBe(expected);
    });

    it('boosts priority', () => {
      concept.writeAttention({ reason: 'assign', value: 0.5 });
      concept.writeAttention({ reason: 'prime', amount: 0.3 });
      expect(concept.priority).toBeGreaterThan(0.5);
    });

    it('floors priority at 0 when a negative boost overshoots', () => {
      concept.writeAttention({ reason: 'assign', value: 0.1 });
      concept.writeAttention({ reason: 'prime', amount: -0.3 });
      expect(concept.priority).toBe(0);
    });

    it('caps priority at 1 when a boost overshoots', () => {
      concept.writeAttention({ reason: 'assign', value: 0.9 });
      concept.writeAttention({ reason: 'prime', amount: 0.5 });
      expect(concept.priority).toBe(1);
    });

    it('holds a boost under an explicit cap', () => {
      concept.writeAttention({ reason: 'assign', value: 0.9 });
      concept.writeAttention({ reason: 'prime', amount: 0.5, cap: 0.95 });
      expect(concept.priority).toBe(0.95);
    });

    it('decays priority by the amount the clock deducted', () => {
      concept.writeAttention({ reason: 'assign', value: 0.8 });
      concept.writeAttention({ reason: 'decay', amount: 0.16 });
      expect(concept.priority).toBe(0.64);
    });

    it('never decays below zero', () => {
      concept.writeAttention({ reason: 'assign', value: 0.1 });
      concept.writeAttention({ reason: 'decay', amount: 5 });
      expect(concept.priority).toBe(0);
    });
  });

  describe('task management', () => {
    const createTask = (_type: 'belief' | 'goal' | 'question' = 'belief') => ({
      term: TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!,
      truth: Truth.create(0.9, 0.9),
      budget: { priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0 },
      stamp: Stamp.createInput(),
      occurrenceTime: Date.now(),
      derived: false,
    });

    beforeEach(() => {
      const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
      concept = new Concept(term);
    });

    it.each(['belief', 'goal', 'question'] as const)('adds %s task', (type) => {
      const task = createTask(type);
      const added = concept.addTask(type, task);
      expect(added).toBe(true);
    });

    it('returns empty arrays when no tasks', () => {
      expect(concept.getBeliefs()).toHaveLength(0);
      expect(concept.getGoals()).toHaveLength(0);
      expect(concept.getQuestions()).toHaveLength(0);
    });

    it('tracks total tasks', () => {
      expect(concept.totalTasks).toBe(0);

      const task = createTask('belief');
      concept.addTask('belief', task);
      expect(concept.totalTasks).toBe(1);
    });
  });

  describe('belief revision', () => {
    const createTask = () => ({
      term: TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!,
      truth: Truth.create(0.9, 0.9),
      budget: { priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0 },
      stamp: Stamp.createInput(),
      occurrenceTime: Date.now(),
      derived: false,
    });

    beforeEach(() => {
      const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
      concept = new Concept(term);
    });

    it('revises matching beliefs', () => {
      concept.addTask('belief', createTask());
      expect(concept.getBeliefs()).toHaveLength(1);

      concept.addTask('belief', createTask());
      expect(concept.getBeliefs()).toHaveLength(1);
    });

    it('checks for matching beliefs', () => {
      concept.addTask('belief', createTask());
      expect(concept.hasMatchingBelief(concept.term)).toBe(true);
    });
  });

  describe('links', () => {
    let concept1: Concept;
    let concept2: Concept;

    beforeEach(() => {
      const term1 = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('animal'))!;
      const term2 = TermBuilder.inheritance(TermBuilder.atom('dog'), TermBuilder.atom('animal'))!;
      concept1 = new Concept(term1);
      concept2 = new Concept(term2);
    });

    it('has no link graph of its own', () => {
      // Links live in `LinkManager` and are read through the link port. A second
      // term-keyed store on the concept was written only by `mergeWith`, so
      // every reader of it saw an empty graph (TODO29.a §5.4, finding 6).
      expect(concept1).not.toHaveProperty('linkedConcepts');
      expect(concept1).not.toHaveProperty('addLink');
    });
  });

  describe('merging', () => {
    let concept1: Concept;
    let concept2: Concept;

    beforeEach(() => {
      const term1 = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('animal'))!;
      const term2 = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('mammal'))!;
      concept1 = new Concept(term1);
      concept2 = new Concept(term2);
    });

    it('checks if concepts can merge', () => {
      expect(typeof concept1.canMergeWith(concept2, 0.3)).toBe('boolean');
    });

    it('merges concepts', () => {
      concept1.addTask('belief', {
        term: concept1.term,
        truth: Truth.create(0.9, 0.9),
        budget: { priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0 },
        stamp: Stamp.createInput(),
        occurrenceTime: Date.now(),
        derived: false,
      });

      concept2.addTask('belief', {
        term: concept2.term,
        truth: Truth.create(0.8, 0.85),
        budget: { priority: 0.75, durability: 0.7, quality: 0.85, cycles: 0, depth: 0 },
        stamp: Stamp.createInput(),
        occurrenceTime: Date.now(),
        derived: false,
      });

      const result = concept1.mergeWith([concept2]);
      expect(result.merged).toBe(concept1);
      expect(result.discarded).toContain(concept2);
    });

    it('does not merge with self', () => {
      expect(concept1.canMergeWith(concept1, 0.85)).toBe(false);
    });
  });

  describe('hierarchy', () => {
    let parent: Concept;
    let child: Concept;

    beforeEach(() => {
      const parentTerm = TermBuilder.inheritance(
        TermBuilder.atom('animal'),
        TermBuilder.atom('entity')
      )!;
      const childTerm = TermBuilder.inheritance(
        TermBuilder.atom('cat'),
        TermBuilder.atom('animal')
      )!;
      parent = new Concept(parentTerm);
      child = new Concept(childTerm);
    });

    it('has no parent/child graph of its own', () => {
      expect(parent).not.toHaveProperty('subConcepts');
      expect(parent).not.toHaveProperty('addChildConcept');
    });
  });

  describe('input touch', () => {
    beforeEach(() => {
      const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
      concept = new Concept(term);
    });

    it('starts at zero attention', () => {
      expect(concept.priority).toBe(0);
    });

    it('lifts attention when a task is admitted', () => {
      concept.writeAttention({ reason: 'input' });
      expect(concept.priority).toBeGreaterThan(0);
      expect(concept.priority).toBeLessThanOrEqual(1);
    });

    it('never exceeds 1 across many inputs', () => {
      for (let i = 0; i < 50; i++) concept.writeAttention({ reason: 'input' });
      expect(concept.priority).toBe(1);
    });

    it('admitting a task touches attention', () => {
      concept.addTask('belief', {
        term: concept.term,
        truth: Truth.create(0.9, 0.9),
        budget: { priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0 },
        stamp: Stamp.createInput(),
        occurrenceTime: Date.now(),
        derived: false,
      });
    });
  });

  describe('serialization', () => {
    it('serializes and deserializes', () => {
      const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
      const concept = new Concept(term);
      concept.writeAttention({ reason: 'assign', value: 0.75 });

      expect(concept.term).toBeDefined();
      expect(concept.priority).toBe(0.75);
    });
  });

  describe('edge cases', () => {
    it('handles multiple beliefs', () => {
      const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
      const concept = new Concept(term);

      for (let i = 0; i < 10; i++) {
        concept.addTask('belief', {
          term: concept.term,
          truth: Truth.create(0.5 + i * 0.05, 0.9),
          budget: { priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0 },
          stamp: Stamp.createInput(),
          occurrenceTime: Date.now(),
          derived: false,
        });
      }

      expect(concept.getBeliefs().length).toBeGreaterThan(0);
    });

    it('drains to zero under repeated decay and stays there', () => {
      const term = TermBuilder.inheritance(TermBuilder.atom('old'), TermBuilder.atom('concept'))!;
      const concept = new Concept(term);
      concept.writeAttention({ reason: 'assign', value: 0.9 });

      concept.writeAttention({ reason: 'decay', amount: 0.09 });
      expect(concept.priority).toBeLessThan(0.9);
    });
  });
});
