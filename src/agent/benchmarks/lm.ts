import type {Scenario} from '../scenarios/types.js';

export const lmRulesSuite: Scenario[] = [
    {
        id: 'lm-rules-1',
        name: 'LM Rule Narsese Output',
        category: 'benchmark',
        tags: ['lm'],
        description: 'Test LM produces valid Narsese output',
        steps: [
            {input: 'Convert this to Narsese: A is a type of B', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseContains: '-->',
        },
        weight: 1,
    },
    {
        id: 'lm-rules-2',
        name: 'LM Rule Question',
        category: 'benchmark',
        tags: ['lm'],
        description: 'Test LM generates a question in Narsese',
        steps: [
            {input: 'Ask a question about cats in Narsese', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseContains: '?',
        },
        weight: 1,
    },
    {
        id: 'lm-rules-3',
        name: 'LM Rule Belief',
        category: 'benchmark',
        tags: ['lm'],
        description: 'Test LM generates a belief in Narsese',
        steps: [
            {input: 'State a belief about animals in Narsese', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseContains: '.',
        },
        weight: 1,
    },
    {
        id: 'lm-rules-4',
        name: 'LM Rule with Truth Value',
        category: 'benchmark',
        tags: ['lm'],
        description: 'Test LM includes truth value in output',
        steps: [
            {input: 'State a belief with high confidence in Narsese', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseContains: '%',
        },
        weight: 1,
    },
    {
        id: 'lm-rules-5',
        name: 'LM Rule Compound Term',
        category: 'benchmark',
        tags: ['lm'],
        description: 'Test LM generates compound term',
        steps: [
            {input: 'Express "cats and dogs are animals" in Narsese', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseContains: '&',
        },
        weight: 1,
    },
    {
        id: 'lm-rules-6',
        name: 'LM Rule Implication',
        category: 'benchmark',
        tags: ['lm'],
        description: 'Test LM generates implication statement',
        steps: [
            {input: 'Express "if it rains then ground is wet" in Narsese', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseContains: '=>',
        },
        weight: 1,
    },
    {
        id: 'lm-rules-7',
        name: 'LM Rule Variable',
        category: 'benchmark',
        tags: ['lm'],
        description: 'Test LM generates query with variable',
        steps: [
            {input: 'Ask what category birds belong to in Narsese', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseContains: '?',
        },
        weight: 1,
    },
    {
        id: 'lm-rules-8',
        name: 'LM Rule Repair',
        category: 'benchmark',
        tags: ['lm'],
        description: 'Test LM output repair handles malformed parentheses',
        steps: [
            {input: 'Write a Narsese statement with unbalanced parens: (bird --> animal', type: 'chat'},
        ],
        expectation: {
            afterSteps: 1,
            responseNotContains: ['undefined', 'null'],
        },
        weight: 1,
    },
];

export default lmRulesSuite;
