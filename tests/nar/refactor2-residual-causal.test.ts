import type { CognitiveEvent } from '@senars/core';
import type { CycleHost } from '@senars/core/agent/phases';
import { runCycle } from '@senars/core/agent/phases';
import { type BagItem, PriorityBag } from '@senars/nar/bag/Bag.js';
import { retrospect } from '@senars/nar/dialogue/retrospect.js';
import { AIKRProcessor } from '@senars/nar/learning/aikr-processor.js';
import { EpisodicMemory } from '@senars/nar/memory/EpisodicMemory.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const dirs: string[] = [];
const tmpBase = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'refactor2-residual-'));
  dirs.push(dir);
  return dir;
};
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface HookHost extends CycleHost {
  trace: string[];
}

const makeHost = (
  overrides: {
    consolidateLearning?: (options: { budget?: number }) => Promise<void>;
    consolidation?: { enabled?: boolean; budget?: number };
  } = {}
): HookHost => {
  const trace: string[] = [];
  const host: HookHost = {
    trace,
    log: {
      append: async (e: { type: string }) => {
        trace.push(`log:${e.type}`);
        return { ...e, id: 'cid-1', timestamp: 0 };
      },
    },
    memory: {
      recent: () => [],
      queryEpisodic: async () => [],
      querySemantic: async () => [],
      append: (entry: { type: string }) => trace.push(`memory:append:${entry.type}`),
      consolidate: async (id: string) => trace.push(`memory:consolidate:${id}`),
    },
    engines: new Map([
      [
        'nar',
        { reason: async () => [{ term: '<a --> b>', truth: { frequency: 1, confidence: 0.9 } }] },
      ],
    ]),
    policy: { checkCommand: () => ({ allowed: true }) },
    motor: { execute: async () => ({ success: true, content: null }) },
    emit: () => {},
    getLastResponse: () => '',
    setLastResponse: () => {},
    consolidateLearning: overrides.consolidateLearning
      ? async (options: { budget?: number }) => {
          trace.push('learning-consolidation');
          await overrides.consolidateLearning?.(options);
        }
      : undefined,
    consolidation: overrides.consolidation,
  } as unknown as HookHost;
  return host;
};

const stimulus = { correlationId: 'c1', text: 'hello', source: 'chat' as const, timestamp: 1234 };

/** Real bag machinery behind the hook — mirrors the production `nar.consolidateLearning` shape. */
const makeLearningHook = (capacity = 10, forgetRate = 0.2) => {
  const bag = new PriorityBag<BagItem>({ capacity, forgetRate });
  const drained: string[] = [];
  let decayCycles = 0;
  const budgets: (number | undefined)[] = [];
  const processor = new AIKRProcessor<BagItem, string>({
    bag,
    pressureThreshold: 0.7,
    process: (picked) => {
      for (const i of picked) drained.push(i.id);
      return picked.map((i) => i.id);
    },
  });
  return {
    bag,
    drained,
    pressure: () => processor.pressure(),
    decayCycles: () => decayCycles,
    budgets,
    hook: async (options: { budget?: number } = {}) => {
      budgets.push(options.budget);
      bag.decay(0.5); // decay happens per cycle
      decayCycles++;
      await processor.processIfPressured(options);
    },
  };
};

describe('Bench 86 — consolidation hook (recordPhase)', () => {
  it('default-on: hook drains bags under pressure, decays per cycle, budget forwarded', async () => {
    const learning = makeLearningHook();
    for (let i = 0; i < 8; i++) learning.bag.add({ id: `t${i}`, priority: 0.9 });
    expect(learning.pressure()).toBeGreaterThanOrEqual(0.7);

    const host = makeHost({ consolidateLearning: learning.hook, consolidation: { budget: 3 } });
    await runCycle(host, stimulus);

    expect(host.trace).toContain('learning-consolidation');
    expect(learning.drained).toHaveLength(3); // budget-bounded drain
    expect(learning.bag.size()).toBe(5);
    expect(learning.decayCycles()).toBe(1); // decay per cycle
    expect(learning.budgets).toEqual([3]);
  });

  it('inert below pressure: hook invoked but the bag is untouched', async () => {
    const learning = makeLearningHook();
    learning.bag.add({ id: 'only', priority: 0.9 });
    expect(learning.pressure()).toBeLessThan(0.7);

    const host = makeHost({ consolidateLearning: learning.hook });
    await runCycle(host, stimulus);
    expect(host.trace).toContain('learning-consolidation');
    expect(learning.drained).toHaveLength(0);
    expect(learning.bag.size()).toBe(1);
  });

  it('disabled: consolidation config opts out — trace identical to the hook-less pipeline', async () => {
    const learning = makeLearningHook();
    for (let i = 0; i < 8; i++) learning.bag.add({ id: `t${i}`, priority: 0.9 });
    const disabled = makeHost({
      consolidateLearning: learning.hook,
      consolidation: { enabled: false },
    });
    const hookless = makeHost();
    await runCycle(disabled, stimulus);
    await runCycle(hookless, stimulus);
    expect(learning.decayCycles()).toBe(0);
    expect(learning.bag.size()).toBe(8);
    expect(disabled.trace).toEqual(hookless.trace);
    expect(disabled.trace).not.toContain('learning-consolidation');
  });

  it('hook failure never blocks the cycle', async () => {
    const host = makeHost({
      consolidateLearning: async () => {
        throw new Error('consolidation exploded');
      },
    });
    await expect(runCycle(host, stimulus)).resolves.toBeDefined();
    expect(host.trace).toContain('learning-consolidation');
  });
});

describe('Bench 86 — causal traversal (causedBy/leadingTo)', () => {
  const bruteForce = async (
    mem: EpisodicMemory,
    filter: { causedBy?: string; leadingTo?: string; type?: 'reaction' | 'dialogue' }
  ) => {
    const all = await mem.getEpisodes({ limit: 1000 });
    return all
      .filter(
        (e) =>
          (!filter.causedBy || (e.causes ?? []).includes(filter.causedBy)) &&
          (!filter.leadingTo || (e.consequences ?? []).includes(filter.leadingTo)) &&
          (!filter.type || e.type === filter.type)
      )
      .sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));
  };
  const contentsOf = (eps: Awaited<ReturnType<EpisodicMemory['getEpisodes']>>) =>
    eps.map((e) => e.content).sort();

  it('indexed causal queries match brute-force scan; foreign ids excluded', async () => {
    const base = await tmpBase();
    const mem = new EpisodicMemory({ basePath: base });

    await mem.log('dialogue', 'turn-1', { correlationId: 'c1', sessionId: 's1', id: 't1' });
    await sleep(2);
    await mem.log('dialogue', 'turn-2', { correlationId: 'c1', sessionId: 's1', id: 't2' });
    await sleep(2);
    await mem.log('reaction', 'react-1', {
      correlationId: 'c1',
      sessionId: 's1',
      turnId: 't1',
      kind: 'correct',
      causes: ['t1'],
    });
    await sleep(2);
    await mem.log('reaction', 'react-2', {
      correlationId: 'c1',
      sessionId: 's1',
      turnId: 't2',
      kind: 'accept',
      causes: ['t2'],
      consequences: ['t1'],
    });
    await sleep(2);
    // Foreign session: its causes must be reachable, but only via its own edge.
    await mem.log('reaction', 'foreign', {
      correlationId: 'c2',
      sessionId: 's2',
      turnId: 'f1',
      kind: 'reject',
      causes: ['t1'],
    });

    const idsOf = (eps: Awaited<ReturnType<EpisodicMemory['getEpisodes']>>) =>
      eps.map((e) => e.id ?? '').sort();

    expect(contentsOf(await mem.getEpisodes({ causedBy: 't1' }))).toEqual(
      contentsOf(await bruteForce(mem, { causedBy: 't1' }))
    );
    expect(contentsOf(await bruteForce(mem, { causedBy: 't1' }))).toEqual(['foreign', 'react-1']);

    expect(contentsOf(await mem.getEpisodes({ leadingTo: 't1' }))).toEqual(
      contentsOf(await bruteForce(mem, { leadingTo: 't1' }))
    );
    expect(contentsOf(await mem.getEpisodes({ leadingTo: 't1' }))).toEqual(['react-2']);

    // Foreign-id exclusion: no corpus episode cites these ids.
    await expect(mem.getEpisodes({ causedBy: 'no-such-id' })).resolves.toEqual([]);
    await expect(mem.getEpisodes({ leadingTo: 'no-such-id' })).resolves.toEqual([]);

    // Session scoping composes over the causal path: the foreign reaction is out.
    expect(contentsOf(await mem.getEpisodes({ causedBy: 't1', sessionId: 's1' }))).toEqual([
      'react-1',
    ]);

    // Type post-filter composes over the indexed path.
    const typed = await mem.getEpisodes({ causedBy: 't1', type: 'dialogue' });
    expect(typed).toEqual([]);
    expect(idsOf(await mem.getEpisodes({ causedBy: 't1', type: 'reaction' }))).toEqual(
      idsOf(await bruteForce(mem, { causedBy: 't1', type: 'reaction' }))
    );
  });

  it('incremental: episodes logged after the index build appear in causal queries', async () => {
    const base = await tmpBase();
    const mem = new EpisodicMemory({ basePath: base });
    await mem.log('dialogue', 'seed', { correlationId: 'c1', sessionId: 's1', id: 't0' });
    await mem.getEpisodes({ causedBy: 't0' }); // force the index build
    await mem.log('reaction', 'late', {
      correlationId: 'c1',
      sessionId: 's1',
      turnId: 't0',
      kind: 'accept',
      causes: ['t0'],
    });
    const found = await mem.getEpisodes({ causedBy: 't0' });
    expect(found).toHaveLength(1);
    expect(found[0]!.content).toBe('late');
  });

  it('clear() invalidates the causal index', async () => {
    const base = await tmpBase();
    const mem = new EpisodicMemory({ basePath: base });
    await mem.log('dialogue', 'seed', { correlationId: 'c1', sessionId: 's1', id: 't0' });
    await mem.log('reaction', 'r', { correlationId: 'c1', sessionId: 's1', causes: ['t0'] });
    await mem.getEpisodes({ causedBy: 't0' }); // build
    await mem.clear();
    await expect(mem.getEpisodes({ causedBy: 't0' })).resolves.toEqual([]);
  });
});

describe('Bench 86 — retrospective causal-chain summary', () => {
  it('renders causes edges upstream-first, in chronological order', async () => {
    const base = await tmpBase();
    const mem = new EpisodicMemory({ basePath: base });
    await mem.log('dialogue', JSON.stringify({ turnId: 'c1:1', sessionId: 's1', seq: 1 }), {
      correlationId: 'c1',
      sessionId: 's1',
      turnId: 'c1:1',
      id: 'c1:1',
    });
    await sleep(2);
    await mem.log('dialogue', JSON.stringify({ turnId: 'c1:2', sessionId: 's1', seq: 2 }), {
      correlationId: 'c1',
      sessionId: 's1',
      turnId: 'c1:2',
      id: 'c1:2',
    });
    await sleep(2);
    await mem.log('reaction', JSON.stringify({ turnId: 'c1:1', kind: 'correct' }), {
      correlationId: 'c1',
      sessionId: 's1',
      turnId: 'c1:1',
      kind: 'correct',
      causes: ['c1:1'],
    });
    await sleep(2);
    await mem.log('reaction', JSON.stringify({ turnId: 'c1:2', kind: 'accept' }), {
      correlationId: 'c1',
      sessionId: 's1',
      turnId: 'c1:2',
      kind: 'accept',
      causes: ['c1:2'],
    });

    const r = await retrospect('s1', mem, { minTurns: 1, minReactions: 1 });
    expect(r.causalChains).toHaveLength(2);
    expect(r.causalChains?.map((e) => e.from)).toEqual(['c1:1', 'c1:2']);
    expect(r.causalChains?.map((e) => e.kind)).toEqual(['correct', 'accept']);
    // Every edge terminates at a real reaction episode id (downstream end exists).
    const episodeIds = new Set((await mem.getEpisodes({ type: 'reaction' })).map((e) => e.id));
    for (const edge of r.causalChains ?? []) expect(episodeIds.has(edge.to)).toBe(true);
  });

  it('legacy reactions without causes edges yield no causal chains', async () => {
    const base = await tmpBase();
    const mem = new EpisodicMemory({ basePath: base });
    await mem.log('dialogue', JSON.stringify({ turnId: 'c1:1', sessionId: 's1', seq: 1 }), {
      correlationId: 'c1',
      sessionId: 's1',
      turnId: 'c1:1',
      id: 'c1:1',
    });
    await mem.log('reaction', JSON.stringify({ turnId: 'c1:1', kind: 'accept' }), {
      correlationId: 'c1',
      sessionId: 's1',
      turnId: 'c1:1',
      kind: 'accept',
    });
    const r = await retrospect('s1', mem, { minTurns: 1, minReactions: 1 });
    expect(r.causalChains).toBeUndefined();
  });
});

describe('Bench 86 — hook position in the macro pipeline', () => {
  it('hook runs inside recordPhase: after memory consolidation, before announce', async () => {
    const order: string[] = [];
    const host = makeHost({
      consolidateLearning: async (options: { budget?: number }) => {
        order.push('hook');
      },
    });
    (host.memory as { consolidate: (id: string) => Promise<void> }).consolidate = async () => {
      order.push('memory-consolidate');
    };
    (host as unknown as { emit: (e: CognitiveEvent) => void }).emit = (e) => {
      if (e.type === 'derivation.made') order.push('announce');
    };
    await runCycle(host, stimulus);
    expect(order.indexOf('memory-consolidate')).toBeLessThan(order.indexOf('hook'));
    expect(order.indexOf('hook')).toBeLessThan(order.indexOf('announce'));
  });
});
