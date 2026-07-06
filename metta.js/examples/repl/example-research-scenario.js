#!/usr/bin/env node

/**
 * SeNARS Agent Interactive Scenario Demo
 * Simulates a complex AI research scenario with hybrid reasoning
 */

import {App} from '@senars/agent';

async function runResearchScenarioDemo() {
    console.log('🔬🤖 SeNARS Research Agent Scenario Demo');
    console.log('='.repeat(50));
    console.log('Simulating a complex AI research scenario with hybrid reasoning\n');

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

        // Scenario: AI Research Project
        console.log('📍 SCENARIO: AI Research Project on Hybrid Intelligence');
        console.log('-'.repeat(50));

        // Create specialized agents
        await createResearchTeam(app);

        const agent = app.agent;

        // Set up research context in NARS
        await setupResearchContext(agent);

        // Begin research process with hybrid reasoning
        await conductResearch(agent);

        // Demonstrate goal achievement tracking
        await trackProgress(agent);

        // Showcase learning and adaptation
        await adaptiveReasoning(agent);

        console.log('\n✅ RESEARCH SCENARIO COMPLETED SUCCESSFULLY!');

        if (agent.getStats) {
            const stats = agent.getStats();
            console.log('\n📊 Research Metrics:');
            console.log(`   - Research cycles: ${stats.cycleCount || 0}`);
            console.log(`   - Active agents: ${app.agents.size}`);
        }

        await app.shutdown();

    } catch (error) {
        console.error('❌ Research Scenario Error:', error);
        if (error.stack) console.error(error.stack);
    }
}

async function createResearchTeam(app) {
    console.log('\n👥 Creating Research Team...');

    await app.createAgent('lead-researcher');
    await app.createAgent('cognitive-modeler');
    await app.createAgent('ml-engineer');
    app.switchAgent('lead-researcher');

    console.log('   ✓ Research team created with specialized roles');
    const agents = app.listAgents();
    agents.forEach(a => console.log(`  - ${a.id} ${a.isActive ? '[ACTIVE]' : ''}`));
}

async function setupResearchContext(agent) {
    console.log('\n🧠 Setting up Research Context in NARS...');

    // Add foundational knowledge about AI systems
    const foundationalKnowledge = [
        '<neural-network --> system>. %1.00;0.90%',
        '<symbolic-system --> system>. %1.00;0.90%',
        '<hybrid-system --> system>. %1.00;0.90%',
        '<neural-network --> fast-learner>. %0.80;0.85%',
        '<symbolic-system --> interpretable>. %0.90;0.80%',
        '<hybrid-system --> (fast-learner AND interpretable)>. %0.70;0.75%',
        '<reasoning --> problem-solving>. %1.00;0.90%',
        '<learning --> knowledge-acquisition>. %1.00;0.90%',
        '<AI-safety --> important>. %1.00;0.95%'
    ];

    for (const fact of foundationalKnowledge) {
        try {
            await agent.processInput(fact);
        } catch (e) {
            console.log(`   ⚠ Could not process: ${fact} (${e.message})`);
        }
    }

    console.log('   ✓ Foundational AI knowledge added to NARS');
}

async function conductResearch(agent) {
    console.log('\n🔍 Beginning Research Process...');

    // Define main research goal
    await runCommand(agent, 'goal', 'develop hybrid AI system combining neural and symbolic reasoning');

    // Generate research plan
    console.log('\n📋 Generating research plan...');
    await runCommand(agent, 'plan', 'How to develop a hybrid AI system combining neural and symbolic reasoning');

    // Ask for specific reasoning
    console.log('\n🤔 Analyzing design decisions...');
    await runCommand(agent, 'reason', 'What are the main challenges in combining neural networks with symbolic reasoning systems?');

    // Get expert perspective
    console.log('\n💡 Seeking expert insights...');
    await runCommand(agent, 'think', 'What would be the key breakthrough needed to make hybrid neural-symbolic systems practical?');

    // Query NARS for related knowledge
    console.log('\n🔍 Querying NARS knowledge...');
    try {
        const res = await agent.processInput('<hybrid-system --> ?property>?');
        console.log(`   Result: ${res}`);
    } catch (e) {
        console.log(`   ⚠ NARS query failed: ${e.message}`);
    }

    // Synthesize information from both systems
    console.log('\n🔗 Synthesizing hybrid insights...');
    await runCommand(agent, 'lm', 'Based on the NARS knowledge and your understanding, what would be the architecture of a practical hybrid neural-symbolic system?');
}

async function trackProgress(agent) {
    console.log('\n📈 Tracking Research Progress...');

    // Add progress indicators to NARS
    await agent.processInput('<research-phase-1 --> completed>. %0.60;0.70%');
    await agent.processInput('<hybrid-architecture --> designed>. %0.40;0.65%');
    await agent.processInput('<neural-integration --> in-progress>. %0.30;0.70%');
    await agent.processInput('<symbolic-module --> implemented>. %0.80;0.85%');

    // Check status
    console.log('\n📊 Current research status:');
    await runCommand(agent, 'agent', 'status');
    await runCommand(agent, 'goal', 'list');

    // Analyze progress
    console.log('\n🎯 Analyzing progress...');
    await runCommand(agent, 'reason', 'What is the current state of the hybrid AI research project and what are the next steps?');
}

async function adaptiveReasoning(agent) {
    console.log('\n🔄 Demonstrating Adaptive Reasoning...');

    // Simulate encountering a research challenge
    console.log('\n⚠️  Research challenge encountered: Symbolic reasoning is too slow');

    // Query for solutions
    await runCommand(agent, 'think', 'How can we optimize symbolic reasoning speed without losing expressiveness?');

    // Get planning advice
    await runCommand(agent, 'plan', 'Approaches to optimize symbolic reasoning performance in hybrid systems');

    // Update knowledge based on new insights
    await agent.processInput('<optimization-needed --> symbolic-reasoning-speed>. %1.00;0.80%');
    await agent.processInput('<potential-solution --> indexing-optimization>. %0.70;0.75%');
    await agent.processInput('<potential-solution --> parallel-processing>. %0.60;0.70%');

    // Synthesize solution
    await runCommand(agent, 'lm', 'Combine NARS knowledge about symbolic reasoning optimization with your expertise to propose the best approach');

    // Update goals based on new understanding
    await runCommand(agent, 'goal', 'optimize symbolic reasoning performance in hybrid system');

    console.log('\n✅ Adaptation completed - system adjusted to new challenge');
}

async function runCommand(agent, cmd, ...args) {
    try {
        const result = await agent.executeCommand(cmd, ...args);
        console.log(`   Command: /${cmd} ${args.join(' ')}`);
        console.log(`   Result: ${typeof result === 'string' ? result.substring(0, 80) : JSON.stringify(result)}${result.length > 80 ? '...' : ''}`);
        return result;
    } catch (error) {
        console.log(`   Command: /${cmd} ${args.join(' ')}`);
        console.log(`   Error: ${error.message}`);
        return null;
    }
}

runResearchScenarioDemo();
