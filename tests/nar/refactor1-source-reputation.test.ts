import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KernelPerceptionGate } from '@senars/nar/kernel/KernelPerceptionGate.js';
import { SourceReputation } from '@senars/nar/kernel/source-reputation.js';
import { seedTruth } from '@senars/nar/lm/system-one/seed.js';
import { afterAll, describe, expect, it } from 'vitest';

const dirs: string[] = [];
const tmpBase = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'refactor1-reputation-'));
  dirs.push(dir);
  return dir;
};
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

const proposition = {
  kind: 'classify' as const,
  top: { option: 'belief', p: 0.95 },
  calibration: { version: 'v1.0.0', ece: 0.0 },
} as never;

describe('Bench 85 — source reputation', () => {
  it('neutral by default; clamps at the floor with contradictions', () => {
    const rep = new SourceReputation({ floor: 0.3 });
    expect(rep.multiplier('peer-a')).toBe(1);
    rep.record('peer-a', 'contradicted');
    expect(rep.multiplier('peer-a')).toBe(1); // below the decay gate (2)
    rep.record('peer-a', 'contradicted');
    expect(rep.multiplier('peer-a')).toBeLessThan(1);
    expect(rep.multiplier('peer-a')).toBeGreaterThanOrEqual(0.3);
    rep.record('peer-a', 'confirmed');
    expect(rep.multiplier('peer-a')).toBeGreaterThan(0.3);
  });

  it('perception-gate admission confidence respects the reputation ceiling (default-neutral)', async () => {
    const gate = new KernelPerceptionGate();
    const base = await gate.admit({
      sourceId: 'peer-b',
      rawObservation: 'x',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    const rep = new SourceReputation({ floor: 0.2 });
    rep.record('peer-b', 'contradicted');
    rep.record('peer-b', 'contradicted');
    gate.setReputation(rep);
    const degraded = await gate.admit({
      sourceId: 'peer-b',
      rawObservation: 'x',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    expect(degraded.task!.truth!.confidence).toBeLessThan(base.task!.truth!.confidence);
    // A different, unreputed source stays neutral.
    const neutral = await gate.admit({
      sourceId: 'peer-c',
      rawObservation: 'x',
      sensorConfidence: 1,
      sourceQuality: 'PRIMARY',
    });
    expect(neutral.task!.truth!.confidence).toBe(base.task!.truth!.confidence);
  });

  it('firewall: reputation never mutates Truth values, only the ceiling', () => {
    const rep = new SourceReputation({ floor: 0.1 });
    rep.record('src', 'contradicted');
    rep.record('src', 'contradicted');
    const base = seedTruth(proposition, 'PRIMARY');
    const degraded = seedTruth(proposition, 'PRIMARY', rep, 'src');
    expect(degraded.c).toBeLessThan(base.c);
    expect(degraded.f).toBe(base.f); // frequency untouched (C2)
  });

  it('persists an append-only JSONL ledger and reloads it', async () => {
    const dir = await tmpBase();
    const path = join(dir, 'source-reputation.jsonl');
    const rep = new SourceReputation({ path });
    rep.record('peer-d', 'contradicted');
    rep.record('peer-d', 'contradicted');
    rep.record('peer-d', 'confirmed');
    const content = await readFile(path, 'utf-8');
    expect(content.trim().split('\n')).toHaveLength(3);
    const reloaded = new SourceReputation({ path });
    expect(reloaded.table().get('peer-d')).toMatchObject({
      confirmed: 1,
      contradicted: 2,
    });
  });
});
