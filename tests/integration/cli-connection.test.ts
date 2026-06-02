/**
 * CLI connection wiring test.
 *
 * Exercises the CLI -> AIAgent -> CLI round-trip. A mock LM returns canned
 * responses so the test is deterministic and fast (no real inference).
 */

import {describe, expect, test} from '@jest/globals';
import {CLIConnection} from '../../src/io/connections/cli.js';
import {AIAgent} from '../../src/agent/AIAgent.js';
import {ConversationState} from '../../src/agent/ConversationState.js';
import {SeNARSFactory} from '../../src/nar/index.js';
import {createSeNARSRegistry} from '../../src/nar/lm/providers.js';
import {makeDefaultBotConfig} from '../../src/config/defaults.js';
import {createMockLMClient} from '../../src/nar/lm/mock-client.js';
import type {Capabilities} from '../../src/agent/types.js';
import type {LMClient} from '../../src/nar/lm/types.js';
import {createLogger} from '../../src/nar/logger/index.js';

function makeMockLM(): LMClient {
    return createMockLMClient({
        hello: 'Hi there! How can I help?',
        default: 'Mock reply.',
    });
}

const testConfig = makeDefaultBotConfig({
    reasoning: {autoTrigger: false, triggerThreshold: 0.5, triggerCooldown: 3, maxStepsPerTrigger: 5, backgroundReasoning: false, backgroundIntervalMs: 60000, lmDriven: true},
    streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
    conversation: {maxHistory: 8, summaryThreshold: 30, maxArtifacts: 50},
});

const capabilities: Capabilities = {hasLM: true, hasSeNARS: true, hasStreaming: false, hasTools: true, hasMemory: true, mode: 'full'};

describe('CLI connection round-trips with AIAgent', () => {
    test('message flows through agent and response is printed', async () => {
        const registry = createSeNARSRegistry();
        const nar = SeNARSFactory.createDefault({
            providerRegistry: registry,
            core: {maxConcepts: 50, maxDerivationDepth: 5, cpuThrottleMs: 0},
        });
        await nar.input('(cat --> animal).');
        const lm = makeMockLM();
        const agent = new AIAgent({
            nar,
            provider: 'ollama' as any,
            lmClient: lm,
            config: testConfig,
            capabilities,
        });
        const conversation = new ConversationState(testConfig);

        let printed: string[] = [];
        const sendFn = (text: string) => { printed.push(text); };
        const cfg = {id: 'cli-test', enabled: true, type: 'cli' as const, config: {name: 'cli-test', sendFn}};
        const logger = createLogger({scope: 'test'});
        const deps = {nar, emit: () => {}, logger};
        const conn = new CLIConnection(cfg, deps);

        conn.onMessage(async (message) => {
            const result = await agent.process(message.text, {
                sender: message.sender,
                connectionType: conn.type,
            } as any);
            await conn.send(message.sender, result.response);
        });

        await conn.connect();

        const fakeMessage = {
            id: 'test-1',
            source: conn.id,
            origin: 'cli:direct:local-user',
            sender: 'local-user',
            text: 'Tell me something about cats',
            timestamp: Date.now(),
        };
        const handler = (conn as any).handleMessage as (m: typeof fakeMessage) => Promise<void>;
        await handler(fakeMessage);

        await new Promise((r) => setImmediate(r));
        expect(printed.length).toBeGreaterThan(0);
        expect(printed[0]).toMatch(/Mock reply/i);

        await conn.disconnect('test done');
    });
});
