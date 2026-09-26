import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixedClock, SystemClock } from '@senars/nar/clock.js';
import { Memory } from '@senars/nar/memory';
import { EpisodicMemory } from '@senars/nar/memory/EpisodicMemory.js';
import { MemoryQuery } from '@senars/nar/query/memory-query.js';
import { TermBuilder } from '@senars/nar/terms';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';

const NAR_DIR = join(import.meta.dirname, '../../nar/src');
const loc = (p: string) => readFileSync(p, 'utf-8').split('\n').length;

const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

describe('Bench 91 — test hygiene & monolith paydown (REFACTOR.todo3 Phase A)', () => {
  it('M2 budget holds: nar.ts under 900 LOC with facade extraction live', () => {
    expect(loc(join(NAR_DIR, 'nar.ts'))).toBeLessThan(900);
    const nar = readFileSync(join(NAR_DIR, 'nar.ts'), 'utf-8');
    expect(nar).toContain("from './nar/facade.js'");
    expect(readFileSync(join(NAR_DIR, 'nar/facade.ts'), 'utf-8')).toContain('initializeLMRules');
  });

  it('Clock injection: MemoryQuery ranking deterministic under pinned time (100 runs)', async () => {
    const mem = new Memory({ maxConcepts: 100, activationDecayRate: 0.01 });
    mem.addConcept(TermBuilder.atom('cat')).priority = 0.9;
    mem.addConcept(TermBuilder.atom('catalog')).priority = 0.7;
    const ep = new EpisodicMemory({
      basePath: await mkdtemp(join(tmpdir(), 'bench91-')).then((d) => (dirs.push(d), d)),
      clock: fixedClock(1_700_000_000_000),
    });
    await ep.log('dialogue', 'cat saga', { id: 'ep-1' });
    await ep.log('input', 'dog walk', { id: 'ep-2' });
    const q = new MemoryQuery({ memory: mem, episodic: ep, clock: fixedClock(1_700_000_000_000) });

    const first = await q.search({ concept: 'cat', limit: 10 });
    for (let i = 0; i < 100; i++) {
      const again = await q.search({ concept: 'cat', limit: 10 });
      expect(again.map((r) => r.score)).toEqual(first.map((r) => r.score));
      expect(again.map((r) => r.episode?.id ?? r.concept?.term.toString())).toEqual(
        first.map((r) => r.episode?.id ?? r.concept?.term.toString())
      );
    }
  });

  it('SystemClock is the zero-cost production default', () => {
    const before = Date.now();
    const t = SystemClock.now();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(fixedClock(42).now()).toBe(42);
  });

  it('deps:gate baseline documents the rule-builders→rule-templates cycle (68)', () => {
    const gate = readFileSync(join(import.meta.dirname, '../../scripts/deps-gate.ts'), 'utf-8');
    expect(gate).toContain('const BASELINE = 246');
  });
});
