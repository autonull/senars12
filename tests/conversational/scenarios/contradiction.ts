import type {Scenario} from '../framework.js';

const contradiction: Scenario = {
    name: 'contradiction',
    description: 'Conflicting beliefs and truth revision',
    seedBeliefs: [
        '(bird --> fly). :0.9:0.9',
    ],
    probes: [
        {
            input: 'Penguins do not fly',
            expect: {
                responseContainsAny: ['penguin', 'bird', 'fly', 'recorded', 'belief'],
                maxDurationMs: 30_000,
            },
        },
        {
            input: '(bird --> fly)?',
            expect: {
                expectNarseseParsed: true,
                maxDurationMs: 30_000,
            },
        },
    ],
};

export default contradiction;
