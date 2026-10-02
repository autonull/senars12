import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createAgent } from '../../../nar/src/agent/index.js';
import { createNAR } from '../../../nar/src/nar-presets.js';
import { Truth, termKey, termParser } from '../../../nar/src/terms';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const testStateDir = join(process.cwd(), '.cache', 'test-delegation');

async function ensureDir() {
  await mkdir(testStateDir, { recursive: true });
}

describe('M6: Multi-Agent Delegation — Live WS round-trip', () => {
  beforeEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
    await ensureDir();
  });

  afterEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
  });

  test('Agent A delegates to Agent B over WebSocket', { timeout: 30000 }, async () => {
    // Agent B: runs as WebSocket server on port 8766
    const narB = createNAR({
      persistState: false,
      maxConcepts: 1000,
      systemOne: { enabled: false },
    });
    const agentB = await createAgent({
      nar: narB,
      transport: { ws: { port: 8766 } }, // Server mode: listen on port 8766
    });

    await agentB.start();

    // Pre-load Agent B with knowledge: Paris is the capital of France
    await agentB.believe('(Paris --> capitalOfFrance). %0.9;0.9%');
    await narB.run(5);

    // Agent A: no transport config (client mode - delegate() creates its own connection)
    const narA = createNAR({
      persistState: false,
      maxConcepts: 1000,
      systemOne: { enabled: false },
    });
    const agentA = await createAgent({
      nar: narA,
      // No transport config - delegate() will create client connection
    });

    await agentA.start();

    // Agent A delegates a question to Agent B
    const result = await agentA.delegate({
      target: 'ws://localhost:8766',
      task: { type: 'question', term: '(?what --> capitalOfFrance)?' },
      ruleId: 'lm-curiosity-question',
    });

    // Verify result
    expect(result).toBeDefined();
    expect(result.error).toBeUndefined();
    expect(result.truth).toBeDefined();
    
    // The result should be admitted with PEER_AGENT quality (confidence ≤ 0.5)
    expect(result.confidence).toBeLessThanOrEqual(0.5);
    
    // The answer should be Paris
    const answerTerm = termParser.parse(result.truth!);
    expect(termKey(answerTerm)).toBe(termKey(termParser.parse('(Paris --> capitalOfFrance)')));

    await agentA.stop();
    await narA.dispose();
    await agentB.stop();
    await narB.dispose();
  });

  test('Delegation timeout handling', { timeout: 30000 }, async () => {
    // Agent A tries to delegate to non-existent server
    const narA = createNAR({
      persistState: false,
      maxConcepts: 1000,
      systemOne: { enabled: false },
    });
    const agentA = await createAgent({
      nar: narA,
      // No transport config - delegate() will create client connection
    });

    await agentA.start();

    const result = await agentA.delegate({
      target: 'ws://localhost:9999',
      task: { type: 'question', term: '(test --> ?what)?' },
      ruleId: 'lm-curiosity-question',
    });

    // Should fail with timeout/error
    expect(result).toBeDefined();
    expect(result.error).toBeDefined();

    await agentA.stop();
    await narA.dispose();
  });
});