import type { CalibrationVersion, RubricId } from './types';
export interface CalibrationPoint {
    predicted: number;
    observed: number;
    weight: number;
}
export interface IsotonicCalibrator {
    readonly version: CalibrationVersion;
    readonly rubric: RubricId | 'classify';
    readonly fitted: boolean;
    calibrate(score: number): number;
    update(points: CalibrationPoint[]): void;
    getECE(): number;
    getPoints(): ReadonlyArray<CalibrationPoint>;
    reset(): void;
}
export interface RollingECEConfig {
    /** Window width in minutes; a sample older than this is out. */
    windowSize: number;
    /**
     * Hard cap on retained samples. The width alone bounds the window in time but
     * not in count: a run recording every batch could put thousands of samples
     * inside one window, and the reading would then be dominated by whichever
     * samples fitted. The cap is the AIKR answer — bound both axes.
     */
    maxSamples: number;
    minSamples: number;
    driftThreshold: number;
}
export interface DriftDemotionConfig {
    eceThreshold: number;
    consecutiveCycles: number;
    cooldownCycles: number;
}
export interface BackendHealth {
    backendId: string;
    calibrators: Map<string, IsotonicCalibrator>;
    rollingECE: number;
    consecutiveDriftCycles: number;
    isDemoted: boolean;
    lastDemotionCycle: number;
}
export declare function createIsotonicCalibrator(version: CalibrationVersion, rubric: RubricId | 'classify', initialPoints?: CalibrationPoint[]): IsotonicCalibrator;
/**
 * The sample-weighted ECE over a bounded trailing window — drift detection's
 * input. The window is the shared {@link BoundedMap}: one container bounds every
 * cache and ledger hot path in the repository, and a private array plus a
 * hand-rolled prune pass is what it replaces. Expiry is lazy, so a read costs
 * one pass and allocates nothing.
 */
export declare class RollingECEMonitor {
    #private;
    constructor(config?: Partial<RollingECEConfig>);
    record(ece: number, sampleCount: number): void;
    getRollingECE(): number;
    getSampleCount(): number;
    isDriftDetected(): boolean;
    reset(): void;
}
export declare class DriftDemotionManager {
    #private;
    constructor(config?: Partial<DriftDemotionConfig>);
    registerBackend(backendId: string, calibrators: Map<string, IsotonicCalibrator>): void;
    updateCycle(backendId: string, cycleNumber: number): {
        demoted: boolean;
        rollingECE: number;
    } | null;
    getHealth(backendId: string): BackendHealth | undefined;
    getAllHealth(): ReadonlyMap<string, BackendHealth>;
    forceDemote(backendId: string, cycleNumber: number): boolean;
    canRecover(backendId: string, cycleNumber: number): boolean;
    attemptRecovery(backendId: string, cycleNumber: number): boolean;
}
export declare function createCalibrationSuite(version: CalibrationVersion, rubrics: (RubricId | 'classify')[]): Map<string, IsotonicCalibrator>;
export declare function createDefaultCalibrationSuite(version: CalibrationVersion): Map<string, IsotonicCalibrator>;
//# sourceMappingURL=calibration.d.ts.map