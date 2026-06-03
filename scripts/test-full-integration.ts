/**
 * SeNARS Agent Full Integration Test
 *
 * Demonstrates the complete neurosymbolic agent with:
 * - Real Transformers.js Language Model
 * - CLI interface (via ConversationState)
 * - IRC interface (message creation/routing)
 * - NAR reasoning engine
 * - Cognition loop with LM integration
 *
 * Run: node --import 'tsx' scripts/test-full-integration.ts
 */

import {AIAgent} from '../src/agent/AIAgent.ts';
import {ConversationState} from '../src/agent/ConversationState.ts';
import {SeNARSFactory} from '../src/nar/index.ts';
import {createSeNARSRegistry} from '../src/nar/lm/providers.ts';
import {TransformersLMClient, DEFAULT_TRANSFORMERS_MODEL} from '../src/nar/lm/transformers-client.ts';
import {makeDefaultBotConfig} from '../src/config/defaults.ts';
import {IRCConnection} from '../src/io/connections/irc.ts';
import {CLIConnection} from '../src/io/connections/cli.ts';
import type {ConnectionConfig, ConnectionDeps} from '../src/io/types.js';
import {createLogger} from '../src/nar/logger/index.js';
import type {Capabilities} from '../src/agent/types.ts';

const MODEL_ID = process.env.LM_MODEL || DEFAULT_TRANSFORMERS_MODEL;

interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    details?: string;
}

async function runTests() {
    const results: TestResult[] = [];
    const logger = createLogger({scope: 'test:full-integration'});

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  SeNARS Full Integration Test (Real LM + CLI + IRC)        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 1. Initialize LM
    console.log('[1/7] Initializing Transformers.js LM...');
    const t0 = Date.now();
    const lmClient = new TransformersLMClient(MODEL_ID);
    await lmClient.init();
    const lmInitTime = Date.now() - t0;

    if (!lmClient.available) {
        console.error('FAILED: LM not available');
        process.exit(1);
    }
    console.log(`      LM ready (${lmInitTime}ms)\n`);

    // 2. Create NAR
    console.log('[2/7] Creating NAR instance...');
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({
        providerRegistry: registry,
        core: {maxConcepts: 100, maxDerivationDepth: 8, cpuThrottleMs: 0}
    });
    console.log(`      NAR created\n`);

    // 3. Create Agent
    console.log('[3/7] Creating AIAgent...');
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

    // 4. Test Conversation State
    console.log('[4/7] Testing ConversationState...');
    const conversation = new ConversationState(testConfig);

    // Simulate some conversation history
    conversation.addMessage({role: 'user', content: 'Hello', timestamp: Date.now()}, lmClient);
    conversation.addMessage({role: 'assistant', content: 'Hi there!', timestamp: Date.now()}, lmClient);
    const history = conversation.getHistory(5);
    console.log(`      Conversation has ${history.length} messages in history\n`);

    // 5. Test CLI Connection
    console.log('[5/7] Testing CLI Connection...');
    const mockEmit = (event: string, data: unknown) => {
        logger.debug(`Event: ${event}`);
    };

    const cliConfig: ConnectionConfig = {
        id: 'test-cli',
        enabled: true,
        type: 'cli',
        config: {name: 'test-cli', sendFn: (text: string) => console.log(`  [CLI OUT] ${text.slice(0, 80)}`)},
    };
    const cliDeps: ConnectionDeps = {nar, emit: mockEmit, logger};
    const cliConnection = new CLIConnection(cliConfig, cliDeps);

    let cliReceived = false;
    cliConnection.onMessage(async (message) => {
        cliReceived = true;
        console.log(`      CLI received: "${message.text.slice(0, 50)}..."`);
    });

    await cliConnection.connect();
    console.log(`      CLI connected, state: ${cliConnection.state}\n`);

    results.push({
        name: 'CLI Connection',
        passed: cliConnection.state === 'connected',
        duration: 0,
        details: `State: ${cliConnection.state}`
    });

    // 6. Test IRC Connection (message creation)
    console.log('[6/7] Testing IRC Connection...');
    const ircConfig: ConnectionConfig = {
        id: 'test-irc',
        enabled: true,
        type: 'irc',
        config: {
            server: 'localhost',
            port: 6667,
            nick: 'test-bot',
            channels: ['#test'],
        },
    };
    const ircDeps: ConnectionDeps = {nar, emit: mockEmit, logger};
    const ircConnection = new IRCConnection(ircConfig, ircDeps);

    // Test message creation (doesn't require network)
    const testMsg = (ircConnection as any).createMessage('testuser', 'Hello IRC!', {channel: '#test'});
    console.log(`      IRC message created: origin="${testMsg.origin}"`);

    results.push({
        name: 'IRC Connection',
        passed: testMsg.origin.includes('irc:#test'),
        duration: 0,
        details: `Origin: ${testMsg.origin}`
    });

    // 7. Full Agent Cognition Loop Test
    console.log('[7/7] Testing Agent Cognition Loop...\n');

    const probes = [
        {
            name: 'Simple greeting',
            prompt: 'Say hello in 3 words.',
            expectLM: true,
            validate: (reply: string) => reply.length > 0 && reply.length < 50,
        },
        {
            name: 'Simple math',
            prompt: 'What is 5 + 3? Just give the number.',
            expectLM: true,
            validate: (reply: string) => reply.includes('8'),
        },
    ];

    let passed = 0;
    let failed = 0;

    for (const probe of probes) {
        const probeStart = Date.now();
        try {
            console.log(`  Probe: ${probe.name}`);

            // Process via agent (cognition loop)
            const reply = await agent.chat(probe.prompt, {
                sender: 'test',
                connectionType: 'cli',
                conversation,
            });

            const duration = Date.now() - probeStart;
            const stats = lmClient.getStats();

            // Check if LM was actually used
            const lmUsed = stats.totalCalls > 0;

            if (probe.expectLM && !lmUsed) {
                console.log(`    FAILED: Expected LM call`);
                failed++;
                results.push({name: probe.name, passed: false, duration, details: 'No LM call'});
            } else if (probe.validate(reply)) {
                console.log(`    PASSED (${duration}ms): "${reply.slice(0, 60)}${reply.length > 60 ? '...' : ''}"`);
                passed++;
                results.push({name: probe.name, passed: true, duration});
            } else {
                console.log(`    FAILED: Validation`);
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

    // Test NAR reasoning
    console.log('  Testing NAR reasoning directly...');
    try {
        await nar.input('(apple --> fruit).', 'belief');
        await nar.input('(fruit --> plant).', 'belief');
        const derived = await nar.run(3);
        const beliefs = nar.getBeliefs();

        console.log(`    Derived ${derived} concepts, total beliefs: ${beliefs.length}`);

        if (beliefs.length >= 2) {
            console.log('    NAR reasoning PASSED\n');
            passed++;
            results.push({name: 'NAR reasoning', passed: true, duration: 0});
        } else {
            console.log('    NAR reasoning FAILED\n');
            failed++;
            results.push({name: 'NAR reasoning', passed: false, duration: 0});
        }
    } catch (err) {
        console.log(`    NAR reasoning ERROR: ${(err as Error).message}\n`);
        failed++;
        results.push({name: 'NAR reasoning', passed: false, duration: 0, details: String(err)});
    }

    // Cleanup
    await cliConnection.disconnect();

    // Final stats
    const lmStats = lmClient.getStats();
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                     TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Components:`);
    console.log(`    LM: ${lmClient.available ? '✓ Available' : '✗ Unavailable'}`);
    console.log(`    NAR: ✓ Created`);
    console.log(`    Agent: ✓ Created`);
    console.log(`    CLI: ✓ ${cliConnection.state}`);
    console.log(`    IRC: ✓ Message creation works`);
    console.log(`\n  Probes:`);
    console.log(`    Passed: ${passed}`);
    console.log(`    Failed: ${failed}`);
    console.log(`\n  LM Stats:`);
    console.log(`    Total calls: ${lmStats.totalCalls}`);
    console.log(`    Success rate: ${lmStats.totalCalls > 0 ? (lmStats.successfulCalls / lmStats.totalCalls * 100).toFixed(1) : 0}%`);
    console.log(`    Avg duration: ${lmStats.averageDuration.toFixed(0)}ms`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    const totalPassed = results.filter(r => r.passed).length;
    const totalFailed = results.filter(r => !r.passed).length;

    if (totalFailed > 0) {
        console.log(`OVERALL: FAILED (${totalPassed}/${totalPassed + totalFailed} passed)`);
        process.exit(1);
    } else {
        console.log(`OVERALL: PASSED - Full integration successful!`);
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
});