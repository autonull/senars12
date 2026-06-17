import type {Scenario} from '../framework.js';

const rlfp: Scenario = {
    name: 'rlfp',
    description: 'User feedback → reward → policy update → behavior change',
    seedBeliefs: [
        '<(*, correct, answer) --> reward>. %1.0;0.9%',
        '<(*, incorrect, answer) --> penalty>. %1.0;0.9%',
    ],
    probes: [
        {
            input: 'What is 5+5?',
            expect: {
                responseContains: ['10'],
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'That was correct, good job!',
            expect: {
                expectRLFPState: {explorationRate: 0.1, policyChanged: true},
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'What is 7+7?',
            expect: {
                responseContains: ['14'],
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'That was wrong, it should be 15!',
            expect: {
                expectRLFPState: {explorationRate: 0.1, policyChanged: true},
                maxDurationMs: 30_000,
            },
        },
    ],
};

export default rlfp;