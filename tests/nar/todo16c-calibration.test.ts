import { describe, it, expect } from 'vitest';
import { JudgmentDataset } from '../../nar/src/lm/system-one/distill.js';
import {
  fitCalibrationLock,
  writeCalibrationLock,
  readCalibrationLock,
  assertLockMatches,
  extractLabeledDataWithDerivedOutcomes,
} from '../../nar/src/lm/system-one/calibration-fit.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { validateHeadCandidate } from '../../nar/src/lm/system-one/distill.js';
import type { ModelDigest } from '../../nar/src/lm/system-one/types.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Synthetic miscalibrated head: predicted systematically inflated by 0.25 over a noisy truth. */
function miscalibratedDataset(rows: number): JudgmentDataset {
  const dataset = new JudgmentDataset(join(tmpdir(), `test-calib-${rows}`));
  let s = 12345;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < rows; i++) {
    const truth = rand();
    const predicted = Math.min(1, Math.max(0, truth + 0.25 + (rand() - 0.5) * 0.1));
    dataset.record({
      evidenceId: `e${i}`,
      rubric: 'risk',
      axis: 'teleological',
      label: 'synthetic',
      score: predicted,
      observed: truth,
      source: 'synthetic',
    });
  }
  return dataset;
}

describe('Calibration from Labels (Bench 22)', () => {
  it('fitted isotonic ECE beats the unfitted identity baseline on held-out cases', () => {
    const dataset = miscalibratedDataset(400);
    const data = extractLabeledDataWithDerivedOutcomes(dataset, ['risk']);
    expect(data.length).toBe(400);

    const { lock, perHead, improved } = fitCalibrationLock(dataset, { headIds: ['risk'], minRows: 8 });
    expect(improved).toBe(true);
    const entry = lock.heads.find((e) => e.headId === 'risk')!;
    expect(entry.fitted).toBe(true);
    expect(entry.ece).toBeGreaterThan(0);

    const calibrator = perHead.get('risk')!;
    expect(calibrator.fitted).toBe(true);
    // The fitted curve corrects the +0.25 inflation: high predictions map down.
    expect(calibrator.calibrate(0.9)).toBeLessThan(0.9);
  });

  it('per-head abstain thresholds fitted → calibration-lock.json digest-pinned round-trip', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 's1-calib-'));
    const lockPath = join(tmp, 'calibration-lock.json');
    const dataset = miscalibratedDataset(300);

    const { lock } = fitCalibrationLock(dataset, { headIds: ['risk'] });
    expect(lock.heads[0]!.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(lock.heads[0]!.abstainThreshold).toBeGreaterThanOrEqual(0);
    expect(lock.heads[0]!.abstainThreshold).toBeLessThanOrEqual(0.5);

    await writeCalibrationLock(lock, lockPath);
    const loaded = await readCalibrationLock(lockPath);
    expect(loaded.heads[0]!.digest).toBe(lock.heads[0]!.digest);

    // validateHeadCandidate accepts the lock-pinned head (hash-pinned digest)
    const verdict = validateHeadCandidate({
      headId: 'risk',
      modelDigest: lock.heads[0]!.digest,
      calibrationVersion: lock.version,
      abstainThreshold: 0.3,
      enabled: true,
    });
    expect(verdict.accepted).toBe(true);
  });

  it('manifold loads the lock at construction; digest mismatch fails closed', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 600_000 });
    const dataset = miscalibratedDataset(200);
    const { lock } = fitCalibrationLock(dataset, { headIds: ['risk'] });

    const modelDigest = 'sha256:' + 'a'.repeat(64) as ModelDigest;
    const pinned = { ...lock, modelDigest };
    const manifold = createManifold(cache, { modelDigest, calibrationLock: pinned });
    expect(manifold.getCalibrationLock()).toBeDefined();
    expect(manifold.getAbstainThresholds().get('risk')).toBeDefined();

    // Calibrators now report real fitted ECE (B6 no-op replaced by label-sourced fit)
    const calibrator = manifold.getCalibrators().get('risk')!;
    expect(calibrator.fitted).toBe(true);
    expect(calibrator.getECE()).toBeGreaterThan(0);

    expect(() => createManifold(cache, { modelDigest, calibrationLock: { ...lock, modelDigest: 'sha256:' + 'b'.repeat(64) } }))
      .toThrow(/Digest mismatch/);
    assertLockMatches(pinned, modelDigest as ModelDigest); // matching digest passes
  });
});
