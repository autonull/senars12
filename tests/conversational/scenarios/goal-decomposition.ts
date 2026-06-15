import type {Scenario} from '../framework.js';

const goalDecomposition: Scenario = {
    name: 'goal-decomposition',
    description: 'Complex goal → subgoals via lm-goal-decomposition rule',
    seedBeliefs: [
        '<(*, build, house) --> complex_goal>. %1.0;0.9%',
        '<(*, gather, materials) --> (*, build, house)>. %1.0;0.8%',
        '<(*, design, plan) --> (*, build, house)>. %1.0;0.8%',
    ],
    probes: [
        {
            input: 'I want to build a house',
            expect: {
                responseContainsAny: ['goal', 'subgoal', 'plan', 'materials', 'design'],
                expectToolCall: 'nar_goal',
                maxDurationMs: 45_000,
            },
        },
        {
            input: 'What are the steps to build a house?',
            expect: {
                responseContainsAny: ['gather', 'design', 'build', 'step'],
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'Decompose the goal of building a house',
            expect: {
                expectLmRuleFired: ['lm-goal-decomposition'],
                maxDurationMs: 45_000,
            },
        },
    ],
};

export default goalDecomposition;