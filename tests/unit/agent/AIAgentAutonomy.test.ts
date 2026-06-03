import {describe, it, expect, beforeEach} from '@jest/globals';
import {AIAgent} from '../../../src/agent/AIAgent.js';
import {ConversationState} from '../../../src/agent/ConversationState.js';
import {SeNARSFactory} from '../../../src/nar/index.js';
import {makeDefaultBotConfig} from '../../../src/config/defaults.js';
import type {LMClient} from '../../../src/nar/lm/types.js';
import type {Capabilities} from '../../../src/agent/types.js';

class ScriptedLM implements LMClient {
    readonly provider = 'scripted';
    readonly model = 'scripted-1';
    readonly available = true;
    constructor(private readonly responses: string[]) {}
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
        policy: {promptBudget: 2048, recencyEpisodes: 20, selfAnalysisEveryN: 5, consolidationEveryN: 3, consolidationDebounceMs: 2000},
    });
    const nar = SeNARSFactory.createDefault({core: {maxConcepts: 50, maxDerivationDepth: 3, cpuThrottleMs: 0}});
    const agent = new AIAgent({nar, provider: 'transformers', lmClient: lm, config, capabilities});
    const conversation = new ConversationState(config);
    return {agent, conversation};
}

describe('AIAgent — Phase 7/8 wiring (I9, I10, I11)', () => {
    let agent: AIAgent;
    let conversation: ConversationState;
    let lm: ScriptedLM;

    beforeEach(() => {
        lm = new ScriptedLM(['Hello.', '{"action":"accept"}']);
        ({agent, conversation} = makeAgent(lm));
    });

    it('getScheduler() returns the agent-owned scheduler', () => {
        const s = agent.getScheduler();
        expect(s).toBeDefined();
        expect(s?.size()).toBe(0);
    });

    it('getConsolidationEngine() returns the engine', () => {
        const engine = agent.getConsolidationEngine();
        expect(engine).toBeDefined();
        expect(engine.getPassCount()).toBe(0);
    });

    it('getPolicy() returns a baseline AgentPolicy', () => {
        const p = agent.getPolicy();
        expect(p.routingWeights).toBeDefined();
        expect(p.promptBudget).toBeGreaterThan(0);
        expect(p.recencyEpisodes).toBe(20);
    });

    it('autonomy insights flow into the working memory prior_insights slot', async () => {
        const scheduler = agent.getScheduler();
        expect(scheduler).toBeDefined();
        if (!scheduler) return;
        scheduler.recordInsights([
            {term: 'cat', truth: {frequency: 0.9, confidence: 0.8}, ts: Date.now(), provenance: 'derivation'},
        ]);
        lm = new ScriptedLM(['Hello.', '{"action":"accept"}']);
        ({agent, conversation} = makeAgent(lm));
        // Re-inject the insights into the new agent's scheduler
        agent.getScheduler()?.recordInsights([
            {term: 'cat', truth: {frequency: 0.9, confidence: 0.8}, ts: Date.now(), provenance: 'derivation'},
        ]);
        const result = await agent.executeEpisode('hi', {sender: 'user', conversation});
        const slots = result.workingMemory.snapshot();
        const insights = slots['prior_insights'] as string[] | undefined;
        expect(insights?.[0]).toContain('cat');
    });

    it('policy routingWeights shift toward the dominant route after N episodes', async () => {
        lm = new ScriptedLM(['hi.', '{"action":"accept"}']);
        ({agent, conversation} = makeAgent(lm));
        for (let i = 0; i < 12; i++) {
            await agent.executeEpisode('why is the sky blue?', {sender: 'user', conversation, routeOverride: 'reason', reasoningDepth: 1});
        }
        const p = agent.getPolicy();
        expect(p.routingWeights['reason']).toBeGreaterThan(0.5);
    });

    it('consolidation is scheduled after each episode (off the critical path)', async () => {
        lm = new ScriptedLM(['ok', '{"action":"accept"}']);
        ({agent, conversation} = makeAgent(lm));
        const engine = agent.getConsolidationEngine();
        const before = engine.getBufferSize();
        await agent.executeEpisode('hi', {sender: 'user', conversation});
        // Either the buffer was populated (debounce hasn't fired) or a pass already ran
        expect(engine.getBufferSize() + engine.getPassCount()).toBeGreaterThan(before);
    });
});
