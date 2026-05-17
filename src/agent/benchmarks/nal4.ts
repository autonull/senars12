import type {Scenario} from '../scenarios/types.js';

export const nal4RevisionSuite: Scenario[] = [
    {
        id: 'nal4-rev-1',
        name: 'Basic Revision',
        category: 'benchmark',
        tags: ['nal4', 'revision'],
        description: 'Test belief revision with same fact, different truth values',
        steps: [
            {input: '(A --> B).', type: 'belief', label: 'First belief'},
            {input: '(A --> B).', type: 'belief', label: 'Same belief again'},
            {input: '(A --> B)?', type: 'question', runSteps: 2},
        ],
        expectation: {
            afterSteps: 3,
            responseContains: 'A --> B',
        },
        weight: 1,
    },
    {
        id: 'nal4-rev-2',
        name: 'Revision with Confidence Increase',
        category: 'benchmark',
        tags: ['nal4', 'revision'],
        description: 'Repeated evidence should increase confidence',
        steps: [
            {input: '(bird --> fly).', type: 'belief'},
            {input: '(bird --> fly).', type: 'belief'},
            {input: '(bird --> fly).', type: 'belief'},
            {input: '(bird --> fly)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
    {
        id: 'nal4-rev-3',
        name: 'Conflicting Revision',
        category: 'benchmark',
        tags: ['nal4', 'revision', 'conflict'],
        description: 'Test revision with contradictory beliefs',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(A --> (-- B)).', type: 'belief'},
            {input: '(A --> B)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal4-rev-4',
        name: 'Revision with Different Sources',
        category: 'benchmark',
        tags: ['nal4', 'revision'],
        description: 'Test revision from different input sources',
        steps: [
            {input: '(cat --> mammal).', type: 'belief'},
            {input: '(cat --> mammal).', type: 'belief'},
            {input: '(cat --> ?X)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal4-rev-5',
        name: 'Revision Stability',
        category: 'benchmark',
        tags: ['nal4', 'revision'],
        description: 'Test that revision produces stable results',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(A --> B).', type: 'belief'},
            {input: '(A --> B).', type: 'belief'},
            {input: '(A --> B)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
    {
        id: 'nal4-rev-6',
        name: 'Revision with Multiple Terms',
        category: 'benchmark',
        tags: ['nal4', 'revision'],
        description: 'Test revision with complex terms',
        steps: [
            {input: '((A & B) --> C).', type: 'belief'},
            {input: '((A & B) --> C).', type: 'belief'},
            {input: '((A & B) --> C)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
];

export default nal4RevisionSuite;
