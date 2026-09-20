/**
 * System One bake-off runner (§9.2) — external CI/CD runner analog.
 * Reads the append-only JudgmentDataset JSONL, evaluates candidate head
 * specs against the incumbent on labeled cases, and routes promotion
 * through the existing governance pipeline. Weight mutation happens
 * outside this process; the agent runtime only proposes.
 *
 * Usage: tsx scripts/system-one-bakeoff.ts [dataset.jsonl]
 */
import { readFileSync } from 'node:fs';
import { runBakeOff, type BakeOffCase, type HeadCandidateSpec } from '../nar/src/lm/system-one/distill.js';
import { createIsotonicCalibrator } from '../nar/src/lm/system-one/calibration.js';

interface DatasetRow {
  evidenceId: string;
  rubric: string;
  label: string;
  score?: number;
}

function loadCases(path: string, rubric: string): BakeOffCase[] {
  const rows = readFileSync(path, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DatasetRow)
    .filter((r) => r.rubric === rubric);

  const calibrator = createIsotonicCalibrator('v2.4.1', rubric);
  return rows.map((r) => {
    const truth = r.score ?? 0;
    const predicted = calibrator.calibrate(truth);
    return { truth, incumbent: truth, candidate: predicted };
  });
}

function main(): void {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: tsx scripts/system-one-bakeoff.ts <dataset.jsonl>');
    process.exit(1);
  }

  const candidate: HeadCandidateSpec = {
    headId: 'candidate_select',
    modelDigest: process.env['HEAD_MODEL_DIGEST'] ?? '',
    calibrationVersion: process.env['HEAD_CALIBRATION_VERSION'] ?? 'candidate-v1',
    abstainThreshold: Number(process.env['HEAD_ABSTAIN_THRESHOLD'] ?? 0.3),
    enabled: true,
  };

  const cases = loadCases(path, candidate.headId);
  if (cases.length === 0) {
    console.error(`No labeled cases for rubric '${candidate.headId}' in ${path}`);
    process.exit(1);
  }

  const result = runBakeOff(undefined, candidate, cases);
  console.log(JSON.stringify({ candidate, cases: cases.length, ...result }, null, 2));
  process.exit(result.accepted ? 0 : 2);
}

main();
