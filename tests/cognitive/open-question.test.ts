/**
 * Cognitive test: open question (invariant I7).
 *
 * The user asks a wonder-question ("is the moon cheese?"). The LM marks
 * the open question in WM, and the question persists across the next
 * episode.
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

function makeAgent(lm: LMClient): {agent: AIAgent; conversation: ConversationState} {
    const config = makeDefaultBotConfig({
        reasoning: {autoTrigger: true, triggerThreshold: 0.5, triggerCooldown: 3, maxStepsPerTrigger: 5, backgroundReasoning: false, backgroundIntervalMs: 60000, lmDriven: true},
        streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
        conversation: {maxHistory: 10, summaryThreshold: 100, maxArtifacts: 50, pinnedBeliefLimit: 4},
        autonomy: {incorporationLimit: 3, incorporationWindowMs: 5 * 60 * 1000},
        policy: {promptBudget: 2048, recencyEpisodes: 20, selfAnalysisEveryN: 5, consolidationEveryN: 3, consolidationDebounceMs: 50},
    });
    const nar = SeNARSFactory.createDefault({core: {maxConcepts: 50, maxDerivationDepth: 3, cpuThrottleMs: 0}});
    const agent = new AIAgent({nar, provider: 'transformers', lmClient: lm, config, capabilities});
    const conversation = new ConversationState(config);
    return {agent, conversation};
}

describe('Cognitive — open question (I7)', () => {
    it('reflection stage open_question appends to working memory and persists', async () => {
        const lm = new ScriptedLM([
            'I do not know.',
            '{"action":"open_question","openQuestion":"is the moon cheese?"}',
        ]);
        const {agent, conversation} = makeAgent(lm);
        const result = await agent.executeEpisode('is the moon cheese?', {sender: 'user', conversation});
        expect(result.verdict.action).toBe('open_question');
        expect(result.workingMemory.get<string[]>('open_questions')).toContain('is the moon cheese?');
    });

    it('open questions survive across two episodes via WM persistence', async () => {
        const lm1 = new ScriptedLM([
            'I do not know.',
            '{"action":"open_question","openQuestion":"what is dark matter?"}',
        ]);
        const {agent, conversation} = makeAgent(lm1);
        const r1 = await agent.executeEpisode('first', {sender: 'user', conversation});
        expect(r1.workingMemory.get<string[]>('open_questions')).toContain('what is dark matter?');

        const lm2 = new ScriptedLM(['ok.', '{"action":"accept"}']);
        const {agent: agent2} = makeAgent(lm2);
        const r2 = await agent2.executeEpisode('second', {sender: 'user', conversation});
        // The new agent loads the conversation state, so the open question is preserved
        expect(r2.workingMemory.get<string[]>('open_questions')).toContain('what is dark matter?');
    });
});
