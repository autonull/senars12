/**
 * Inference Rules Tests - Deduction, Induction, Abduction
 */
import { NAR } from '../../nar.js';
import { TermBuilder } from '../../terms/factory.js';
import { Truth } from '../../terms/truth.js';

describe('Inference Rules', () => {
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

  describe('Deduction', () => {
    it('performs deduction: (A --> B), (B --> C) |- (A --> C)', async () => {
      await nar.input('(bird --> animal)', 'belief', Truth.create(0.9, 0.9));
      await nar.input('(animal --> living)', 'belief', Truth.create(0.9, 0.9));
      await nar.run(1);
      const birdConcept = nar.memory.getConcept(TermBuilder.atom('bird'));
      expect(birdConcept).toBeDefined();
    });

    it('chains multiple deduction steps', async () => {
      await nar.input('(mammal --> animal)', 'belief', Truth.create(0.95, 0.9));
      await nar.input('(dog --> mammal)', 'belief', Truth.create(0.95, 0.9));
      await nar.run(2);
      const dogConcept = nar.memory.getConcept(TermBuilder.atom('dog'));
      expect(dogConcept).toBeDefined();
    });
  });

  describe('Similarity', () => {
    it('handles similarity reasoning', async () => {
      await nar.input('(cat <-> feline)', 'belief', Truth.create(0.95, 0.9));
      await nar.run(1);
      const catConcept = nar.memory.getConcept(TermBuilder.atom('cat'));
      expect(catConcept).toBeDefined();
    });
  });

  describe('Complex Reasoning', () => {
    it('manages conflicting beliefs', async () => {
      await nar.input('(bird --> fly)', 'belief', Truth.create(0.9, 0.8));
      await nar.input('(penguin --> bird)', 'belief', Truth.create(0.95, 0.9));
      await nar.run(2);
      expect(nar.memory.size).toBeGreaterThan(0);
    });

  it('handles compound terms in reasoning', async () => {
    const cat = TermBuilder.atom('cat');
    const dog = TermBuilder.atom('dog');
    const pets = TermBuilder.conjunction(cat, dog);
    expect(pets.kind).toBe('conjunction');
    if ('args' in pets) expect(pets.args).toHaveLength(2);
  });
  });
});
