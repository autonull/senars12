/**
 * Judgment Calibration — calibration and demotion for the judgment cascade.
 *
 * Implements temperature scaling, isotonic regression, and demotion policies
 * for poorly calibrated judges.
 */
import type { JudgmentCalibration } from './cascade';
import type { Clock } from '../../kernel/env';
import type { TelemetryCollector } from './telemetry';
/** Calibration method. */
export type CalibrationMethod = 'temperature' | 'isotonic' | 'platt' | 'beta' | 'none';
/** Calibration configuration. */
export interface CalibrationConfig {
    /** Method to use. */
    method: CalibrationMethod;
    /** Minimum samples before calibrating. */
    minSamples: number;
    /** Recalibration interval (ms). */
    recalibrateIntervalMs: number;
    /** Temperature bounds. */
    temperatureBounds: [number, number];
    /** Enable demotion. */
    enableDemotion: boolean;
    /** Demotion threshold (ECE). */
    demotionThreshold: number;
    /** Demotion factor. */
    demotionFactor: number;
}
/** Default calibration configuration. */
export declare const defaultCalibrationConfig: CalibrationConfig;
/** Calibration data point. */
export interface CalibrationPoint {
    /** Predicted confidence. */
    predicted: number;
    /** Actual outcome (1 = correct, 0 = incorrect). */
    actual: number;
    /** Timestamp. */
    timestamp: number;
    /** Context metadata. */
    metadata?: Record<string, unknown>;
}
/** Calibration result. */
export interface CalibrationResult {
    /** Calibrated confidence. */
    calibrated: number;
    /** Method used. */
    method: CalibrationMethod;
    /** Calibration parameters. */
    params: Record<string, number>;
    /** Expected Calibration Error. */
    ece: number;
    /** Maximum Calibration Error. */
    mce: number;
}
/** Temperature scaler. */
export declare class TemperatureScaler {
    private bounds;
    private temperature;
    private data;
    private lastRecalibrated;
    constructor(bounds?: [number, number]);
    /** Add calibration data. */
    addData(point: CalibrationPoint): void;
    /** Recalibrate temperature. */
    recalibrate(): {
        temperature: number;
        ece: number;
    };
    /** Compute ECE for a given temperature. */
    private computeECEForTemp;
    /** Apply temperature scaling. */
    applyTemperature(confidence: number, temp?: number): number;
    /** Calibrate a confidence value. */
    calibrate(confidence: number): CalibrationResult;
    /** Compute ECE with current temperature. */
    computeECE(): number;
    /** Compute MCE (Maximum Calibration Error). */
    computeMCE(): number;
    /** Get current temperature. */
    getTemperature(): number;
    /** Get data count. */
    getDataCount(): number;
}
/** Beta calibration (more flexible than temperature). */
export declare class BetaCalibrator {
    private a;
    private b;
    private data;
    /** Add calibration data. */
    addData(point: CalibrationPoint): void;
    /** Recalibrate using method of moments. */
    recalibrate(): {
        a: number;
        b: number;
        ece: number;
    };
    /** Apply beta calibration. */
    applyBeta(confidence: number): number;
    /** Calibrate a confidence value. */
    calibrate(confidence: number): CalibrationResult;
    /** Compute ECE. */
    computeECE(): number;
    /** Compute MCE. */
    computeMCE(): number;
}
/** Calibration manager — manages multiple calibrators and demotion. */
export declare class CalibrationManager {
    private config;
    private temperatureScaler;
    private betaCalibrator;
    private isotonicCalibrator;
    private lastRecalibrated;
    private demoted;
    private demotionFactor;
    private readonly clock;
    private readonly telemetry?;
    constructor(config?: Partial<CalibrationConfig>, options?: {
        clock?: Clock;
        telemetry?: TelemetryCollector;
    });
    /** Record a judgment outcome. */
    recordOutcome(predicted: number, actual: number, metadata?: Record<string, unknown>): Promise<void>;
    /** Recalibrate all calibrators. */
    recalibrate(): Promise<{
        temperature: number;
        beta: {
            a: number;
            b: number;
        };
        isotonic: number;
    }>;
    /** Calibrate a confidence value. */
    calibrate(confidence: number): JudgmentCalibration;
    /** Check if demoted. */
    isDemoted(): boolean;
    /** Get demotion factor. */
    getDemotionFactor(): number;
    /** Reset demotion (e.g., after model update). */
    resetDemotion(): void;
    /** Get calibration statistics. */
    getStats(): {
        method: CalibrationMethod;
        demoted: boolean;
        demotionFactor: number;
        temperature: number;
        betaParams: {
            a: number;
            b: number;
        };
        dataPoints: number;
        ece: number;
        mce: number;
    };
}
/** Create a calibration manager. */
export declare function createCalibrationManager(config?: Partial<CalibrationConfig>, options?: {
    clock?: Clock;
    telemetry?: TelemetryCollector;
}): CalibrationManager;
/** Global calibration manager (non-deterministic; prefer {@link createCalibrationManager}). */
export declare const calibrationManager: CalibrationManager;
//# sourceMappingURL=calibration.d.ts.map