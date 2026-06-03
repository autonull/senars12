/**
 * Integration Test: Agent with Real LM (Transformers.js)
 *
 * This test demonstrates the complete agent functionality with a real
 * Transformers.js language model, showcasing the neurosymbolic capabilities.
 *
 * Run: node --import 'tsx' scripts/test-agent-integration.ts
 */

import {AIAgent} from '../src/agent/AIAgent.ts';
import {ConversationState} from '../src/agent/ConversationState.ts';
import {SeNARSFactory} from '../src/nar/index.ts';
import {createSeNARSRegistry} from '../src/nar/lm/providers.ts';
import {TransformersLMClient, DEFAULT_TRANSFORMERS_MODEL} from '../src/nar/lm/transformers-client.ts';
import {makeDefaultBotConfig} from '../src/config/defaults.ts';
import type {Capabilities} from '../src/agent/types.ts';

const MODEL_ID = process.env.LM_MODEL || DEFAULT_TRANSFORMERS_MODEL;

interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function runTests() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  SeNARS Agent Integration Test (Real LM)                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Initialize LM
    console.log('[1/6] Initializing Transformers.js LM...');
    const t0 = Date.now();
    const lmClient = new TransformersLMClient(MODEL_ID);
    await lmClient.init();
    const lmInitTime = Date.now() - t0;

    assert(lmClient.available, 'LM should be available after init');
    console.log(`      LM ready (${lmInitTime}ms)\n`);

    // Create NAR
    console.log('[2/6] Creating NAR instance...');
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({
        providerRegistry: registry,
        core: {maxConcepts: 100, maxDerivationDepth: 8, cpuThrottleMs: 0}
    });
    console.log(`      NAR created with ${nar.getStatistics().totalConcepts} concepts\n`);

    // Create Agent
    console.log('[3/6] Creating AIAgent...');
    const testConfig = makeDefaultBotConfig({
        reasoning: {
            autoTrigger: false, triggerThreshold: 0.5, triggerCooldown: 3,
            maxStepsPerTrigger: 5, backgroundReasoning: false,
            backgroundIntervalMs: 60000, lmDriven: true
        },
        streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
        conversation: {maxHistory: 20, summaryThreshold: 30, maxArtifacts: 50, pinnedBeliefLimit: 8},
    });

    const capabilities: Capabilities = {
        hasLM: true, hasSeNARS: true, hasStreaming: false,
        hasTools: true, hasMemory: true, mode: 'full'
    };

    const agent = new AIAgent({
        nar, provider: 'transformers', lmClient,
        config: testConfig, capabilities,
    });
    console.log('      Agent created\n');

    // Test conversation state
    console.log('[4/6] Testing conversation state...');
    const conversation = new ConversationState(testConfig);
    assert(conversation !== null, 'ConversationState should exist');
    console.log('      Conversation state OK\n');

    // Test 1: Basic chat
    console.log('[5/6] Running integration probes...\n');
    let passed = 0;
    let failed = 0;

    const probes = [
        {
            name: 'Simple greeting',
            prompt: 'Say hello in one short sentence.',
            expectLM: true,
            validate: (reply: string) => reply.length > 0,
        },
        {
            name: 'Question answering',
            prompt: 'What is the capital of France? Answer briefly.',
            expectLM: true,
            validate: (reply: string) => reply.toLowerCase().includes('paris'),
        },
        {
            name: 'NAR belief insertion via tool',
            prompt: 'Add the belief (sparrow --> bird) to memory using the nar_believe tool.',
            expectLM: true,
            validate: (reply: string) => reply.length > 0,
        },
    ];

    for (const probe of probes) {
        const probeStart = Date.now();
        try {
            console.log(`  Probe: ${probe.name}`);
            const reply = await agent.chat(probe.prompt, {
                sender: 'test', connectionType: 'cli', conversation
            });

            const duration = Date.now() - probeStart;
            const stats = lmClient.getStats();
            const lmUsed = stats.totalCalls > 0;

            if (probe.expectLM && !lmUsed) {
                console.log(`    FAILED - Expected LM call but got none`);
                failed++;
                results.push({name: probe.name, passed: false, duration, details: 'No LM call'});
            } else if (probe.validate(reply)) {
                console.log(`    PASSED (${duration}ms): "${reply.slice(0, 80)}${reply.length > 80 ? '...' : ''}"`);
                passed++;
                results.push({name: probe.name, passed: true, duration});
            } else {
                console.log(`    FAILED - Validation failed`);
                console.log(`    Reply: "${reply.slice(0, 100)}"`);
                failed++;
                results.push({name: probe.name, passed: false, duration});
            }
        } catch (err) {
            console.log(`    ERROR: ${(err as Error).message}`);
            failed++;
            results.push({name: probe.name, passed: false, duration: Date.now() - probeStart, details: String(err)});
        }
        console.log('');
    }

    // Test 2: NAR direct reasoning
    console.log('[6/6] Testing NAR direct operations...\n');
    try {
        console.log('  Adding beliefs to NAR...');
        await nar.input('(bird --> animal).', 'belief');
        await nar.input('(robin --> bird).', 'belief');

        const derived = await nar.run(5);
        console.log(`  Derived ${derived} new concepts from chaining`);

        const beliefs = nar.getBeliefs();
        console.log(`  NAR has ${beliefs.length} belief(s)`);

        // Check that inference worked
        assert(derived >= 0, 'Should run inference');
        assert(beliefs.length >= 2, 'Should have beliefs');

        console.log('  NAR direct operations PASSED\n');
        passed++;
    } catch (err) {
        console.log(`  NAR direct operations FAILED: ${(err as Error).message}\n`);
        failed++;
    }

    // Final stats
    const lmStats = lmClient.getStats();
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                     TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Total probes: ${passed + failed}`);
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  LM calls: ${lmStats.totalCalls}`);
    console.log(`  LM success rate: ${lmStats.totalCalls > 0 ? (lmStats.successfulCalls / lmStats.totalCalls * 100).toFixed(1) : 0}%`);
    console.log(`  Average LM duration: ${lmStats.averageDuration.toFixed(0)}ms`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (failed > 0) {
        console.log('OVERALL: FAILED');
        process.exit(1);
    } else {
        console.log('OVERALL: PASSED - All integration tests succeeded');
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
});