import {BaseProvider} from './BaseProvider.js';

const cannedResponses = {
    greeting: [
        'Hello! How can I help you today?',
        'Hi there! What can I do for you?',
        'Hey! Nice to see you. How can I assist?'
    ],
    question: [
        'That\'s an interesting question. Let me think about it... Based on what I know, I\'d say the answer depends on context.',
        'Good question! I\'d need more information to give a precise answer, but generally it varies by situation.',
        'I\'m a dummy AI with limited capabilities, but I\'ll do my best: that\'s a great topic to explore further.'
    ],
    command: [
        'Command acknowledged.',
        'Got it, processing your request.',
        'Understood.'
    ],
    fallback: [
        'Interesting! Tell me more about that.',
        'I see. What else is on your mind?',
        'Thanks for sharing! Is there something specific I can help with?',
        'Hmm, that\'s worth thinking about. What would you like to explore next?'
    ]
};

export class DummyProvider extends BaseProvider {
    constructor(options = {}) {
        super(options);
        this.id = options.id || 'dummy';
        this.latency = options.latency || 0;
        this.responseTemplate = options.responseTemplate || null;
        this.mockResponses = options.mockResponses || {};
        this._responseIndex = 0;
    }

    _classifyPrompt(prompt) {
        const lower = prompt.toLowerCase();
        if (/^(hello|hi|hey|greetings|good morning|good afternoon|good evening|yo|sup)/i.test(lower)) {
            return 'greeting';
        }
        if (/(what|who|when|where|why|how|is|are|do|does|can|could|would|should)\b/i.test(lower) || lower.includes('?')) {
            return 'question';
        }
        if (/^(\/|!|\.)/.test(lower)) {
            return 'command';
        }
        return 'fallback';
    }

    _pickResponse(category) {
        const responses = cannedResponses[category] || cannedResponses.fallback;
        const idx = this._responseIndex % responses.length;
        this._responseIndex++;
        // Every 3rd response, wrap in JSON action format so the action pipeline gets exercised
        if (this._responseIndex % 3 === 0) {
            return JSON.stringify({ actions: [{ name: 'respond', args: [responses[idx]] }] });
        }
        return responses[idx];
    }

    async generateText(prompt, options = {}) {
        if (this.latency > 0) {
            await new Promise(resolve => setTimeout(resolve, this.latency));
        }

        // Check mock responses first
        for (const [pattern, response] of Object.entries(this.mockResponses)) {
            if (prompt.includes(pattern)) {
                return response;
            }
        }

        // Use template if explicitly set
        if (this.responseTemplate) {
            return this.responseTemplate.replace('{prompt}', prompt);
        }

        // Otherwise pick a canned response based on prompt classification
        return this._pickResponse(this._classifyPrompt(prompt));
    }

    async invoke(prompt) {
        return this.generateText(prompt);
    }

    async* streamText(prompt, options = {}) {
        const text = await this.generateText(prompt, options);
        const chunkSize = 5;
        for (let i = 0; i < text.length; i += chunkSize) {
            yield text.slice(i, i + chunkSize);
            if (this.latency > 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }

    async generateEmbedding(text) {
        if (this.latency > 0) {
            await new Promise(resolve => setTimeout(resolve, this.latency));
        }
        return Array.from({length: 16}, (_, i) => Math.sin(text.charCodeAt(i % text.length) + i));
    }
}
