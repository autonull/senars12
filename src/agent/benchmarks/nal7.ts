import type {Scenario} from '../scenarios/types.js';

export const nal7TemporalSuite: Scenario[] = [
    {
        id: 'nal7-temp-1',
        name: 'Temporal Implication',
        category: 'benchmark',
        tags: ['nal7', 'temporal'],
        description: 'Test temporal implication: (A =/> B)',
        steps: [
            {input: '(A =/> B).', type: 'belief'},
            {input: '(A).', type: 'belief'},
            {input: '(B)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal7-temp-2',
        name: 'Temporal Prediction',
        category: 'benchmark',
        tags: ['nal7', 'temporal'],
        description: 'Test temporal prediction from sequence',
        steps: [
            {input: '(lightning =/> thunder).', type: 'belief'},
            {input: '(lightning).', type: 'belief'},
            {input: '(thunder)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal7-temp-3',
        name: 'Temporal Equivalence',
        category: 'benchmark',
        tags: ['nal7', 'temporal'],
        description: 'Test temporal equivalence: (A <=>/> B)',
        steps: [
            {input: '(A <=>/> B).', type: 'belief'},
            {input: '(A).', type: 'belief'},
            {input: '(B)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal7-temp-4',
        name: 'Temporal Chain',
        category: 'benchmark',
        tags: ['nal7', 'temporal'],
        description: 'Test chained temporal implications',
        steps: [
            {input: '(A =/> B).', type: 'belief'},
            {input: '(B =/> C).', type: 'belief'},
            {input: '(A).', type: 'belief'},
            {input: '(C)?', type: 'question', runSteps: 4},
        ],
        weight: 1,
    },
    {
        id: 'nal7-temp-5',
        name: 'Event Sequence',
        category: 'benchmark',
        tags: ['nal7', 'temporal'],
        description: 'Test event sequence learning',
        steps: [
            {input: '(press-button =/> door-opens).', type: 'belief'},
            {input: '(press-button).', type: 'belief'},
            {input: '(door-opens)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal7-temp-6',
        name: 'Temporal Negation',
        category: 'benchmark',
        tags: ['nal7', 'temporal', 'negation'],
        description: 'Test temporal implication with negation',
        steps: [
            {input: '(rain =/> wet-ground).', type: 'belief'},
            {input: '(-- rain).', type: 'belief'},
            {input: '(wet-ground)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
];

export default nal7TemporalSuite;
