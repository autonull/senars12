/**
 * D2: fit isotonic calibrators + per-head abstain thresholds from a labeled
 * JudgmentDataset (jevcal pattern) and emit a digest-pinned calibration-lock.json.
 *
 * Usage:
 *   pnpm exec tsx scripts/system-one-fit-thresholds.ts \
 *     --dataset .cache/systemone/dataset.jsonl \
 *     --out .cache/systemone/calibration-lock.json \
 *     [--model-digest sha256:...] [--head risk --head reflex_value]
 */
import { parseArgs } from 'node:util';
import { JudgmentDataset } from '../nar/src/lm/system-one/distill.js';
import { fitCalibrationLock, writeCalibrationLock } from '../nar/src/lm/system-one/calibration-fit.js';

const { values } = parseArgs({
  options: {
    dataset: { type: 'string' },
    out: { type: 'string' },
    modelDigest: { type: 'string' },
    head: { type: 'string', multiple: true },
    minRows: { type: 'string', default: '8' },
  },
});

if (!values.dataset || !values.out) {
  console.error('Required: --dataset <jsonl> --out <lock.json> [--model-digest sha256:...]');
  process.exit(1);
}

const dataset = await JudgmentDataset.load(values.dataset);
const { lock, perHead, improved } = fitCalibrationLock(dataset, {
  headIds: values.head,
  minRows: Number(values.minRows),
});
if (values.modelDigest) lock.modelDigest = values.modelDigest as never;

await writeCalibrationLock(lock, values.out);
console.log(`Fitted ${perHead.size} head(s) from ${dataset.size} labels; holdout ECE improved: ${improved}`);
for (const entry of lock.heads) {
  console.log(`  ${entry.headId}: ece=${entry.ece.toFixed(4)} abstainThreshold=${entry.abstainThreshold}`);
}
console.log(`Lock written to ${values.out}`);
