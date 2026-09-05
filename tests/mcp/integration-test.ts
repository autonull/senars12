/**
 * MCP Integration Test
 * Tests the SeNARS MCP server using the official SDK client
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function runIntegrationTest() {
  console.log('Starting MCP integration test...');

  // Create client transport that spawns the server
  const transport = new StdioClientTransport({
    command: 'pnpm',
    args: ['mcp'],
    cwd: '/home/me/senars12',
  });

  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

  try {
    await client.connect(transport);
    console.log('Connected to MCP server');

    // Test 1: List tools
    console.log('\n=== Test 1: List Tools ===');
    const toolsResult = await client.listTools();
    console.log(`Found ${toolsResult.tools.length} tools:`);
    for (const t of toolsResult.tools) {
      console.log(`  - ${t.name}: ${t.description}`);
    }

    // Verify expected tools exist
    const expectedTools = [
      'calculate',
      'read_file',
      'write_file',
      'search_memory',
      'run_reasoning',
      'learn_belief',
      'explain_belief',
      'agent_chat',
      'agent_chat_stream',
      'agent_believe',
      'agent_recall',
      'agent_know',
      'agent_lm_rule_enable',
      'agent_lm_rule_disable',
      'agent_explain',
      'agent_goal_progress',
      'get_beliefs',
      'get_attention',
    ];

    for (const tool of expectedTools) {
      const found = toolsResult.tools.some((t) => t.name === tool);
      console.log(found ? `  ✓ ${tool}` : `  ✗ ${tool} MISSING`);
    }

    // Test 2: Call calculate tool
    console.log('\n=== Test 2: Calculate Tool ===');
    const calcResult = await client.callTool({
      name: 'calculate',
      arguments: { expression: '2 + 2 * 3' },
    });
    console.log('Result:', calcResult.content[0]?.text);

    // Test 3: Call get_beliefs tool
    console.log('\n=== Test 3: Get Beliefs Tool ===');
    const beliefsResult = await client.callTool({
      name: 'get_beliefs',
      arguments: {},
    });
    console.log('Beliefs count:', JSON.parse(beliefsResult.content[0]?.text || '[]').length);

    // Test 4: List resources
    console.log('\n=== Test 4: List Resources ===');
    const resourcesResult = await client.listResources();
    console.log(`Found ${resourcesResult.resources.length} resources:`);
    for (const r of resourcesResult.resources) {
      console.log(`  - ${r.uri}: ${r.name}`);
    }

    // Test 5: Read a resource
    console.log('\n=== Test 5: Read Resource ===');
    const resourceResult = await client.readResource({ uri: 'nar://beliefs' });
    console.log('Resource content length:', resourceResult.contents[0]?.text?.length || 0);

    // Test 6: List prompts
    console.log('\n=== Test 6: List Prompts ===');
    const promptsResult = await client.listPrompts();
    console.log(`Found ${promptsResult.prompts.length} prompts:`);
    for (const p of promptsResult.prompts) {
      console.log(`  - ${p.name}: ${p.description}`);
    }

    // Test 7: Get a prompt
    console.log('\n=== Test 7: Get Prompt ===');
    const promptResult = await client.getPrompt({
      name: 'reasoning_chain',
      arguments: { premise: 'A -> B', target: 'B' },
    });
    console.log('Prompt messages:', promptResult.messages.length);

    console.log('\n=== All Tests Passed! ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exitCode = 1;
  } finally {
    await client.close();
    await transport.close();
  }
}

runIntegrationTest().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
