/**
 * NAL1 Core Rules Unit Tests
 * Tests for fundamental inference rules: deduction, induction, abduction
 */

import { describe, expect, it } from 'vitest';
import { assertReasoning, createPremise, describeReasoning, expectDerivation } from '../framework';

describeReasoning('NAL1 Core Rules', [
  {
    name: 'Deduction: A → B, B → C ⊢ A → C',
    premises: [
      createPremise('(animal --> mammal)', 'belief', 0.9, 0.9),
      createPremise('(mammal --> dog)', 'belief', 0.9, 0.9),
    ],
    cycles: 5,
    expect: [
      expectDerivation('(animal --> dog)', {
        minFrequency: 0.5,
        minConfidence: 0.5,
      }),
    ],
  },
  {
    name: 'Induction: A → C, B → C ⊢ A → B',
    premises: [
      createPremise('(dog --> animal)', 'belief', 0.9, 0.9),
      createPremise('(cat --> animal)', 'belief', 0.9, 0.9),
    ],
    cycles: 5,
    expect: [
      expectDerivation('(dog --> cat)', {
        minFrequency: 0.3,
        minConfidence: 0.3,
      }),
    ],
  },
  {
    name: 'Abduction: A → C, B → C ⊢ A → B (explanation)',
    premises: [
      createPremise('(dog --> mammal)', 'belief', 0.9, 0.9),
      createPremise('(animal --> mammal)', 'belief', 0.9, 0.9),
    ],
    cycles: 5,
    expect: [
      expectDerivation('(dog --> animal)', {
        minFrequency: 0.3,
        minConfidence: 0.3,
      }),
    ],
  },
  {
    name: 'Deduction chain: (A → B), (B → C), (C → D) ⊢ (A → D)',
    premises: [
      createPremise('(a --> b)', 'belief', 0.9, 0.9),
      createPremise('(b --> c)', 'belief', 0.9, 0.9),
      createPremise('(c --> d)', 'belief', 0.9, 0.9),
    ],
    cycles: 10,
    expect: [
      expectDerivation('(a --> d)', {
        minFrequency: 0.4,
        minConfidence: 0.4,
      }),
    ],
  },
  {
    name: 'Multiple deductions from same premise',
    premises: [
      createPremise('(a --> b)', 'belief', 0.9, 0.9),
      createPremise('(b --> c)', 'belief', 0.9, 0.9),
      createPremise('(b --> d)', 'belief', 0.9, 0.9),
    ],
    cycles: 8,
    expect: [
      expectDerivation('(a --> c)', { minFrequency: 0.3 }),
      expectDerivation('(a --> d)', { minFrequency: 0.3 }),
    ],
  },
  {
    name: 'Deduction with lower truth values',
    premises: [
      createPremise('(x --> y)', 'belief', 0.6, 0.7),
      createPremise('(y --> z)', 'belief', 0.6, 0.7),
    ],
    cycles: 5,
    expect: [
      expectDerivation('(x --> z)', {
        minFrequency: 0.2,
        minConfidence: 0.2,
      }),
    ],
  },
  {
    name: 'Induction with shared predicate',
    premises: [
      createPremise('(robin --> bird)', 'belief', 0.95, 0.9),
      createPremise('(sparrow --> bird)', 'belief', 0.95, 0.9),
    ],
    cycles: 5,
    expect: [
      expectDerivation('(robin --> sparrow)', {
        minFrequency: 0.4,
        minConfidence: 0.3,
      }),
    ],
  },
  {
    name: 'Abduction for diagnostic reasoning',
    premises: [
      createPremise('(rain --> wet)', 'belief', 0.9, 0.95),
      createPremise('(sprinkler --> wet)', 'belief', 0.9, 0.95),
    ],
    cycles: 5,
    expect: [
      expectDerivation('(rain --> sprinkler)', {
        minFrequency: 0.3,
        minConfidence: 0.3,
      }),
    ],
  },
  {
    name: 'Deduction with very high confidence',
    premises: [
      createPremise('(square --> rectangle)', 'belief', 0.99, 0.99),
      createPremise('(rectangle --> polygon)', 'belief', 0.99, 0.99),
    ],
    cycles: 5,
    expect: [
      expectDerivation('(square --> polygon)', {
        minFrequency: 0.8,
        minConfidence: 0.8,
      }),
    ],
  },
  {
    name: 'Failed deduction: no matching middle term',
    premises: [
      createPremise('(a --> b)', 'belief', 0.9, 0.9),
      createPremise('(c --> d)', 'belief', 0.9, 0.9),
    ],
    cycles: 5,
    expect: [],
  },
]);

describe('NAL1 Truth Value Computations', () => {
  it('should preserve truth values through deduction', async () => {
    const result = await assertReasoning({
      name: 'Truth preservation in deduction',
      premises: [
        createPremise('(high_conf --> test)', 'belief', 0.9, 0.95),
        createPremise('(test --> result)', 'belief', 0.9, 0.95),
      ],
      cycles: 5,
      expect: [
        expectDerivation('(high_conf --> result)', {
          minFrequency: 0.7,
          minConfidence: 0.6,
        }),
      ],
    });
    expect(result.passed).toBe(true);
  });

  it('should handle asymmetric truth values', async () => {
    const result = await assertReasoning({
      name: 'Asymmetric truth values',
      premises: [
        createPremise('(weak --> strong)', 'belief', 0.4, 0.9),
        createPremise('(strong --> stronger)', 'belief', 0.9, 0.9),
      ],
      cycles: 5,
      expect: [
        expectDerivation('(weak --> stronger)', {
          minFrequency: 0.2,
          minConfidence: 0.3,
        }),
      ],
    });
    expect(result.passed).toBe(true);
  });

  it('should compute confidence correctly in multi-step deduction', async () => {
    const result = await assertReasoning({
      name: 'Multi-step confidence computation',
      premises: [
        createPremise('(a --> b)', 'belief', 0.8, 0.8),
        createPremise('(b --> c)', 'belief', 0.8, 0.8),
        createPremise('(c --> d)', 'belief', 0.8, 0.8),
      ],
      cycles: 10,
      expect: [
        expectDerivation('(a --> d)', {
          minFrequency: 0.3,
          minConfidence: 0.2,
        }),
      ],
    });
    expect(result.passed).toBe(true);
  });
});

describe('NAL1 Rule Application Edge Cases', () => {
  it('should handle self-referential terms gracefully', async () => {
    const result = await assertReasoning({
      name: 'Self-referential deduction',
      premises: [
        createPremise('(a --> a)', 'belief', 0.9, 0.9),
        createPremise('(a --> b)', 'belief', 0.9, 0.9),
      ],
      cycles: 5,
      expect: [expectDerivation('(a --> b)')],
    });
    expect(result.passed).toBe(true);
  });

  it('should not derive from contradictory premises immediately', async () => {
    const result = await assertReasoning({
      name: 'Contradictory premises handling',
      premises: [
        createPremise('(a --> b)', 'belief', 0.9, 0.9),
        createPremise('(a --> b)', 'belief', 0.1, 0.5),
      ],
      cycles: 5,
      expect: [
        expectDerivation('(a --> b)', {
          minFrequency: 0.3,
          maxFrequency: 0.9,
        }),
      ],
    });
    expect(result.passed).toBe(true);
  });

  it('should handle chain with varying confidence levels', async () => {
    const result = await assertReasoning({
      name: 'Varying confidence chain',
      premises: [
        createPremise('(a --> b)', 'belief', 0.9, 0.95),
        createPremise('(b --> c)', 'belief', 0.5, 0.6),
        createPremise('(c --> d)', 'belief', 0.9, 0.95),
      ],
      cycles: 10,
      expect: [
        expectDerivation('(a --> d)', {
          minFrequency: 0.2,
          minConfidence: 0.15,
        }),
      ],
    });
    expect(result.passed).toBe(true);
  });
});
