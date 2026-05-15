/**
 * Mock LM Client for testing and demos
 * Provides predictable, configurable responses
 */

import type {LMClient, LMConfig} from './types.js';

interface MockResponse {
    text: string;
    confidence: number;
}

const DEFAULT_RESPONSES: Record<string, string> = {
    'translate': '(translated --> concept)',
    'hypothesis': '(observed --> pattern)',
    'explain': '(reason --> explanation)',
    'elaborate': '(concept --> detail)',
    'default': '(lm --> suggestion)'
};

export class MockLMClient implements LMClient {
    readonly provider = 'mock';
    readonly model = 'default';
    readonly available = true;
    private responses: Map<string, MockResponse> = new Map();
    private callLog: Array<{ prompt: string; response: string }> = [];
    private shouldFail = false;
    private failMessage = 'Mock LM failure';

    constructor(responses?: Record<string, string>) {
        if (responses) {
            for (const [key, value] of Object.entries(responses)) {
                this.responses.set(key, {text: value, confidence: 0.9});
            }
        }
        for (const [key, text] of Object.entries(DEFAULT_RESPONSES)) {
            if (!this.responses.has(key)) {
                this.responses.set(key, {text, confidence: 0.9});
            }
        }
    }

    async generateText(prompt: string, _options?: LMConfig): Promise<string> {
        if (this.shouldFail) {
            throw new Error(this.failMessage);
        }

        const lowerPrompt = prompt.toLowerCase();
        let response = this.responses.get('default')!;

        for (const [key, mockResponse] of this.responses) {
            if (lowerPrompt.includes(key)) {
                response = mockResponse;
                break;
            }
        }

        this.callLog.push({prompt, response: response.text});
        return response.text;
    }

    getCallLog() {
        return [...this.callLog];
    }

    clearLog() {
        this.callLog = [];
    }

    setFailure(shouldFail: boolean, message?: string) {
        this.shouldFail = shouldFail;
        if (message) this.failMessage = message;
    }

    setResponse(key: string, text: string, confidence = 0.9) {
        this.responses.set(key, {text, confidence});
    }

    getLastCall(): { prompt: string; response: string } | null {
        return this.callLog[this.callLog.length - 1] ?? null;
    }

    getCallCount(): number {
        return this.callLog.length;
    }
}

export const createMockLMClient = (responses?: Record<string, string>): MockLMClient => {
    return new MockLMClient(responses);
};

export class RuleBasedLMClient implements LMClient {
    private knowledge: Map<string, string> = new Map();

    constructor() {
        this.knowledge.set('bird', 'Birds are animals that can fly');
        this.knowledge.set('animal', 'Animals are living organisms');
        this.knowledge.set('robin', 'Robins are small singing birds');
        this.knowledge.set('fish', 'Fish are aquatic animals');
    }

    async generateText(prompt: string, _options?: LMConfig): Promise<string> {
        const lower = prompt.toLowerCase();

        for (const [concept, info] of this.knowledge) {
            if (lower.includes(concept)) {
                return info;
            }
        }

        return 'I need more information to answer that.';
    }

    addKnowledge(concept: string, info: string) {
        this.knowledge.set(concept, info);
    }
}

export const createRuleBasedLMClient = (): RuleBasedLMClient => {
    return new RuleBasedLMClient();
};