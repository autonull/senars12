import type {Scenario} from '../scenarios/types.js';

export const nal2CompoundSuite: Scenario[] = [
    {
        id: 'nal2-comp-1',
        name: 'Intersection Term',
        category: 'benchmark',
        tags: ['nal2', 'compound'],
        description: 'Test intersection compound: (A & B)',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(C --> B).', type: 'belief'},
            {input: '((A & C) --> B)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal2-comp-2',
        name: 'Union Term',
        category: 'benchmark',
        tags: ['nal2', 'compound'],
        description: 'Test union compound: (A | B)',
        steps: [
            {input: '(A --> X).', type: 'belief'},
            {input: '(B --> Y).', type: 'belief'},
            {input: '((A | B) --> (X | Y))?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal2-comp-3',
        name: 'Product Term',
        category: 'benchmark',
        tags: ['nal2', 'compound'],
        description: 'Test product compound: (A × B)',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '((A × B) --> (B × A))?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
    {
        id: 'nal2-comp-4',
        name: 'Negation Compound',
        category: 'benchmark',
        tags: ['nal2', 'compound', 'negation'],
        description: 'Test negation: (--A)',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '((--A) --> B)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
    {
        id: 'nal2-comp-5',
        name: 'Conjunction Simplification',
        category: 'benchmark',
        tags: ['nal2', 'compound'],
        description: 'Test conjunction simplification',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(C --> D).', type: 'belief'},
            {input: '((A & C) --> (B & D))?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal2-comp-6',
        name: 'Disjunction Simplification',
        category: 'benchmark',
        tags: ['nal2', 'compound'],
        description: 'Test disjunction simplification',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(C --> D).', type: 'belief'},
            {input: '((A | C) --> (B | D))?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal2-comp-7',
        name: 'Compound With Variable',
        category: 'benchmark',
        tags: ['nal2', 'compound'],
        description: 'Test compound with variable',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(C --> ?X)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal2-comp-8',
        name: 'Nested Compound',
        category: 'benchmark',
        tags: ['nal2', 'compound'],
        description: 'Test nested compound terms',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(B --> C).', type: 'belief'},
            {input: '((A & B) --> C)?', type: 'question', runSteps: 4},
        ],
        weight: 1,
    },
    {
        id: 'nal2-comp-9',
        name: 'Difference Compound',
        category: 'benchmark',
        tags: ['nal2', 'compound'],
        description: 'Test difference compound: (A -- B)',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(C --> B).', type: 'belief'},
            {input: '((A -- C) --> B)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal2-comp-10',
        name: 'Image Compound',
        category: 'benchmark',
        tags: ['nal2', 'compound'],
        description: 'Test image compound: (/ A B C)',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '((/ A C B) --> something)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
];

export default nal2CompoundSuite;