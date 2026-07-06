#!/usr/bin/env node

/**
 * SeNARS Agent LM Fallback Mechanism Demo
 * Demonstrates how the system properly routes input between LM and NARS
 */

import {App} from '@senars/agent';

async function runFallbackDemo() {
    console.log('🔄🤖 SeNARS LM Fallback Mechanism Demo');
    console.log('='.repeat(50));
    console.log('Demonstrating intelligent input routing between LM and NARS\n');

    try {
        const app = new App({
            lm: {
                enabled: true,
                provider: 'ollama',
                modelName: process.env.OLLAMA_MODEL || 'llama3',
                baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
                temperature: 0.7
            }
        });

        await app.initialize();
        const agent = app.agent;

        console.log('🎯 Testing Input Routing Intelligence');
        console.log('-'.repeat(40));

        // Test 1: Natural language input → LM
        console.log('\n📋 Test 1: Natural Language Input (should go to LM)');
        await testInputRoute(agent, 'What is the capital of France?');

        // Test 2: Narsese input → NARS
        console.log('\n📋 Test 2: Narsese Syntax (should go to NARS)');
        await testInputRoute(agent, '<bird --> animal>. %1.00;0.90%');

        // Test 3: Natural language question → LM
        console.log('\n📋 Test 3: Natural Language Question (should go to LM)');
        await testInputRoute(agent, 'Explain quantum computing in simple terms');

        // Test 4: Narsese query → NARS
        console.log('\n📋 Test 4: Narsese Query (should go to NARS)');
        await testInputRoute(agent, '<robin --> ?x>?');

        // Test 5: Mixed natural language with NARS context
        console.log('\n📋 Test 5: Mixed Query (LM with NARS context)');
        await testMixedQuery(agent);

        // Test 6: Agent commands
        console.log('\n📋 Test 6: Agent Commands');
        // Note: agent create is app level
        await app.createAgent('test-agent');
        app.switchAgent('test-agent');
        console.log('   Agent created and switched');

        // Test 7: Complex hybrid reasoning
        console.log('\n📋 Test 7: Hybrid Reasoning Example');
        await testHybridReasoning(app.agent);

        // Test 8: Fallback error handling
        console.log('\n📋 Test 8: Error Handling & Fallbacks');
        await testErrorFallback(app.agent);

        console.log('\n✅ FALLBACK DEMO COMPLETED SUCCESSFULLY!');

        if (agent.getStats) {
            const stats = agent.getStats();
            console.log('\n📊 Routing Statistics:');
            console.log(`   - NARS cycles executed: ${stats.cycleCount || 0}`);
            console.log(`   - LM calls: ${agent.lm?.lmStats?.totalCalls || 0}`);
        }

        await app.shutdown();

    } catch (error) {
        console.error('❌ Fallback Demo Error:', error);
        if (error.stack) console.error(error.stack);
    }
}

async function testInputRoute(agent, input) {
    console.log(`   Input: "${input}"`);
    try {
        const result = await agent.processInput(input);
        console.log(`   → Result: ${typeof result === 'string' ? result.substring(0, 80) : JSON.stringify(result)}${result && result.length > 80 ? '...' : ''}`);
    } catch (error) {
        console.log(`   → Error: ${error.message}`);
    }
}

async function testMixedQuery(agent) {
    // First, add some knowledge to NARS
    await agent.processInput('<AI --> intelligent-system>. %1.00;0.90%');
    await agent.processInput('<machine-learning --> AI-technique>. %1.00;0.85%');

    // Now ask a question that combines NARS knowledge with LM reasoning
    await testInputRoute(agent, 'How does the NARS system view machine learning as an AI technique?');
}

async function testHybridReasoning(agent) {
    console.log('   Setting up hybrid reasoning context...');

    // Add complex knowledge to NARS
    await agent.processInput('<neural-symbolic-system --> hybrid-approach>. %1.00;0.90%');
    await agent.processInput('<neural-symbolic-system --> (neural-network AND symbolic-reasoning)>. %0.85;0.80%');
    await agent.processInput('<neural-network --> good-at-pattern-recognition>. %0.90;0.85%');
    await agent.processInput('<symbolic-reasoning --> good-at-logical-inference>. %0.95;0.80%');

    // Ask for hybrid analysis
    await testInputRoute(agent, 'Analyze the advantages of neural-symbolic systems combining both pattern recognition and logical inference');
}

async function testErrorFallback(agent) {
    console.log('   Testing error handling and fallbacks...');

    // Test with malformed Narsese that should fail and potentially fall back
    try {
        await agent.processInput('<malformed [syntax >. %1.00;0.90%');
        console.log('   → Handled malformed syntax gracefully (or processed if parser resilient)');
    } catch (error) {
        console.log(`   → Properly caught error: ${error.message}`);
    }

    // Test with unknown command
    try {
        const res = await agent.executeCommand('unknowncommand');
        console.log(`   → Handled unknown command: ${res}`);
    } catch (error) {
        console.log(`   → Properly caught command error: ${error.message}`);
    }
}

runFallbackDemo();
