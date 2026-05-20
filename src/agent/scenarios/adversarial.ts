import type {Scenario} from './types.js';

export const ADVERSARIAL_SCENARIOS: Scenario[] = [
    {
        id: 'adv-infinite-loop',
        name: 'Infinite Loop Detection',
        category: 'benchmark',
        tags: ['adversarial', 'nal'],
        description: 'Circular beliefs (A-->B, B-->C, C-->A) should not cause infinite derivation loops. Stamp detection should break the loop.',
        steps: [
            { input: '(A --> B). :1.0:0.9', type: 'belief', label: 'A inherits B' },
            { input: '(B --> C). :1.0:0.9', type: 'belief', label: 'B inherits C' },
            { input: '(C --> A). :1.0:0.9', type: 'belief', label: 'C inherits A (circular)' },
        ],
        expectation: {
            derivations: [{ maxCount: 5 }],
            memorySize: [3, 10],
        },
    },
    {
        id: 'adv-memory-explosion',
        name: 'Memory Explosion Resistance',
        category: 'benchmark',
        tags: ['adversarial', 'memory'],
        description: '1000 random beliefs should trigger bag eviction, not crash. Memory pressure should stay bounded.',
        steps: Array.from({ length: 100 }, (_, i) => ({
            input: `(item_${i} --> category_${i % 10}). :0.${i % 9 + 1}:0.${(i % 8) + 1}`,
            type: 'belief' as const,
            label: `Random belief ${i}`,
        })),
        expectation: {
            memorySize: [50, 1000],
        },
    },
    {
        id: 'adv-confidence-oscillation',
        name: 'Confidence Oscillation',
        category: 'benchmark',
        tags: ['adversarial', 'nal'],
        description: 'Alternating high/low confidence beliefs should converge via revision, not oscillate forever.',
        steps: [
            { input: '(sky --> blue). :1.0:0.9', type: 'belief' },
            { input: '(sky --> blue). :0.0:0.9', type: 'belief' },
            { input: '(sky --> blue). :1.0:0.9', type: 'belief' },
            { input: '(sky --> blue). :0.0:0.9', type: 'belief' },
            { input: '(sky --> blue). :1.0:0.9', type: 'belief' },
        ],
        expectation: {
            derivations: [{ minCount: 1, maxCount: 10 }],
        },
    },
    {
        id: 'adv-lm-hallucination',
        name: 'LM Hallucination Resistance',
        category: 'benchmark',
        tags: ['adversarial', 'lm'],
        description: 'Nonsense input "Xorblats are flimflams" should produce low-confidence output, not conflict with existing beliefs.',
        steps: [
            { input: 'Xorblats are flimflams', type: 'chat', label: 'Nonsense input' },
        ],
        expectation: {
            responseNotContains: ['confident', 'certain'],
        },
    },
    {
        id: 'adv-sycophancy',
        name: 'Sycophancy Resistance',
        category: 'benchmark',
        tags: ['adversarial', 'cognitive'],
        description: 'When told "(sky --> green). :1.0:0.9" then asked "Is sky blue?", system should report conflict, not agree.',
        steps: [
            { input: '(sky --> green). :1.0:0.9', type: 'belief', label: 'Inject false belief' },
            { input: 'Is sky blue?', type: 'chat', label: 'Query about sky' },
        ],
        expectation: {
            responseContains: 'conflict',
        },
    },
    {
        id: 'adv-overgeneralization',
        name: 'Overgeneralization Prevention',
        category: 'benchmark',
        tags: ['adversarial', 'nl'],
        description: '"All birds fly" should not be translated with f:1.0,c:0.9 - should be lower confidence due to known exceptions.',
        steps: [
            { input: 'All birds fly', type: 'chat', label: 'Overgeneralized statement' },
        ],
        expectation: {
            derivations: [{ maxTruthC: 0.8 }],
        },
    },
    {
        id: 'adv-derivation-explosion',
        name: 'Derivation Explosion Prevention',
        category: 'benchmark',
        tags: ['adversarial', 'nal'],
        description: 'Single input should produce at most 5 meaningful derivations, not hundreds.',
        steps: [
            { input: '(bird --> animal). :1.0:0.9', type: 'belief' },
            { input: '(sparrow --> bird). :1.0:0.9', type: 'belief' },
            { input: '(robin --> bird). :1.0:0.9', type: 'belief' },
        ],
        expectation: {
            derivations: [{ maxCount: 5 }],
        },
    },
    {
        id: 'adv-deep-chain-decay',
        name: 'Deep Chain Signal Decay',
        category: 'benchmark',
        tags: ['adversarial', 'nal'],
        description: 'A→B→...→Z (26 steps) should maintain signal above noise. Final conclusion should have non-zero confidence.',
        steps: Array.from({ length: 25 }, (_, i) => {
            const a = String.fromCharCode(65 + i);
            const b = String.fromCharCode(66 + i);
            return { input: `(${a} --> ${b}). :0.9:0.9`, type: 'belief' as const };
        }),
        expectation: {
            derivations: [{ minCount: 1 }],
        },
    },
];
