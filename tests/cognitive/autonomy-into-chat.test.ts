/**
 * Cognitive test: autonomy-into-chat (invariant I9).
 *
 * Pre-load NARS so the scheduler derives a non-trivial belief. Then
 * a chat episode pulls that insight into the working memory
 * `prior_insights` slot.
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

function makeAgent(): {agent: AIAgent; conversation: ConversationState; nar: ReturnType<typeof SeNARSFactory.createDefault>; lm: ScriptedLM} {
    const config = makeDefaultBotConfig({
        reasoning: {autoTrigger: true, triggerThreshold: 0.5, triggerCooldown: 3, maxStepsPerTrigger: 5, backgroundReasoning: false, backgroundIntervalMs: 60000, lmDriven: true},
        streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
        conversation: {maxHistory: 10, summaryThreshold: 100, maxArtifacts: 50, pinnedBeliefLimit: 4},
        autonomy: {incorporationLimit: 3, incorporationWindowMs: 5 * 60 * 1000},
        policy: {promptBudget: 2048, recencyEpisodes: 20, selfAnalysisEveryN: 5, consolidationEveryN: 3, consolidationDebounceMs: 50},
    });
    const nar = SeNARSFactory.createDefault({core: {maxConcepts: 50, maxDerivationDepth: 5, cpuThrottleMs: 0}});
    const lm = new ScriptedLM([]);
    const agent = new AIAgent({nar, provider: 'transformers', lmClient: lm, config, capabilities});
    const conversation = new ConversationState(config);
    return {agent, conversation, nar, lm};
}

describe('Cognitive — autonomy into chat (I9)', () => {
    let agent: AIAgent;
    let conversation: ConversationState;
    let nar: ReturnType<typeof SeNARSFactory.createDefault>;
    let lm: ScriptedLM;

    beforeEach(() => {
        ({agent, conversation, nar, lm} = makeAgent());
    });

    it('a recent scheduler insight lands in the working memory prior_insights slot', async () => {
        const scheduler = agent.getScheduler();
        expect(scheduler).toBeDefined();
        if (!scheduler) return;
        scheduler.recordInsights([
            {term: '(cat --> mammal)', truth: {frequency: 0.95, confidence: 0.9}, ts: Date.now(), provenance: 'derivation'},
        ]);
        lm = new ScriptedLM(['I have been thinking about cats.', '{"action":"accept"}']);
        const result = await agent.executeEpisode('what have you been thinking about?', {sender: 'user', conversation});
        const insights = result.workingMemory.get<string[]>('prior_insights');
        expect(insights?.[0]).toContain('cat');
    });

    it('no prior insights leaves the prior_insights slot empty', async () => {
        lm = new ScriptedLM(['Hello.', '{"action":"accept"}']);
        const result = await agent.executeEpisode('hi', {sender: 'user', conversation});
        const insights = result.workingMemory.get<string[]>('prior_insights');
        expect(insights ?? []).toEqual([]);
    });
});
