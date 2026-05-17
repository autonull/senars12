import type {Scenario} from '../scenarios/types.js';

export const nal8ProceduralSuite: Scenario[] = [
    {
        id: 'nal8-proc-1',
        name: 'Basic Goal',
        category: 'benchmark',
        tags: ['nal8', 'procedural'],
        description: 'Test basic goal: (A --> B)!',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(A --> B)!', type: 'goal', label: 'Set goal'},
            {input: '(goal achieved)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal8-proc-2',
        name: 'Goal Decomposition',
        category: 'benchmark',
        tags: ['nal8', 'procedural'],
        description: 'Test goal decomposition into subgoals',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '(B --> C).', type: 'belief'},
            {input: '(A --> C)!', type: 'goal'},
            {input: '(A --> B)?', type: 'question', runSteps: 4},
        ],
        weight: 1,
    },
    {
        id: 'nal8-proc-3',
        name: 'Operation Execution',
        category: 'benchmark',
        tags: ['nal8', 'procedural'],
        description: 'Test operation execution from goal',
        steps: [
            {input: '(^op).', type: 'belief'},
            {input: '(A --> B)!', type: 'goal'},
            {input: '(operation executed)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal8-proc-4',
        name: 'Procedural Implication',
        category: 'benchmark',
        tags: ['nal8', 'procedural'],
        description: 'Test procedural implication: (A =\> B)',
        steps: [
            {input: '(A =\> B).', type: 'belief'},
            {input: '(A).', type: 'belief'},
            {input: '(B)?', type: 'question', runSteps: 3},
        ],
        weight: 1,
    },
    {
        id: 'nal8-proc-5',
        name: 'Goal with Operation',
        category: 'benchmark',
        tags: ['nal8', 'procedural'],
        description: 'Test goal that requires an operation',
        steps: [
            {input: '(want --> eat).', type: 'belief'},
            {input: '(eat --> action).', type: 'belief'},
            {input: '(want --> eat)!', type: 'goal'},
            {input: '(action)?', type: 'question', runSteps: 4},
        ],
        weight: 1,
    },
    {
        id: 'nal8-proc-6',
        name: 'Conditional Goal',
        category: 'benchmark',
        tags: ['nal8', 'procedural'],
        description: 'Test conditional goal execution',
        steps: [
            {input: '(A --> B).', type: 'belief'},
            {input: '((A --> B) =\> (C --> D)).', type: 'belief'},
            {input: '(A --> B)!', type: 'goal'},
            {input: '(C --> D)?', type: 'question', runSteps: 4},
        ],
        weight: 1,
    },
];

export default nal8ProceduralSuite;
