import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAgent } from '../../../agent/src';
import type { NAR } from '../../../nar/src';
import { SeNARSFactory } from '../../../nar/src';
import { createMockLMService } from '../../../nar/src/lm';
import { EpisodicMemory } from '../../../nar/src/memory/EpisodicMemory.js';

const scriptedLM = createMockLMService({
  available: true,
  generateTextFn: async (prompt: string) => {
    if (prompt.toLowerCase().includes('hello')) return 'Hi there!';
    return 'Mock response.';
  },
});

function makeEpisodicMemory(): EpisodicMemory {
  const basePath = mkdtempSync(join(tmpdir(), 'episodic-'));
  return new EpisodicMemory({ enabled: true, basePath, retentionDays: 1, maxEntriesPerFile: 100 });
}

describe('Agent (v6 harness)', () => {
  let nar: NAR;

  beforeEach(() => {
    nar = SeNARSFactory.createForTesting({ maxConcepts: 20 });
  });

  afterEach(() => {
    // no-op: tmp dirs cleaned in individual tests
  });

  // ── Parse gate ──────────────────────────────────────────

  it('feeds Narsese belief directly to NAR without LM', async () => {
    const ep = makeEpisodicMemory();
    const agent = createAgent({ nar, lmService: scriptedLM, episodicMemory: ep });
    const text = await agent.chat('(cat --> animal).');
    expect(text).toContain('(cat --> animal)');
    expect(nar.getBeliefs().length).toBeGreaterThan(0);
    rmSync(ep['config'].basePath, { recursive: true, force: true });
  });

  it('parses goal (!) correctly', async () => {
    const ep = makeEpisodicMemory();
    const agent = createAgent({ nar, lmService: scriptedLM, episodicMemory: ep });
    const text = await agent.chat('(call_mom)!');
    expect(text).toContain('+ (call_mom)!');
    expect(nar.getGoals().length).toBeGreaterThan(0);
    rmSync(ep['config'].basePath, { recursive: true, force: true });
  });

  it('parses question (?) and checks existing beliefs', async () => {
    const ep = makeEpisodicMemory();
    const agent = createAgent({ nar, lmService: scriptedLM, episodicMemory: ep });
    await nar.input('(cat --> animal).');
    const text = await agent.chat('(cat --> ?)?');
    expect(text).toMatch(/cat/);
    rmSync(ep['config'].basePath, { recursive: true, force: true });
  });

  it('rejects invalid Narsese and falls back to LM', async () => {
    const ep = makeEpisodicMemory();
    const agent = createAgent({ nar, lmService: scriptedLM, episodicMemory: ep });
    const text = await agent.chat('hello world');
    expect(text).toBe('Hi there!');
    rmSync(ep['config'].basePath, { recursive: true, force: true });
  });

  // ── recall ──────────────────────────────────────────────

  it('recall() returns empty without episodic memory', async () => {
    const agent = createAgent({ nar });
    const episodes = await agent.recall();
    expect(episodes).toEqual([]);
  });

  it('recall() searches episodic memory after chat', async () => {
    const ep = makeEpisodicMemory();
    const agent = createAgent({ nar, lmService: scriptedLM, episodicMemory: ep });
    await agent.chat('hello there friend');
    await new Promise((r) => setTimeout(r, 50));
    const episodes = await agent.recall('hello');
    expect(episodes.length).toBeGreaterThan(0);
    expect(episodes.some((e) => e.content.includes('hello'))).toBe(true);
    rmSync(ep['config'].basePath, { recursive: true, force: true });
  });

  // ── Throttle ────────────────────────────────────────────

  it('setThrottle() clamps to 0-100', () => {
    const agent = createAgent({ nar });
    agent.setThrottle(150);
    expect(agent.getThrottle()).toBe(100);
    agent.setThrottle(-5);
    expect(agent.getThrottle()).toBe(0);
    agent.setThrottle(50);
    expect(agent.getThrottle()).toBe(50);
  });

  it('start() returns a stop function and stop() is idempotent', () => {
    const agent = createAgent({ nar });
    const stop = agent.start();
    expect(typeof stop).toBe('function');
    stop();
    stop(); // idempotent
  });

  it('start()/stop() works without NAR (no-op)', () => {
    const agent = createAgent();
    const stop = agent.start();
    expect(typeof stop).toBe('function');
    stop();
  });

  // ── Context ─────────────────────────────────────────────

  it('works without NAR (NL still goes to LM)', async () => {
    const agent = createAgent({ lmService: scriptedLM });
    const text = await agent.chat('hello');
    expect(text).toBe('Hi there!');
  });

  // ── Graceful degradation ────────────────────────────────

  it('works without LM (Narsese only)', async () => {
    const agent = createAgent({ nar });
    const text = await agent.chat('(cat --> animal).');
    expect(text).toContain('(cat --> animal)');
  });

  it('works without NAR (LM only)', async () => {
    const agent = createAgent({ lmService: scriptedLM });
    const text = await agent.chat('hello');
    expect(text).toBe('Hi there!');
  });

  it('works without episodic memory', async () => {
    const agent = createAgent({ nar, lmService: scriptedLM });
    const text = await agent.chat('hello');
    expect(text).toBe('Hi there!');
  });

  // ── believe ─────────────────────────────────────────────

  it('believe() parses Narsese and feeds NAR', async () => {
    const ep = makeEpisodicMemory();
    const agent = createAgent({ nar, episodicMemory: ep });
    await agent.believe('(cat --> animal).');
    expect(nar.getBeliefs().length).toBeGreaterThan(0);
    rmSync(ep['config'].basePath, { recursive: true, force: true });
  });

  // ── accessors ───────────────────────────────────────────

  it('getNAR() returns the NAR instance', () => {
    const agent = createAgent({ nar });
    expect(agent.getNAR()).toBe(nar);
  });

  it('getEpisodicMemory() returns the memory instance', () => {
    const ep = makeEpisodicMemory();
    const agent = createAgent({ nar, episodicMemory: ep });
    expect(agent.getEpisodicMemory()).toBe(ep);
    rmSync(ep['config'].basePath, { recursive: true, force: true });
  });
});
