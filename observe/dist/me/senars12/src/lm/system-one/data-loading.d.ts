/**
 * Training data loading for System One heads.
 * Joins JSONL labels with vector sidecar and deduplicates.
 */
import type { TrainingRow, LoadTrainingDataOptions } from './types';
/**
 * Load training rows from a JSONL dataset, joining with embedded vectors.
 */
export declare function loadTrainingData(options: LoadTrainingDataOptions): Promise<TrainingRow[]>;
//# sourceMappingURL=data-loading.d.ts.map