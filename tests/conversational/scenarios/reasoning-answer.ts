import type {Scenario} from '../framework.js';

const reasoningAnswer: Scenario = {
    name: 'reasoning-answer',
    description: 'Multi-hop reasoning with belief derivation — tests NAL inference chain',
    seedBeliefs: [
        '<bird --> animal>. %1.0;0.9%',
        '<robin --> bird>. %1.0;0.9%',
        '<sparrow --> bird>. %1.0;0.9%',
        '<can_fly --> (*, bird, _fly)>. %1.0;0.9%',
    ],
    probes: [
        {
            input: 'Is a robin an animal?',
            expect: {
                responseContainsAny: ['yes', 'true', 'animal'],
                expectBeliefIncrease: true,
                minBeliefs: 4,
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'Can a sparrow fly?',
            expect: {
                responseContainsAny: ['yes', 'true', 'fly'],
                expectBeliefIncrease: true,
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'What can fly?',
            expect: {
                responseContainsAny: ['bird', 'fly', 'robin', 'sparrow'],
                expectNarseseParsed: true,
                maxDurationMs: 30_000,
            },
        },
    ],
};

export default reasoningAnswer;
