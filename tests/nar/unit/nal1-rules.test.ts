/**
 * NAL1 Core Rules Unit Tests
 * Tests for fundamental inference rules: deduction, induction, abduction
 */

import {describe, it, expect} from '@jest/globals';
import {NAR} from '../../../src/nar/nar.js';
import {assertReasoning, describeReasoning, createPremise, expectDerivation} from '../framework/ReasoningTestBuilder.js';

describeReasoning('NAL1 Core Rules', [
  {
    name: 'Deduction: A → B, B → C ⊢ A → C',
    premises: [
      createPremise('inheritance<animal, mammal>', 'belief', 0.9, 0.9),
      createPremise('inheritance<mammal, dog>', 'belief', 0.9, 0.9)
    ],
    cycles: 5,
    expect: [
      expectDerivation('inheritance<animal, dog>', {
        minFrequency: 0.5,
        minConfidence: 0.5
      })
    ]
  },
  {
    name: 'Induction: A → C, B → C ⊢ A → B',
    premises: [
      createPremise('inheritance<dog, animal>', 'belief', 0.9, 0.9),
      createPremise('inheritance<cat, animal>', 'belief', 0.9, 0.9)
    ],
    cycles: 5,
    expect: [
      expectDerivation('inheritance<dog, cat>', {
        minFrequency: 0.3,
        minConfidence: 0.3
      })
    ]
  },
  {
    name: 'Abduction: A → C, B → C ⊢ A → B (explanation)',
    premises: [
      createPremise('inheritance<dog, mammal>', 'belief', 0.9, 0.9),
      createPremise('inheritance<animal, mammal>', 'belief', 0.9, 0.9)
    ],
    cycles: 5,
    expect: [
      expectDerivation('inheritance<dog, animal>', {
        minFrequency: 0.3,
        minConfidence: 0.3
      })
    ]
  },
  {
    name: 'Deduction chain: (A → B), (B → C), (C → D) ⊢ (A → D)',
    premises: [
      createPremise('inheritance<a, b>', 'belief', 0.9, 0.9),
      createPremise('inheritance<b, c>', 'belief', 0.9, 0.9),
      createPremise('inheritance<c, d>', 'belief', 0.9, 0.9)
    ],
    cycles: 10,
    expect: [
      expectDerivation('inheritance<a, d>', {
        minFrequency: 0.4,
        minConfidence: 0.4
      })
    ]
  },
  {
    name: 'Multiple deductions from same premise',
    premises: [
      createPremise('inheritance<a, b>', 'belief', 0.9, 0.9),
      createPremise('inheritance<b, c>', 'belief', 0.9, 0.9),
      createPremise('inheritance<b, d>', 'belief', 0.9, 0.9)
    ],
    cycles: 8,
    expect: [
      expectDerivation('inheritance<a, c>', {minFrequency: 0.3}),
      expectDerivation('inheritance<a, d>', {minFrequency: 0.3})
    ]
  },
  {
    name: 'Deduction with lower truth values',
    premises: [
      createPremise('inheritance<x, y>', 'belief', 0.6, 0.7),
      createPremise('inheritance<y, z>', 'belief', 0.6, 0.7)
    ],
    cycles: 5,
    expect: [
      expectDerivation('inheritance<x, z>', {
        minFrequency: 0.2,
        minConfidence: 0.2
      })
    ]
  },
  {
    name: 'Induction with shared predicate',
    premises: [
      createPremise('inheritance<robin, bird>', 'belief', 0.95, 0.9),
      createPremise('inheritance<sparrow, bird>', 'belief', 0.95, 0.9)
    ],
    cycles: 5,
    expect: [
      expectDerivation('inheritance<robin, sparrow>', {
        minFrequency: 0.4,
        minConfidence: 0.3
      })
    ]
  },
  {
    name: 'Abduction for diagnostic reasoning',
    premises: [
      createPremise('inheritance<rain, wet>', 'belief', 0.9, 0.95),
      createPremise('inheritance<sprinkler, wet>', 'belief', 0.9, 0.95)
    ],
    cycles: 5,
    expect: [
      expectDerivation('inheritance<rain, sprinkler>', {
        minFrequency: 0.3,
        minConfidence: 0.3
      })
    ]
  },
  {
    name: 'Deduction with very high confidence',
    premises: [
      createPremise('inheritance<square, rectangle>', 'belief', 0.99, 0.99),
      createPremise('inheritance<rectangle, polygon>', 'belief', 0.99, 0.99)
    ],
    cycles: 5,
    expect: [
      expectDerivation('inheritance<square, polygon>', {
        minFrequency: 0.8,
        minConfidence: 0.8
      })
    ]
  },
  {
    name: 'Failed deduction: no matching middle term',
    premises: [
      createPremise('inheritance<a, b>', 'belief', 0.9, 0.9),
      createPremise('inheritance<c, d>', 'belief', 0.9, 0.9)
    ],
    cycles: 5,
    expect: [],
    expectNot: [
      expectDerivation('inheritance<a, d>')
    ]
  }
]);

describe('NAL1 Truth Value Computations', () => {
  it('should preserve truth values through deduction', async () => {
    const result = await assertReasoning({
      name: 'Truth preservation in deduction',
      premises: [
        createPremise('inheritance<high_conf, test>', 'belief', 0.9, 0.95),
        createPremise('inheritance<test, result>', 'belief', 0.9, 0.95)
      ],
      cycles: 5,
      expect: [
        expectDerivation('inheritance<high_conf, result>', {
          minFrequency: 0.7,
          minConfidence: 0.6
        })
      ]
    });
    expect(result.passed).toBe(true);
  });

  it('should handle asymmetric truth values', async () => {
    const result = await assertReasoning({
      name: 'Asymmetric truth values',
      premises: [
        createPremise('inheritance<weak, strong>', 'belief', 0.4, 0.9),
        createPremise('inheritance<strong, stronger>', 'belief', 0.9, 0.9)
      ],
      cycles: 5,
      expect: [
        expectDerivation('inheritance<weak, stronger>', {
          minFrequency: 0.2,
          minConfidence: 0.3
        })
      ]
    });
    expect(result.passed).toBe(true);
  });

  it('should compute confidence correctly in multi-step deduction', async () => {
    const result = await assertReasoning({
      name: 'Multi-step confidence computation',
      premises: [
        createPremise('inheritance<a, b>', 'belief', 0.8, 0.8),
        createPremise('inheritance<b, c>', 'belief', 0.8, 0.8),
        createPremise('inheritance<c, d>', 'belief', 0.8, 0.8)
      ],
      cycles: 10,
      expect: [
        expectDerivation('inheritance<a, d>', {
          minFrequency: 0.3,
          minConfidence: 0.2
        })
      ]
    });
    expect(result.passed).toBe(true);
  });
});

describe('NAL1 Rule Application Edge Cases', () => {
  it('should handle self-referential terms gracefully', async () => {
    const result = await assertReasoning({
      name: 'Self-referential deduction',
      premises: [
        createPremise('inheritance<a, a>', 'belief', 0.9, 0.9),
        createPremise('inheritance<a, b>', 'belief', 0.9, 0.9)
      ],
      cycles: 5,
      expect: [
        expectDerivation('inheritance<a, b>')
      ]
    });
    expect(result.passed).toBe(true);
  });

  it('should not derive from contradictory premises immediately', async () => {
    const result = await assertReasoning({
      name: 'Contradictory premises handling',
      premises: [
        createPremise('inheritance<a, b>', 'belief', 0.9, 0.9),
        createPremise('inheritance<a, b>', 'belief', 0.1, 0.5)
      ],
      cycles: 5,
      expect: [
        expectDerivation('inheritance<a, b>', {
          minFrequency: 0.3,
          maxFrequency: 0.9
        })
      ]
    });
    expect(result.passed).toBe(true);
  });

  it('should handle chain with varying confidence levels', async () => {
    const result = await assertReasoning({
      name: 'Varying confidence chain',
      premises: [
        createPremise('inheritance<a, b>', 'belief', 0.9, 0.95),
        createPremise('inheritance<b, c>', 'belief', 0.5, 0.6),
        createPremise('inheritance<c, d>', 'belief', 0.9, 0.95)
      ],
      cycles: 10,
      expect: [
        expectDerivation('inheritance<a, d>', {
          minFrequency: 0.2,
          minConfidence: 0.15
        })
      ]
    });
    expect(result.passed).toBe(true);
  });
});
