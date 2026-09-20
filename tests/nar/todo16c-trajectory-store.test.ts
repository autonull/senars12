import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type DistillationLabel, JudgmentDataset } from '../../nar/src/lm/system-one/distill.js';
import { type CycleTrajectory, TrajectoryStore } from '../../nar/src/rlfp/trajectory-store.js';

const cycle = (correlationId: string, grounded?: number, meanRisk = 0.2): CycleTrajectory => ({
  correlationId,
  timestamp: Date.now(),
  steps: [{ timestamp: Date.now(), type: 'narrative', data: `narration ${correlationId}` }],
  grades:
    grounded === undefined
      ? undefined
      : {
          groundedness: { score: grounded, abstained: false },
          risks: [{ command: 't', score: meanRisk, abstained: false }],
        },
});

describe('E4 follow-up (a): TrajectoryStore pairs graded cycles into implicit preferences', () => {
  it('pairs the two most recent cycles; higher groundedness wins, tie on both grades ⇒ SKIP', () => {
    const store = new TrajectoryStore();
    expect(store.pairForPreference()).toBeNull();
    store.recordCycle(cycle('c1', 0.4));
    expect(store.pairForPreference()).toBeNull();
    store.recordCycle(cycle('c2', 0.9));
    let pair = store.pairForPreference()!;
    expect(pair.preference).toBe('B');
    expect(pair.trajectoryB.correlationId).toBe('c2');

    store.recordCycle(cycle('c3', 0.9));
    pair = store.pairForPreference()!;
    expect(pair.preference).toBe('SKIP');
    expect(pair.trajectoryA.correlationId).toBe('c2');
  });

  it('lower mean risk breaks a groundedness tie; unfitted grades abstain to SKIP', () => {
    const store = new TrajectoryStore();
    store.recordCycle(cycle('c1', 0.8, 0.9));
    store.recordCycle(cycle('c2', 0.8, 0.1));
    expect(store.pairForPreference()!.preference).toBe('B');

    store.recordCycle({ correlationId: 'c3', timestamp: Date.now(), steps: [] });
    expect(store.pairForPreference()!.preference).toBe('SKIP');
  });

  it('persists append-only JSONL and reloads cycles', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'traj-store-'));
    try {
      const path = join(dir, 'trajectories.jsonl');
      const store = new TrajectoryStore(path);
      await store.recordCycle(cycle('c1', 0.5));
      await store.recordCycle(cycle('c2', 0.7));
      expect(readFileSync(path, 'utf-8').trim().split('\n')).toHaveLength(2);

      const reloaded = new TrajectoryStore(path);
      await reloaded.load();
      expect(reloaded.getCycles()).toHaveLength(2);
      expect(reloaded.pairForPreference()!.preference).toBe('B');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reloading tolerates malformed lines', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'traj-store-'));
    try {
      const path = join(dir, 'trajectories.jsonl');
      writeFileSync(path, `${JSON.stringify(cycle('c1', 0.5))}\ngarbage\n\n`, 'utf-8');
      const store = new TrajectoryStore(path);
      await store.load();
      expect(store.getCycles()).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('D3 follow-up: dataset compaction dedupes rows and prunes orphaned vectors', () => {
  it('keeps last row per evidenceId and prunes sidecar files without a live row', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dataset-compact-'));
    try {
      const datasetPath = join(dir, 'dataset.jsonl');
      const sidecarPath = join(dir, 'vectors');
      const row = (evidenceId: string, score: number, vecRef?: string): DistillationLabel => ({
        evidenceId,
        rubric: 'risk',
        axis: 'teleological',
        label: 'medium',
        score,
        source: 'test',
        ...(vecRef ? { vecRef } : {}),
      });
      writeFileSync(
        datasetPath,
        [row('a', 0.1, 'a'), row('a', 0.2), row('b', 0.3, 'b'), 'malformed', row('b', 0.4)]
          .map((r) => (typeof r === 'string' ? r : JSON.stringify(r)))
          .join('\n') + '\n',
        'utf-8'
      );
      const { mkdirSync } = await import('node:fs');
      mkdirSync(sidecarPath, { recursive: true });
      writeFileSync(join(sidecarPath, 'a.f32'), Buffer.from(new Float32Array([1, 2]).buffer));
      writeFileSync(join(sidecarPath, 'b.f32'), Buffer.from(new Float32Array([3]).buffer));
      writeFileSync(join(sidecarPath, 'orphan.f32'), Buffer.from(new Float32Array([4]).buffer));

      const result = await JudgmentDataset.compact(datasetPath, sidecarPath);
      expect(result.kept).toBe(2);
      expect(result.dropped).toBe(3); // duplicate 'a', duplicate 'b', malformed
      expect(result.vectorsDropped).toBe(1);
      expect(result.vectorsKept).toBe(2);

      const lines = readFileSync(datasetPath, 'utf-8').trim().split('\n');
      const scores = lines.map((l) => JSON.parse(l) as { evidenceId: string; score: number });
      expect(scores.map((s) => `${s.evidenceId}:${s.score}`)).toEqual(['a:0.2', 'b:0.4']);
      expect(readFileSync(join(sidecarPath, 'a.f32'))).toBeDefined();
      expect(readFileSync(join(sidecarPath, 'b.f32'))).toBeDefined();
      expect(() => readFileSync(join(sidecarPath, 'orphan.f32'))).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
