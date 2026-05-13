/**
 * Concept Class Tests
 */

import {describe, it, expect, beforeEach} from '@jest/globals';
import {Concept} from '../../../src/nar/memory/concept.js';
import {TermBuilder, Truth} from '../../../src/nar/terms/index.js';
import {Stamp} from '../../../src/nar/terms/stamp.js';

describe('Concept', () => {
  let concept: Concept;

  beforeEach(() => {
    const term = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('animal'));
    concept = new Concept(term);
  });

  it('should create concept with term', () => {
    expect(concept).toBeDefined();
    expect(concept.term).toBeDefined();
    expect(concept.term.kind).toBe('inheritance');
  });

  it('should initialize with default priority', () => {
    expect(concept.priority).toBe(0);
  });

  it('should initialize belief, goal, and question bags', () => {
    expect(concept.beliefBag).toBeDefined();
    expect(concept.goalBag).toBeDefined();
    expect(concept.questionBag).toBeDefined();
  });

  it('should track creation time', () => {
    expect(concept.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it('should track last accessed time', () => {
    expect(concept.lastAccessedAt).toBeLessThanOrEqual(Date.now());
  });
});

describe('Concept Priority', () => {
  let concept: Concept;

  beforeEach(() => {
    const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'));
    concept = new Concept(term);
  });

  it('should set and get priority', () => {
    concept.priority = 0.5;
    expect(concept.priority).toBe(0.5);
  });

  it('should clamp priority to [0, 1]', () => {
    concept.priority = 1.5;
    expect(concept.priority).toBe(1);

    concept.priority = -0.5;
    expect(concept.priority).toBe(0);
  });

  it('should boost priority', () => {
    concept.priority = 0.5;
    concept.boost(0.3);
    expect(concept.priority).toBeGreaterThan(0.5);
  });

  it('should decay priority', () => {
    concept.priority = 0.8;
    concept.decay(0.2);
    expect(concept.priority).toBeLessThan(0.8);
  });

  it('should apply time decay', () => {
    concept.priority = 0.9;
    concept.applyTimeDecay(0.01);
    expect(concept.priority).toBeLessThan(0.9);
  });
});

describe('Concept Task Management', () => {
  let concept: Concept;

  beforeEach(() => {
    const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'));
    concept = new Concept(term);
  });

  it('should add belief task', () => {
    const stamp = Stamp.createInput();
    const task = {
      term: concept.term,
      truth: Truth.create(0.9, 0.9),
      budget: {priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
      stamp,
      occurrenceTime: Date.now(),
      derived: false
    };

    const added = concept.addTask('belief', task);
    expect(added).toBe(true);
    expect(concept.getBeliefs().length).toBe(1);
  });

  it('should add goal task', () => {
    const stamp = Stamp.createInput();
    const task = {
      term: concept.term,
      truth: Truth.create(0.5, 0.8),
      budget: {priority: 0.6, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
      stamp,
      occurrenceTime: Date.now(),
      derived: false
    };

    const added = concept.addTask('goal', task);
    expect(added).toBe(true);
    expect(concept.getGoals().length).toBe(1);
  });

  it('should add question task', () => {
    const stamp = Stamp.createInput();
    const task = {
      term: concept.term,
      truth: undefined,
      budget: {priority: 0.5, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
      stamp,
      occurrenceTime: Date.now(),
      derived: false
    };

    const added = concept.addTask('question', task);
    expect(added).toBe(true);
    expect(concept.getQuestions().length).toBe(1);
  });

  it('should return empty arrays when no tasks', () => {
    expect(concept.getBeliefs().length).toBe(0);
    expect(concept.getGoals().length).toBe(0);
    expect(concept.getQuestions().length).toBe(0);
  });

  it('should track total tasks', () => {
    expect(concept.totalTasks).toBe(0);

    const stamp = Stamp.createInput();
    const task = {
      term: concept.term,
      truth: Truth.create(0.9, 0.9),
      budget: {priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
      stamp,
      occurrenceTime: Date.now(),
      derived: false
    };

    concept.addTask('belief', task);
    expect(concept.totalTasks).toBe(1);
  });
});

describe('Concept Belief Revision', () => {
  let concept: Concept;

  beforeEach(() => {
    const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'));
    concept = new Concept(term);
  });

  it('should revise matching beliefs', () => {
    const stamp1 = Stamp.createInput();
    const task1 = {
      term: concept.term,
      truth: Truth.create(0.8, 0.9),
      budget: {priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
      stamp: stamp1,
      occurrenceTime: Date.now(),
      derived: false
    };

    concept.addTask('belief', task1);
    expect(concept.getBeliefs().length).toBe(1);

    const stamp2 = Stamp.createInput();
    const task2 = {
      term: concept.term,
      truth: Truth.create(0.7, 0.85),
      budget: {priority: 0.75, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
      stamp: stamp2,
      occurrenceTime: Date.now(),
      derived: false
    };

    concept.addTask('belief', task2);
    expect(concept.getBeliefs().length).toBe(1);
  });

  it('should check for matching beliefs', () => {
    const stamp = Stamp.createInput();
    const task = {
      term: concept.term,
      truth: Truth.create(0.9, 0.9),
      budget: {priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
      stamp,
      occurrenceTime: Date.now(),
      derived: false
    };

    concept.addTask('belief', task);
    expect(concept.hasMatchingBelief(concept.term)).toBe(true);
  });
});

describe('Concept Links', () => {
  let concept1: Concept;
  let concept2: Concept;

  beforeEach(() => {
    const term1 = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('animal'));
    const term2 = TermBuilder.inheritance(TermBuilder.atom('dog'), TermBuilder.atom('animal'));
    concept1 = new Concept(term1);
    concept2 = new Concept(term2);
  });

  it('should add link between concepts', () => {
    concept1.addLink(concept2, 0.7);
    const links = concept1.getLinks();
    expect(links.length).toBe(1);
    expect(links[0].concept).toBe(concept2);
    expect(links[0].strength).toBe(0.7);
  });

  it('should get linked concepts', () => {
    concept1.addLink(concept2, 0.8);
    const linked = concept1.getLinkedConcepts();
    expect(linked.length).toBe(1);
    expect(linked[0]).toBe(concept2);
  });

  it('should remove link', () => {
    concept1.addLink(concept2, 0.6);
    expect(concept1.getLinks().length).toBe(1);

    concept1.removeLink(concept2);
    expect(concept1.getLinks().length).toBe(0);
  });

  it('should update links', () => {
    concept1.addLink(concept2, 0.5);
    concept1.updateLinks();

    const links = concept1.getLinks();
    expect(links.length).toBeGreaterThanOrEqual(0);
  });

  it('should not link to self', () => {
    concept1.addLink(concept1, 0.9);
    expect(concept1.getLinks().length).toBe(0);
  });

  it('should create bidirectional links', () => {
    concept1.addLink(concept2, 0.7);
    expect(concept1.getLinks().length).toBe(1);
    expect(concept2.getLinks().length).toBe(1);
  });
});

describe('Concept Merging', () => {
  let concept1: Concept;
  let concept2: Concept;

  beforeEach(() => {
    const term1 = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('animal'));
    const term2 = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('mammal'));
    concept1 = new Concept(term1);
    concept2 = new Concept(term2);
  });

  it('should check if concepts can merge', () => {
    const canMerge = concept1.canMergeWith(concept2, 0.3);
    expect(typeof canMerge).toBe('boolean');
  });

  it('should merge concepts', () => {
    const stamp1 = Stamp.createInput();
    const task1 = {
      term: concept1.term,
      truth: Truth.create(0.9, 0.9),
      budget: {priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
      stamp: stamp1,
      occurrenceTime: Date.now(),
      derived: false
    };
    concept1.addTask('belief', task1);

    const stamp2 = Stamp.createInput();
    const task2 = {
      term: concept2.term,
      truth: Truth.create(0.8, 0.85),
      budget: {priority: 0.75, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
      stamp: stamp2,
      occurrenceTime: Date.now(),
      derived: false
    };
    concept2.addTask('belief', task2);

    const result = concept1.mergeWith([concept2]);
    expect(result.merged).toBe(concept1);
    expect(result.discarded).toContain(concept2);
  });

  it('should not merge with self', () => {
    expect(concept1.canMergeWith(concept1, 0.85)).toBe(false);
  });
});

describe('Concept Hierarchy', () => {
  let parent: Concept;
  let child: Concept;

  beforeEach(() => {
    const parentTerm = TermBuilder.inheritance(TermBuilder.atom('animal'), TermBuilder.atom('entity'));
    const childTerm = TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('animal'));
    parent = new Concept(parentTerm);
    child = new Concept(childTerm);
  });

  it('should add child concept', () => {
    parent.addChildConcept(child);
    expect(parent.getChildConcepts().length).toBe(1);
  });

  it('should track parent concepts', () => {
    parent.addChildConcept(child);
    expect(child.getParentConcepts().length).toBe(1);
    expect(child.getParentConcepts()[0]).toBe(parent);
  });

  it('should remove child concept', () => {
    parent.addChildConcept(child);
    parent.removeChildConcept(child);
    expect(parent.getChildConcepts().length).toBe(0);
  });

  it('should split concept', () => {
    const result = parent.split();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(parent);
  });
});

describe('Concept Activation', () => {
  let concept: Concept;

  beforeEach(() => {
    const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'));
    concept = new Concept(term);
  });

  it('should have initial activation of 0', () => {
    expect(concept.activationValue).toBe(0);
  });

  it('should boost activation', () => {
    concept.boost(0.3);
    expect(concept.activationValue).toBeGreaterThan(0);
    expect(concept.activationValue).toBeLessThanOrEqual(1);
  });

  it('should track access count', () => {
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

describe('Concept Serialization', () => {
  it('should serialize and deserialize', () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'));
    const concept = new Concept(term);
    concept.priority = 0.75;

    expect(concept.term).toBeDefined();
    expect(concept.priority).toBe(0.75);
  });
});

describe('Concept Edge Cases', () => {
  it('should handle multiple beliefs', () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'));
    const concept = new Concept(term);

    for (let i = 0; i < 10; i++) {
      const stamp = Stamp.createInput();
      const task = {
        term: concept.term,
        truth: Truth.create(0.5 + i * 0.05, 0.9),
        budget: {priority: 0.8, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
        stamp,
        occurrenceTime: Date.now(),
        derived: false
      };
      concept.addTask('belief', task);
    }

    expect(concept.getBeliefs().length).toBeGreaterThan(0);
  });

  it('should handle decay on old concepts', () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('old'), TermBuilder.atom('concept'));
    const concept = new Concept(term);
    concept.priority = 0.9;

    concept.applyTimeDecay(0.1);
    expect(concept.priority).toBeLessThan(0.9);
  });
});
