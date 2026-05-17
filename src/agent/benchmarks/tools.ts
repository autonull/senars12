import type {Scenario} from '../scenarios/types.js';

export const toolsBasicSuite: Scenario[] = [
    {
        id: 'tools-calc-1',
        name: 'Calculate Basic',
        category: 'benchmark',
        tags: ['tools'],
        description: 'Test Calculate tool',
        steps: [
            {input: '!calculate(2 + 2)', type: 'command'},
            {input: '(result = 4)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
    {
        id: 'tools-http-1',
        name: 'HTTP Tool Basic',
        category: 'benchmark',
        tags: ['tools'],
        description: 'Test HTTP tool',
        steps: [
            {input: '!http(GET https://example.com)', type: 'command'},
            {input: '(response success)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
    {
        id: 'tools-search-1',
        name: 'Search Memory',
        category: 'benchmark',
        tags: ['tools'],
        description: 'Test memory search',
        steps: [
            {input: '(cat --> animal).', type: 'belief'},
            {input: '!search(cat)', type: 'command'},
            {input: '(cat found)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
    {
        id: 'tools-read-1',
        name: 'Read File',
        category: 'benchmark',
        tags: ['tools'],
        description: 'Test ReadFile tool',
        steps: [
            {input: '!read(packages.json)', type: 'command'},
            {input: '(content exists)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
    {
        id: 'tools-reason-1',
        name: 'Reason Tool',
        category: 'benchmark',
        tags: ['tools'],
        description: 'Test Reason tool',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(B --> C).', type: 'belief'},
            {input: '!reason', type: 'command'},
            {input: '(A --> C)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'tools-learn-1',
        name: 'Learn Tool',
        category: 'benchmark',
        tags: ['tools'],
        description: 'Test Learn tool',
        steps: [
            {input: '!learn(test fact)', type: 'command'},
            {input: '(test fact learned)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
    {
        id: 'tools-timer-1',
        name: 'Timer Tool',
        category: 'benchmark',
        tags: ['tools'],
        description: 'Test Timer tool',
        steps: [
            {input: '!timer(100)', type: 'command'},
            {input: '(timer set)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
    {
        id: 'tools-process-1',
        name: 'Process Tool',
        category: 'benchmark',
        tags: ['tools'],
        description: 'Test Process tool',
        steps: [
            {input: '!process(echo hello)', type: 'command'},
            {input: '(hello output)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
];

export default toolsBasicSuite;