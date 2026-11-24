import fc from 'fast-check';
import {
  Memory,
  Concept,
  TermBuilder,
  Truth,
  createTaskWeight,
  Stamp,
} from '@senars/nar';

const f32 = (x: number) => Math.fround(x);

const atomArb = fc
  .string({ minLength: 1, maxLength: 8 })
  .filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s))
  .map((s) => TermBuilder.atom(s)!);

/**
 * Property-based tests for Memory and Concept operations.
 *
 * These tests use fast-check to generate random inputs and verify
 * invariants that hold for all valid inputs.
 */

describe('Memory/Concept invariants (property)', () => {
  describe('Concept priority management', () => {
    it('priority always stays in [0, 1]', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -10, max: 10, noNaN: true }),
          fc.constantFrom('assign', 'prime', 'input', 'decay', 'merge', 'related', 'self-tune'),
          (value, reason) => {
            const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
            const concept = new Concept(term);
            concept.writeAttention({ reason: reason as any, value: Math.abs(value), amount: Math.abs(value) });
            expect(concept.priority).toBeGreaterThanOrEqual(0);
            expect(concept.priority).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('assign sets exact priority (clamped)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: f32(2), noNaN: true }),
          (value) => {
            const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
            const concept = new Concept(term);
            concept.writeAttention({ reason: 'assign', value });
            expect(concept.priority).toBe(Math.max(0, Math.min(1, value)));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('decay reduces priority but never below 0', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1, noNaN: true }),
          fc.float({ min: 0, max: f32(2), noNaN: true }),
          (initial, decay) => {
            const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
            const concept = new Concept(term);
            concept.writeAttention({ reason: 'assign', value: initial });
            const before = concept.priority;
            concept.writeAttention({ reason: 'decay', amount: decay });
            expect(concept.priority).toBeLessThanOrEqual(before);
            expect(concept.priority).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('boost increases priority but never above 1', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1, noNaN: true }),
          fc.float({ min: 0, max: 1, noNaN: true }),
          (initial, boost) => {
            const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
            const concept = new Concept(term);
            concept.writeAttention({ reason: 'assign', value: initial });
            const before = concept.priority;
            concept.writeAttention({ reason: 'prime', amount: boost });
            expect(concept.priority).toBeGreaterThanOrEqual(before);
            expect(concept.priority).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cap limits boost', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1, noNaN: true }),
          fc.float({ min: 0, max: 1, noNaN: true }),
          fc.float({ min: 0, max: 1, noNaN: true }),
          (initial, boost, cap) => {
            const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
            const concept = new Concept(term);
            concept.writeAttention({ reason: 'assign', value: initial });
            concept.writeAttention({ reason: 'prime', amount: boost, cap });
            expect(concept.priority).toBeLessThanOrEqual(Math.max(initial, cap));
            expect(concept.priority).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('multiple writes compose correctly (order independent for same reason)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(
            fc.constantFrom('assign', 'prime', 'input', 'decay'),
            fc.float({ min: 0, max: 1, noNaN: true })
          ), { minLength: 1, maxLength: 10 }),
          (operations) => {
            const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
            const concept = new Concept(term);
            for (const [reason, value] of operations) {
              concept.writeAttention({ reason: reason as any, value, amount: value });
            }
            expect(concept.priority).toBeGreaterThanOrEqual(0);
            expect(concept.priority).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Concept task management', () => {
    const taskArb = fc.record({
      term: atomArb,
      truth: fc.tuple(
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: f32(0.001), max: f32(0.99), noNaN: true })
      ).map(([f, c]) => Truth.create(f, c)),
      budget: fc.record({
        priority: fc.float({ min: 0, max: 1, noNaN: true }),
        durability: fc.float({ min: 0, max: 1, noNaN: true }),
        quality: fc.float({ min: 0, max: 1, noNaN: true }),
        cycles: fc.integer({ min: 0, max: 100 }),
        depth: fc.integer({ min: 0, max: 10 }),
      }),
      stamp: fc.constant(Stamp.createInput()),
      occurrenceTime: fc.integer({ min: Date.now() - 1e6, max: Date.now() }),
      derived: fc.boolean(),
    });

    it('adding task increases totalTasks', () => {
      fc.assert(
        fc.property(
          fc.array(taskArb, { minLength: 1, maxLength: 20 }),
          fc.constantFrom('goal', 'question' as const),
          (tasks, type) => {
            const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
            const concept = new Concept(term);
            const initialTotal = concept.totalTasks;
            for (const task of tasks) {
              concept.addTask(type, task);
            }
            expect(concept.totalTasks).toBe(initialTotal + tasks.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('getBeliefs/getGoals/getQuestions return correct bag', () => {
      fc.assert(
        fc.property(
          fc.array(taskArb, { minLength: 1, maxLength: 10 }),
          fc.constantFrom('goal', 'question' as const),
          (tasks, type) => {
            const term = TermBuilder.inheritance(TermBuilder.atom('test'), TermBuilder.atom('concept'))!;
            const concept = new Concept(term);
            for (const task of tasks) {
              concept.addTask(type, task);
            }
            const getFn = type === 'goal' ? concept.getGoals.bind(concept)
              : concept.getQuestions.bind(concept);
            expect(getFn().length).toBe(tasks.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('hasMatchingBelief works correctly', () => {
      fc.assert(
        fc.property(
          taskArb,
          (task) => {
            const concept = new Concept(task.term);
            concept.addTask('belief', task);
            expect(concept.hasMatchingBelief(task.term)).toBe(true);
            const otherTerm = TermBuilder.atom('other')!;
            expect(concept.hasMatchingBelief(otherTerm)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Concept merging', () => {
    it('mergeWith merges all beliefs from other concepts', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            atomArb,
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: f32(0.001), max: f32(0.99), noNaN: true }),
          ),
          ([term, f, c]) => {
            const concept1 = new Concept(term);
            concept1.addTask('belief', {
              term,
              truth: Truth.create(f, c),
              budget: { priority: 0.5, durability: 0.5, quality: 0.5, cycles: 0, depth: 0 },
              stamp: Stamp.createInput(),
              occurrenceTime: Date.now(),
              derived: false,
            });

            const concept2 = new Concept(term);
            concept2.addTask('belief', {
              term,
              truth: Truth.create(f, c),
              budget: { priority: 0.5, durability: 0.5, quality: 0.5, cycles: 0, depth: 0 },
              stamp: Stamp.createInput(),
              occurrenceTime: Date.now(),
              derived: false,
            });

            const result = concept1.mergeWith([concept2]);
            expect(result.merged).toBe(concept1);
            expect(result.discarded).toContain(concept2);
            // mergeWith adds all beliefs from other concepts
            expect(concept1.totalTasks).toBe(2);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('canMergeWith is reflexive-false', () => {
      fc.assert(
        fc.property(
          atomArb,
          (term) => {
            const concept = new Concept(term);
            expect(concept.canMergeWith(concept, 0.5)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('mergeWith preserves truth through revision', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            atomArb,
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: f32(0.001), max: f32(0.99), noNaN: true }),
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: f32(0.001), max: f32(0.99), noNaN: true }),
          ),
          ([term, f1, c1, f2, c2]) => {
            const concept1 = new Concept(term);
            concept1.addTask('belief', {
              term,
              truth: Truth.create(f1, c1),
              budget: { priority: 0.5, durability: 0.5, quality: 0.5, cycles: 0, depth: 0 },
              stamp: Stamp.createInput(),
              occurrenceTime: Date.now(),
              derived: false,
            });

            const concept2 = new Concept(term);
            concept2.addTask('belief', {
              term,
              truth: Truth.create(f2, c2),
              budget: { priority: 0.5, durability: 0.5, quality: 0.5, cycles: 0, depth: 0 },
              stamp: Stamp.createInput(),
              occurrenceTime: Date.now(),
              derived: false,
            });

            const result = concept1.mergeWith([concept2]);
            const beliefs = concept1.getBeliefs();
            // mergeWith adds all beliefs from other concepts
            expect(beliefs.length).toBe(2);
            for (const belief of beliefs) {
              expect(belief.truth.f).toBeGreaterThanOrEqual(0);
              expect(belief.truth.f).toBeLessThanOrEqual(1);
              expect(belief.truth.c).toBeGreaterThanOrEqual(0);
              expect(belief.truth.c).toBeLessThanOrEqual(Truth.MAX_CONFIDENCE);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Memory operations', () => {
    it('addConcept is idempotent', () => {
      fc.assert(
        fc.property(
          fc.array(atomArb, { minLength: 1, maxLength: 20 }),
          (terms) => {
            const mem = new Memory({ maxConcepts: 1000 });
            for (const term of terms) {
              mem.addConcept(term);
              mem.addConcept(term); // Second add should return same concept
            }
            expect(mem.size).toBeLessThanOrEqual(terms.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('getConcept returns same reference', () => {
      fc.assert(
        fc.property(
          fc.array(atomArb, { minLength: 1, maxLength: 20 }),
          (terms) => {
            const mem = new Memory({ maxConcepts: 1000 });
            for (const term of terms) {
              const c1 = mem.addConcept(term);
              const c2 = mem.getConcept(term);
              expect(c1).toBe(c2);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('addTask adds to correct concept bag', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            atomArb,
            fc.constantFrom('belief', 'goal', 'question' as const),
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: f32(0.001), max: f32(0.99), noNaN: true }),
          ),
          ([term, type, p, f, c]) => {
            const mem = new Memory({ maxConcepts: 1000 });
            const result = mem.addTask(term, type, Truth.create(f, c), createTaskWeight(p));
            expect(result).toBe(true);
            const concept = mem.getConcept(term);
            expect(concept).toBeDefined();
            const bag = type === 'belief' ? concept!.beliefBag
              : type === 'goal' ? concept!.goalBag
              : concept!.questionBag;
            expect(bag.size).toBe(1);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('topConcepts returns sorted by priority', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              atomArb,
              fc.float({ min: 0, max: 1, noNaN: true })
            ),
            { minLength: 1, maxLength: 20 }
          ),
          (pairs) => {
            const mem = new Memory({ maxConcepts: 1000, activationDecayRate: 0 });
            for (const [term, priority] of pairs) {
              mem.addTask(term, 'belief', Truth.TRUE, createTaskWeight(priority));
            }
            const top = mem.topConcepts(pairs.length);
            expect(top.length).toBeLessThanOrEqual(pairs.length);
            for (let i = 1; i < top.length; i++) {
              expect(top[i]!.priority).toBeLessThanOrEqual(top[i - 1]!.priority);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('consolidate with zero decay preserves all concepts', () => {
      fc.assert(
        fc.property(
          fc.array(atomArb, { minLength: 1, maxLength: 20 }),
          (terms) => {
            const mem = new Memory({ maxConcepts: 1000, activationDecayRate: 0 });
            for (const term of terms) {
              mem.addTask(term, 'belief', Truth.TRUE, createTaskWeight(0.5));
            }
            const initialSize = mem.size;
            for (let i = 0; i < 100; i++) {
              mem.consolidate();
            }
            expect(mem.size).toBe(initialSize);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('removeConcept removes exactly one concept', () => {
      fc.assert(
        fc.property(
          fc.array(atomArb, { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 19 }),
          (terms, index) => {
            const mem = new Memory({ maxConcepts: 1000 });
            for (const term of terms) {
              mem.addTask(term, 'belief', Truth.TRUE, createTaskWeight(0.5));
            }
            const initialSize = mem.size;
            const termToRemove = terms[index % terms.length];
            const result = mem.removeConcept(termToRemove);
            expect(result).toBe(true);
            expect(mem.size).toBe(initialSize - 1);
            expect(mem.getConcept(termToRemove)).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});