import type {Scenario} from '../framework.js';

const proactiveNotification: Scenario = {
    name: 'proactive-notification',
    description: 'AutonomyEngine emits notifications on derivation/conflict',
    seedBeliefs: [
        '<bird --> animal>. %1.0;0.9%',
        '<penguin --> bird>. %1.0;0.9%',
        '<penguin --> [fly]>. %0.0;0.9%',
        '<bird --> [fly]>. %0.8;0.9%',
    ],
    probes: [
        {
            input: 'Tell me about penguins',
            expect: {
                responseContainsAny: ['penguin', 'bird', 'fly', 'cannot'],
                expectProactiveEvent: 'nar:derivation',
                expectNarDerivations: 1,
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'Can penguins fly?',
            expect: {
                responseContainsAny: ['cannot', 'no', 'flightless'],
                expectProactiveEvent: 'nar:conflict:detected',
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'What did you just derive?',
            expect: {
                responseContainsAny: ['derived', 'conclusion', 'belief'],
                maxDurationMs: 30_000,
            },
        },
    ],
};

export default proactiveNotification;