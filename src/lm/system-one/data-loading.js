/**
 * Training data loading for System One heads.
 * Joins JSONL labels with vector sidecar and deduplicates.
 */
import { promises as fs } from 'node:fs';
import { accumulate, getOrInsert } from '@senars/util/collections';
import { decodeVector } from './distill';
/**
 * Load training rows from a JSONL dataset, joining with embedded vectors.
 */
export async function loadTrainingData(options) {
    const { rows: rawRows } = await readJsonlAsync(options.datasetPath, (value) => value);
    const grouped = new Map();
    for (const label of rawRows) {
        if (label.rubric !== options.headId)
            continue;
        const target = label.observed ?? label.score;
        if (target === undefined || !Number.isFinite(target) || !label.vector)
            continue;
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
        accumulate(grouped, key, () => ({ sum: 0, count: 0, action: label.label, vector: label.vector }), (running) => {
            running.sum += target;
            running.count += 1;
        });
    }
    const trainingRows = [];
    for (const { sum, count, action, vector } of grouped.values()) {
        trainingRows.push({ embedding: decodeVector(vector), action, target: sum / count });
    }
    return trainingRows;
}
/** Read JSONL file with a row parser. */
async function readJsonlAsync(path, parse) {
    const content = await fs.readFile(path, 'utf-8');
    const rows = [];
    for (const line of content.split('\n')) {
        if (line.trim() === '')
            continue;
        try {
            rows.push(parse(JSON.parse(line)));
        }
        catch {
            // Skip malformed lines
        }
    }
    return { rows };
}
