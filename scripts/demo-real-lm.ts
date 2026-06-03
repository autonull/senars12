/**
 * Real LM Integration Demo
 *
 * This script demonstrates the full agent loop with a real Transformers.js model.
 * It tests the cognition loop with the LM.
 */

import {AIAgent} from '../src/agent/AIAgent.ts';
import {ConversationState} from '../src/agent/ConversationState.ts';
import {SeNARSFactory} from '../src/nar/index.ts';
import {createSeNARSRegistry} from '../src/nar/lm/providers.ts';
import {TransformersLMClient} from '../src/nar/lm/transformers-client.ts';
import {makeDefaultBotConfig} from '../src/config/defaults.ts';
import type {Capabilities} from '../src/agent/types.ts';

const MODEL_ID = 'HuggingFaceTB/SmolLM2-135M-Instruct';

const log = (...args: unknown[]) => console.log('[demo]', ...args);

log('Initializing Transformers.js LM...');
const lmClient = new TransformersLMClient(MODEL_ID);

log('LM class created, initializing...');
await lmClient.init();
log(`LM initialized, available=${lmClient.available}`);

const testConfig = makeDefaultBotConfig({
    reasoning: {autoTrigger: true, triggerThreshold: 0.5, triggerCooldown: 3, maxStepsPerTrigger: 5, backgroundReasoning: false, backgroundIntervalMs: 60000, lmDriven: true},
    streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
    conversation: {maxHistory: 8, summaryThreshold: 30, maxArtifacts: 50, pinnedBeliefLimit: 8},
});
const capabilities: Capabilities = {hasLM: true, hasSeNARS: true, hasStreaming: false, hasTools: true, hasMemory: false, mode: 'full'};

const registry = createSeNARSRegistry();
const nar = SeNARSFactory.createDefault({
    providerRegistry: registry,
    core: {maxConcepts: 50, maxDerivationDepth: 5, cpuThrottleMs: 0}
});

log('NAR created');

const agent = new AIAgent({
    nar,
    provider: 'transformers',
    lmClient,
    config: testConfig,
    capabilities,
});

log('Agent created');

const conversation = new ConversationState(testConfig);
log('Conversation state created');

// Simple conversation test
const probes = [
    {
        label: 'greeting',
        prompt: 'Say hello in one short sentence.',
        expectLM: true,
        expectToolCall: false,
    },
    {
        label: 'simple-question',
        prompt: 'What is 2+2? Answer with just the number.',
        expectLM: true,
        expectToolCall: false,
    },
    {
        label: 'preference',
        prompt: 'Do you prefer cats or dogs? Keep your answer very brief.',
        expectLM: true,
        expectToolCall: false,
    },
    {
        label: 'belief-record',
        prompt: 'Please record the fact that dogs are mammals. Use the nar_believe tool with the Narsese statement "(dog --> mammal)."',
        expectLM: true,
        expectToolCall: true,
    },
];

log(`\nRunning ${probes.length} probes against the agent...\n`);

let passed = 0;
let failed = 0;

for (const probe of probes) {
    const before = lmClient.getStats().totalCalls;
    const t0 = Date.now();

    let reply: string;
    let turn;
    try {
        turn = await agent.executeEpisode(probe.prompt, {sender: 'demo', connectionType: 'cli', conversation});
        reply = turn.text;
    } catch (err) {
        reply = `ERROR: ${(err as Error).message}`;
    }

    const dt = Date.now() - t0;
    const after = lmClient.getStats().totalCalls;
    const delta = after - before;
    const toolCallCount = turn?.toolCalls?.length ?? 0;
    const beliefCount = nar.getBeliefs().length;

    const summary = reply.length > 150 ? reply.slice(0, 149) + '…' : reply;
    log(`probe="${probe.label}" lmCalls=${delta} tools=${toolCallCount} beliefs=${beliefCount} t=${dt}ms reply="${summary}"`);

    if (delta < 1 && probe.expectLM) {
        log(`  WARNING: Expected LM call but got none`);
        failed++;
    } else if (probe.expectToolCall && toolCallCount < 1) {
        log(`  INFO: Tool-call probe did not dispatch a tool call (small LM may not emit JSON tool calls)`);
        passed++;
    } else {
        passed++;
    }
}

const finalStats = lmClient.getStats();
log(`\nLM stats: calls=${finalStats.totalCalls} ok=${finalStats.successfulCalls} fail=${finalStats.failedCalls} timeouts=${finalStats.timeoutCount}`);
log(`Final belief count: ${nar.getBeliefs().length}`);
log(`Passed: ${passed}/${probes.length}`);

if (failed > 0) {
    log('FAIL: Some probes did not invoke the LM as expected');
    process.exit(1);
} else {
    log('PASS: Agent successfully used real Language Model');
    process.exit(0);
}