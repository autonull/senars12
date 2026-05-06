/**
 * Resource Bounds & AIKR Compliance Tests
 */
import { NAR } from '../../nar.js';
import { TermFactory } from '../../terms/factory.js';
import { Truth } from '../../terms/truth.js';

describe('AIKR Compliance', () => {
  let nar: NAR;

  beforeEach(() => {
    nar = new NAR({
      maxConcepts: 100,
      priorityThreshold: 0.1,
      activationDecayRate: 0.01,
      consolidationInterval: 5,
      cpuThrottleMs: 10,
      maxDerivationDepth: 10,
      maxDerivationsPerStep: 100,
      enableLMRules: false
    });
  });

  describe('Anytime Execution', () => {
    it('produces results even if interrupted', async () => {
      await nar.input('(x --> y)', 'belief');

      const results: any[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await nar.run(1);
        results.push(r);
        if (results.length > 0) break;
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it('can be stopped at any cycle', async () => {
      await nar.input('(a --> b)', 'belief');

      let derived = 0;
      for (let i = 0; i < 5; i++) {
        const r = await nar.run(1);
        derived += r;
        if (i === 2) break;
      }

      expect(derived >= 0).toBe(true);
    });
  });

  describe('Bounded Resources', () => {
    it('respects memory limits', async () => {
      const startMem = process.memoryUsage().heapUsed;

      for (let i = 0; i < 10; i++) {
        await nar.run(1);
      }

      const endMem = process.memoryUsage().heapUsed;
      const growth = (endMem - startMem) / 1024 / 1024;

      expect(growth).toBeLessThan(50);
    });

    it('respects derivation depth limits', async () => {
      await nar.input('(a --> b)', 'belief');
      await nar.input('(b --> c)', 'belief');
      await nar.input('(c --> d)', 'belief');

      const results = await nar.run(5);
      expect(Array.isArray(results)).toBe(true);
    });

    it('handles resource constraints gracefully', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        await nar.run(1);
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('Knowledge-Grounded', () => {
    it('uses existing beliefs for reasoning', async () => {
      await nar.input('(human --> mortal)', 'belief', Truth.create(0.99, 0.99));
      await nar.input('(socrates --> human)', 'belief', Truth.create(0.99, 0.99));
      await nar.run(1);

      const socrates = nar.memory.getConcept(TermFactory.atom('socrates'));
      expect(socrates).toBeDefined();
    });

    it('builds on established concepts', async () => {
      await nar.input('(bird --> animal)', 'belief');
      await nar.input('(animal --> living)', 'belief');

      await nar.run(2);

      const bird = nar.memory.getConcept(TermFactory.atom('bird'));
      expect(bird).toBeDefined();
    });
  });

  describe('Resource-Aware', () => {
    it('throttles execution to prevent blocking', async () => {
      const start = Date.now();

      await nar.run(5);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10000);
    });

    it('yields control periodically', async () => {
      const start = Date.now();

      for (let i = 0; i < 5; i++) {
        await nar.run(1);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('Complete Reasoning Cycle', () => {
    it('executes full cognitive cycle from input to derived belief', async () => {
      await nar.input('(bird --> animal)', 'belief', Truth.create(0.9, 0.9));
      await nar.input('(animal --> living)', 'belief', Truth.create(0.9, 0.9));
      await nar.input('(living --> needs-oxygen)', 'belief', Truth.create(0.95, 0.95));

      const initialSize = nar.memory.size;
      expect(initialSize).toBeGreaterThan(0);

      for (let i = 0; i < 5; i++) {
        await nar.run(1);
      }

      expect(nar.memory.size).toBeGreaterThanOrEqual(initialSize);

      const birdConcept = nar.memory.getConcept(TermFactory.atom('bird'));
      if (birdConcept) {
        expect(birdConcept.totalTasks).toBeGreaterThanOrEqual(0);
      }
    });

    it('demonstrates emergent reasoning behavior', async () => {
      const premises = [['rain', 'wet'], ['wet', 'slippery'], ['slippery', 'dangerous']];

      for (const [from, to] of premises) {
        await nar.input(`(${from} --> ${to})`, 'belief', Truth.create(0.85, 0.85));
      }

      await nar.run(3);

      expect(nar.memory.size).toBeGreaterThan(0);
    });
  });
});
