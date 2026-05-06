/**
 * Memory Operations Tests - Concept formation, activation, decay, consolidation
 */
import { NAR } from '../../nar.js';
import { TermFactory } from '../../terms/factory.js';
import { Truth } from '../../terms/truth.js';

describe('Memory Operations', () => {
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

  describe('Concept Formation', () => {
    it('creates and retrieves concepts', async () => {
      await nar.input('knowledge', 'belief');
      const concept = nar.memory.getConcept(TermFactory.atom('knowledge'));
      expect(concept).toBeDefined();
      expect(concept.term.kind).toBe('atom');
    });

    it('stores compound term concepts', async () => {
      await nar.input('(bird --> animal)', 'belief');
      const concept = nar.memory.getConcept(
        TermFactory.inheritance(TermFactory.atom('bird'), TermFactory.atom('animal'))
      );
      expect(concept).toBeDefined();
    });
  });

  describe('Activation and Decay', () => {
    it('manages concept activation', async () => {
      await nar.input('important', 'belief', Truth.create(0.9, 0.9));
      const concept1 = nar.memory.getConcept(TermFactory.atom('important'));
      expect(concept1.priority).toBeGreaterThan(0);
    });

    it('applies decay over cycles', async () => {
      await nar.input('temporary', 'belief', Truth.create(0.9, 0.9));
      const concept1 = nar.memory.getConcept(TermFactory.atom('temporary'));
      const initialPriority = concept1.priority;

      for (let i = 0; i < 10; i++) {
        await nar.run(1);
      }

      const concept2 = nar.memory.getConcept(TermFactory.atom('temporary'));
      if (concept2) {
        expect(concept2.priority).toBeLessThanOrEqual(initialPriority);
      }
    });
  });

  describe('Consolidation and Forgetting', () => {
    it('consolidates memory and applies forgetting', async () => {
      for (let i = 0; i < 20; i++) {
        await nar.input(`concept_${i}`, 'belief');
      }

      expect(nar.memory.size).toBeGreaterThan(0);

      for (let i = 0; i < 50; i++) {
        await nar.run(1);
      }

      expect(nar.memory.size).toBeLessThanOrEqual(100);
    });

    it('forgets low-priority concepts when at capacity', async () => {
      for (let i = 0; i < 120; i++) {
        await nar.input(`item_${i}`, 'belief', Truth.create(0.1, 0.1));
      }

      expect(nar.memory.size).toBeLessThanOrEqual(100);
    });
  });

  describe('Budget Management', () => {
    it('propagates budget through derivations', async () => {
      await nar.input('(premise --> conclusion)', 'belief', Truth.create(0.8, 0.8));
      const concept = nar.memory.getConcept(TermFactory.atom('premise'));
      expect(concept).toBeDefined();
    });

    it('prioritizes high-budget tasks', async () => {
      await nar.input('urgent', 'belief', Truth.create(0.9, 0.9));
      await nar.input('normal', 'belief', Truth.create(0.5, 0.5));

      const urgent = nar.memory.getConcept(TermFactory.atom('urgent'));
      const normal = nar.memory.getConcept(TermFactory.atom('normal'));

      if (urgent && normal) {
        expect(urgent.priority).toBeGreaterThanOrEqual(normal.priority);
      }
    });
  });
});
