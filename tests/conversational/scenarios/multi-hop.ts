import type {Scenario} from '../framework.js';

const multiHop: Scenario = {
    name: 'multi-hop',
    description: 'Chained reasoning across multiple beliefs',
    seedBeliefs: [
        '(cat --> animal). :1.0:0.9',
        '(animal --> living). :1.0:0.9',
    ],
    probes: [
        {
            input: '(cat --> living)?',
            expect: {
                expectNarseseParsed: true,
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'Is a cat living?',
            expect: {
                responseContainsAny: ['cat', 'living', 'animal'],
                maxDurationMs: 30_000,
            },
        },
    ],
};

export default multiHop;
