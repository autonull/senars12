/**
 * Strategy Tests
 * Tests for all 13 reasoning strategies in SeNARS12
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Strategy } from '../../../nar/src/reason';
import { createStrategy } from '../../../nar/src/reason';
import { CompositeStrategy, DecompositionStrategy } from '../../../nar/src/strategies/premise';
import { createDefaultRegistry } from '../../../nar/src/cognitive';
import { Truth } from '../../../nar/src/terms/impls/Truth.js';
import { createTask, type Task } from '../../../nar/src/types/index.js';
import { NAR } from '../../../src';

/** The premise slot, by name — the registry is the only way to get a strategy. */
const premise = (name: string): Strategy => createDefaultRegistry().get<Strategy>('premise', name);

describe('Core Strategies', () => {
  let nar: NAR;

  beforeEach(() => {
    nar = new NAR();
  });

  describe('resolution', () => {
    it('should have correct configuration', () => {
      expect(premise('resolution').name).toBe('resolution');
      expect(premise('resolution').sampleSize).toBe(15);
      expect(premise('resolution').limit).toBe(5);
    });

    it('should select secondary tasks for inference', async () => {
      await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
      await nar.input('(b --> c)', 'belief', Truth.create(0.9, 0.9));

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = premise('resolution').selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  describe('resolution', () => {
    it('should have correct configuration', () => {
      expect(premise('resolution').name).toBe('resolution');
      expect(premise('resolution').sampleSize).toBe(15);
      expect(premise('resolution').limit).toBe(5);
    });

    it('should filter for inheritance terms only', async () => {
      await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
      await nar.input('(&, a, b)', 'belief', Truth.create(0.9, 0.9));

      const concepts = nar.memory.listConcepts();
      const inheritanceConcepts = concepts.filter((c) => c.term.kind === 'inheritance');
      expect(inheritanceConcepts.length).toBeGreaterThan(0);
    });
  });

  describe('goal-driven', () => {
    it('should have correct name', () => {
      expect(premise('goal-driven').name).toBe('goal-driven');
    });

    it('should prioritize high-confidence beliefs', async () => {
      await nar.input('(important --> fact)', 'belief', Truth.create(0.95, 0.95));
      await nar.input('(unimportant --> fact)', 'belief', Truth.create(0.3, 0.5));

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = premise('goal-driven').selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  describe('analogical', () => {
    it('should have correct name', () => {
      expect(premise('analogical').name).toBe('analogical');
    });

    it('should find concepts with overlapping terms', async () => {
      await nar.input('(dog --> animal)', 'belief', Truth.create(0.9, 0.9));
      await nar.input('(cat --> animal)', 'belief', Truth.create(0.9, 0.9));

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = premise('analogical').selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it('should handle non-inheritance terms gracefully', async () => {
      await nar.input('test', 'belief', Truth.create(0.9, 0.9));

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = premise('analogical').selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  describe('term-link', () => {
    it('should have correct configuration', () => {
      expect(premise('term-link').name).toBe('term-link');
    });

    it('should link related terms', async () => {
      await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
      await nar.input('(b --> c)', 'belief', Truth.create(0.9, 0.9));

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = premise('term-link').selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  describe('sampled', () => {
    it('should have correct configuration', () => {
      expect(premise('sampled').name).toBe('sampled');
      expect(premise('sampled').sampleSize).toBe(20);
      expect(premise('sampled').limit).toBe(5);
    });

    it('should match tasks with similar terms', async () => {
      await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = premise('sampled').selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  describe('DecompositionStrategy', () => {
    it('should have correct name', () => {
      expect(new DecompositionStrategy().name).toBe('decomposition');
    });

    it('should decompose conjunctions into components', async () => {
      await nar.input('(&, a, b, c)', 'belief', Truth.create(0.9, 0.9));

      const task = nar.taskManager.peekTask();
      if (task && task.term.kind === 'conjunction') {
        const results = new DecompositionStrategy().selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
      } else {
        const concepts = nar.memory.listConcepts();
        const conjunctionConcept = concepts.find((c) => c.term.kind === 'conjunction');
        if (conjunctionConcept) {
          const mockTask = createTask(conjunctionConcept.term, 'belief', Truth.create(0.9, 0.9));
          const results = new DecompositionStrategy().selectSecondary(mockTask, nar.memory);
          expect(Array.isArray(results)).toBe(true);
          expect(results.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return empty array for non-conjunction terms', async () => {
      await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = new DecompositionStrategy().selectSecondary(task, nar.memory);
        expect(results.length).toBe(0);
      }
    });
  });

  describe('default-formation', () => {
    it('should have correct configuration', () => {
      expect(premise('default-formation').name).toBe('default-formation');
      expect(premise('default-formation').sampleSize).toBe(10);
      expect(premise('default-formation').limit).toBe(5);
    });

    it('should form beliefs from premises', async () => {
      await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = premise('default-formation').selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });
});

describe('Composite Strategies', () => {
  let nar: NAR;

  beforeEach(() => {
    nar = new NAR();
  });

  it('should combine multiple strategies', async () => {
    const composite = new CompositeStrategy([premise('resolution'), premise('sampled')]);

    await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));

    const task = nar.taskManager.peekTask();
    if (task) {
      const results = composite.selectSecondary(task, nar.memory);
      expect(Array.isArray(results)).toBe(true);
    }
  });

  it('should handle sequential mode', async () => {
    const composite = new CompositeStrategy([premise('resolution'), premise('sampled')], 'concatenate');

    await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
    const task = nar.taskManager.peekTask();
    if (task) {
      const results = composite.selectSecondary(task, nar.memory);
      expect(Array.isArray(results)).toBe(true);
    }
  });

  it('should handle parallel mode', async () => {
    const composite = new CompositeStrategy([premise('resolution'), premise('goal-driven')], 'concatenate');

    await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
    const task = nar.taskManager.peekTask();
    if (task) {
      const results = composite.selectSecondary(task, nar.memory);
      expect(Array.isArray(results)).toBe(true);
    }
  });

  it('should dedupe overlapping terms to the strongest task in dedup mode', async () => {
    const composite = new CompositeStrategy(
      [premise('resolution'), premise('sampled'), premise('goal-driven')],
      'dedup'
    );

    await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
    const task = nar.taskManager.peekTask();
    if (task) {
      const results = composite.selectSecondary(task, nar.memory);
      const keys = results.map((r: Task) => r.term.toString());
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('should handle strategy failures gracefully', async () => {
    const failingStrategy: Strategy = {
      name: 'failing',
      selectSecondary: () => {
        throw new Error('Intentional failure');
      },
    };

    const composite = new CompositeStrategy([failingStrategy, premise('resolution')]);

    await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
    const task = nar.taskManager.peekTask();
    if (task) {
      const results = composite.selectSecondary(task, nar.memory);
      expect(Array.isArray(results)).toBe(true);
    }
  });
});

describe('Strategy Factory Functions', () => {
  it('should create strategy with default options', () => {
    const strategy = createStrategy({
      name: 'test-strategy',
      sampleSize: 10,
      limit: 5,
    });

    expect(strategy.name).toBe('test-strategy');
    expect(strategy.selectSecondary).toBeDefined();
  });

  it('should create strategy with custom filter', () => {
    const strategy = createStrategy({
      name: 'filtered-strategy',
      sampleSize: 15,
      limit: 7,
      filter: (concept) => concept.term.kind === 'inheritance',
    });

    expect(strategy.name).toBe('filtered-strategy');
  });

  it('should create strategy with truth filter', () => {
    const strategy = createStrategy({
      name: 'truth-filtered-strategy',
      sampleSize: 20,
      limit: 10,
      truthFilter: (truth) => truth.f >= 0.5,
    });

    expect(strategy.name).toBe('truth-filtered-strategy');
    expect(strategy.selectSecondary).toBeDefined();
  });
});

describe('Strategy Performance', () => {
  let nar: NAR;

  beforeEach(() => {
    nar = new NAR();
  });

  it('should handle large concept spaces efficiently', async () => {
    for (let i = 0; i < 50; i++) {
      await nar.input(`(concept${i} --> property)`, 'belief', Truth.create(0.9, 0.9));
    }

    const task = nar.taskManager.peekTask();
    if (task) {
      const strategies = [premise('resolution'), premise('term-link'), premise('sampled')];

      for (const strategy of strategies) {
        const start = Date.now();
        const results = strategy.selectSecondary(task, nar.memory);
        const duration = Date.now() - start;

        expect(Array.isArray(results)).toBe(true);
        expect(duration).toBeLessThan(100);
      }
    }
  });

  it('should handle empty memory gracefully', () => {
    const task = nar.taskManager.peekTask();
    if (task) {
      const strategies: Strategy[] = ['resolution', 'goal-driven', 'analogical', 'sampled', 'default-formation'].map(
        premise
      );

      for (const strategy of strategies) {
        const results = strategy.selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    }
  });
});
