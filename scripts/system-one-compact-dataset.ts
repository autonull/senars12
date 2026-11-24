#!/usr/bin/env node
/**
 * D3 follow-up: compact the append-only System One distillation dataset —
 * dedupe rows by evidenceId and prune orphaned vector sidecar files.
 * Run: pnpm exec tsx scripts/system-one-compact-dataset.ts [datasetPath] [sidecarPath]
 */
import { JudgmentDataset } from '@senars/lm/system-one/distill.js';
import { loadConfig } from '@senars/config';

const appConfig = await loadConfig().catch(() => null);
const distillation = appConfig?.systemOne?.distillation;
const datasetPath =
  process.argv[2] ?? distillation?.datasetPath ?? './data/systemone-distillation.jsonl';

const result = await JudgmentDataset.compact(datasetPath);
console.log(`Compacted ${datasetPath}:`);
console.log(`  rows kept: ${result.kept}  duplicates/malformed dropped: ${result.dropped}`);
