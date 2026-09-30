import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCognitiveAgent } from '@senars/nar/agent';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('TODO26 T1 — createCognitiveAgent demo @load-sensitive', () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = await mkdtemp(join(tmpdir(), 'todo26-agent-'));
  });

  afterEach(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  it('teach/ask/checkpoint/resume equivalence', async () => {
    const agent = await createCognitiveAgent({ preset: 'chat' });
    await agent.teach('(cat --> animal). %1.00;0.90%');
    const a = await agent.ask('(cat --> animal)?');

    await agent.checkpoint();
    await agent.stop();

    const agent2 = await createCognitiveAgent({ preset: 'chat', resume: true });
    const a2 = await agent2.ask('(cat --> animal)?');
    await agent2.stop();

    // Compare stripped answers (no provenance fields)
    expect(a.conclusion).toBe(a2.conclusion);
    expect(a.truth.f).toBeCloseTo(a2.truth.f, 3);
    expect(a.truth.c).toBeCloseTo(a2.truth.c, 3);
    expect(a.reputation).toBe(a2.reputation);
  });
});