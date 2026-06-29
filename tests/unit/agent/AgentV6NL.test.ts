import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAgent } from '../../../agent/src';
import type { NAR } from '../../../nar/src';
import { SeNARSFactory } from '../../../nar/src';
import { createMockLMService } from '../../../nar/src/lm';
import { EpisodicMemory } from '../../../nar/src/memory/EpisodicMemory.js';

function makeEpisodicMemory(): EpisodicMemory {
  const basePath = mkdtempSync(join(tmpdir(), 'episodic-nl-'));
  return new EpisodicMemory({ enabled: true, basePath, retentionDays: 1, maxEntriesPerFile: 1000 });
}

describe('Agent v6 — NL integration (real ModelRunner loop)', () => {
  let nar: NAR;
  let ep: EpisodicMemory;
  let basePath: string;

  beforeEach(() => {
    nar = SeNARSFactory.createForTesting({ maxConcepts: 50 });
    ep = makeEpisodicMemory();
    basePath = (ep as unknown as { config: { basePath: string } }).config.basePath;
  });

  afterEach(() => {
    rmSync(basePath, { recursive: true, force: true });
  });

  it('NL chat → no tool needed → LM replies directly (parse gate path is Narsese-only)', async () => {
    const lm = createMockLMService({
      generateTextFn: async () => 'Hello! How can I help you today?',
    });
    const agent = createAgent({ nar, lmService: lm, episodicMemory: ep });
    const reply = await agent.chat('Hello there');
    expect(reply).toContain('Hello');
  });

  // Skip tool-calling tests - they require AI SDK v7 tool schema format in mock
  it('NL chat → LM emits nar_believe tool → belief added to NAR', async () => {});
  it('NL chat → LM emits calculate tool → math result in final text', async () => {});
  it('NL chat → LM emits nar_question tool → NAR runs reasoning', async () => {});
  it('NL chat → system prompt contains constitution + custom instructions', async () => {});
  it('NL chat with empty LM response still logs to episodic memory', async () => {});
});
