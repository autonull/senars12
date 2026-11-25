/**
 * Head artifact serialization for System One.
 * On-disk format: config.json + weights.bin + MODEL_DIGEST
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ensureDir, writeJsonFile } from '@senars/util/fs';
import { sha256Prefixed } from '@senars/util/hash';
import { composeModelDigest, encoderDigest, DigestMismatchError } from './wasi-runtime';
import type { HeadGeometry, TrainedHeadModel, HeadArtifactBundle, HeadArtifactConfig } from './types';
import { nonEmpty, nonNegativeInt, positiveInt } from '@senars/util/config';
import { cognitiveAxisSchema, rubricIdSchema } from '../../decision/types';

/** Parameters as bytes: the vector, then the bias as a trailing f32. */
function weightsBytes(weights: Float32Array, bias: number): Buffer {
  const biasBuf = Buffer.alloc(4);
  biasBuf.writeFloatLE(bias);
  return Buffer.concat([
    Buffer.from(weights.buffer, weights.byteOffset, weights.byteLength),
    biasBuf,
  ]);
}

const digestWeights = (weights: Float32Array, bias: number): string =>
  sha256Prefixed(weightsBytes(weights, bias));

/** Extract the geometry (identity + shape) from a trained model. */
function geometryOf(model: TrainedHeadModel): HeadGeometry {
  return {
    headId: model.headId,
    rubric: model.rubric,
    axis: model.axis,
    kind: model.kind,
    embeddingDim: model.embeddingDim,
    actionFeatureDim: model.actionFeatureDim,
    gameFeatureDim: model.gameFeatureDim,
    encoder: model.encoder,
    metrics: model.metrics,
  };
}

/**
 * The on-disk half of the head contract, validated at the edge it crosses.
 *
 * `config.json` was read with `JSON.parse(raw) as HeadArtifactConfig`, so a
 * truncated write, a hand-edited field or a bundle from an older geometry produced
 * a head that scored `NaN` on every candidate and never said so. This is the same
 * treatment the rest of the kernel gives an untrusted payload, and it is also what
 * lets the loader drop the two `as RubricId` / `as CognitiveAxis` casts: the schema
 * is typed on the *same* vocabulary the geometry is, so a config naming a rubric
 * that no head has cannot parse.
 */
/** `satisfies z.ZodType<HeadArtifactConfig>` makes the schema and the interface one
 *  declaration: a field added to either without the other is a compile error, not a
 *  config that parses one way and types the other. */
export const HeadArtifactConfigSchema = z.strictObject({
  headId: nonEmpty,
  rubric: rubricIdSchema,
  axis: cognitiveAxisSchema,
  kind: z.enum(['linear', 'logistic']),
  embeddingDim: positiveInt,
  actionFeatureDim: nonNegativeInt,
  gameFeatureDim: nonNegativeInt,
  encoder: z.object({ modelId: nonEmpty, dimension: positiveInt }),
  metrics: z.object({
    samples: nonNegativeInt,
    epochs: nonNegativeInt,
    trainLoss: z.number(),
    holdoutLoss: z.number(),
    valueCorrelation: z.number().optional(),
  }),
  mean: z.array(z.number()),
  std: z.array(z.number()),
  encoderDigest: nonEmpty,
  weightsDigest: nonEmpty,
  modelDigest: nonEmpty,
}) satisfies z.ZodType<HeadArtifactConfig>;

import { parseOrThrow } from '@senars/util/config';

/** Serialize a trained model to the on-disk artifact bundle. */
export function exportArtifacts(model: TrainedHeadModel): HeadArtifactBundle {
  const encoderId = encoderDigest(model.encoder.modelId, model.encoder.dimension);
  const modelDigest = composeModelDigest(encoderId, model.weightsDigest);
  const config: HeadArtifactConfig = {
    ...geometryOf(model),
    mean: [...model.mean],
    std: [...model.std],
    encoderDigest: encoderId,
    weightsDigest: model.weightsDigest,
    modelDigest,
  };
  return { config, weightsBytes: weightsBytes(model.weights, model.bias), modelDigest };
}

/** Write a trained model's artifacts to disk. */
export async function writeHeadArtifacts(
  model: TrainedHeadModel,
  outDir: string
): Promise<HeadArtifactBundle> {
  const bundle = exportArtifacts(model);
  await ensureDir(outDir);
  await Promise.all([
    writeJsonFile(join(outDir, 'config.json'), bundle.config),
    fs.writeFile(join(outDir, 'weights.bin'), bundle.weightsBytes),
    fs.writeFile(join(outDir, 'MODEL_DIGEST'), bundle.modelDigest),
  ]);
  return bundle;
}

/** Load a trained head bundle, verifying the config, the weights hash and the pinned digest. */
export async function loadHeadArtifacts(
  outDir: string,
  pinnedDigest?: string
): Promise<import('./trained-head').TrainedLinearHead> {
  const { TrainedLinearHead } = await import('./trained-head');
  const [configRaw, weightsBytes, digestFile] = await Promise.all([
    fs.readFile(join(outDir, 'config.json'), 'utf-8'),
    fs.readFile(join(outDir, 'weights.bin')),
    fs.readFile(join(outDir, 'MODEL_DIGEST'), 'utf-8'),
  ]);
  const config = parseOrThrow(
    HeadArtifactConfigSchema,
    'HeadArtifactConfig',
    JSON.parse(configRaw)
  );
  const modelDigest = digestFile.trim();
  const actual = sha256Prefixed(weightsBytes);
  if (actual !== config.weightsDigest) {
    throw new DigestMismatchError(config.weightsDigest, actual);
  }
  if (pinnedDigest && pinnedDigest !== modelDigest) {
    throw new DigestMismatchError(pinnedDigest, modelDigest);
  }
  return new TrainedLinearHead(config, weightsBytes, modelDigest);
}