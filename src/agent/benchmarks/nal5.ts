import type {Scenario} from '../scenarios/types.js';

export const nal5NegationSuite: Scenario[] = [
    {
        id: 'nal5-neg-1',
        name: 'Basic Negation',
        category: 'benchmark',
        tags: ['nal5', 'negation'],
        description: 'Test negation: (--A)',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '((--A) --> B)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal5-neg-2',
        name: 'Negation in Predicate',
        category: 'benchmark',
        tags: ['nal5', 'negation'],
        description: 'Test negation in predicate position',
        steps: [
            {input: '(A --> (-- B)).', type: 'belief'},
            {input: '(A --> B)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal5-neg-3',
        name: 'Double Negation',
        category: 'benchmark',
        tags: ['nal5', 'negation'],
        description: 'Test double negation elimination',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '((-- (-- A)) --> B)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal5-neg-4',
        name: 'Negation with Inheritance',
        category: 'benchmark',
        tags: ['nal5', 'negation'],
        description: 'Test negation with inheritance chain',
        steps: [
            {input: '(bird --> animal).', type: 'belief'},
            {input: '(penguin --> bird).', type: 'belief'},
            {input: '((-- penguin) --> animal)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal5-neg-5',
        name: 'Negation Conflict',
        category: 'benchmark',
        tags: ['nal5', 'negation', 'conflict'],
        description: 'Test conflicting positive and negative beliefs',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(A --> (-- B)).', type: 'belief'},
            {input: '(A --> B)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal5-neg-6',
        name: 'Negation in Compound',
        category: 'benchmark',
        tags: ['nal5', 'negation', 'compound'],
        description: 'Test negation within compound terms',
        steps: [
            {input: '((A & (-- B)) --> C).', type: 'belief'},
            {input: '(A --> C)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal5-neg-7',
        name: 'Negation with Question',
        category: 'benchmark',
        tags: ['nal5', 'negation'],
        description: 'Test negation in question form',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(A --> (-- B))? ', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal5-neg-8',
        name: 'Negation and Revision',
        category: 'benchmark',
        tags: ['nal5', 'negation', 'revision'],
        description: 'Test negation interacts with revision',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(A --> B).', type: 'belief'},
            {input: '(A --> (-- B)).', type: 'belief'},
            {input: '(A --> B)?', type: 'question', runSteps: 4},
        ],
        weight: 1,
    },
];

export default nal5NegationSuite;
