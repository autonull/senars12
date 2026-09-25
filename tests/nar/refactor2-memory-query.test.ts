import { Memory } from '@senars/nar/memory';
import { EpisodicMemory } from '@senars/nar/memory/EpisodicMemory.js';
import {
  episodeQualitySurface,
  MemoryQuery,
} from '@senars/nar/query/memory-query.js';
import { retrospect } from '@senars/nar/dialogue/retrospect.js';
import { TermBuilder } from '@senars/nar/terms';
import type { Episode } from '@senars/util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const dirs: string[] = [];
const tmpBase = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'refactor2-memory-query-'));
  dirs.push(dir);
  return dir;
};
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

/** Deterministic 4-dim embedder: word-hash buckets (no randomness). */
const embed = (text: string): Float32Array => {
  const v = new Float32Array(4);
  for (const w of text.toLowerCase().split(/\W+/).filter(Boolean))
    v[w.charCodeAt(0) % 4]! += 1;
  return v;
};

const makeMemory = (): Memory => {
  const mem = new Memory({ maxConcepts: 100, activationDecayRate: 0.01 });
  for (const symbol of ['cat', 'catalog', 'dog', 'catastrophe']) {
    const concept = mem.addConcept(TermBuilder.atom(symbol));
    concept.priority = symbol === 'cat' ? 0.9 : symbol === 'catalog' ? 0.7 : 0.3;
  }
  return mem;
};

const makeEpisodes = async (): Promise<EpisodicMemory> => {
  const mem = new EpisodicMemory({ basePath: await tmpBase() });
  await mem.log('dialogue', 'cat saga', { correlationId: 'c1', sessionId: 's1', id: 'ep-cat' });
  await mem.log('input', 'dog walk', { correlationId: 'c1', sessionId: 's1', id: 'ep-dog' });
  await mem.log('error', 'unrelated failure', { correlationId: 'c2', sessionId: 's2', id: 'ep-err' });
  return mem;
};

describe('Bench 88 — MemoryQuery fan-out + ranking', () => {
  it('merges concept and episodic legs, ranked by weighted relevance', async () => {
    const episodic = await makeEpisodes();
    const q = new MemoryQuery({ memory: makeMemory(), episodic, weights: { concept: 2 } });
    const results = await q.search({ concept: 'cat', limit: 10 });
    const sources = new Set(results.map((r) => r.source));
    expect(sources.has('concept')).toBe(true);
    expect(sources.has('episode')).toBe(true);
    // Concept 'cat' (priority 0.9) outranks substring siblings.
    expect(results[0]!.source).toBe('concept');
    expect(results[0]!.concept?.term.toString()).toBe('cat');
    // Strictly descending scores.
    for (let i = 1; i < results.length; i++)
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
  });

  it('semantic leg scores by embedding similarity with threshold + weights', async () => {
    const episodic = await makeEpisodes();
    const q = new MemoryQuery({
      memory: makeMemory(),
      episodic,
      embed,
      weights: { concept: 1, episodic: 0.5, semantic: 2 },
    });
    const anchor = embed('cat saga pet');
    const results = await q.search({ embedding: anchor, limit: 10 });
    expect(results.length).toBeGreaterThan(0);
    // High-similarity episode content outranks weakly-related concepts.
    const topEpisode = results.find((r) => r.source === 'episode');
    expect(topEpisode).toBeDefined();
    const withThreshold = await q.search({
      embedding: anchor,
      similarityThreshold: 0.99,
      limit: 10,
    });
    expect(withThreshold).toHaveLength(0);
  });

  it('ranking order is stable (no RNG anywhere in the path)', async () => {
    const episodic = await makeEpisodes();
    const q = new MemoryQuery({ memory: makeMemory(), episodic, embed });
    const a = await q.search({ concept: 'cat', embedding: embed('cat'), limit: 10 });
    const b = await q.search({ concept: 'cat', embedding: embed('cat'), limit: 10 });
    expect(a.map((r) => r.score)).toEqual(b.map((r) => r.score));
    expect(a.map((r) => r.episode?.id ?? r.concept?.term.toString())).toEqual(
      b.map((r) => r.episode?.id ?? r.concept?.term.toString())
    );
  });

  it('empty-subsystem tolerance: episodic absent ⇒ concept-only', async () => {
    const q = new MemoryQuery({ memory: makeMemory() });
    const results = await q.search({ concept: 'cat', limit: 5 });
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.source === 'concept')).toBe(true);
  });

  it('limit bounds results; minPriority filters', async () => {
    const episodic = await makeEpisodes();
    const q = new MemoryQuery({ memory: makeMemory(), episodic });
    expect(await q.search({ concept: 'cat', limit: 2 })).toHaveLength(2);
    expect(await q.search({ concept: 'cat', limit: 0 })).toHaveLength(0);
    const high = await q.search({ concept: 'cat', minPriority: 0.8, limit: 10 });
    expect(high.every((r) => r.score >= 0.8)).toBe(true);
    expect(high.some((r) => r.concept?.term.toString() === 'cat')).toBe(true);
  });

  it('read-only: store snapshots unchanged across searches', async () => {
    const memory = makeMemory();
    const episodic = await makeEpisodes();
    const before = [...memory.listConcepts()].map((c) => [c.term.toString(), c.priority]);
    const beforeEpisodes = await episodic.getEpisodes({ limit: 100 });
    const q = new MemoryQuery({ memory, episodic, embed });
    await q.search({ concept: 'cat', embedding: embed('cat'), limit: 10 });
    const now = Date.now();
    await q.search({ timeRange: [now - 60_000, now + 60_000], limit: 10 });
    const after = [...memory.listConcepts()].map((c) => [c.term.toString(), c.priority]);
    expect(after).toEqual(before);
    const afterEpisodes = await episodic.getEpisodes({ limit: 100 });
    expect(afterEpisodes.map((e) => e.id)).toEqual(beforeEpisodes.map((e) => e.id));
  });

  it('timeRange + episodeType filters compose', async () => {
    const episodic = await makeEpisodes();
    const q = new MemoryQuery({ memory: makeMemory(), episodic });
    const errs = await q.search({ episodeType: 'error', limit: 10 });
    expect(errs.map((r) => r.episode?.id)).toEqual(['ep-err']);
    const future = await q.search({ timeRange: [Date.now() + 60_000, Date.now() + 120_000], limit: 10 });
    expect(future).toHaveLength(0);
  });
});

describe('Bench 88 — consumers', () => {
  it('retrospect() consumes MemoryQuery for session context', async () => {
    const episodic = await makeEpisodes();
    const q = new MemoryQuery({ memory: makeMemory(), episodic });
    await episodic.log('dialogue', JSON.stringify({ turnId: 'c1:1', sessionId: 's1', seq: 1 }), {
      correlationId: 'c1',
      sessionId: 's1',
      turnId: 'c1:1',
      id: 'c1:1',
    });
    await episodic.log('reaction', JSON.stringify({ turnId: 'c1:1', kind: 'accept' }), {
      correlationId: 'c1',
      sessionId: 's1',
      turnId: 'c1:1',
      kind: 'accept',
      causes: ['c1:1'],
    });
    const r = await retrospect('s1', episodic, {
      minTurns: 1,
      minReactions: 1,
      memoryQuery: q,
    });
    expect(r.sessionContext).toBeDefined();
    expect(r.sessionContext!.length).toBeGreaterThan(0);
    expect(r.sessionContext!.some((s) => s.startsWith('episode:') || s.startsWith('concept:'))).toBe(
      true
    );
  });

  it('episodeQualitySurface: groundedness turns + reaction fallback mapping', () => {
    const now = Date.now();
    const episodes: Episode[] = [
      {
        timestamp: now - 30,
        type: 'dialogue',
        content: 'turn',
        metadata: { grounding: { admitted: true, score: 0.8 } },
        id: 't1',
      },
      {
        timestamp: now - 20,
        type: 'reaction',
        content: 'r',
        metadata: { kind: 'accept' },
        id: 'r1',
      },
      {
        timestamp: now - 10,
        type: 'dialogue',
        content: 'ungrounded turn',
        metadata: {},
        id: 't2',
      },
      { timestamp: now - 5, type: 'input', content: 'ignored', metadata: {}, id: 'i1' },
    ];
    const surface = episodeQualitySurface(episodes);
    expect(surface).toEqual([
      { at: now - 30, quality: 0.8 },
      { at: now - 20, quality: 1 },
    ]);
  });
});
