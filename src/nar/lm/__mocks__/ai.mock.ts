export async function generateText() {
    return {text: 'Mock response'};
}

export async function streamText() {
    return {
        text: Promise.resolve('Mock response'),
        fullStream: [],
    };
}

export default {generateText, streamText};
