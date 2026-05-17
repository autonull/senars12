import type {Scenario} from '../scenarios/types.js';

export const memoryOpsSuite: Scenario[] = [
    {
        id: 'mem-ops-1',
        name: 'Add Belief',
        category: 'benchmark',
        tags: ['memory'],
        description: 'Test adding a belief to memory',
        steps: [
            {input: '(cat --> animal).', type: 'belief'},
            {input: '(cat --> animal)?', type: 'question', runSteps: 1},
        ],
        expectation: {
            afterSteps: 2,
            responseContains: 'cat',
        },
        weight: 1,
    },
    {
        id: 'mem-ops-2',
        name: 'Query Memory',
        category: 'benchmark',
        tags: ['memory'],
        description: 'Test querying memory for beliefs',
        steps: [
            {input: '(dog --> animal).', type: 'belief'},
            {input: '(dog --> ?X)?', type: 'question', runSteps: 2},
        ],
        expectation: {
            afterSteps: 3,
            responseContains: 'animal',
        },
        weight: 1,
    },
    {
        id: 'mem-ops-3',
        name: 'Multiple Beliefs',
        category: 'benchmark',
        tags: ['memory'],
        description: 'Test adding multiple beliefs',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(B --> C).', type: 'belief'},
            {input: '(C --> D).', type: 'belief'},
            {input: '(A --> D)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'mem-ops-4',
        name: 'Working Memory Pin',
        category: 'benchmark',
        tags: ['memory'],
        description: 'Test pinning value in working memory',
        steps: [
            {input: '!pin key value', type: 'command'},
            {input: '!recall key', type: 'command'},
        ],
        expectation: {
            afterSteps: 2,
            responseContains: 'value',
        },
        weight: 1,
    },
    {
        id: 'mem-ops-5',
        name: 'Working Memory Unpin',
        category: 'benchmark',
        tags: ['memory'],
        description: 'Test unpinning value from working memory',
        steps: [
            {input: '!pin temp value', type: 'command'},
            {input: '!unpin temp', type: 'command'},
            {input: '!recall temp', type: 'command'},
        ],
        weight: 1,
    },
    {
        id: 'mem-ops-6',
        name: 'Memory Consolidation',
        category: 'benchmark',
        tags: ['memory'],
        description: 'Test memory consolidation after multiple additions',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(A --> B).', type: 'belief'},
            {input: '(A --> B).', type: 'belief'},
            {input: '(A --> B)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
    {
        id: 'mem-ops-7',
        name: 'Memory Search',
        category: 'benchmark',
        tags: ['memory'],
        description: 'Test searching memory for term',
        steps: [
            {input: '(cat --> animal).', type: 'belief'},
            {input: '(dog --> animal).', type: 'belief'},
            {input: '!search(animal)', type: 'command'},
        ],
        expectation: {
            afterSteps: 3,
            responseContains: 'animal',
        },
        weight: 1,
    },
    {
        id: 'mem-ops-8',
        name: 'Memory Clear',
        category: 'benchmark',
        tags: ['memory'],
        description: 'Test clearing memory',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '!clear', type: 'command'},
            {input: '(A --> B)?', type: 'question', runSteps: 1},
        ],
        weight: 1,
    },
    {
        id: 'mem-ops-9',
        name: 'Belief Retrieval',
        category: 'benchmark',
        tags: ['memory'],
        description: 'Test retrieving stored beliefs',
        steps: [
            {input: '(bird --> fly).', type: 'belief'},
            {input: '(fish --> swim).', type: 'belief'},
            {input: '!beliefs', type: 'command'},
        ],
        expectation: {
            afterSteps: 3,
            responseContains: 'bird',
        },
        weight: 1,
    },
    {
        id: 'mem-ops-10',
        name: 'Memory Stats',
        category: 'benchmark',
        tags: ['memory'],
        description: 'Test getting memory statistics',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(B --> C).', type: 'belief'},
            {input: '!stats', type: 'command'},
        ],
        expectation: {
            afterSteps: 3,
            responseContains: 'concept',
        },
        weight: 1,
    },
];

export default memoryOpsSuite;
