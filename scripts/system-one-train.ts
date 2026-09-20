/**
 * D1: System One head trainer (RLCD-shaped — loss is Brier/MSE on decisions,
 * not text likelihood). Consumes a JudgmentDataset JSONL joined with the Z1
 * vector sidecar and emits digest-pinned head artifacts.
 *
 * Usage:
 *   pnpm exec tsx scripts/system-one-train.ts \
 *     --dataset .cache/systemone/dataset.jsonl \
 *     --sidecar .cache/systemone/vectors \
 *     --out .cache/systemone/heads/reflex_value \
 *     --head reflex_value [--kind linear|logistic]
 */
import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { loadTrainingData, trainHead, writeHeadArtifacts } from '../nar/src/lm/system-one/train.js';

const { values } = parseArgs({
  options: {
    dataset: { type: 'string' },
    sidecar: { type: 'string' },
    out: { type: 'string' },
    head: { type: 'string' },
    kind: { type: 'string', default: 'linear' },
    epochs: { type: 'string', default: '300' },
    /** D5: also emit a WASI head bundle (head.wasm + digest) alongside the artifacts. */
    wasi: { type: 'boolean', default: false },
  },
});

if (!values.dataset || !values.sidecar || !values.out || !values.head) {
  console.error('Required: --dataset <jsonl> --sidecar <dir> --out <dir> --head <headId>');
  process.exit(1);
}

const rows = await loadTrainingData({
  datasetPath: values.dataset,
  sidecarPath: values.sidecar,
  headId: values.head,
});
if (rows.length === 0) {
  console.error(`No trainable rows for head '${values.head}' — check the vector sidecar join.`);
  process.exit(1);
}

const model = trainHead(rows, { headId: values.head, rubric: values.head, axis: 'teleological' }, {
  kind: values.kind === 'logistic' ? 'logistic' : 'linear',
  epochs: Number(values.epochs),
});

const bundle = await writeHeadArtifacts(model, values.out);
console.log(`Trained '${values.head}' on ${model.metrics.samples} rows over ${model.metrics.epochs} epochs`);
console.log(`  holdout Brier: ${model.metrics.holdoutLoss.toFixed(4)}  correlation: ${(model.metrics.valueCorrelation ?? 0).toFixed(4)}`);
console.log(`  MODEL_DIGEST: ${bundle.modelDigest}`);
console.log(`Artifacts written to ${values.out} (config.json, weights.bin, MODEL_DIGEST)`);

if (values.wasi) {
  if (model.kind !== 'linear') {
    console.error('WASI bundles support linear heads only (no exp in core wasm ops).');
    process.exit(1);
  }
  const { writeHeadBundle } = await import('../nar/src/lm/system-one/wasi-head-bundle.js');
  const wasiBundle = await writeHeadBundle(join(values.out, 'wasi'), {
    weights: model.weights,
    bias: model.bias,
    mean: model.mean,
    std: model.std,
  });
  console.log(`WASI bundle: ${wasiBundle.wasmPath}  digest ${wasiBundle.modelDigest}`);
}
