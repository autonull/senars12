import { describe, it, expect } from 'vitest';
import { JudgmentDataset, runBakeOff } from '../../nar/src/lm/system-one/distill.js';
import { recordClarificationLabel, recordApprovalLabel } from '../../nar/src/lm/system-one/label-sources.js';
import {
  loadTrainingData,
  trainHead,
  writeHeadArtifacts,
  loadHeadArtifacts,
  TrainedLinearHead,
} from '../../nar/src/lm/system-one/train.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { createHeadById } from '../../nar/src/lm/system-one/head-specs.js';
import { loadHeadRuntime, DigestMismatchError } from '../../nar/src/lm/system-one/wasi-runtime.js';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { JudgmentQuery } from '../../nar/src/lm/system-one/types.js';

/** Synthetic labeled fixtures: risk head where observed outcomes follow a learnable pattern. */
function buildLabeledDataset(rows: number, sidecarPath: string): JudgmentDataset {
  const dataset = new JudgmentDataset();
  dataset.setVectorSidecarPath(sidecarPath);
  let s = 999;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < rows; i++) {
    const action = Math.floor(rand() * 4);
    const observed = action % 2 === 0 ? 0.8 + rand() * 0.15 : 0.1 + rand() * 0.15;
    // Encoder-like embedding: action-conditioned base direction + small noise (structured signal).
    const embedding = new Float32Array(384);
    for (let j = 0; j < 384; j++) embedding[j] = (j % 4 === action ? 1 : 0) + rand() * 0.05;
    recordApprovalLabel(dataset, {
      action: `op-${action}:${i}`,
      approved: observed > 0.5,
      predicted: observed,
      embedding,
    });
  }
  return dataset;
}

describe('Training Round-Trip (Bench 24)', () => {
  it('JSONL+sidecar → artifacts (config.json, weights.bin, MODEL_DIGEST) → digest-verified load → beats incumbent Brier', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 's1-train-'));
    const datasetPath = join(tmp, 'dataset.jsonl');
    const sidecarPath = join(tmp, 'vectors');
    const outDir = join(tmp, 'heads', 'risk');

    const dataset = buildLabeledDataset(500, sidecarPath);
    await dataset.flush(datasetPath);
    await dataset.flushVectors();

    const rows = await loadTrainingData({ datasetPath, sidecarPath, headId: 'risk' });
    expect(rows.length).toBeGreaterThan(100);
    const model = trainHead(
      rows.map((r) => ({ ...r, action: r.action.split(':')[0]! })),
      { headId: 'risk', rubric: 'risk', axis: 'teleological' },
      { kind: 'linear' }
    );

    const bundle = await writeHeadArtifacts(model, outDir);
    expect(existsSync(join(outDir, 'config.json'))).toBe(true);
    expect(existsSync(join(outDir, 'weights.bin'))).toBe(true);
    const digestFile = readFileSync(join(outDir, 'MODEL_DIGEST'), 'utf-8').trim();
    expect(digestFile).toBe(bundle.modelDigest);
    expect(digestFile).toMatch(/^sha256:[0-9a-f]{64}$/);

    // Round-trip load verifies weights hash; wrong pin fails closed
    const head = await loadHeadArtifacts(outDir, bundle.modelDigest);
    expect(head.fitted).toBe(true);
    await expect(loadHeadArtifacts(outDir, 'sha256:' + 'c'.repeat(64))).rejects.toThrow(DigestMismatchError);

    // Sandboxed runtime path: digest-pinned load succeeds, mismatched pin throws
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 600_000 });
    const manifold = createManifold(cache);
    expect(() => loadHeadRuntime(manifold, { provider: 'off', modelDigest: bundle.modelDigest }, bundle.modelDigest)).not.toThrow();
    expect(() => loadHeadRuntime(manifold, { provider: 'off', modelDigest: bundle.modelDigest }, 'sha256:' + 'd'.repeat(64))).toThrow(DigestMismatchError);

    // Trained head beats the incumbent hash head on Brier over the labeled fixtures
    const incumbent = createHeadById('risk', { calibrationVersion: 'v2.4.1' as never, embeddingCache: cache, abstainThreshold: 0 });
    const query = { kind: 'evaluate', instruction: '', rubric: 'risk', axis: 'teleological' } as JudgmentQuery;
    const bakeOffCases: { truth: number; incumbent: number; candidate: number }[] = [];
    let trainedBrier = 0, incumbentBrier = 0;
    for (const row of rows.slice(0, 100)) {
      const action = row.action.split(':')[0]!;
      const trained = head.score(row.embedding, action);
      const base = (await incumbent.evaluate(row.embedding, { ...query, instruction: `Assess risk of action ${action}` })).score;
      trainedBrier += (trained - row.target) ** 2;
      incumbentBrier += (base - row.target) ** 2;
      bakeOffCases.push({ truth: row.target, incumbent: base, candidate: trained });
    }
    trainedBrier /= 100;
    incumbentBrier /= 100;
    expect(trainedBrier).toBeLessThan(incumbentBrier);

    const bakeOff = runBakeOff(
      undefined,
      { headId: 'risk', modelDigest: bundle.modelDigest, calibrationVersion: 'v2.4.1', abstainThreshold: 0.3, enabled: true },
      bakeOffCases
    );
    // Trained candidate strictly improves on the untrained incumbent (runBakeOff's
    // parity gate is a regression guard — a large improvement exceeds ±2% parity).
    expect(bakeOff.candidateAccuracy).toBeGreaterThan(bakeOff.incumbentAccuracy);
  }, 120_000);

  it('D5: trained head compiles to a WASI bundle — sandbox-loaded eval matches the trained model, digest mismatch fails closed', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 's1-wasi-'));
    const datasetPath = join(tmp, 'dataset.jsonl');
    const sidecarPath = join(tmp, 'vectors');
    const dataset = buildLabeledDataset(300, sidecarPath);
    await dataset.flush(datasetPath);
    await dataset.flushVectors();
    const rows = await loadTrainingData({ datasetPath, sidecarPath, headId: 'risk' });
    const model = trainHead(
      rows.map((r) => ({ ...r, action: r.action.split(':')[0]! })),
      { headId: 'risk', rubric: 'risk', axis: 'teleological' },
      { kind: 'linear', actionFeatureDim: 0 }
    );

    const { writeHeadBundle, loadHeadBundle } = await import(
      '../../nar/src/lm/system-one/wasi-head-bundle.js'
    );
    const { wasmPath, modelDigest } = await writeHeadBundle(tmp, {
      weights: model.weights,
      bias: model.bias,
      mean: model.mean,
      std: model.std,
    });
    expect(modelDigest).toMatch(/^sha256:[0-9a-f]{64}$/);

    const bundle = await loadHeadBundle({
      wasmPath,
      modelDigest,
      dimension: model.embeddingDim,
      allowedPaths: [tmp],
    });

    let maxDelta = 0;
    for (const row of rows.slice(0, 50)) {
      const wasmScore = await bundle.evaluate(row.embedding);
      // Reference: the same standardize → linear → clamp01 arithmetic in TS
      let z = model.bias;
      for (let i = 0; i < model.embeddingDim; i++) {
        z += model.weights[i]! * ((row.embedding[i]! - model.mean[i]!) / model.std[i]!);
      }
      const reference = Math.min(1, Math.max(0, z));
      maxDelta = Math.max(maxDelta, Math.abs(wasmScore - reference));
    }
    expect(maxDelta).toBeLessThan(1e-5);

    await expect(
      loadHeadBundle({ wasmPath, modelDigest: 'sha256:' + 'e'.repeat(64), dimension: model.embeddingDim })
    ).rejects.toThrow(DigestMismatchError);
  }, 120_000);

  it('D3 label sources (approval, clarification) record embeddings and observed outcomes', async () => {
    const dataset = new JudgmentDataset();
    recordApprovalLabel(dataset, { action: 'delete', approved: false, predicted: 0.2 });
    recordClarificationLabel(dataset, { question: 'q', answer: 'a' });
    expect(dataset.size).toBe(2);
    const [approval, clarification] = dataset.all();
    expect(approval!.observed).toBe(0);
    expect(approval!.score).toBe(0.2);
    expect(clarification!.source).toBe('human-clarification');

    // Auto-flush writes appended labels to disk (D3)
    const tmp = mkdtempSync(join(tmpdir(), 's1-autoflush-'));
    const path = join(tmp, 'auto.jsonl');
    const stop = dataset.startAutoFlush(path, 20);
    await new Promise((r) => setTimeout(r, 80));
    stop();
    const loaded = await JudgmentDataset.load(path);
    expect(loaded.size).toBeGreaterThanOrEqual(2); // append-only flush may tick multiple times
    expect(loaded.all().some((l) => l.source === 'human-clarification')).toBe(true);
  });
});
