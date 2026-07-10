#!/usr/bin/env node

/**
 * Advanced SeNARS Agent REPL with Ollama Integration Demo
 * Demonstrates hybrid intelligence with LM and NARS integration
 */

import { App } from '@senars/agent';

async function runAdvancedAgentDemo() {
  console.log('🤖🎨 SeNARS Advanced Agent REPL Demo with Ollama Integration\n');
  console.log('This demo showcases hybrid intelligence capabilities\n');
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log('│  DEMONSTRATION: Complex reasoning with LM + NARS   │');
  console.log('└─────────────────────────────────────────────────────┘\n');

  try {
    // Initialize App with configuration for Ollama
    const app = new App({
      lm: {
        enabled: true,
        provider: process.env.LM_PROVIDER || 'ollama',
        modelName: process.env.LM_MODEL || process.env.OLLAMA_MODEL || 'llama3',
        task: process.env.LM_TASK,
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        temperature: 0.7,
      },
    });

    // Initialize default agent
    console.log('Initializing default agent...');
    await app.initialize();
    console.log('✅ Agent engine initialized with Ollama provider\n');

    // Run comprehensive demonstration scenarios
    await runAgentManagementDemo(app);

    // Get the active agent for subsequent demos
    const activeAgent = app.agent;
    if (!activeAgent) throw new Error('No active agent found');

    await runHybridReasoningDemo(activeAgent);
    await runGoalPlanningDemo(activeAgent);
    await runComplexQueryDemo(activeAgent);

    console.log('\n🎉 ADVANCED DEMO COMPLETE!');
    console.log('Hybrid intelligence capabilities successfully demonstrated!');

    if (activeAgent.getStats) {
      const stats = activeAgent.getStats();
      console.log('\n📊 PERFORMANCE METRICS:');
      console.log(`   - NARS cycles executed: ${stats.cycleCount || 0}`);
      console.log(`   - Beliefs: ${activeAgent.getBeliefs().length}`);
    }

    await app.shutdown();
    console.log('\n👋 Engine shutdown completed');
  } catch (error) {
    console.error('❌ Advanced Demo Error:', error);
    if (error.stack) console.error(error.stack);
  }
}

async function runAgentManagementDemo(app) {
  console.log('\n┌─ DEMONSTRATION: Agent Creation & Management ──────────┐');

  console.log("Creating 'researcher' and 'planner' agents...");
  await app.createAgent('researcher');
  await app.createAgent('planner');

  // List agents
  console.log('Listing agents:');
  const agents = app.listAgents();
  agents.forEach((a) => console.log(`  - ${a.id} ${a.isActive ? '[ACTIVE]' : ''}`));

  // Switch between agents
  console.log("Switching to 'researcher'...");
  app.switchAgent('researcher');
  console.log(`Active agent is now: ${app.activeAgentId}`);

  console.log('└──────────────────────────────────────────────────────┘');
}

async function runHybridReasoningDemo(agent) {
  console.log('\n┌─ DEMONSTRATION: Hybrid Reasoning (LM + NARS) ────────┐');

  console.log('\n📚 Adding background knowledge to NARS system...');
  await agent.processInput('<bird --> animal>. %1.00;0.90%');
  await agent.processInput('<robin --> bird>. %1.00;0.90%');
  await agent.processInput('<swan --> bird>. %1.00;0.90%');
  await agent.processInput('<bird --> flyer>. %0.80;0.85%');
  await agent.processInput('<swan --> white>. %0.95;0.80%');

  console.log('\n🧠 Testing pure NARS inference...');
  // NARS should infer: <robin --> animal>. from the above
  const res = await agent.processInput('<robin --> ?x>?'); // Query what robins are
  console.log(`Result: ${res}`);

  console.log('\n🤔 Testing LM reasoning with NARS knowledge context...');
  // Now ask the LM to reason about this knowledge
  await runCommand(agent, 'reason', 'What can you infer about robins based on NARS knowledge?');

  console.log('\n💭 Demonstrating LM reflection on NARS reasoning...');
  await runCommand(
    agent,
    'think',
    "How does the NARS system's inference about robins differ from typical neural network reasoning?"
  );

  // Ask for synthesis of both systems
  console.log('\n🔗 Testing hybrid synthesis...');
  await runCommand(
    agent,
    'lm',
    'Combine NARS inference that robins are animals with additional knowledge about robins to describe robin characteristics.'
  );

  console.log('└──────────────────────────────────────────────────────┘');
}

async function runGoalPlanningDemo(agent) {
  console.log('\n┌─ DEMONSTRATION: Goal Setting & Planning ─────────────┐');

  // Set an agent goal
  await runCommand(agent, 'goal', 'learn_quantum_physics');

  // Generate a plan to achieve the goal
  await runCommand(agent, 'plan', 'How to learn quantum physics fundamentals in 3 months');

  // Set a more specific goal
  await runCommand(agent, 'goal', 'understand_quantum_entanglement --> important');

  // Query for goals
  await runCommand(agent, 'goal', 'list');

  // Ask the LM to reason about goal prioritization
  await runCommand(
    agent,
    'reason',
    'Between learning quantum physics and understanding quantum entanglement, which should be prioritized and why?'
  );

  console.log('└──────────────────────────────────────────────────────┘');
}

async function runComplexQueryDemo(agent) {
  console.log('\n┌─ DEMONSTRATION: Complex LM-NARS Integration ────────┐');

  // Complex reasoning that combines both systems
  console.log('\n🧩 Complex multi-step reasoning example...');
  await runCommand(
    agent,
    'think',
    'How might quantum physics concepts like entanglement be represented in a NARS system?'
  );

  // Ask for practical applications
  console.log('\n💡 Practical application reasoning...');
  await runCommand(
    agent,
    'reason',
    'If we know that quantum computers use entanglement and NARS can represent complex relationships, how might we combine these for AI?'
  );

  // Planning with hybrid intelligence
  console.log('\n📋 Hybrid planning example...');
  await runCommand(
    agent,
    'plan',
    'Design a research project that uses both NARS for symbolic reasoning and quantum computing principles'
  );

  // Test the LM fallback mechanism with non-Narsese input
  console.log('\n🔄 Testing LM fallback mechanism...');
  const fallbackTest = await agent.processInput('What is the weather like today?');
  console.log(
    `   Fallback response: ${typeof fallbackTest === 'string' ? fallbackTest.substring(0, 60) : JSON.stringify(fallbackTest)}...`
  );

  // Test with actual Narsese that should go to NARS
  console.log('\n⚡ Testing Narsese detection and routing...');
  try {
    await agent.processInput('<cat --> animal>. %1.00;0.90%');
    console.log('   ✓ Narsese properly routed to NARS system');
  } catch (e) {
    console.log('   ⚠ Narsese routing: ', e.message);
  }

  console.log('└──────────────────────────────────────────────────────┘');
}

async function runCommand(agent, cmd, ...args) {
  try {
    const result = await agent.executeCommand(cmd, ...args);
    console.log(`💬 Command: /${cmd} ${args.join(' ')}`);

    // Format output based on content type
    if (typeof result === 'string') {
      console.log('✅ Result:');
      console.log(
        result
          .trim()
          .split('\n')
          .map((line) => `   ${line}`)
          .join('\n')
      );
    } else {
      console.log(`✅ Result: ${JSON.stringify(result, null, 2)}`);
    }
    console.log('');
    return result;
  } catch (error) {
    console.log(`💬 Command: /${cmd} ${args.join(' ')}`);
    console.log(`❌ Error: ${error.message}\n`);
    return null;
  }
}

// Run the demo
runAdvancedAgentDemo();
