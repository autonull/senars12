/**
 * Training data loading for System One heads.
 * Joins JSONL labels with vector sidecar and deduplicates.
 */

import { promises as fs } from 'node:fs';
import { accumulate, getOrInsert } from '@senars/util/collections';
import { decodeVector } from './distill';
import type { TrainingRow, LoadTrainingDataOptions } from './types';

interface RawLabel {
  evidenceId: string;
  rubric: string;
  label: string;
  score?: number;
  observed?: number;
  vector?: string;
}

/**
 * Load training rows from a JSONL dataset, joining with embedded vectors.
 */
export async function loadTrainingData(
  options: LoadTrainingDataOptions
): Promise<TrainingRow[]> {
  const { rows: rawRows } = await readJsonlAsync<RawLabel>(
    options.datasetPath,
    (value) => value as RawLabel
  );

  const grouped = new Map<string, { sum: number; count: number; action: string; vector: string }>();
  for (const label of rawRows) {
    if (label.rubric !== options.headId) continue;
    const target = label.observed ?? label.score;
    if (target === undefined || !Number.isFinite(target) || !label.vector) continue;
    const key = `${label.evidenceId}`;
    if (options.averageDuplicates === false) {
      getOrInsert(grouped, key, () => ({
        sum: target,
        count: 1,
        action: label.label,
        vector: label.vector,
      }));
      continue;
    }
    accumulate(
      grouped,
      key,
      () => ({ sum: 0, count: 0, action: label.label, vector: label.vector }),
      (running) => {
        running.sum += target;
        running.count += 1;
      }
    );
  }

  const trainingRows: TrainingRow[] = [];
  for (const { sum, count, action, vector } of grouped.values()) {
    trainingRows.push({ embedding: decodeVector(vector), action, target: sum / count });
  }
  return trainingRows;
}

/** Read JSONL file with a row parser. */
async function readJsonlAsync<T>(
  path: string,
  parse: (value: unknown) => T
): Promise<{ rows: T[] }> {
  const content = await fs.readFile(path, 'utf-8');
  const rows: T[] = [];
  for (const line of content.split('\n')) {
    if (line.trim() === '') continue;
    try {
      rows.push(parse(JSON.parse(line)));
    } catch {
      // Skip malformed lines
    }
  }
  return { rows };
}