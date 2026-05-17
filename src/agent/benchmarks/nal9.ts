import type {Scenario} from '../scenarios/types.js';

export const nal9SelfSuite: Scenario[] = [
    {
        id: 'nal9-self-1',
        name: 'Self Reference',
        category: 'benchmark',
        tags: ['nal9', 'self'],
        description: 'Test self-referential belief',
        steps: [
            {input: '(SeNARS --> system).', type: 'belief'},
            {input: '(SeNARS --> SeNARS).', type: 'belief'},
            {input: '(SeNARS --> ?X)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal9-self-2',
        name: 'Self Knowledge',
        category: 'benchmark',
        tags: ['nal9', 'self'],
        description: 'Test system knowledge about itself',
        steps: [
            {input: '(SeNARS --> reasoning-system).', type: 'belief'},
            {input: '(reasoning-system --> intelligent).', type: 'belief'},
            {input: '(SeNARS --> intelligent)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal9-self-3',
        name: 'Self Question',
        category: 'benchmark',
        tags: ['nal9', 'self'],
        description: 'Test self-directed question',
        steps: [
            {input: '(SeNARS --> capable).', type: 'belief'},
            {input: '(SeNARS --> capable)?', type: 'question', runSteps: 2},
        ],
        weight: 1,
    },
    {
        id: 'nal9-self-4',
        name: 'Self Reflection',
        category: 'benchmark',
        tags: ['nal9', 'self'],
        description: 'Test self-reflective reasoning',
        steps: [
            {input: '(SeNARS --> learns).', type: 'belief'},
            {input: '(learns --> improves).', type: 'belief'},
            {input: '(SeNARS --> improves)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
];

export default nal9SelfSuite;
