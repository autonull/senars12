import type { Episode } from '@senars/util';
import { EpisodeConsolidator, symbolicSummary } from '@senars/nar/memory/episode-consolidator.js';
import { EpisodicMemory } from '@senars/nar/memory/EpisodicMemory.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const dirs: string[] = [];
const tmpBase = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'refactor2-consolidator-'));
  dirs.push(dir);
  return dir;
};
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

const episode = (
  id: string,
  type: Episode['type'],
  content: string,
  edges: Partial<Pick<Episode, 'causes' | 'consequences' | 'context'>> = {},
  correlationId = 'c1',
  kind?: string
): Episode => ({
  timestamp: Date.now(),
  type,
  content,
  metadata: { correlationId, ...(kind ? { kind } : {}) },
  id,
  ...edges,
});

describe('Bench 87 — EpisodeConsolidator (AIKR pattern #1)', () => {
  it('capacity eviction drops lowest-priority candidates', () => {
    const c = new EpisodeConsolidator({ capacity: 3 });
    c.admit(episode('low', 'tool_call', 'a', {}, 's0'));
    c.admit(episode('mid', 'dialogue', 'b', {}, 's0'));
    c.admit(episode('high', 'reaction', 'c', { causes: ['x', 'y'] }, 's0'));
    c.admit(episode('higher', 'reaction', 'd', { causes: ['x', 'y', 'z'] }, 's0'));
    expect(c.peek().sort()).toEqual(['high', 'higher', 'mid']);
  });

  it('pressure gate: inert below threshold, drains only above it', async () => {
    const summaries: Episode[] = [];
    const c = new EpisodeConsolidator({
      capacity: 8,
      emit: (s) => {
        summaries.push(s);
      },
    });
    c.admit(episode('e1', 'dialogue', 'one', {}, 's1'));
    c.admit(episode('e2', 'dialogue', 'two', {}, 's1'));
    expect(c.pressure).toBeLessThan(0.7);
    await expect(c.consolidateIfPressured()).resolves.toEqual([]);
    expect(summaries).toHaveLength(0);

    for (let i = 0; i < 6; i++) c.admit(episode(`m${i}`, 'dialogue', `bulk-${i}`, {}, 's1'));
    const out = await c.consolidateIfPressured({ budget: 4 });
    expect(out).toHaveLength(1); // one signature bucket → one summary of up to 4
    expect(out[0]!.merged).toHaveLength(4);
    expect(summaries).toHaveLength(1);
  });

  it('decay forgets stale candidates', () => {
    const c = new EpisodeConsolidator({ capacity: 4, forgetRate: 0.3 });
    c.admit(episode('x', 'input', 'stale', {}, 's9'));
    c.decay(0.5); // 0.5 × 0.5 = 0.25 < forgetRate 0.3 → forgotten
    expect(c.size).toBe(0);
  });

  it('abort yields partial results; unprocessed candidates stay', async () => {
    const ctl = new AbortController();
    const emitted: Episode[] = [];
    const c = new EpisodeConsolidator({
      emit: (s) => {
        emitted.push(s);
        ctl.abort(); // abort after the first summary
      },
    });
    c.admit(episode('p1', 'dialogue', 'a', {}, 's1'));
    c.admit(episode('p2', 'dialogue', 'b', {}, 's1'));
    c.admit(episode('p3', 'input', 'c', {}, 's2'));
    c.admit(episode('p4', 'input', 'd', {}, 's2'));
    const out = await c.consolidate({ signal: ctl.signal });
    expect(out).toHaveLength(1); // partial: first group only
    expect(c.size).toBe(4); // aborted batch is not consumed
    expect(emitted).toHaveLength(1);
  });

  it('symbolic fallback on LM null and LM exception', async () => {
    const nullLM = new EpisodeConsolidator({});
    nullLM.admit(episode('a1', 'dialogue', 'hello world', {}, 's1'));
    nullLM.admit(episode('a2', 'dialogue', 'hello again', {}, 's1'));
    const [nullOut] = await nullLM.consolidate();
    expect(nullOut!.summary.content).toBe('consolidated 2 dialogue episodes: hello world | hello again');

    const throwingLM = new EpisodeConsolidator({
      summarizeWithLM: async () => {
        throw new Error('LM unavailable');
      },
    });
    throwingLM.admit(episode('b1', 'error', 'boom one', {}, 's1'));
    throwingLM.admit(episode('b2', 'error', 'boom two', {}, 's1'));
    const [throwOut] = await throwingLM.consolidate();
    expect(throwOut!.summary.content).toBe('consolidated 2 error episodes: boom one | boom two');
  });

  it('LM path is used when it produces text; empty/null falls back symbolically', async () => {
    const c = new EpisodeConsolidator({
      summarizeWithLM: async (group) => (group.length > 1 ? `LM digest of ${group.length} turns` : ''),
    });
    c.admit(episode('l1', 'dialogue', 'a', {}, 's1'));
    c.admit(episode('l2', 'dialogue', 'b', {}, 's1'));
    const [out] = await c.consolidate();
    expect(out!.summary.content).toBe('LM digest of 2 turns');
  });

  it('determinism under a fixed RandomSource', async () => {
    const run = async (seed: number): Promise<string[]> => {
      let s = seed;
      const rng = (): number => {
        s = (s * 48271) % 2147483647;
        return s / 2147483647;
      };
      const c = new EpisodeConsolidator({ capacity: 64, rng });
      for (let i = 0; i < 12; i++)
        c.admit(episode(`d${i}`, i % 2 ? 'dialogue' : 'input', `v${i}`, {}, i % 2 ? 's1' : 's2'));
      const out = await c.consolidate();
      return out.flatMap((r) => [r.summary.id ?? '', r.summary.content]);
    };
    expect(await run(42)).toEqual(await run(42));
  });

  it('summaries carry correct causal edges; raw episodes never deleted', async () => {
    const base = await tmpBase();
    const mem = new EpisodicMemory({ basePath: base });
    const consolidator = new EpisodeConsolidator({
      emit: (s) => mem.log(s.type, s.content, s.metadata),
    });
    mem.onLogged = (e) => consolidator.admit(e);

    for (const id of ['r1', 'r2', 'r3']) {
      await mem.log('reaction', `corr-${id}`, {
        correlationId: 's1',
        kind: 'correct',
        causes: [`turn-${id}`],
        id,
      });
    }
    await consolidator.consolidate({ budget: 3 });

    const all = await mem.getEpisodes({ limit: 100 });
    const summary = all.find((e) => e.metadata.kind === 'consolidation');
    expect(summary).toBeDefined();
    expect(summary!.causes).toHaveLength(3);
    expect([...(summary!.causes ?? [])].sort()).toEqual(['r1', 'r2', 'r3']);

    // Append-only: raw episodes survive consolidation.
    expect(all.filter((e) => e.type === 'reaction')).toHaveLength(3);
    const file = await readFile(
      join(base, `${new Date().toISOString().split('T')[0]}.jsonl`),
      'utf-8'
    );
    expect(file.split('\n').filter((l) => l.trim())).toHaveLength(4); // 3 raw + 1 summary
  });

  it('singletons are retained until peers arrive (selection only admits groupable)', async () => {
    const c = new EpisodeConsolidator({ capacity: 16 });
    c.admit(episode('solo', 'dialogue', 'alone', {}, 's5'));
    await expect(c.consolidate()).resolves.toEqual([]);
    expect(c.size).toBe(1);
  });

  it('correction reactions outrank plain reactions at equal connectivity', () => {
    const c = new EpisodeConsolidator({ capacity: 1 });
    c.admit(episode('plain-r', 'reaction', 'plain accept', {}, 's1', 'accept'));
    c.admit(episode('corr-r', 'reaction', 'correction', { causes: ['turn-x'] }, 's1', 'correct'));
    expect(c.peek()).toEqual(['corr-r']);
  });

  it('summary ids are deterministic over the merged set', async () => {
    const build = async (): Promise<Episode> => {
      const c = new EpisodeConsolidator({});
      c.admit(episode('z9', 'dialogue', 'one', {}, 's1'));
      c.admit(episode('z1', 'dialogue', 'two', {}, 's1'));
      const [out] = await c.consolidate();
      return out!.summary;
    };
    const a = await build();
    const b = await build();
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^consolidation:[0-9a-f]{16}$/);
    expect(a.causes).toEqual(['z1', 'z9']); // sorted upstream ids
    expect(symbolicSummary([a])).toContain(a.type);
  });
});

describe('Bench 87 — NAR wiring (inert until sinks are wired)', () => {
  it('consolidator is absent unless config opts in; hook no-ops without it', async () => {
    const { NAR } = await import('@senars/nar');
    const nar = new NAR({ enableLMRules: false } as never);
    expect(nar.getEpisodeConsolidator()).toBeUndefined();
    await expect(nar.consolidateLearning({ budget: 2 })).resolves.toBeUndefined();
  });

  it('enabled config creates the process; admit + emit flow through the episodic store', async () => {
    const { NAR } = await import('@senars/nar');
    const nar = new NAR({
      enableLMRules: false,
      episodeConsolidation: { enabled: true, capacity: 4, budget: 4 },
    } as never);
    const consolidator = nar.getEpisodeConsolidator();
    expect(consolidator).toBeDefined();

    const base = await tmpBase();
    const mem = new EpisodicMemory({ basePath: base });
    const persisted: string[] = [];
    nar.attachEpisodeConsolidatorSink((s) => {
      persisted.push(s.id ?? '');
      return mem.log(s.type, s.content, s.metadata);
    });
    mem.onLogged = (e) => consolidator!.admit(e);

    for (const id of ['w1', 'w2', 'w3', 'w4']) {
      await mem.log('dialogue', `turn-${id}`, { correlationId: 'w', id });
    }
    await nar.consolidateLearning({ budget: 4 });
    expect(persisted.length).toBeGreaterThanOrEqual(1);
    const all = await mem.getEpisodes({ limit: 50 });
    const summary = all.find((e) => e.metadata.kind === 'consolidation');
    expect(summary).toBeDefined();
    expect((summary!.metadata as { summaryOf: string[] }).summaryOf.length).toBeGreaterThanOrEqual(
      2
    );
    // Raw episodes never deleted.
    expect(all.filter((e) => e.type === 'dialogue')).toHaveLength(4);
  });
});

describe('Bench 87 — sink failure surfaces to the caller (batch retained)', () => {
  it('emit rejection propagates; candidates remain for a later pass', async () => {
    const c = new EpisodeConsolidator({
      emit: async () => {
        throw new Error('sink down');
      },
    });
    c.admit(episode('f1', 'dialogue', 'a', {}, 's1'));
    c.admit(episode('f2', 'dialogue', 'b', {}, 's1'));
    await expect(c.consolidate()).rejects.toThrow('sink down');
    expect(c.size).toBe(2); // removal happens only after a successful pass
  });
});
