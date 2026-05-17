import type {Scenario} from '../scenarios/types.js';

export const chatBasicSuite: Scenario[] = [
    {
        id: 'chat-basic-1',
        name: 'Greeting Response',
        category: 'benchmark',
        tags: ['chat'],
        description: 'Test response to greeting',
        steps: [
            {input: 'Hello', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseContains: 'Hello',
        },
        weight: 1,
    },
    {
        id: 'chat-basic-2',
        name: 'Identity Question',
        category: 'benchmark',
        tags: ['chat'],
        description: 'Test response to identity question',
        steps: [
            {input: 'Who are you?', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseContains: 'SeNARS',
        },
        weight: 1,
    },
    {
        id: 'chat-basic-3',
        name: 'Fact Learning',
        category: 'benchmark',
        tags: ['chat'],
        description: 'Test learning a fact from conversation',
        steps: [
            {input: 'Cats are animals.', type: 'chat'},
            {input: 'What are cats?', type: 'chat'},
        ],
        expectation: {
            afterSteps: 2,
            responseContains: 'animal',
        },
        weight: 1,
    },
    {
        id: 'chat-basic-4',
        name: 'Thank You Response',
        category: 'benchmark',
        tags: ['chat'],
        description: 'Test response to thanks',
        steps: [
            {input: 'Thank you', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseContains: 'welcome',
        },
        weight: 1,
    },
    {
        id: 'chat-basic-5',
        name: 'Unknown Query',
        category: 'benchmark',
        tags: ['chat'],
        description: 'Test response to unknown query',
        steps: [
            {input: 'What is the meaning of life?', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseNotContains: ['error', 'undefined'],
        },
        weight: 1,
    },
    {
        id: 'chat-basic-6',
        name: 'Multi-turn Context',
        category: 'benchmark',
        tags: ['chat'],
        description: 'Test maintaining context across turns',
        steps: [
            {input: 'Birds can fly.', type: 'chat'},
            {input: 'What can fly?', type: 'chat'},
        ],
        expectation: {
            afterSteps: 2,
            responseContains: 'Bird',
        },
        weight: 1,
    },
    {
        id: 'chat-basic-7',
        name: 'Narsese in Chat',
        category: 'benchmark',
        tags: ['chat'],
        description: 'Test handling Narsese in chat context',
        steps: [
            {input: '(cat --> animal).', type: 'chat'},
            {input: 'Tell me about cats', type: 'chat'},
        ],
        expectation: {
            afterSteps: 2,
            responseContains: 'animal',
        },
        weight: 1,
    },
    {
        id: 'chat-basic-8',
        name: 'Capability Question',
        category: 'benchmark',
        tags: ['chat'],
        description: 'Test response to capability question',
        steps: [
            {input: 'What can you do?', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseContains: 'reason',
        },
        weight: 1,
    },
    {
        id: 'chat-basic-9',
        name: 'Conversational Follow-up',
        category: 'benchmark',
        tags: ['chat'],
        description: 'Test follow-up question handling',
        steps: [
            {input: 'Tell me about reasoning', type: 'chat'},
            {input: 'Can you explain more?', type: 'chat'},
        ],
        expectation: {
            afterSteps: 2,
            responseNotContains: ['error'],
        },
        weight: 1,
    },
    {
        id: 'chat-basic-10',
        name: 'Empty Input Handling',
        category: 'benchmark',
        tags: ['chat'],
        description: 'Test handling of minimal input',
        steps: [
            {input: 'Hi', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseNotContains: ['error', 'undefined'],
        },
        weight: 1,
    },
];

export default chatBasicSuite;
