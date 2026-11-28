import { type IsotonicCalibrator } from './calibration';
import type { JudgmentDataset } from './distill';
import type { CalibrationVersion, ModelDigest } from './types';
export { identityECE, meanBrier, meanBrierOf } from './metrics';
export interface CalibrationLockEntry {
    headId: string;
    digest: string;
    abstainThreshold: number;
    ece: number;
    fitted: boolean;
    points: {
        predicted: number;
        observed: number;
        weight: number;
    }[];
}
export interface CalibrationLock {
    version: string;
    generatedAt: number;
    /** Digest of the manifold/head bundle this lock was fitted against. */
    modelDigest?: string;
    heads: CalibrationLockEntry[];
    /** TODO23 Phase 7: metrics over the frozen eval set the fit was scored against. */
    eval?: LockMetrics;
    /** Optional out-of-domain slice metrics (deployment gate for OOD routing). */
    ood?: LockMetrics;
}
export interface LockMetrics {
    brier: number;
    ece: number;
    /** Digest of the frozen eval set (or OOD slice) the metrics were computed over. */
    datasetDigest: string;
    count: number;
}
interface LabeledDatum {
    headId: string;
    predicted: number;
    observed: number;
}
/**
 * Extract (predicted, observed) pairs from dataset labels. Rows carry the
 * head's predicted `score` and a ground-truth `observed` (recorded at label
 * time) — the B6 self-supervised no-op never enters this path.
 */
export declare function extractLabeledData(dataset: JudgmentDataset, headIds?: readonly string[]): LabeledDatum[];
/** Dataset rows that only carry a categorical label get their observed value derived. */
export declare function extractLabeledDataWithDerivedOutcomes(dataset: JudgmentDataset, headIds?: readonly string[]): LabeledDatum[];
export interface FitCalibrationOptions {
    headIds?: readonly string[];
    holdoutFraction?: number;
    seed?: number;
    calibrationVersion?: CalibrationVersion;
    /** Refit points per head; heads with fewer usable rows stay unfitted. */
    minRows?: number;
    /** TODO23 Phase 7: frozen eval set — its metrics land in `lock.eval`. */
    frozenSet?: {
        digest: string;
        rows: readonly {
            predicted: number;
            observed: number;
        }[];
    };
    /** Out-of-domain slice of the frozen set — its metrics land in `lock.ood`. */
    oodSet?: {
        digest: string;
        rows: readonly {
            predicted: number;
            observed: number;
        }[];
    };
}
export interface FitCalibrationResult {
    lock: CalibrationLock;
    perHead: Map<string, IsotonicCalibrator>;
    /** True when every requested head produced an ECE improvement over identity on holdout. */
    improved: boolean;
}
export declare function fitCalibrationLock(dataset: JudgmentDataset, options?: FitCalibrationOptions): FitCalibrationResult;
export declare function writeCalibrationLock(lock: CalibrationLock, path: string): Promise<void>;
export declare function readCalibrationLock(path: string): Promise<CalibrationLock>;
/** The one on-disk location of the digest-pinned calibration lock. */
export declare const CALIBRATION_LOCK_PATH: string;
/** Best-effort lock read: `null` when absent or unreadable. */
export declare function readCalibrationLockOrNull(path?: string): Promise<CalibrationLock | null>;
/**
 * Digest-pinned lock load (H3 fail-closed semantics): a lock pinned to a
 * modelDigest that does not match the manifold's bundle is rejected outright.
 */
export declare function assertLockMatches(lock: CalibrationLock, modelDigest: ModelDigest): void;
/** Apply a verified lock to a calibrator suite (fitted points flow in, B6 no-op replaced). */
export declare function applyCalibrationLock(calibrators: Map<string, IsotonicCalibrator>, lock: CalibrationLock): void;
//# sourceMappingURL=calibration-fit.d.ts.map