import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Reconsolidator } from '@senars/nar/dialogue';
import { digestPin, loadRetrospectives, persistRetrospective } from '@senars/nar/dialogue';
import type { Retrospective } from '@senars/nar/dialogue';
import { emptyReactionDistribution } from '@senars/nar/dialogue';

/**
 * TODO25 Bench 78 — Phase B falsifier: retrospective-triggered
 * re-consolidation. Gate: N2 one-shot per digest, persisted across
 * reconsolidator instances (restarts), fail-closed source (TODO24 Phase C
 * digest pin), lessons ingested as seeded self-beliefs (non-LLM path, I2).
 */
const retrospective = (sessionId: string, accepts: number): Retrospective => {
  const d = emptyReactionDistribution();
  d['accept'] = accepts;
  return {
    version: 'retrospective-v1',
    sessionId,
    at: 0,
    turnCount: 10,
    reactionCount: accepts,
    reactionDistribution: d,
    corrections: [],
    contradictions: [],
    strategyAudit: [],
    proposals: [],
    provenance: { turnIds: [`t-${sessionId}`] },
    digest: digestPin([`t-${sessionId}`], d),
  };
};

const seed = { term: 'dialogue_performance', truth: { frequency: 0.9, confidence: 0.6 } };

describe('TODO25 Bench 78 — reconsolidate', () => {
  let dir: string;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('ingests lessons once per digest; a fresh instance (restart) skips them (N2)', async () => {
    dir = await mkdtemp(join(tmpdir(), 'reconsolidate-'));
    await persistRetrospective(retrospective('s1', 3), dir);
    await persistRetrospective(retrospective('s2', 2), dir);
    const ingested: string[] = [];
    const source = { load: (n: number) => loadRetrospectives(n, dir) };
    const sink = { input: async (term: string) => {
      ingested.push(term);
    } };
    const first = new Reconsolidator(source, sink, seed, join(dir, 'ledger.jsonl'));
    expect(await first.reconsolidate()).toEqual({ ingested: 2, skipped: 0 });
    expect(ingested).toEqual(['dialogue_performance', 'dialogue_performance']);
    // Restart: fresh instance with the same persisted ledger — nothing re-ingests.
    const second = new Reconsolidator(source, sink, seed, join(dir, 'ledger.jsonl'));
    expect(await second.reconsolidate()).toEqual({ ingested: 0, skipped: 2 });
    expect(ingested.length).toBe(2);
  });

  it('retrospectives below the lesson bar (≥2 accepts) consolidate to nothing but still pin their digest', async () => {
    dir = await mkdtemp(join(tmpdir(), 'reconsolidate-'));
    await persistRetrospective(retrospective('s3', 1), dir);
    const sink = { input: async () => {
      throw new Error('must not be called');
    } };
    const r = new Reconsolidator({ load: (n: number) => loadRetrospectives(n, dir) }, sink, seed, join(dir, 'ledger.jsonl'));
    expect(await r.reconsolidate()).toEqual({ ingested: 0, skipped: 0 });
  });

  it('fail-closed: a tampered retrospective digest aborts reconsolidation', async () => {
    dir = await mkdtemp(join(tmpdir(), 'reconsolidate-'));
    const tampered = retrospective('s4', 3);
    tampered.provenance = { turnIds: ['t-tampered'] }; // digest no longer matches content
    await persistRetrospective(tampered, dir);
    const r = new Reconsolidator(
      { load: (n: number) => loadRetrospectives(n, dir) },
      { input: async () => {} },
      seed,
      join(dir, 'ledger.jsonl')
    );
    await expect(r.reconsolidate()).rejects.toThrow();
  });
});
