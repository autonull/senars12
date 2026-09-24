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
import { digestRows, loadEvalSet, splitOod } from '../nar/src/lm/system-one/eval-set.js';
import { fitCalibrationLock, writeCalibrationLock } from '../nar/src/lm/system-one/calibration-fit.js';

const { values } = parseArgs({
  options: {
    dataset: { type: 'string' },
    out: { type: 'string' },
    modelDigest: { type: 'string' },
    head: { type: 'string', multiple: true },
    minRows: { type: 'string', default: '8' },
    evalSet: { type: 'string' },
  },
});

if (!values.dataset || !values.out) {
  console.error('Required: --dataset <jsonl> --out <lock.json> [--model-digest sha256:...] [--eval-set eval-set.json]');
  process.exit(1);
}

const dataset = await JudgmentDataset.load(values.dataset);
// TODO23 Phase 7: when a frozen eval set is supplied, its metrics are embedded
// in the lock (`eval` block; OOD-marked rows form the `ood` slice) —
// deployment can then verify fit-vs-frozen drift and OOD calibration.
const frozen = values.evalSet ? await loadEvalSet(values.evalSet) : undefined;
let frozenSetOption: { digest: string; rows: typeof inDomain } | undefined;
let oodSetOption: { digest: string; rows: typeof inDomain } | undefined;
if (frozen) {
  const { inDomain, ood } = splitOod(frozen.rows);
  frozenSetOption = { digest: inDomain.length > 0 ? digestRows(inDomain) : frozen.digest, rows: inDomain };
  if (ood.length > 0) oodSetOption = { digest: digestRows(ood), rows: ood };
}
const { lock, perHead, improved } = fitCalibrationLock(dataset, {
  headIds: values.head,
  minRows: Number(values.minRows),
  ...(frozenSetOption ? { frozenSet: frozenSetOption } : {}),
  ...(oodSetOption ? { oodSet: oodSetOption } : {}),
});
if (values.modelDigest) lock.modelDigest = values.modelDigest as never;

await writeCalibrationLock(lock, values.out);
console.log(`Fitted ${perHead.size} head(s) from ${dataset.size} labels; holdout ECE improved: ${improved}`);
for (const entry of lock.heads) {
  console.log(`  ${entry.headId}: ece=${entry.ece.toFixed(4)} abstainThreshold=${entry.abstainThreshold}`);
}
if (lock.eval) console.log(`  eval: brier=${lock.eval.brier.toFixed(4)} ece=${lock.eval.ece.toFixed(4)} n=${lock.eval.count}`);
console.log(`Lock written to ${values.out}`);
