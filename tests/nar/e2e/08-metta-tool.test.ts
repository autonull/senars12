import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createAgent } from '../../../nar/src/agent/index.js';
import { createNAR } from '../../../nar/src/nar-presets.js';
import { createMettaPort } from '@senars/metta/agent';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const testStateDir = join(process.cwd(), '.cache', 'test-metta-tool');
const testDbPath = join(testStateDir, 'events.sqlite');

async function ensureDir() {
  await mkdir(testStateDir, { recursive: true });
}

describe('M3: MeTTa Verified — metta tool executes via ActionGate', () => {
  beforeEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
    await ensureDir();
  });

  afterEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
  });

  test('metta tool executes a MeTTa program via ActionGate', async () => {
    const mettaPort = createMettaPort();
    // Create NAR with tools enabled
    const nar = createNAR({
      enableTools: true,
      metta: mettaPort,
      persistState: false,
    });
    const agent = await createAgent({
      nar,
      persistence: { path: testDbPath },
    });

    try {
      // Execute a simple MeTTa program: (add (succ 0) (succ 0)) → (succ (succ 0))
      const result = await nar.executeTool('metta', {
        program:
          '(= (add $x 0) $x)\n(= (add $x (succ $y)) (succ (add $x $y)))\n(add (succ 0) (succ 0))',
      });

      // The result should contain the evaluated expression
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(String(result.content)).toContain('succ');
    } finally {
      await agent.stop();
      await nar.dispose();
    }
  });

  test('metta tool evaluates arithmetic expressions', async () => {
    const mettaPort = createMettaPort();
    // Create NAR with tools enabled
    const nar = createNAR({
      enableTools: true,
      metta: mettaPort,
      persistState: false,
    });
    const agent = await createAgent({
      nar,
      persistence: { path: testDbPath },
    });

    try {
      // Simple arithmetic: (add 1 2) = 3
      const result = await nar.executeTool('metta', {
        program: '(= (add 1 2) 3)\n(add 1 2)',
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(String(result.content)).toContain('3');
    } finally {
      await agent.stop();
      await nar.dispose();
    }
  });

  test('metta tool returns error when engine not configured', async () => {
    // Create NAR with tools enabled but no metta port
    const nar = createNAR({
      enableTools: true,
      persistState: false,
    });
    const agent = await createAgent({
      nar,
      persistence: { path: testDbPath },
    });

    try {
      const result = await nar.executeTool('metta', {
        program: '(add 1 2)',
      });

      // Should fail gracefully with honest error
      expect(result.success).toBe(false);
      expect(result.error).toContain('metta engine not configured');
    } finally {
      await agent.stop();
      await nar.dispose();
    }
  });
});
