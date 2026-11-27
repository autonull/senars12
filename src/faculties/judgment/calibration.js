/**
 * Judgment Calibration — calibration and demotion for the judgment cascade.
 *
 * Implements temperature scaling, isotonic regression, and demotion policies
 * for poorly calibrated judges.
 */
import { IsotonicCalibrator } from './judge';
import { clamp } from '../../util/numeric';
/** Default calibration configuration. */
export const defaultCalibrationConfig = {
    method: 'temperature',
    minSamples: 50,
    recalibrateIntervalMs: 60000, // 1 minute
    temperatureBounds: [0.1, 10.0],
    enableDemotion: true,
    demotionThreshold: 0.1, // ECE > 0.1 triggers demotion
    demotionFactor: 0.5,
};
/** Shared binning logic for calibration error computation. */
const BINS = 10;
/** Compute bin statistics for a set of calibration points using a calibration function. */
function computeBinStats(data, calibrateFn) {
    const bins = Array.from({ length: BINS }, () => ({ correct: 0, total: 0 }));
    for (const point of data) {
        const calibrated = calibrateFn(point.predicted);
        const binIndex = Math.min(Math.floor(calibrated * BINS), BINS - 1);
        const bin = bins[binIndex];
        bin.total++;
        bin.correct += point.actual;
    }
    return bins;
}
/** Compute ECE from bin statistics. */
function computeECEFromBins(bins, dataLength) {
    if (dataLength === 0)
        return 0;
    let ece = 0;
    let total = 0;
    for (let b = 0; b < BINS; b++) {
        const bin = bins[b];
        const { correct, total: binTotal } = bin;
        if (binTotal > 0) {
            const accuracy = correct / binTotal;
            const confidence = (b + 0.5) / BINS;
            ece += (binTotal / dataLength) * Math.abs(accuracy - confidence);
            total += binTotal;
        }
    }
    return total > 0 ? ece : 1.0;
}
/** Compute MCE from bin statistics. */
function computeMCEFromBins(bins) {
    let mce = 0;
    for (let b = 0; b < BINS; b++) {
        const bin = bins[b];
        const { correct, total: binTotal } = bin;
        if (binTotal > 0) {
            const accuracy = correct / binTotal;
            const confidence = (b + 0.5) / BINS;
            mce = Math.max(mce, Math.abs(accuracy - confidence));
        }
    }
    return mce;
}
/** Temperature scaler. */
export class TemperatureScaler {
    bounds;
    temperature = 1.0;
    data = [];
    lastRecalibrated = 0;
    constructor(bounds = [0.1, 10.0]) {
        this.bounds = bounds;
    }
    /** Add calibration data. */
    addData(point) {
        this.data.push(point);
        // Keep only recent data
        if (this.data.length > 10000) {
            this.data = this.data.slice(-5000);
        }
    }
    /** Recalibrate temperature. */
    recalibrate() {
        if (this.data.length < 10) {
            return { temperature: this.temperature, ece: this.computeECE() };
        }
        // Binary search for optimal temperature
        let low = this.bounds[0];
        let high = this.bounds[1];
        let bestTemp = this.temperature;
        let bestECE = this.computeECEForTemp(this.temperature);
        for (let i = 0; i < 20; i++) {
            const mid = (low + high) / 2;
            const eceMid = this.computeECEForTemp(mid);
            const eceLow = this.computeECEForTemp(low);
            const eceHigh = this.computeECEForTemp(high);
            if (eceMid < bestECE) {
                bestECE = eceMid;
                bestTemp = mid;
            }
            if (eceLow < eceHigh) {
                high = mid;
            }
            else {
                low = mid;
            }
        }
        this.temperature = bestTemp;
        this.lastRecalibrated = Date.now();
        return { temperature: this.temperature, ece: bestECE };
    }
    /** Compute ECE for a given temperature. */
    computeECEForTemp(temp) {
        const bins = computeBinStats(this.data, p => this.applyTemperature(p, temp));
        return computeECEFromBins(bins, this.data.length);
    }
    /** Apply temperature scaling. */
    applyTemperature(confidence, temp) {
        const t = temp ?? this.temperature;
        if (t === 1.0)
            return confidence;
        // Temperature scaling: softmax(logits / T) -> for binary, sigmoid(logit / T)
        // logit = log(p / (1-p))
        const eps = 1e-7;
        const p = Math.max(eps, Math.min(1 - eps, confidence));
        const logit = Math.log(p / (1 - p));
        const scaledLogit = logit / t;
        return 1 / (1 + Math.exp(-scaledLogit));
    }
    /** Calibrate a confidence value. */
    calibrate(confidence) {
        const calibrated = this.applyTemperature(confidence);
        const bins = computeBinStats(this.data, p => this.applyTemperature(p));
        const ece = computeECEFromBins(bins, this.data.length);
        const mce = computeMCEFromBins(bins);
        return {
            calibrated,
            method: 'temperature',
            params: { temperature: this.temperature },
            ece,
            mce,
        };
    }
    /** Compute ECE with current temperature. */
    computeECE() {
        const bins = computeBinStats(this.data, p => this.applyTemperature(p));
        return computeECEFromBins(bins, this.data.length);
    }
    /** Compute MCE (Maximum Calibration Error). */
    computeMCE() {
        const bins = computeBinStats(this.data, p => this.applyTemperature(p));
        return computeMCEFromBins(bins);
    }
    /** Get current temperature. */
    getTemperature() {
        return this.temperature;
    }
    /** Get data count. */
    getDataCount() {
        return this.data.length;
    }
}
/** Beta calibration (more flexible than temperature). */
export class BetaCalibrator {
    a = 1.0;
    b = 1.0;
    data = [];
    /** Add calibration data. */
    addData(point) {
        this.data.push(point);
        if (this.data.length > 10000) {
            this.data = this.data.slice(-5000);
        }
    }
    /** Recalibrate using method of moments. */
    recalibrate() {
        if (this.data.length < 10) {
            return { a: this.a, b: this.b, ece: this.computeECE() };
        }
        // Method of moments for Beta distribution
        const calibrated = this.data.map(d => this.applyBeta(d.predicted));
        const mean = calibrated.reduce((sum, v) => sum + v, 0) / calibrated.length;
        const variance = calibrated.reduce((sum, v) => sum + (v - mean) ** 2, 0) / calibrated.length;
        if (variance > 0 && mean > 0 && mean < 1) {
            const phi = mean * (1 - mean) / variance - 1;
            this.a = mean * phi;
            this.b = (1 - mean) * phi;
            // Clamp to reasonable bounds
            this.a = clamp(this.a, 0.1, 100);
            this.b = clamp(this.b, 0.1, 100);
        }
        return { a: this.a, b: this.b, ece: this.computeECE() };
    }
    /** Apply beta calibration. */
    applyBeta(confidence) {
        // Beta calibration: map p to Beta CDF
        // Simplified: use regularized incomplete beta function approximation
        const p = Math.max(1e-7, Math.min(1 - 1e-7, confidence));
        // This is a simplified version - full implementation would use special functions
        return p ** this.a / (p ** this.a + (1 - p) ** this.b);
    }
    /** Calibrate a confidence value. */
    calibrate(confidence) {
        const calibrated = this.applyBeta(confidence);
        const bins = computeBinStats(this.data, p => this.applyBeta(p));
        const ece = computeECEFromBins(bins, this.data.length);
        const mce = computeMCEFromBins(bins);
        return {
            calibrated,
            method: 'beta',
            params: { a: this.a, b: this.b },
            ece,
            mce,
        };
    }
    /** Compute ECE. */
    computeECE() {
        const bins = computeBinStats(this.data, p => this.applyBeta(p));
        return computeECEFromBins(bins, this.data.length);
    }
    /** Compute MCE. */
    computeMCE() {
        const bins = computeBinStats(this.data, p => this.applyBeta(p));
        return computeMCEFromBins(bins);
    }
}
/** Calibration manager — manages multiple calibrators and demotion. */
export class CalibrationManager {
    config;
    temperatureScaler = new TemperatureScaler();
    betaCalibrator = new BetaCalibrator();
    isotonicCalibrator = new IsotonicCalibrator();
    lastRecalibrated = 0;
    demoted = false;
    demotionFactor = 1.0;
    clock;
    telemetry;
    constructor(config = {}, options = {}) {
        this.config = { ...defaultCalibrationConfig, ...config };
        this.clock = options.clock ?? { now: () => Date.now(), setTime: () => { }, advance: () => { } };
        this.telemetry = options.telemetry;
    }
    /** Record a judgment outcome. */
    async recordOutcome(predicted, actual, metadata) {
        const point = {
            predicted,
            actual,
            timestamp: this.clock.now(),
            metadata,
        };
        this.temperatureScaler.addData(point);
        this.betaCalibrator.addData(point);
        this.isotonicCalibrator.record(predicted, actual === 1);
        // Check for recalibration
        const now = this.clock.now();
        if (now - this.lastRecalibrated > this.config.recalibrateIntervalMs) {
            const recalResult = await this.recalibrate();
            // Emit calibration update telemetry
            if (this.telemetry) {
                await this.telemetry.calibrationUpdate(this.config.method, { temperature: recalResult.temperature, betaA: recalResult.beta.a, betaB: recalResult.beta.b }, this.temperatureScaler.computeECE(), this.temperatureScaler.computeMCE(), this.temperatureScaler.getDataCount());
            }
        }
        // Check for demotion
        if (this.config.enableDemotion && !this.demoted) {
            const ece = this.temperatureScaler.computeECE();
            if (ece > this.config.demotionThreshold) {
                this.demoted = true;
                this.demotionFactor = this.config.demotionFactor;
                // Emit demotion telemetry instead of console.warn
                if (this.telemetry) {
                    await this.telemetry.demotion(ece, this.config.demotionThreshold, this.config.demotionFactor);
                }
            }
        }
    }
    /** Recalibrate all calibrators. */
    async recalibrate() {
        const tempResult = this.temperatureScaler.recalibrate();
        const betaResult = this.betaCalibrator.recalibrate();
        this.isotonicCalibrator.recompute();
        this.lastRecalibrated = this.clock.now();
        const result = {
            temperature: tempResult.temperature,
            beta: { a: betaResult.a, b: betaResult.b },
            isotonic: 0, // No single param
        };
        // Emit calibration update telemetry
        if (this.telemetry) {
            await this.telemetry.calibrationUpdate(this.config.method, { temperature: result.temperature, betaA: result.beta.a, betaB: result.beta.b }, this.temperatureScaler.computeECE(), this.temperatureScaler.computeMCE(), this.temperatureScaler.getDataCount());
        }
        return result;
    }
    /** Calibrate a confidence value. */
    calibrate(confidence) {
        let result;
        switch (this.config.method) {
            case 'temperature':
                result = this.temperatureScaler.calibrate(confidence);
                break;
            case 'beta':
                result = this.betaCalibrator.calibrate(confidence);
                break;
            case 'isotonic':
                result = {
                    calibrated: this.isotonicCalibrator.calibrate(confidence),
                    method: 'isotonic',
                    params: {},
                    ece: 0,
                    mce: 0,
                };
                break;
            case 'none':
            default:
                return {
                    applied: false,
                    factor: this.demoted ? this.demotionFactor : 1.0,
                    preConfidence: confidence,
                    postConfidence: confidence * (this.demoted ? this.demotionFactor : 1.0),
                    method: 'none',
                };
        }
        // Apply demotion factor if demoted
        const finalCalibrated = this.demoted ? result.calibrated * this.demotionFactor : result.calibrated;
        return {
            applied: true,
            factor: finalCalibrated / Math.max(0.001, confidence),
            preConfidence: confidence,
            postConfidence: finalCalibrated,
            method: this.config.method,
        };
    }
    /** Check if demoted. */
    isDemoted() {
        return this.demoted;
    }
    /** Get demotion factor. */
    getDemotionFactor() {
        return this.demotionFactor;
    }
    /** Reset demotion (e.g., after model update). */
    resetDemotion() {
        this.demoted = false;
        this.demotionFactor = 1.0;
    }
    /** Get calibration statistics. */
    getStats() {
        return {
            method: this.config.method,
            demoted: this.demoted,
            demotionFactor: this.demotionFactor,
            temperature: this.temperatureScaler.getTemperature(),
            betaParams: { a: this.betaCalibrator['a'], b: this.betaCalibrator['b'] },
            dataPoints: this.temperatureScaler.getDataCount(),
            ece: this.temperatureScaler.computeECE(),
            mce: this.temperatureScaler.computeMCE(),
        };
    }
}
/** Create a calibration manager. */
export function createCalibrationManager(config, options) {
    return new CalibrationManager(config, options);
}
/** Global calibration manager (non-deterministic; prefer {@link createCalibrationManager}). */
export const calibrationManager = createCalibrationManager();
