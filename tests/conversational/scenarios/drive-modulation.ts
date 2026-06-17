import type {Scenario} from '../framework.js';

const driveModulation: Scenario = {
    name: 'drive-modulation',
    description: 'Drive changes trigger proactive reasoning',
    seedBeliefs: [
        '<(*, curious, topic) --> learning_goal>. %1.0;0.8%',
        '<(*, urgent, task) --> priority_goal>. %1.0;0.9%',
    ],
    probes: [
        {
            input: 'I am curious about quantum mechanics',
            expect: {
                responseContainsAny: ['curious', 'learn', 'explore', 'quantum'],
                expectDriveChanged: {driveId: 'curiosity', minDelta: 0.1},
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'This is urgent! I need help now!',
            expect: {
                responseContainsAny: ['urgent', 'priority', 'help', 'immediate'],
                expectDriveChanged: {driveId: 'urgency', minDelta: 0.2},
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'What are my current drives?',
            expect: {
                responseContainsAny: ['curiosity', 'urgency', 'drive', 'level'],
                maxDurationMs: 30_000,
            },
        },
    ],
};

export default driveModulation;