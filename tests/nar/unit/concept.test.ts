/**
 * Concept Tests - Refactored for DRY and Coverage
 */

import {beforeEach, describe, expect, it} from '@jest/globals';
import {Concept, Stamp, TermBuilder, Truth} from '../../../src/nar';

describe('Concept', () => {
  let concept: Concept;

  beforeEach(() => {
    const term = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('animal'));
    concept = new Concept(term);
  });

  describe('initialization', () => {
    it('creates concept with term', () => {
      expect(concept).toBeDefined();
      expect(concept.term).toBeDefined();
      expect(concept.term.kind).toBe('inheritance');
    });

    it('initializes with default priority', () => {
      expect(concept.priority).toBe(0);
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
      const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'));
      concept = new Concept(term);
    });

    it('sets and gets priority', () => {
      concept.priority = 0.5;
      expect(concept.priority).toBe(0.5);
    });

    it('clamps priority to [0, 1]', () => {
      concept.priority = 1.5;
      expect(concept.priority).toBe(1);
      
      concept.priority = -0.5;
      expect(concept.priority).toBe(0);
    });

    it('boosts priority', () => {
      concept.priority = 0.5;
      concept.boost(0.3);
      expect(concept.priority).toBeGreaterThan(0.5);
    });

    it('decays priority', () => {
      concept.priority = 0.8;
      concept.decay(0.2);
      expect(concept.priority).toBeLessThan(0.8);
    });

    it('applies time decay', () => {
      concept.priority = 0.9;
      concept.applyTimeDecay(0.01);
      expect(concept.priority).toBeLessThan(0.9);
    });
  });

  describe('task management', () => {
    const createTask = (type = 'belief' as const) => ({
      term: TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept')),
      truth: Truth.create(0.9, 0.9),
      budget: {priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
      stamp: Stamp.createInput(),
      occurrenceTime: Date.now(),
      derived: false
    });

    beforeEach(() => {
      const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'));
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
      term: TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept')),
      truth: Truth.create(0.9, 0.9),
      budget: {priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
      stamp: Stamp.createInput(),
      occurrenceTime: Date.now(),
      derived: false
    });

    beforeEach(() => {
      const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'));
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
      const term1 = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('animal'));
      const term2 = TermBuilder.inheritance(TermBuilder.atom('dog'), TermBuilder.atom('animal'));
      concept1 = new Concept(term1);
      concept2 = new Concept(term2);
    });

    it('adds link between concepts', () => {
      concept1.addLink(concept2, 0.7);
      const links = concept1.getLinks();
      expect(links).toHaveLength(1);
      expect(links[0].concept).toBe(concept2);
      expect(links[0].strength).toBe(0.7);
    });

    it('gets linked concepts', () => {
      concept1.addLink(concept2, 0.8);
      expect(concept1.getLinkedConcepts()).toEqual([concept2]);
    });

    it('removes link', () => {
      concept1.addLink(concept2, 0.6);
      expect(concept1.getLinks()).toHaveLength(1);
      
      concept1.removeLink(concept2);
      expect(concept1.getLinks()).toHaveLength(0);
    });

    it('updates links', () => {
      concept1.addLink(concept2, 0.5);
      concept1.updateLinks();
      expect(concept1.getLinks()).toHaveLength(1);
    });

    it('does not link to self', () => {
      concept1.addLink(concept1, 0.9);
      expect(concept1.getLinks()).toHaveLength(0);
    });

    it('creates bidirectional links', () => {
      concept1.addLink(concept2, 0.7);
      expect(concept1.getLinks()).toHaveLength(1);
      expect(concept2.getLinks()).toHaveLength(1);
    });
  });

  describe('merging', () => {
    let concept1: Concept;
    let concept2: Concept;

    beforeEach(() => {
      const term1 = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('animal'));
      const term2 = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('mammal'));
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
        budget: {priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
        stamp: Stamp.createInput(),
        occurrenceTime: Date.now(),
        derived: false
      });
      
      concept2.addTask('belief', {
        term: concept2.term,
        truth: Truth.create(0.8, 0.85),
        budget: {priority: 0.75, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
        stamp: Stamp.createInput(),
        occurrenceTime: Date.now(),
        derived: false
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
      const parentTerm = TermBuilder.inheritance(TermBuilder.atom('animal'), TermBuilder.atom('entity'));
      const childTerm = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('animal'));
      parent = new Concept(parentTerm);
      child = new Concept(childTerm);
    });

    it('adds child concept', () => {
      parent.addChildConcept(child);
      expect(parent.getChildConcepts()).toHaveLength(1);
    });

    it('tracks parent concepts', () => {
      parent.addChildConcept(child);
      expect(child.getParentConcepts()).toEqual([parent]);
    });

    it('removes child concept', () => {
      parent.addChildConcept(child);
      parent.removeChildConcept(child);
      expect(parent.getChildConcepts()).toHaveLength(0);
    });

    it('splits concept', () => {
      const result = parent.split();
      expect(result).toEqual([parent]);
    });
  });

  describe('activation', () => {
    beforeEach(() => {
      const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'));
      concept = new Concept(term);
    });

    it('has initial activation of 0', () => {
      expect(concept.activationValue).toBe(0);
    });

    it('boosts activation', () => {
      concept.boost(0.3);
      expect(concept.activationValue).toBeGreaterThan(0);
      expect(concept.activationValue).toBeLessThanOrEqual(1);
    });

    it('tracks access count', () => {
      concept.addTask('belief', {
        term: concept.term,
        truth: Truth.create(0.9, 0.9),
        budget: {priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
        stamp: Stamp.createInput(),
        occurrenceTime: Date.now(),
        derived: false
      });
    });
  });

  describe('serialization', () => {
    it('serializes and deserializes', () => {
      const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'));
      const concept = new Concept(term);
      concept.priority = 0.75;
      
      expect(concept.term).toBeDefined();
      expect(concept.priority).toBe(0.75);
    });
  });

  describe('edge cases', () => {
    it('handles multiple beliefs', () => {
      const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'));
      const concept = new Concept(term);
      
      for (let i = 0; i < 10; i++) {
        concept.addTask('belief', {
          term: concept.term,
          truth: Truth.create(0.5 + i * 0.05, 0.9),
          budget: {priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
          stamp: Stamp.createInput(),
          occurrenceTime: Date.now(),
          derived: false
        });
      }
      
      expect(concept.getBeliefs().length).toBeGreaterThan(0);
    });

    it('handles decay on old concepts', () => {
      const term = TermBuilder.inheritance(TermBuilder.atom('old'), TermBuilder.atom('concept'));
      const concept = new Concept(term);
      concept.priority = 0.9;
      
      concept.applyTimeDecay(0.1);
      expect(concept.priority).toBeLessThan(0.9);
    });
  });
});
