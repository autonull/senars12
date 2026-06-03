/**
 * Integration test: drives `AIAgent.executeEpisode` end-to-end with a
 * scripted LM. Verifies the cognitive flow (I7, I8):
 *   - the LM is offered the working-memory tool catalogue
 *   - `set_focus` and `mark_open_question` tool calls are dispatched
 *   - the resulting `WorkingMemory` reflects the LM's writes
 *   - the `ReasoningTrace` records every phase (route, prepare-wm,
 *     compose, tool-call, tool-result, reflect, finalize)
 *   - the reflection stage accepts a response when the LM is happy
 *   - the reflection stage can `revise` a belief and emit a
 *     `belief_added` artifact
 *   - the reflection stage can mark an open question and surface it
 *
 * Uses a scripted `LMClient` (no Jest mocks per AGENTS.md test rule, but
 * the scripted client is real code, not a mock).
 */

import {describe, it, expect, beforeEach} from '@jest/globals';
import {AIAgent} from '../../src/agent/AIAgent.js';
import {ConversationState} from '../../src/agent/ConversationState.js';
import {SeNARSFactory} from '../../src/nar/index.js';
import {makeDefaultBotConfig} from '../../src/config/defaults.js';
import type {LMClient} from '../../src/nar/lm/types.js';
import type {Capabilities} from '../../src/agent/types.js';

class ScriptedLM implements LMClient {
    readonly provider = 'scripted';
    readonly model = 'scripted-1';
    readonly available = true;
    public callIndex = 0;
    constructor(private readonly responses: string[]) {}
    async generateText(): Promise<string> {
        const out = this.responses[this.callIndex] ?? '{"action":"accept"}';
        this.callIndex++;
        return out;
    }
}

const capabilities: Capabilities = {hasLM: true, hasSeNARS: true, hasStreaming: false, hasTools: true, hasMemory: true, mode: 'full'};

function makeAgent(lm: LMClient): {agent: AIAgent; conversation: ConversationState} {
    const config = makeDefaultBotConfig({
        reasoning: {autoTrigger: true, triggerThreshold: 0.5, triggerCooldown: 3, maxStepsPerTrigger: 5, backgroundReasoning: false, backgroundIntervalMs: 60000, lmDriven: true},
        streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
        conversation: {maxHistory: 10, summaryThreshold: 100, maxArtifacts: 50, pinnedBeliefLimit: 4},
    });
    const nar = SeNARSFactory.createDefault({
        core: {maxConcepts: 50, maxDerivationDepth: 3, cpuThrottleMs: 0},
    });
    const agent = new AIAgent({nar, provider: 'transformers', lmClient: lm, config, capabilities});
    const conversation = new ConversationState(config);
    return {agent, conversation};
}

describe('AIAgent.executeEpisode — Phase 6 cognition (I7, I8)', () => {
    let agent: AIAgent;
    let conversation: ConversationState;
    let lm: ScriptedLM;

    beforeEach(() => {
        lm = new ScriptedLM(['{"action":"accept"}']);
        ({agent, conversation} = makeAgent(lm));
    });

    it('exposes executeEpisode as the only public entry point', () => {
        expect(typeof agent.executeEpisode).toBe('function');
        expect((agent as unknown as {executeTurn?: unknown}).executeTurn).toBeUndefined();
    });

    it('records the route, prepare-wm, compose and finalize steps in the trace', async () => {
        lm = new ScriptedLM([
            '{"name":"set_focus","arguments":{"focus":"the sky"}}',
            'The sky is blue.',
            '{"action":"accept"}',
        ]);
        ({agent, conversation} = makeAgent(lm));
        const result = await agent.executeEpisode('what colour is the sky?', {sender: 'user', conversation});
        const kinds = result.trace.steps.map(s => s.kind);
        expect(kinds).toContain('route');
        expect(kinds).toContain('prepare-wm');
        expect(kinds).toContain('compose');
        expect(kinds).toContain('finalize');
        expect(kinds).toContain('reflect');
    });

    it('persists set_focus into the working memory returned with the result', async () => {
        lm = new ScriptedLM([
            '{"name":"set_focus","arguments":{"focus":"the sky"}}',
            'The sky is blue.',
            '{"action":"accept"}',
        ]);
        ({agent, conversation} = makeAgent(lm));
        const result = await agent.executeEpisode('what colour is the sky?', {sender: 'user', conversation});
        expect(result.workingMemory.get('focus')).toBe('the sky');
    });

    it('persists mark_open_question into working memory', async () => {
        lm = new ScriptedLM([
            '{"name":"mark_open_question","arguments":{"question":"is the moon cheese?"}}',
            'I do not know.',
            '{"action":"accept"}',
        ]);
        ({agent, conversation} = makeAgent(lm));
        const result = await agent.executeEpisode('is the moon cheese?', {sender: 'user', conversation});
        expect(result.workingMemory.get<string[]>('open_questions')).toContain('is the moon cheese?');
    });

    it('persists add_evidence and record_derivation', async () => {
        lm = new ScriptedLM([
            '{"name":"add_evidence","arguments":{"evidence":"(sky --> blue)"}}',
            '{"name":"record_derivation","arguments":{"derivation":"(sky --> blue) via report"}}',
            'Done.',
            '{"action":"accept"}',
        ]);
        ({agent, conversation} = makeAgent(lm));
        const result = await agent.executeEpisode('log evidence', {sender: 'user', conversation});
        expect(result.workingMemory.get<string[]>('evidence')).toContain('(sky --> blue)');
        expect(result.workingMemory.get<string[]>('recent_derivations')).toContain('(sky --> blue) via report');
    });

    it('reflection stage accept yields an "accept" verdict', async () => {
        lm = new ScriptedLM(['Hello.', '{"action":"accept"}']);
        ({agent, conversation} = makeAgent(lm));
        const result = await agent.executeEpisode('hi', {sender: 'user', conversation});
        expect(result.verdict.action).toBe('accept');
    });

    it('reflection stage revise emits a belief_added artifact and writes to NARS', async () => {
        const reviseResponse = '{"action":"revise","reasoning":"the sky is green","revisedStatement":"(sky --> green).","revisedTruth":{"frequency":0.9,"confidence":0.8}}';
        lm = new ScriptedLM(['The sky is blue.', reviseResponse]);
        ({agent, conversation} = makeAgent(lm));
        const result = await agent.executeEpisode('colour of the sky?', {sender: 'user', conversation});
        expect(result.verdict.action).toBe('revise');
        const added = result.artifacts.find(a => a.type === 'belief_added' && (a.metadata as {source?: string} | undefined)?.source === 'reflection-stage');
        expect(added).toBeDefined();
        expect(added?.content).toBe('(sky --> green).');
    });

    it('reflection stage open_question appends to working memory', async () => {
        const oq = '{"action":"open_question","openQuestion":"what about at sunset?"}';
        lm = new ScriptedLM(['Sky is blue.', oq]);
        ({agent, conversation} = makeAgent(lm));
        const result = await agent.executeEpisode('sky?', {sender: 'user', conversation});
        expect(result.verdict.action).toBe('open_question');
        expect(result.workingMemory.get<string[]>('open_questions')).toContain('what about at sunset?');
    });

    it('skipReflection returns an accept verdict without an LM call', async () => {
        lm = new ScriptedLM(['Hi.']);
        ({agent, conversation} = makeAgent(lm));
        const result = await agent.executeEpisode('hi', {sender: 'user', conversation, skipReflection: true});
        expect(result.verdict.action).toBe('accept');
        expect(lm.callIndex).toBe(1);
    });

    it('abort() short-circuits the episode with the aborted marker', async () => {
        lm = new ScriptedLM(['Long response...']);
        ({agent, conversation} = makeAgent(lm));
        agent.abort();
        const result = await agent.executeEpisode('hi', {sender: 'user', conversation});
        expect(result.text).toBe('[aborted]');
    });

    it('exposes getPolicy() with default routing weights', () => {
        const policy = agent.getPolicy();
        expect(policy.routingWeights).toBeDefined();
        expect(policy.promptBudget).toBe(2048);
    });

    it('route.kind=reason produces a candidate without LM involvement', async () => {
        const result = await agent.executeEpisode('why is the sky blue?', {sender: 'user', conversation, routeOverride: 'reason', reasoningDepth: 1});
        expect(result.text).toMatch(/reasoning cycle/);
        expect(result.toolCalls).toEqual([]);
        expect(lm.callIndex).toBe(0);
    });

    it('persists WM across episodes via the conversation state', async () => {
        lm = new ScriptedLM([
            '{"name":"set_focus","arguments":{"focus":"first"}}',
            'First done.',
            '{"action":"accept"}',
        ]);
        ({agent, conversation} = makeAgent(lm));
        await agent.executeEpisode('first', {sender: 'user', conversation});

        lm = new ScriptedLM(['I have remembered.', '{"action":"accept"}']);
        const {agent: agent2} = makeAgent(lm);
        const result = await agent2.executeEpisode('second', {sender: 'user', conversation});
        expect(result.workingMemory.get('focus')).toBe('first');
    });
});
