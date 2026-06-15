import type {Scenario} from '../framework.js';

const explanationTraceability: Scenario = {
    name: 'explanation-traceability',
    description: 'explainBelief/explainGoal/traceRule return valid chains',
    seedBeliefs: [
        '<bird --> animal>. %1.0;0.9%',
        '<robin --> bird>. %1.0;0.9%',
        '<sparrow --> bird>. %1.0;0.8%',
        '<can_fly --> (*, bird, _fly)>. %1.0;0.8%',
    ],
    probes: [
        {
            input: 'Explain why a robin is an animal',
            expect: {
                responseContainsAny: ['robin', 'bird', 'animal', 'because', 'inference'],
                expectExplanationChain: {minPremises: 2, minConfidence: 0.7},
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'Explain the goal of learning to fly',
            expect: {
                responseContainsAny: ['fly', 'goal', 'learn', 'bird'],
                expectExplanationChain: {minPremises: 1, minConfidence: 0.5},
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'Trace the rule lm-belief-revision for bird concept',
            expect: {
                responseContainsAny: ['rule', 'trace', 'belief', 'revision'],
                maxDurationMs: 30_000,
            },
        },
    ],
};

export default explanationTraceability;