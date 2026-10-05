import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SchemaValidationError } from '@senars/util';
import { describe, expect, it } from 'vitest';
import {
  actionFeatures,
  exportArtifacts,
  HeadArtifactConfigSchema,
  loadHeadArtifacts,
  TrainedLinearHead,
  trainHead,
  writeHeadArtifacts,
} from '../../../nar/src/lm/system-one/train.js';

/**
 * A trained head is the one artifact in the system that is read from disk as JSON
 * and then trusted as numbers. `config.json` used to be `JSON.parse(raw) as
 * HeadArtifactConfig`, so a truncated write, a hand-edited field or a bundle from a
 * different geometry produced a head that answered `NaN` to every candidate and
 * reported nothing — and the loader needed two `as` casts to read a rubric and an
 * axis back out of it, which is the compiler saying it could not check them either.
 */

const DIM = 8;

const rows = (count = 16) =>
  Array.from({ length: count }, (_, i) => ({
    embedding: Float32Array.from({ length: DIM }, (_, j) => Math.sin(i * 3 + j)),
    action: ['up', 'down', 'left', 'right'][i % 4]!,
    target: i % 2 === 0 ? 0.9 : 0.1,
    game: 'arena',
  }));

const trained = () =>
  trainHead(
    rows(),
    { headId: 'reflex_value', rubric: 'reflex_value', axis: 'teleological' },
    {
      epochs: 5,
      actionFeatureDim: DIM,
      seed: 3,
    }
  );

describe('head artifacts', () => {
  it('round-trips a trained head through disk and back to the same scores', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'head-artifact-'));
    const bundle = await writeHeadArtifacts(trained(), outDir);
    const loaded = await loadHeadArtifacts(outDir, bundle.modelDigest);
    const inMemory = TrainedLinearHead.fromBundle(bundle);
    const sample = rows()[0]!;

    for (const action of ['up', 'down', 'left', 'right']) {
      expect(loaded.score(sample.embedding, action)).toBe(inMemory.score(sample.embedding, action));
    }
    expect(loaded.rubric).toBe('reflex_value');
    expect(loaded.axis).toBe('teleological');
  });

  it('scores exactly what the uncached feature formula produces', async () => {
    // The action block is memoized now; a cache that returned a *different* block
    // for the same action would still be self-consistent, so compare against the
    // formula rather than against a second call.
    const bundle = exportArtifacts(trained());
    const head = TrainedLinearHead.fromBundle(bundle);
    const embedding = rows()[2]!.embedding;

    const weights = new Float32Array(
      bundle.weightsBytes.buffer.slice(
        bundle.weightsBytes.byteOffset,
        bundle.weightsBytes.byteOffset + bundle.weightsBytes.byteLength - 4
      )
    );
    const bias = bundle.weightsBytes.readFloatLE(bundle.weightsBytes.byteLength - 4);
    const block = actionFeatures('left', bundle.config.embeddingDim);
    let z = bias;
    for (let i = 0; i < bundle.config.embeddingDim; i++) {
      z +=
        (weights[i]! * (embedding[i]! * block[i]! - bundle.config.mean[i]!)) /
        bundle.config.std[i]!;
    }
    const expected =
      bundle.config.kind === 'logistic' ? 1 / (1 + Math.exp(-z)) : Math.min(1, Math.max(0, z));

    expect(head.score(embedding, 'left')).toBe(expected);
  });

  it('rejects a config naming a rubric or an axis the vocabulary does not have', () => {
    const config = exportArtifacts(trained()).config;
    expect(HeadArtifactConfigSchema.safeParse(config).success).toBe(true);
    expect(HeadArtifactConfigSchema.safeParse({ ...config, rubric: 'not_a_rubric' }).success).toBe(
      false
    );
    expect(HeadArtifactConfigSchema.safeParse({ ...config, axis: 'x' }).success).toBe(false);
    expect(HeadArtifactConfigSchema.safeParse({ ...config, kind: 'quantum' }).success).toBe(false);
  });

  it('fails closed on a config.json it cannot parse as the head contract', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'head-artifact-'));
    const bundle = await writeHeadArtifacts(trained(), outDir);
    const configPath = join(outDir, 'config.json');
    const pristine = readFileSync(configPath, 'utf-8');

    const corrupt = async (mutate: (config: Record<string, unknown>) => unknown) => {
      writeFileSync(configPath, JSON.stringify(mutate(JSON.parse(pristine)), null, 2));
      await expect(loadHeadArtifacts(outDir, bundle.modelDigest)).rejects.toThrow(
        SchemaValidationError
      );
    };

    await corrupt((c) => ({ ...c, rubric: 'not_a_rubric' }));
    await corrupt((c) => ({ ...c, axis: 'x' }));
    await corrupt((c) => ({ ...c, embeddingDim: 'eight' }));
    await corrupt((c) => ({ ...c, kind: 'quantum' }));
    await corrupt((c) => ({ ...c, staleField: true }));

    writeFileSync(configPath, '{ "headId": "truncated"');
    await expect(loadHeadArtifacts(outDir, bundle.modelDigest)).rejects.toThrow();
  });

  it('still refuses a bundle whose weights do not match their digest', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'head-artifact-'));
    await writeHeadArtifacts(trained(), outDir);
    // Validation passing is not authentication: the weights hash is a separate claim.
    await expect(loadHeadArtifacts(outDir, `sha256:${'c'.repeat(64)}`)).rejects.toThrow(/digest/i);
  });
});
