import type {Scenario} from '../framework.js';

const basicChat: Scenario = {
    name: 'basic-chat',
    description: 'Simple Q&A and greetings — tests basic LM responsiveness',
    probes: [
        {
            input: 'Hello',
            expect: {
                responseContainsAny: ['hello', 'hi', 'hey', 'help'],
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'What is 2+2?',
            expect: {
                responseContains: ['4'],
                maxDurationMs: 30_000,
            },
        },
        {
            input: 'Say goodbye',
            expect: {
                responseContainsAny: ['goodbye', 'bye', 'farewell'],
                maxDurationMs: 30_000,
            },
        },
    ],
};

export default basicChat;
