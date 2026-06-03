/**
 * Cognitive test: persistence across restart (invariant I11).
 *
 * Run an episode, then "restart" (re-import fresh AIAgent, load the
 * conversation state from JSON). The WorkingMemory and
 * ConversationState should be intact.
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
    private responses: string[];
    constructor(responses: string[]) { this.responses = [...responses]; }
    async generateText(): Promise<string> {
        return this.responses.shift() ?? '{"action":"accept"}';
    }
}

const capabilities: Capabilities = {hasLM: true, hasSeNARS: true, hasStreaming: false, hasTools: true, hasMemory: true, mode: 'full'};

function makeConfig() {
    return makeDefaultBotConfig({
        reasoning: {autoTrigger: true, triggerThreshold: 0.5, triggerCooldown: 3, maxStepsPerTrigger: 5, backgroundReasoning: false, backgroundIntervalMs: 60000, lmDriven: true},
        streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
        conversation: {maxHistory: 10, summaryThreshold: 100, maxArtifacts: 50, pinnedBeliefLimit: 4},
        autonomy: {incorporationLimit: 3, incorporationWindowMs: 5 * 60 * 1000},
        policy: {promptBudget: 2048, recencyEpisodes: 20, selfAnalysisEveryN: 5, consolidationEveryN: 3, consolidationDebounceMs: 50},
    });
}

describe('Cognitive — persistence across restart (I11)', () => {
    it('ConversationState round-trips through JSON for messages and summary', () => {
        const config = makeConfig();
        const conv1 = new ConversationState(config);
        conv1.addMessage({role: 'user', content: 'hi', timestamp: Date.now()});
        conv1.addMessage({role: 'assistant', content: 'hello', timestamp: Date.now()});
        conv1.pin('(sky --> blue).');
        const json = conv1.toJSON();

        const conv2 = new ConversationState(config);
        conv2.fromJSON(json);
        expect(conv2.messages.length).toBe(2);
        expect(conv2.messages[0]?.content).toBe('hi');
        expect(conv2.getPinned()).toEqual(['(sky --> blue).']);
    });

    it('a fresh AIAgent loaded with the previous conversation state continues the dialogue', async () => {
        const lm1 = new ScriptedLM([
            '{"name":"set_focus","arguments":{"focus":"sky"}}',
            'I see.',
            '{"action":"accept"}',
        ]);
        const config1 = makeConfig();
        const nar1 = SeNARSFactory.createDefault({core: {maxConcepts: 50, maxDerivationDepth: 3, cpuThrottleMs: 0}});
        const agent1 = new AIAgent({nar: nar1, provider: 'transformers', lmClient: lm1, config: config1, capabilities});
        const conv1 = new ConversationState(config1);
        const r1 = await agent1.executeEpisode('first', {sender: 'user', conversation: conv1});
        expect(r1.workingMemory.get('focus')).toBe('sky');

        // Simulate a restart: persist the conversation, then build a new
        // agent and load the conversation back. The focus slot should be
        // carried over via the conversation state's WM snapshot.
        const convJson = conv1.toJSON();

        const lm2 = new ScriptedLM(['Hi again.', '{"action":"accept"}']);
        const config2 = makeConfig();
        const nar2 = SeNARSFactory.createDefault({core: {maxConcepts: 50, maxDerivationDepth: 3, cpuThrottleMs: 0}});
        const agent2 = new AIAgent({nar: nar2, provider: 'transformers', lmClient: lm2, config: config2, capabilities});
        const conv2 = new ConversationState(config2);
        conv2.fromJSON(convJson);
        const r2 = await agent2.executeEpisode('second', {sender: 'user', conversation: conv2});
        // The fresh agent reads the WM slot out of the conversation state
        // and merges it with the freshly-prepared WM.
        expect(r2.workingMemory.get('focus')).toBe('sky');
    });
});
