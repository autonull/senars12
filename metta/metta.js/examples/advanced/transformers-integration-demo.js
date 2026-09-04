#!/usr/bin/env node
process.env.ORT_LOG_LEVEL = '3';

import { App } from '@senars/agent';
import { MCPManager } from '../../core/src/mcp/MCPManager.js';
import { NARControlTool } from '../../core/src/tool/NARControlTool.js';

const section = (title) => console.log(`\n${'═'.repeat(60)}\n${title}\n${'═'.repeat(60)}`);
const log = (...args) => console.log('  ', ...args);

async function runDemo() {
  console.log('🔧 SeNARS Transformers.js Integration Demo');
  console.log('Demonstrates: NAR control, LM-tool binding, MCP protocol\n');

  const app = new App({
    lm: {
      provider: 'transformers',
      modelName: 'Xenova/LaMini-Flan-T5-248M',
      enabled: true,
      temperature: 0.1,
    },
    subsystems: {
      lm: true,
      tools: true,
      embeddingLayer: true,
      metacognition: true,
      rules: ['syllogistic-core', 'temporal'],
    },
    nar: { tools: { enabled: true } },
    memory: { enableMemoryValidation: false },
  });

  try {
    const agent = await app.start({ startAgent: true });
    log('✅ SeNARS initialized with Transformers.js + tools + MCP\n');

    // NAR Control Tool
    section('1️⃣  NAR Control Tool');
    const narTool = new NARControlTool(agent.nar || agent);

    const beliefs = [
      '(dog --> mammal).',
      '(mammal --> warm-blooded).',
      '(student --> person).',
      '(person --> mortal).',
    ];

    for (const belief of beliefs) {
      const result = await narTool.execute({ action: 'add_belief', content: belief });
      log(`Added: ${belief} → ${result.message}`);
    }

    await narTool.execute({ action: 'step' });
    const queryResult = await narTool.execute({
      action: 'query',
      content: '<dog --> warm-blooded>?',
    });
    log(`Query result:`, JSON.stringify(queryResult, null, 2));

    // LM-Tool Integration
    section('2️⃣  LM-Tool Binding');
    if (agent.lm?.providers) {
      const providerCount = agent.lm.providers.size ?? [...agent.lm.providers.getAll()].length;
      log(`LM has ${providerCount} provider(s) registered`);

      for (const [id, provider] of agent.lm.providers.getAll()) {
        log(`  ${id}: ${provider.constructor?.name}`);
        if (provider.tools?.length) {
          provider.tools.forEach((t) => log(`    - ${t.name || t.id}`));
        }
      }
    }

    // MCP Integration
    section('3️⃣  MCP Protocol');
    try {
      const mcpManager = new MCPManager({ nar: agent.nar || agent });
      await mcpManager.initialize();
      const server = await mcpManager.setupServer(8082, { nar: agent.nar || agent });
      log(`✅ MCP server on port 8082`);
      log(`Exposed tools: ${server.getExposedTools?.() ?? 'N/A'}`);
      await mcpManager.registerToolsWithNAR?.(agent);
    } catch (e) {
      log(`⚠️  MCP: ${e.message} (expected in some configurations)`);
    }

    // LM Streaming Demo
    section('4️⃣  LM Streaming');
    log('Input: "What can we infer about dogs?"');
    process.stdout.write('  Response: ');
    await agent.processInputStreaming?.(
      'If mammals are warm-blooded and dogs are mammals, what can we conclude?',
      (chunk) => process.stdout.write(chunk)
    );
    console.log('\n');

    // Summary
    section('✨ Integration Summary');
    log('• Transformers.js: Compact, offline LM (Xenova models)');
    log('• NARControlTool: LM can add beliefs, query, step reasoning');
    log('• MCP Protocol: External systems integrate via standard protocol');
    log('• Hybrid architecture: Neural pattern recognition + symbolic logic');

    await app.shutdown();
    console.log('\n✅ Demo completed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    await app.shutdown().catch(() => {});
  }
}

runDemo();
