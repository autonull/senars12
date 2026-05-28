/**
 * Inference Rules Tests - Using Declarative Test Framework
 * Tests for deduction, induction, abduction, and similarity reasoning
 */

import {createPremise, describeReasoning, expectDerivation} from '../framework';

describeReasoning('Inference Rules', [
    {
        name: 'deduction: (A --> B), (B --> C) |- (A --> C)',
        premises: [
            createPremise('(bird --> animal)', 'belief', 0.9, 0.9),
            createPremise('(animal --> living)', 'belief', 0.9, 0.9)
        ],
        cycles: 5,
        expect: [
            expectDerivation('(bird --> living)', {
                minFrequency: 0.7,
                minConfidence: 0.7
            })
        ]
    },
    {
        name: 'chained deduction: (dog --> mammal), (mammal --> animal), (animal --> living)',
        premises: [
            createPremise('(dog --> mammal)', 'belief', 0.95, 0.9),
            createPremise('(mammal --> animal)', 'belief', 0.95, 0.9),
            createPremise('(animal --> living)', 'belief', 0.95, 0.9)
        ],
        cycles: 10,
        expect: [
            expectDerivation('(dog --> living)', {
                minFrequency: 0.6,
                minConfidence: 0.6
            })
        ]
    },
    {
        name: 'induction: (canary --> bird), (sparrow --> bird) |- (canary --> sparrow)',
        premises: [
            createPremise('(canary --> bird)', 'belief', 0.9, 0.9),
            createPremise('(sparrow --> bird)', 'belief', 0.9, 0.9)
        ],
        cycles: 5,
        expect: [
            expectDerivation('(canary --> sparrow)', {
                minFrequency: 0.5,
                minConfidence: 0.5
            })
        ]
    },
    {
        name: 'abduction: (smoke --> fire), (smoke --> observed) |- (observed --> fire) likely',
        premises: [
            createPremise('(smoke --> fire)', 'belief', 0.9, 0.9),
            createPremise('(smoke --> observed)', 'belief', 0.95, 0.95)
        ],
        cycles: 5,
        expect: [
            expectDerivation('(observed --> fire)', {
                minFrequency: 0.5,
                minConfidence: 0.4
            })
        ]
    },
    {
        name: 'similarity reasoning: (cat <-> feline)',
        premises: [
            createPremise('(cat <-> feline)', 'belief', 0.95, 0.9)
        ],
        cycles: 3,
        expect: [
            expectDerivation('(cat <-> feline)', {
                minFrequency: 0.8,
                minConfidence: 0.8,
                minPriority: 0.1
            })
        ]
    },
    {
        name: 'conflicting beliefs: bird can fly vs penguin cannot fly',
        premises: [
            createPremise('(bird --> fly)', 'belief', 0.9, 0.8),
            createPremise('(penguin --> bird)', 'belief', 0.95, 0.9),
            createPremise('(penguin --> (-- fly))', 'belief', 0.95, 0.9)
        ],
        cycles: 10,
        expect: [
            expectDerivation('(penguin --> bird)', {
                minFrequency: 0.8,
                minConfidence: 0.8
            })
        ]
    },
    {
        name: 'compound term reasoning: conjunction from shared subject',
        premises: [
            createPremise('(cat --> pet)', 'belief', 0.9, 0.9),
            createPremise('(cat --> animal)', 'belief', 0.9, 0.9)
        ],
        cycles: 5,
        expect: [
            expectDerivation('([pet, animal])', {
                minFrequency: 0.5,
                minConfidence: 0.5
            })
        ]
    },
    {
        name: 'temporal reasoning: A ,/ B stored and retrieved',
        premises: [
            createPremise('(A ,/ B)', 'belief', 0.9, 0.9),
            createPremise('(B ,/ C)', 'belief', 0.9, 0.9)
        ],
        cycles: 3,
        expect: [
            expectDerivation('(A ,/ B)', {
                minFrequency: 0.8,
                minConfidence: 0.8,
                minPriority: 0.1
            }),
            expectDerivation('(B ,/ C)', {
                minFrequency: 0.8,
                minConfidence: 0.8,
                minPriority: 0.1
            })
        ]
    },
    {
        name: 'analogy: A --> B, B <-> C |- A --> C',
        premises: [
            createPremise('(cat --> mammal)', 'belief', 0.9, 0.9),
            createPremise('(mammal <-> warm-blooded)', 'belief', 0.8, 0.8)
        ],
        cycles: 5,
        expect: [
            expectDerivation('(cat --> warm-blooded)', {
                minFrequency: 0.5,
                minConfidence: 0.4
            })
        ]
    },
    {
        name: 'revision: merge multiple sources of evidence',
        premises: [
            createPremise('(X --> Y)', 'belief', 0.8, 0.7),
            createPremise('(X --> Y)', 'belief', 0.9, 0.8)
        ],
        cycles: 3,
        expect: [
            expectDerivation('(X --> Y)', {
                minFrequency: 0.8,
                minConfidence: 0.85
            })
        ]
    }
]);

describeReasoning('Complex Reasoning Patterns', [
    {
        name: 'multi-step deduction chain',
        premises: [
            createPremise('(A --> B)', 'belief', 0.95, 0.9),
            createPremise('(B --> C)', 'belief', 0.95, 0.9),
            createPremise('(C --> D)', 'belief', 0.95, 0.9),
            createPremise('(D --> E)', 'belief', 0.95, 0.9)
        ],
        cycles: 15,
        expect: [
expectDerivation('(A --> E)', {
minFrequency: 0.5,
minConfidence: 0.49
})
        ]
    },
    {
        name: 'bidirectional inference',
        premises: [
            createPremise('(A --> B)', 'belief', 0.9, 0.9),
            createPremise('(B --> A)', 'belief', 0.9, 0.9)
        ],
        cycles: 5,
        expect: [
            expectDerivation('(A <-> B)', {
                minFrequency: 0.8,
                minConfidence: 0.8
            })
        ]
    },
    {
        name: 'goal-directed reasoning',
        premises: [
            createPremise('(A --> B)', 'belief', 0.9, 0.9),
            createPremise('(B --> C)', 'belief', 0.9, 0.9)
        ],
        cycles: 5,
        expect: [
            expectDerivation('(A --> C)', {
                minFrequency: 0.7,
                minConfidence: 0.7
            })
        ],
        expectNot: [
            {term: '(D --> E)'}
        ]
    }
]);
