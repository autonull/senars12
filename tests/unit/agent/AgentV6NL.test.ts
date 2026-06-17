import {describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import {createAgent} from '../../../src/agent/agent.js';
import {SeNARSFactory} from '../../../src/nar/index.js';
import {EpisodicMemory} from '../../../src/nar/memory/EpisodicMemory.js';
import {ModelRunner} from '../../../src/agent/model/ModelRunner.js';
import type {LMClient} from '../../../src/nar/lm/types.js';
import type {NAR} from '../../../src/nar/nar.js';
import {mkdtempSync, rmSync} from 'fs';
import {tmpdir} from 'os';
import {join} from 'path';

/**
 * Stateful scripted LM that simulates a multi-turn LM session:
 *  - First call emits a tool call (no preceding text)
 *  - Subsequent calls within the same chat() see the tool result and emit final text
 *  - Across chat() calls, conversation state is forgotten (only per-call)
 */
function makeStatefulLM(responses: Array<string | {tool: string; args: Record<string, unknown>} | {text: string}>): LMClient {
    let callIndex = 0;
    return {
        provider: 'scripted',
        model: 'stateful',
        available: true,
        async generateText(_prompt: string): Promise<string> {
            const r = responses[callIndex] ?? {text: 'fallback'};
            callIndex++;
            if (typeof r === 'string') return r;
            if ('tool' in r) {
                return `{"name": "${r.tool}", "arguments": ${JSON.stringify(r.args)}}`;
            }
            return r.text;
        }
    };
}

function makeEpisodicMemory(): EpisodicMemory {
    const basePath = mkdtempSync(join(tmpdir(), 'episodic-nl-'));
    return new EpisodicMemory({enabled: true, basePath, retentionDays: 1, maxEntriesPerFile: 1000});
}

describe('Agent v6 — NL integration (real ModelRunner loop)', () => {
    let nar: NAR;
    let ep: EpisodicMemory;
    let basePath: string;

    beforeEach(() => {
        nar = SeNARSFactory.createForTesting({maxConcepts: 50});
        ep = makeEpisodicMemory();
        basePath = (ep as unknown as {config: {basePath: string}}).config.basePath;
    });

    afterEach(() => {
        rmSync(basePath, {recursive: true, force: true});
    });

    it('NL chat → LM emits nar_believe tool → belief added to NAR', async () => {
        const lm = makeStatefulLM([
            {tool: 'nar_believe', args: {statement: '(cat --> animal).', truth: {frequency: 0.9, confidence: 0.9}}},
            {text: "I've recorded that cats are animals."},
        ]);
        const agent = createAgent({nar, lmClient: lm, episodicMemory: ep});
        const reply = await agent.chat('Please record that cats are animals');
        expect(reply).toContain("I've recorded");
        expect(nar.getBeliefs().length).toBe(1);
        const beliefs = nar.getBeliefs();
        expect(beliefs[0]!.term.toString()).toContain('cat');
    });

    it('NL chat → LM emits calculate tool → math result in final text', async () => {
        const lm = makeStatefulLM([
            {tool: 'calculate', args: {expression: '7 * 6 + 2'}},
            {text: '7 × 6 + 2 = 44.'},
        ]);
        const agent = createAgent({nar, lmClient: lm, episodicMemory: ep});
        const reply = await agent.chat('What is 7 times 6 plus 2?');
        expect(reply).toContain('44');
    });

    it('NL chat → no tool needed → LM replies directly (parse gate path is Narsese-only)', async () => {
        const lm = makeStatefulLM([
            {text: 'Hello! How can I help you today?'},
        ]);
        const agent = createAgent({nar, lmClient: lm, episodicMemory: ep});
        const reply = await agent.chat('Hello there');
        expect(reply).toContain('Hello');
    });

    it('NL chat → LM emits nar_question tool → NAR runs reasoning', async () => {
        await nar.input('(cat --> animal).');
        const lm = makeStatefulLM([
            {tool: 'nar_question', args: {question: '(cat --> ?)', steps: 5}},
            {text: 'A cat is an animal.'},
        ]);
        const agent = createAgent({nar, lmClient: lm, episodicMemory: ep});
        const reply = await agent.chat('What is a cat?');
        expect(reply).toContain('cat');
    });

    it('NL chat → system prompt contains constitution + custom instructions', async () => {
        nar.getConstitution = () => [
            {term: {toString: () => '(kernel --> open).'}},
        ];
        let capturedPrompt = '';
        const lm: LMClient = {
            provider: 'spy', model: 'spy', available: true,
            async generateText(prompt: string) {
                if (!capturedPrompt) capturedPrompt = prompt;
                return 'OK';
            }
        };
        const agent = createAgent({nar, lmClient: lm, episodicMemory: ep, systemInstructions: 'Be terse.'});
        await agent.chat('ping');
        expect(capturedPrompt).toContain('kernel');
        expect(capturedPrompt).toContain('open');
        expect(capturedPrompt).toContain('Be terse');
    });

    it('NL chat with empty LM response still logs to episodic memory', async () => {
        const lm = makeStatefulLM([{text: '   '}]);
        const agent = createAgent({nar, lmClient: lm, episodicMemory: ep});
        const reply = await agent.chat('any question');
        await new Promise(r => setTimeout(r, 50));
        const episodes = await agent.recall();
        expect(episodes.some(e => e.type === 'input' && e.content === 'any question')).toBe(true);
        expect(episodes.some(e => e.type === 'response')).toBe(true);
    });
});
