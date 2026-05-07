import { SeNARSFactory } from '../src/nar/factory.js';
import { VercelLMClient } from '../src/nar/lm/vercel-client.js';
import { OllamaLMClient } from '../src/nar/lm/ollama-client.js';
import { MockLMClient } from '../src/nar/lm/mock-client.js';

async function testWithMock() {
  console.log('\n=== Testing with Mock LM Client ===\n');

  const lmClient = new MockLMClient({
    'hypothesis': '(animal --> can-fly)',
    'explain': '(bird --> has-wings)',
  });

  console.log('Testing LM prompt...');
  const response = await lmClient.generateText('test hypothesis');
  console.log('LM Response:', response);
  console.log('Call count:', lmClient.getCallCount());
  console.log('✓ Mock LM test complete\n');
}

async function testWithVercel() {
  console.log('\n=== Testing with Vercel AI SDK (Anthropic) ===\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠ ANTHROPIC_API_KEY not set, skipping Vercel test');
    console.log('Set ANTHROPIC_API_KEY to test with real LLM');
    console.log('Get one at: https://console.anthropic.com/\n');
    return;
  }

  try {
    const lmClient = new VercelLMClient({
      model: 'claude-3-5-sonnet-20241022',
    });

    console.log('Testing LM prompt...');
    const response = await lmClient.generateText('What is 2+2? Answer in one word.');
    console.log('LM Response:', response);
    console.log('✓ Vercel AI SDK test complete\n');
  } catch (error) {
    console.log('⚠ Vercel test failed:', error instanceof Error ? error.message : error);
    console.log('');
  }
}

async function testWithOllama() {
  console.log('\n=== Testing with Ollama (Local LLM) ===\n');

  try {
    const lmClient = new OllamaLMClient({
      model: 'llama3.2',
      baseUrl: 'http://localhost:11434',
    });

    console.log('Testing LM prompt...');
    const response = await lmClient.generateText('What is 2+2? Answer in one word.');
    console.log('LM Response:', response);
    console.log('✓ Ollama test complete\n');
  } catch (error) {
    console.log('⚠ Ollama test failed (Ollama may not be running)');
    console.log('Install Ollama: https://ollama.ai');
    console.log('Error:', error instanceof Error ? error.message : error);
    console.log('');
  }
}

async function main() {
  console.log('SeNARS12 - Real LM Backend Integration Test');
  console.log('==========================================\n');

  await testWithMock();
  await testWithVercel();
  await testWithOllama();

  console.log('All tests complete!\n');
}

main().catch(console.error);
