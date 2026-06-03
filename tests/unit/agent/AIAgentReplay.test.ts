/**
 * Tests for AIAgent.replay (DoD #11).
 *
 * Asserts:
 *  - after an episode, the agent records the episode in the consolidation
 *    engine's bounded log
 *  - listEpisodes returns the recorded episode
 *  - replay() with the recorded id re-runs the input and returns a result
 *    with a text field, tool calls, and artifacts for comparison
 *  - replay() with an unknown id throws a clear error
 */

import {describe, it, expect} from '@jest/globals';
import {AIAgent} from '../../../src/agent/AIAgent.js';
import {ConversationState} from '../../../src/agent/ConversationState.js';
import {SeNARSFactory} from '../../../src/nar/index.js';
import {createSeNARSRegistry} from '../../../src/nar/lm/providers.js';
import {makeDefaultBotConfig} from '../../../src/config/defaults.js';
import type {Capabilities} from '../../../src/agent/types.js';
import type {LMClient} from '../../../src/nar/lm/types.js';

const mockLM: LMClient = {
    provider: 'mock',
    available: true,
    model: 'mock',
    async generateText(): Promise<string> {
        return 'Mock response.';
    },
};

const capabilities: Capabilities = {hasLM: true, hasSeNARS: true, hasStreaming: false, hasTools: true, hasMemory: true, mode: 'full'};

const testConfig = makeDefaultBotConfig({
    reasoning: {autoTrigger: true, triggerThreshold: 0.5, triggerCooldown: 3, maxStepsPerTrigger: 5, backgroundReasoning: false, backgroundIntervalMs: 60000, lmDriven: true},
    streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
    conversation: {maxHistory: 8, summaryThreshold: 30, maxArtifacts: 50, pinnedBeliefLimit: 8},
});

describe('AIAgent.replay', () => {
    it('records an episode in the log after executeEpisode', async () => {
        const registry = createSeNARSRegistry();
        const nar = SeNARSFactory.createDefault({providerRegistry: registry});
        const agent = new AIAgent({nar, provider: 'transformers', lmClient: mockLM, config: testConfig, capabilities});
        const conversation = new ConversationState(testConfig);

        await agent.executeEpisode('Hello, world!', {sender: 'test', connectionType: 'cli', conversation});

        const episodes = agent.listEpisodes(10);
        expect(episodes.length).toBeGreaterThan(0);
        expect(episodes[0].input).toBe('Hello, world!');
    });

    it('replays a recorded episode and returns a comparable result', async () => {
        const registry = createSeNARSRegistry();
        const nar = SeNARSFactory.createDefault({providerRegistry: registry});
        const agent = new AIAgent({nar, provider: 'transformers', lmClient: mockLM, config: testConfig, capabilities});
        const conversation = new ConversationState(testConfig);

        await agent.executeEpisode('Hello, world!', {sender: 'test', connectionType: 'cli', conversation});
        const eps = agent.listEpisodes(1);
        const id = eps[0].id;

        const result = await agent.replay(id);
        expect(result.original.input).toBe('Hello, world!');
        expect(result.replay.text).toBeDefined();
        expect(result.replay.toolCalls).toBeDefined();
        expect(result.replay.artifacts).toBeDefined();
    });

    it('throws on an unknown episode id', async () => {
        const registry = createSeNARSRegistry();
        const nar = SeNARSFactory.createDefault({providerRegistry: registry});
        const agent = new AIAgent({nar, provider: 'transformers', lmClient: mockLM, config: testConfig, capabilities});

        await expect(agent.replay('does-not-exist')).rejects.toThrow(/Episode not found/);
    });
});
