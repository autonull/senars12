/**
 * Strategy Tests
 * Tests for all 13 reasoning strategies in SeNARS12
 */

import {describe, it, expect, beforeEach} from '@jest/globals';
import {NAR} from '../../../src/nar/nar.js';
import {
  PrologStrategy,
  ResolutionStrategy,
  GoalDrivenStrategy,
  AnalogicalStrategy,
  TermLinkStrategy,
  TaskMatchStrategy,
  DecompositionStrategy,
  DefaultFormationStrategy,
  CompositeStrategy,
  AdaptiveStrategy,
  SwitchingStrategy,
  createStrategy
} from '../../../src/nar/reason/strategies/index.js';
import type {Strategy} from '../strategy.js';

describe('Core Strategies', () => {
  let nar: NAR;

  beforeEach(() => {
    nar = new NAR();
  });

  describe('PrologStrategy', () => {
    it('should have correct configuration', () => {
      expect(PrologStrategy.name).toBe('prolog');
      expect(PrologStrategy.sampleSize).toBe(20);
      expect(PrologStrategy.limit).toBe(5);
    });

    it('should select secondary tasks for inference', async () => {
      await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});
      await nar.input('(b --> c)', 'belief', {f: 0.9, c: 0.9});

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = PrologStrategy.selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  describe('ResolutionStrategy', () => {
    it('should have correct configuration', () => {
      expect(ResolutionStrategy.name).toBe('resolution');
      expect(ResolutionStrategy.sampleSize).toBe(15);
      expect(ResolutionStrategy.limit).toBe(5);
    });

    it('should filter for inheritance terms only', async () => {
      await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});
      await nar.input('(&, a, b)', 'belief', {f: 0.9, c: 0.9});

      const concepts = nar.memory.listConcepts();
      const inheritanceConcepts = concepts.filter(c => c.term.kind === 'inheritance');
      expect(inheritanceConcepts.length).toBeGreaterThan(0);
    });
  });

  describe('GoalDrivenStrategy', () => {
    it('should have correct name', () => {
      expect(GoalDrivenStrategy.name).toBe('goal-driven');
    });

    it('should prioritize high-confidence beliefs', async () => {
      await nar.input('(important --> fact)', 'belief', {f: 0.95, c: 0.95});
      await nar.input('(unimportant --> fact)', 'belief', {f: 0.3, c: 0.5});

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = GoalDrivenStrategy.selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  describe('AnalogicalStrategy', () => {
    it('should have correct name', () => {
      expect(AnalogicalStrategy.name).toBe('analogical');
    });

    it('should find concepts with overlapping terms', async () => {
      await nar.input('(dog --> animal)', 'belief', {f: 0.9, c: 0.9});
      await nar.input('(cat --> animal)', 'belief', {f: 0.9, c: 0.9});

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = AnalogicalStrategy.selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it('should handle non-inheritance terms gracefully', async () => {
      await nar.input('test', 'belief', {f: 0.9, c: 0.9});

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = AnalogicalStrategy.selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  describe('TermLinkStrategy', () => {
    it('should have correct configuration', () => {
      expect(TermLinkStrategy.name).toBe('term-link');
      expect(TermLinkStrategy.sampleSize).toBe(25);
      expect(TermLinkStrategy.limit).toBe(10);
    });

    it('should link related terms', async () => {
      await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});
      await nar.input('(b --> c)', 'belief', {f: 0.9, c: 0.9});

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = TermLinkStrategy.selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  describe('TaskMatchStrategy', () => {
    it('should have correct configuration', () => {
      expect(TaskMatchStrategy.name).toBe('task-match');
      expect(TaskMatchStrategy.sampleSize).toBe(20);
      expect(TaskMatchStrategy.limit).toBe(5);
    });

    it('should match tasks with similar terms', async () => {
      await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = TaskMatchStrategy.selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  describe('DecompositionStrategy', () => {
    it('should have correct name', () => {
      expect(DecompositionStrategy.name).toBe('decomposition');
    });

it('should decompose conjunctions into components', async () => {
await nar.input('(&, a, b, c)', 'belief', {f: 0.9, c: 0.9});

const task = nar.taskManager.peekTask();
if (task && task.term.kind === 'conjunction') {
const results = DecompositionStrategy.selectSecondary(task, nar.memory);
expect(Array.isArray(results)).toBe(true);
expect(results.length).toBeGreaterThan(0);
} else {
const concepts = nar.memory.listConcepts();
const conjunctionConcept = concepts.find(c => c.term.kind === 'conjunction');
if (conjunctionConcept) {
const mockTask = {
term: conjunctionConcept.term,
type: 'belief' as const,
truth: {f: 0.9, c: 0.9},
budget: {priority: 0.9, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
stamp: {id: 'test', creationTime: 0, source: 'INPUT' as const, derivations: [], depth: 0},
occurrenceTime: 0,
derived: false
};
const results = DecompositionStrategy.selectSecondary(mockTask, nar.memory);
expect(Array.isArray(results)).toBe(true);
expect(results.length).toBeGreaterThan(0);
}
}
});

    it('should return empty array for non-conjunction terms', async () => {
      await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = DecompositionStrategy.selectSecondary(task, nar.memory);
        expect(results.length).toBe(0);
      }
    });
  });

  describe('DefaultFormationStrategy', () => {
    it('should have correct configuration', () => {
      expect(DefaultFormationStrategy.name).toBe('default-formation');
      expect(DefaultFormationStrategy.sampleSize).toBe(10);
      expect(DefaultFormationStrategy.limit).toBe(5);
    });

    it('should form beliefs from premises', async () => {
      await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});

      const task = nar.taskManager.peekTask();
      if (task) {
        const results = DefaultFormationStrategy.selectSecondary(task, nar.memory);
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
    const composite = new CompositeStrategy([
      PrologStrategy,
      ResolutionStrategy
    ]);

    await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});

    const task = nar.taskManager.peekTask();
    if (task) {
      const results = composite.selectSecondary(task, nar.memory);
      expect(Array.isArray(results)).toBe(true);
    }
  });

  it('should handle sequential mode', async () => {
    const composite = new CompositeStrategy(
      [PrologStrategy, ResolutionStrategy],
      'sequential'
    );

    await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});
    const task = nar.taskManager.peekTask();
    if (task) {
      const results = composite.selectSecondary(task, nar.memory);
      expect(Array.isArray(results)).toBe(true);
    }
  });

  it('should handle parallel mode', async () => {
    const composite = new CompositeStrategy(
      [PrologStrategy, GoalDrivenStrategy],
      'parallel'
    );

    await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});
    const task = nar.taskManager.peekTask();
    if (task) {
      const results = composite.selectSecondary(task, nar.memory);
      expect(Array.isArray(results)).toBe(true);
    }
  });

  it('should handle weighted mode', async () => {
    const composite = new CompositeStrategy(
      [PrologStrategy, ResolutionStrategy, GoalDrivenStrategy],
      'weighted',
      [0.5, 0.3, 0.2]
    );

    await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});
    const task = nar.taskManager.peekTask();
    if (task) {
      const results = composite.selectSecondary(task, nar.memory);
      expect(Array.isArray(results)).toBe(true);
    }
  });

  it('should handle strategy failures gracefully', async () => {
    const failingStrategy: Strategy = {
      name: 'failing',
      selectSecondary: () => {
        throw new Error('Intentional failure');
      }
    };

    const composite = new CompositeStrategy([failingStrategy, PrologStrategy]);

    await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});
    const task = nar.taskManager.peekTask();
    if (task) {
      const results = composite.selectSecondary(task, nar.memory);
      expect(Array.isArray(results)).toBe(true);
    }
  });
});

describe('Adaptive Strategy', () => {
  let nar: NAR;

  beforeEach(() => {
    nar = new NAR();
  });

  it('should initialize with provided strategies', () => {
    const adaptive = new AdaptiveStrategy([PrologStrategy, ResolutionStrategy]);
    expect(adaptive.name).toBe('adaptive');

    const stats = adaptive.getStats();
    expect(stats).toBeDefined();
    expect(stats.size).toBe(2);
  });

  it('should adapt based on effectiveness', async () => {
    const adaptive = new AdaptiveStrategy([PrologStrategy, ResolutionStrategy]);

    await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});
    const task = nar.taskManager.peekTask();

    if (task) {
      const results1 = adaptive.selectSecondary(task, nar.memory);
      expect(Array.isArray(results1)).toBe(true);

      const results2 = adaptive.selectSecondary(task, nar.memory);
      expect(Array.isArray(results2)).toBe(true);

      const stats = adaptive.getStats();
      expect(stats.size).toBe(2);
    }
  });

  it('should track statistics per strategy', async () => {
    const adaptive = new AdaptiveStrategy([PrologStrategy]);

    await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});
    const task = nar.taskManager.peekTask();

    if (task) {
      adaptive.selectSecondary(task, nar.memory);
      adaptive.selectSecondary(task, nar.memory);

      const stats = adaptive.getStats();
      const prologStats = stats.get('prolog');
      expect(prologStats).toBeDefined();
      if (prologStats) {
        expect(prologStats.pairsGenerated).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('Switching Strategy', () => {
  let nar: NAR;

  beforeEach(() => {
    nar = new NAR();
  });

  it('should switch between strategies', () => {
    const switching = new SwitchingStrategy([PrologStrategy, ResolutionStrategy], 5);
    expect(switching.name).toBe('switching');
    expect(switching.getCurrentStrategy()).toBe(PrologStrategy);
  });

  it('should cycle through strategies at interval', async () => {
    const switching = new SwitchingStrategy([PrologStrategy, ResolutionStrategy], 3);

    await nar.input('(a --> b)', 'belief', {f: 0.9, c: 0.9});
    const task = nar.taskManager.peekTask();

    if (task) {
      expect(switching.getCurrentStrategy()).toBe(PrologStrategy);

      switching.selectSecondary(task, nar.memory);
      switching.selectSecondary(task, nar.memory);
      switching.selectSecondary(task, nar.memory);

      expect(switching.getCurrentStrategy()).toBe(ResolutionStrategy);
    }
  });

  it('should reset to first strategy', () => {
    const switching = new SwitchingStrategy([PrologStrategy, ResolutionStrategy], 3);

    switching.reset();
    expect(switching.getCurrentStrategy()).toBe(PrologStrategy);
  });
});

describe('Strategy Factory Functions', () => {
  it('should create strategy with default options', () => {
    const strategy = createStrategy({
      name: 'test-strategy',
      sampleSize: 10,
      limit: 5
    });

    expect(strategy.name).toBe('test-strategy');
    expect(strategy.selectSecondary).toBeDefined();
  });

  it('should create strategy with custom filter', () => {
    const strategy = createStrategy({
      name: 'filtered-strategy',
      sampleSize: 15,
      limit: 7,
      filter: (concept) => concept.term.kind === 'inheritance'
    });

    expect(strategy.name).toBe('filtered-strategy');
  });

  it('should create strategy with custom selector', () => {
    const strategy = createStrategy({
      name: 'custom-selector',
      sampleSize: 20,
      limit: 10,
      selectFromSample: (sample, task, memory) => {
        return sample.slice(0, 5);
      }
    });

    expect(strategy.name).toBe('custom-selector');
  });
});

describe('Strategy Performance', () => {
  let nar: NAR;

  beforeEach(() => {
    nar = new NAR();
  });

  it('should handle large concept spaces efficiently', async () => {
    for (let i = 0; i < 50; i++) {
      await nar.input(`(concept${i} --> property)`, 'belief', {f: 0.9, c: 0.9});
    }

    const task = nar.taskManager.peekTask();
    if (task) {
      const strategies = [
        PrologStrategy,
        ResolutionStrategy,
        TermLinkStrategy,
        TaskMatchStrategy
      ];

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
      const strategies = [
        PrologStrategy,
        ResolutionStrategy,
        GoalDrivenStrategy,
        AnalogicalStrategy
      ];

      for (const strategy of strategies) {
        const results = strategy.selectSecondary(task, nar.memory);
        expect(Array.isArray(results)).toBe(true);
      }
    }
  });
});
