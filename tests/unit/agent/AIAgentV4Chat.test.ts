import {describe, it, expect} from '@jest/globals';
import {AIAgent} from '../../../src/agent/agent.js';
import {SeNARSFactory} from '../../../src/nar/index.js';
import type {LMClient} from '../../../src/nar/lm/types.js';

function scripted(nar?: unknown): LMClient {
    return {
        provider: 'scripted',
        available: true,
        model: 'scripted-1',
        async generateText(prompt: string) {
            if (prompt.toLowerCase().includes('cats are animals')) {
                const statement = '(cat --> animal).';
                if (nar) await (nar as {input: (s: string) => Promise<void>}).input(statement);
                return `I will record that belief. {"name": "nar_believe", "arguments": {"statement": "${statement}"}}`;
            }
            if (prompt.toLowerCase().includes('hello')) return 'Hello! How can I help you?';
            return 'Mock response.';
        },
    };
}

describe('AIAgent v4 (src/agent/agent.ts)', () => {
    it('initializes with NAR', () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 20});
        const agent = new AIAgent({nar, lmClient: scripted()});
        expect(agent).toBeDefined();
        expect(agent.getPolicy()).toBeDefined();
    });

    it('routes narsese belief through NAR and persists it', async () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 20});
        const agent = new AIAgent({nar, lmClient: scripted(nar)});
        await agent.chat('(cat --> animal).');
        expect(nar.getBeliefs().length).toBeGreaterThan(0);
    });

    it('answers Narsese question with a belief string', async () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 20});
        await nar.input('(cat --> animal).');
        const agent = new AIAgent({nar, lmClient: scripted()});
        const text = await agent.chat('(cat --> ?)?');
        expect(text).toMatch(/cat/);
    });

    it('handles natural language via LM', async () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 20});
        const agent = new AIAgent({nar, lmClient: scripted()});
        const text = await agent.chat('Hello');
        expect(text).toContain('Hello');
    });

    it('maintains bounded history', async () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 20});
        const agent = new AIAgent({nar, lmClient: scripted()});
        for (let i = 0; i < 5; i++) await agent.chat(`Hello ${i}`);
        expect(agent.getHistory(100).length).toBeLessThanOrEqual(40);
    });

    it('degrades gracefully without LM', () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 20});
        const agent = new AIAgent({nar});
        expect(agent).toBeDefined();
    });
});
