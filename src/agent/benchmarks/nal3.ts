import type {Scenario} from '../scenarios/types.js';

export const nal3HigherOrderSuite: Scenario[] = [
    {
        id: 'nal3-high-1',
        name: 'Implication Introduction',
        category: 'benchmark',
        tags: ['nal3', 'higher-order'],
        description: 'Test implication: (A => B)',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(C --> B).', type: 'belief'},
            {input: '((A & C) => B)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal3-high-2',
        name: 'Equivalence Introduction',
        category: 'benchmark',
        tags: ['nal3', 'higher-order'],
        description: 'Test equivalence: (A <=> B)',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(B --> A).', type: 'belief'},
            {input: '(A <=> B)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal3-high-3',
        name: 'Implication Transitivity',
        category: 'benchmark',
        tags: ['nal3', 'higher-order'],
        description: 'Test implication transitivity',
        steps: [
            {input: '(A => B).', type: 'belief'},
            {input: '(B => C).', type: 'belief'},
            {input: '(A => C)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal3-high-4',
        name: 'Higher Order Inference',
        category: 'benchmark',
        tags: ['nal3', 'higher-order'],
        description: 'Test higher-order inference',
        steps: [
            {input: '((A --> B) => (B --> C)).', type: 'belief'},
            {input: '(A --> B).', type: 'belief'},
            {input: '(B --> C)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal3-high-5',
        name: 'Implication vs Inheritance',
        category: 'benchmark',
        tags: ['nal3', 'higher-order'],
        description: 'Test difference between implication and inheritance',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(A => B).', type: 'belief'},
            {input: '(A => B)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal3-high-6',
        name: 'Nested Implication',
        category: 'benchmark',
        tags: ['nal3', 'higher-order'],
        description: 'Test nested implication',
        steps: [
            {input: '(A => B).', type: 'belief'},
            {input: '(B => C).', type: 'belief'},
            {input: '(C => D).', type: 'belief'},
            {input: '(A => D)?', type: 'question', runSteps: 4},
        ],
        weight: 1,
    },
    {
        id: 'nal3-high-7',
        name: 'Implication with Variables',
        category: 'benchmark',
        tags: ['nal3', 'higher-order'],
        description: 'Test implication with variables',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(?X --> ?Y)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal3-high-8',
        name: 'Equivalence Symmetry',
        category: 'benchmark',
        tags: ['nal3', 'higher-order'],
        description: 'Test equivalence symmetry',
        steps: [
            {input: '(A <=> B).', type: 'belief'},
            {input: '(B <=> A)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
];

export default nal3HigherOrderSuite;