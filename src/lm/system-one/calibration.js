import { BoundedMap } from '@senars/util/bounded-map';
import { lerp, safeRatio } from '@senars/util/numeric';
import { maxScore, sortBy, trimCapped } from '@senars/util/collections';
import { headRubrics } from './head-ontology';
import { weightedAbsoluteError } from './metrics';
/** Fitted points retained per calibrator; older points stop steering the fit. */
const CALIBRATION_POINT_CAP = 10_000;
function poolAdjacentViolators(predicted, observed, weights) {
    const n = predicted.length;
    const blocks = [];
    for (let i = 0; i < n; i++) {
        blocks.push({
            start: i,
            end: i,
            value: observed[i] ?? 0,
            weight: weights[i] ?? 1,
        });
        while (blocks.length >= 2) {
            const b1 = blocks[blocks.length - 2];
            const b2 = blocks[blocks.length - 1];
            if (b1.value <= b2.value)
                break;
            const mergedWeight = b1.weight + b2.weight;
            const mergedValue = (b1.value * b1.weight + b2.value * b2.weight) / mergedWeight;
            blocks[blocks.length - 2] = {
                start: b1.start,
                end: b2.end,
                value: mergedValue,
                weight: mergedWeight,
            };
            blocks.pop();
        }
    }
    const result = new Array(n);
    for (const block of blocks) {
        for (let i = block.start; i <= block.end; i++) {
            result[i] = block.value;
        }
    }
    return result;
}
export function createIsotonicCalibrator(version, rubric, initialPoints = []) {
    const points = [...initialPoints];
    let isotonicMap = null;
    let sortedPredicted = null;
    let fitted = initialPoints.length > 0 && initialPoints.some((p) => p.observed !== p.predicted);
    /** ECE depends on nothing but `points`, and every reader asks per batch. */
    let cachedECE = null;
    /** Track if points have actually changed (new real labels or count) to skip rebuild. */
    let pointsVersion = 0;
    let lastRebuildVersion = -1;
    function rebuild() {
        cachedECE = null;
        if (points.length < 2) {
            isotonicMap = null;
            sortedPredicted = null;
            return;
        }
        const sorted = sortBy(points, (p) => p.predicted);
        sortedPredicted = sorted.map((p) => p.predicted);
        const observed = sorted.map((p) => p.observed);
        const weights = sorted.map((p) => p.weight);
        isotonicMap = poolAdjacentViolators(sortedPredicted, observed, weights);
        lastRebuildVersion = pointsVersion;
    }
    rebuild();
    return {
        version,
        rubric,
        get fitted() {
            return fitted;
        },
        calibrate(score) {
            if (!isotonicMap || !sortedPredicted || points.length < 2) {
                return score;
            }
            let idx = sortedPredicted.findIndex((p) => p >= score);
            if (idx === -1)
                idx = sortedPredicted.length - 1;
            if (idx === 0)
                return isotonicMap[0] ?? score;
            if (idx >= isotonicMap.length)
                return isotonicMap[isotonicMap.length - 1] ?? score;
            const p0 = sortedPredicted[idx - 1] ?? 0;
            const p1 = sortedPredicted[idx] ?? 1;
            const v0 = isotonicMap[idx - 1] ?? 0;
            const v1 = isotonicMap[idx] ?? 1;
            if (p1 === p0)
                return v0;
            return lerp(v0, v1, (score - p0) / (p1 - p0));
        },
        update(newPoints) {
            const hasRealLabels = newPoints.some((p) => p.observed !== p.predicted);
            if (hasRealLabels) {
                fitted = true;
            }
            const oldLength = points.length;
            points.push(...newPoints);
            trimCapped(points, CALIBRATION_POINT_CAP);
            // Only rebuild if points actually changed (new real labels or count changed)
            if (hasRealLabels || points.length !== oldLength) {
                pointsVersion++;
                rebuild();
            }
        },
        getECE() {
            if (cachedECE === null) {
                cachedECE = weightedAbsoluteError(points, (p) => this.calibrate(p.predicted) - p.observed, (p) => p.weight);
            }
            return cachedECE;
        },
        getPoints() {
            return points;
        },
        reset() {
            points.length = 0;
            isotonicMap = null;
            sortedPredicted = null;
            cachedECE = null;
            fitted = false;
        },
    };
}
/**
 * The sample-weighted ECE over a bounded trailing window — drift detection's
 * input. The window is the shared {@link BoundedMap}: one container bounds every
 * cache and ledger hot path in the repository, and a private array plus a
 * hand-rolled prune pass is what it replaces. Expiry is lazy, so a read costs
 * one pass and allocates nothing.
 */
export class RollingECEMonitor {
    #config;
    /** Append-ordered by construction: the key is the record sequence, so the oldest sample leaves first. */
    #samples;
    #seq = 0;
    constructor(config = {}) {
        this.#config = {
            windowSize: config.windowSize ?? 100,
            maxSamples: config.maxSamples ?? 1000,
            minSamples: config.minSamples ?? 10,
            driftThreshold: config.driftThreshold ?? 0.15,
        };
        this.#samples = new BoundedMap({
            maxSize: this.#config.maxSamples,
            ttlMs: this.#config.windowSize * 60_000,
        });
    }
    record(ece, sampleCount) {
        this.#samples.set(this.#seq++, { ece, sampleCount });
    }
    getRollingECE() {
        const { weighted, weight } = this.#aggregate();
        return safeRatio(weighted, weight);
    }
    getSampleCount() {
        return this.#aggregate().weight;
    }
    isDriftDetected() {
        return (this.getSampleCount() >= this.#config.minSamples &&
            this.getRollingECE() > this.#config.driftThreshold);
    }
    reset() {
        this.#samples.clear();
    }
    /** One pass for both readings: a read happens once per batch, twice over. */
    #aggregate() {
        let weighted = 0;
        let weight = 0;
        for (const { ece, sampleCount } of this.#samples.values()) {
            weighted += (ece ?? 0) * (sampleCount ?? 0);
            weight += sampleCount ?? 0;
        }
        return { weighted, weight };
    }
}
export class DriftDemotionManager {
    #config;
    #backendHealth = new Map();
    constructor(config = {}) {
        this.#config = {
            eceThreshold: config.eceThreshold ?? 0.15,
            consecutiveCycles: config.consecutiveCycles ?? 3,
            cooldownCycles: config.cooldownCycles ?? 10,
        };
    }
    registerBackend(backendId, calibrators) {
        this.#backendHealth.set(backendId, {
            backendId,
            calibrators,
            rollingECE: 0,
            consecutiveDriftCycles: 0,
            isDemoted: false,
            lastDemotionCycle: 0,
        });
    }
    updateCycle(backendId, cycleNumber) {
        const health = this.#backendHealth.get(backendId);
        if (!health)
            return null;
        const maxECE = maxScore(health.calibrators.values(), (calibrator) => calibrator.getECE());
        health.rollingECE = maxECE;
        if (maxECE > this.#config.eceThreshold) {
            health.consecutiveDriftCycles++;
        }
        else {
            health.consecutiveDriftCycles = 0;
        }
        if (health.consecutiveDriftCycles >= this.#config.consecutiveCycles &&
            !health.isDemoted &&
            cycleNumber - health.lastDemotionCycle >= this.#config.cooldownCycles) {
            health.isDemoted = true;
            health.lastDemotionCycle = cycleNumber;
            return { demoted: true, rollingECE: maxECE };
        }
        return { demoted: false, rollingECE: maxECE };
    }
    getHealth(backendId) {
        return this.#backendHealth.get(backendId);
    }
    getAllHealth() {
        return this.#backendHealth;
    }
    forceDemote(backendId, cycleNumber) {
        const health = this.#backendHealth.get(backendId);
        if (!health || health.isDemoted)
            return false;
        health.isDemoted = true;
        health.lastDemotionCycle = cycleNumber;
        return true;
    }
    canRecover(backendId, cycleNumber) {
        const health = this.#backendHealth.get(backendId);
        if (!health?.isDemoted)
            return false;
        return cycleNumber - health.lastDemotionCycle >= this.#config.cooldownCycles;
    }
    attemptRecovery(backendId, cycleNumber) {
        const health = this.#backendHealth.get(backendId);
        if (!health?.isDemoted)
            return false;
        if (!this.canRecover(backendId, cycleNumber))
            return false;
        const maxECE = maxScore(health.calibrators.values(), (calibrator) => calibrator.getECE());
        if (maxECE <= this.#config.eceThreshold * 0.8) {
            health.isDemoted = false;
            health.consecutiveDriftCycles = 0;
            return true;
        }
        return false;
    }
}
export function createCalibrationSuite(version, rubrics) {
    const calibrators = new Map();
    for (const rubric of rubrics) {
        calibrators.set(rubric, createIsotonicCalibrator(version, rubric));
    }
    return calibrators;
}
export function createDefaultCalibrationSuite(version) {
    // One rubric per head, read off the ontology: the hand-written list this replaced
    // named `feasibility` twice and had never heard of `episodic_match`, so a head
    // existed with no calibrator and a rubric had two.
    return createCalibrationSuite(version, [...headRubrics()]);
}
