/**
 * Cognitive test: policy shift (invariant I10).
 *
 * Drive 20 episodes dominated by `route=reason`. After 10 episodes
 * `AIAgent.getPolicy().routingWeights['reason']` should dominate.
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

function makeAgent(lm: LMClient, selfAnalysisEveryN = 5): {agent: AIAgent; conversation: ConversationState} {
    const config = makeDefaultBotConfig({
        reasoning: {autoTrigger: true, triggerThreshold: 0.5, triggerCooldown: 3, maxStepsPerTrigger: 5, backgroundReasoning: false, backgroundIntervalMs: 60000, lmDriven: true},
        streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
        conversation: {maxHistory: 10, summaryThreshold: 100, maxArtifacts: 50, pinnedBeliefLimit: 4},
        autonomy: {incorporationLimit: 3, incorporationWindowMs: 5 * 60 * 1000},
        policy: {promptBudget: 2048, recencyEpisodes: 20, selfAnalysisEveryN, consolidationEveryN: 3, consolidationDebounceMs: 5000},
    });
    const nar = SeNARSFactory.createDefault({core: {maxConcepts: 50, maxDerivationDepth: 3, cpuThrottleMs: 0}});
    const agent = new AIAgent({nar, provider: 'transformers', lmClient: lm, config, capabilities});
    const conversation = new ConversationState(config);
    return {agent, conversation};
}

describe('Cognitive — policy shift (I10)', () => {
    let agent: AIAgent;
    let conversation: ConversationState;

    beforeEach(() => {
        const lm = new ScriptedLM([]);
        ({agent, conversation} = makeAgent(lm, 5));
    });

    it('20 reason-route episodes shift routingWeights toward reason', async () => {
        for (let i = 0; i < 20; i++) {
            await agent.executeEpisode(`why ${i}?`, {sender: 'user', conversation, routeOverride: 'reason', reasoningDepth: 1});
        }
        const p = agent.getPolicy();
        expect(p.routingWeights['reason']).toBeGreaterThan(0.5);
        expect(p.updatedAt).toBeGreaterThan(0);
    });

    it('mixed routes produce a non-extreme policy', async () => {
        for (let i = 0; i < 12; i++) {
            const override = i % 2 === 0 ? 'reason' : 'nl';
            await agent.executeEpisode(`msg ${i}`, {sender: 'user', conversation, routeOverride: override, reasoningDepth: 1});
        }
        const p = agent.getPolicy();
        // 50/50 traffic should produce ~0.5 weight for 'reason'; the
        // baseline floor of 0.1 may pad it slightly. Use a wider bound.
        expect(p.routingWeights['reason']).toBeLessThanOrEqual(0.6);
    });
});
