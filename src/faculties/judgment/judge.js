/**
 * Learned Judge — a learned model for judgment scoring.
 *
 * Can be trained on judgment outcomes to improve calibration and selection.
 */
import { promises as fs } from 'fs';
import { join } from 'path';
import { flooredRatio, sigmoid } from '@senars/util/numeric';
/** Simple logistic regression judge. */
export class LogisticJudge {
    weights = [];
    bias = 0;
    featureNames = [];
    version = '1.0.0';
    trainingExamples = 0;
    lastTrained = 0;
    rng;
    now;
    telemetry;
    constructor(options = {}) {
        this.rng = options.rng ?? (() => Math.random());
        this.now = options.now ?? (() => Date.now());
        this.telemetry = options.telemetry;
    }
    /** Extract features from candidate and context. */
    extractFeatures(candidate, context, numCandidates) {
        const evidenceStrength = candidate.evidence.reduce((sum, e) => sum + e.strength, 0) * flooredRatio(1, candidate.evidence.length);
        // Encode faculty
        const facultyMap = {
            abduction: 0, inference: 1, analogy: 2, induction: 3,
            planning: 4, evaluation: 5, communication: 6, governance: 7,
            grounding: 8, goal: 9,
        };
        return {
            candidateConfidence: candidate.confidence,
            evidenceCount: candidate.evidence.length,
            avgEvidenceStrength: evidenceStrength,
            sourceFaculty: facultyMap[candidate.sourceFaculty] ?? -1,
            goalAlignment: this.computeGoalAlignment(candidate, context),
            beliefSupport: this.computeBeliefSupport(candidate, context),
            urgency: context.urgency,
            riskTolerance: context.riskTolerance,
            budgetFraction: context.budget > 0 ? 0.5 : 0, // Simplified
            numCandidates,
            stageReached: ['candidates', 'filter', 'score', 'select', 'calibrate'].indexOf(candidate.stageReached),
        };
    }
    /** Compute goal alignment. */
    computeGoalAlignment(candidate, context) {
        if (context.goals.length === 0)
            return 0.5;
        let maxAlign = 0;
        const propStr = candidate.proposal.toString();
        for (const goal of context.goals) {
            const goalStr = goal.term.toString();
            if (propStr.includes(goalStr) || goalStr.includes(propStr)) {
                maxAlign = Math.max(maxAlign, 1.0);
            }
            else if (propStr.length > 0 && goalStr.length > 0) {
                // Simple string similarity
                const common = this.commonSubstring(propStr, goalStr);
                maxAlign = Math.max(maxAlign, common / Math.max(propStr.length, goalStr.length));
            }
        }
        return maxAlign;
    }
    /** Compute belief support. */
    computeBeliefSupport(candidate, context) {
        if (context.beliefs.length === 0)
            return 0.5;
        let maxSupport = 0;
        const propStr = candidate.proposal.toString();
        for (const belief of context.beliefs) {
            const beliefStr = belief.term.toString();
            if (propStr.includes(beliefStr) || beliefStr.includes(propStr)) {
                maxSupport = Math.max(maxSupport, 1.0);
            }
            else if (propStr.length > 0 && beliefStr.length > 0) {
                const common = this.commonSubstring(propStr, beliefStr);
                maxSupport = Math.max(maxSupport, common / Math.max(propStr.length, beliefStr.length));
            }
        }
        return maxSupport;
    }
    /** Longest common substring ratio. */
    commonSubstring(a, b) {
        let maxLen = 0;
        for (let i = 0; i < a.length; i++) {
            for (let j = 0; j < b.length; j++) {
                let len = 0;
                while (i + len < a.length && j + len < b.length && a[i + len] === b[j + len]) {
                    len++;
                }
                maxLen = Math.max(maxLen, len);
            }
        }
        return maxLen;
    }
    /** Convert features to array. */
    featuresToArray(features) {
        return [
            features.candidateConfidence,
            features.evidenceCount / 10, // Normalize
            features.avgEvidenceStrength,
            features.sourceFaculty / 10, // Normalize
            features.goalAlignment,
            features.beliefSupport,
            features.urgency,
            features.riskTolerance,
            features.budgetFraction,
            features.numCandidates / 20, // Normalize
            features.stageReached / 5, // Normalize
        ];
    }
    /** Sigmoid function. */
    sigmoid(x) {
        return sigmoid(x);
    }
    /** Predict score. */
    predict(features) {
        const x = this.featuresToArray(features);
        let sum = this.bias;
        for (let i = 0; i < x.length && i < this.weights.length; i++) {
            sum += x[i] * this.weights[i];
        }
        return this.sigmoid(sum);
    }
    /** Train using gradient descent. */
    async train(examples) {
        if (examples.length === 0)
            return;
        const learningRate = 0.01;
        const epochs = 100;
        const numFeatures = 11;
        // Store old weights for delta calculation
        const oldWeights = [...this.weights];
        const oldBias = this.bias;
        // Initialize weights if needed
        if (this.weights.length !== numFeatures) {
            this.weights = new Array(numFeatures).fill(0).map(() => (this.rng() - 0.5) * 0.1);
            this.bias = 0;
        }
        // Prepare training data
        const X = [];
        const y = [];
        for (const ex of examples) {
            const features = this.extractFeatures(ex.candidate, ex.context, 10); // Approximate
            X.push(this.featuresToArray(features));
            y.push(ex.correct ? 1 : 0);
        }
        // Gradient descent
        for (let epoch = 0; epoch < epochs; epoch++) {
            let totalLoss = 0;
            for (let i = 0; i < X.length; i++) {
                const xi = X[i];
                const yi = y[i];
                const pred = this.predictFromArray(xi);
                const error = pred - yi;
                totalLoss += error * error;
                // Update weights
                for (let j = 0; j < this.weights.length; j++) {
                    this.weights[j] -= learningRate * error * xi[j];
                }
                this.bias -= learningRate * error;
            }
            // Emit weight-change telemetry per epoch
            if (this.telemetry) {
                const weightDelta = this.weights.reduce((sum, w, idx) => sum + Math.abs(w - (oldWeights[idx] ?? 0)), 0)
                    + Math.abs(this.bias - oldBias);
                await this.telemetry.judgeWeightChange('logistic', weightDelta, examples.length, epoch, totalLoss);
            }
            if (totalLoss < 1e-4)
                break;
        }
        this.trainingExamples = examples.length;
        this.lastTrained = this.now();
        // Emit model-trained telemetry
        if (this.telemetry) {
            await this.telemetry.judgeModelTrained('logistic', this.version, this.trainingExamples, this.lastTrained, undefined // metrics would be computed separately
            );
        }
    }
    /** Predict from feature array. */
    predictFromArray(x) {
        let sum = this.bias;
        for (let i = 0; i < x.length && i < this.weights.length; i++) {
            sum += x[i] * this.weights[i];
        }
        return this.sigmoid(sum);
    }
    /** Save model to storage. */
    async save() {
        const dir = join(process.cwd(), 'data', 'judge');
        await fs.mkdir(dir, { recursive: true });
        const path = join(dir, 'logistic-judge.json');
        await fs.writeFile(path, JSON.stringify({
            weights: this.weights,
            bias: this.bias,
            version: this.version,
            trainingExamples: this.trainingExamples,
            lastTrained: this.lastTrained,
        }, null, 2));
    }
    /** Load model from storage. */
    async load() {
        const path = join(process.cwd(), 'data', 'judge', 'logistic-judge.json');
        try {
            const content = await fs.readFile(path, 'utf-8');
            const data = JSON.parse(content);
            this.weights = data.weights ?? [];
            this.bias = data.bias ?? 0;
            this.version = data.version ?? '1.0.0';
            this.trainingExamples = data.trainingExamples ?? 0;
            this.lastTrained = data.lastTrained ?? 0;
        }
        catch {
            // No saved model
        }
    }
    /** Get model info. */
    getInfo() {
        return {
            type: 'logistic',
            version: this.version,
            trainingExamples: this.trainingExamples,
            lastTrained: this.lastTrained,
        };
    }
}
/** Judge ensemble for better predictions. */
export class JudgeEnsemble {
    models = [];
    weights = [];
    /** Add a model to the ensemble. */
    addModel(model, weight = 1.0) {
        this.models.push(model);
        this.weights.push(weight);
    }
    /** Predict using weighted average. */
    predict(features) {
        if (this.models.length === 0)
            return 0.5;
        let sum = 0;
        let weightSum = 0;
        for (let i = 0; i < this.models.length; i++) {
            const pred = this.models[i].predict(features);
            const w = this.weights[i];
            sum += pred * w;
            weightSum += w;
        }
        return weightSum > 0 ? sum / weightSum : 0.5;
    }
    /** Train all models. */
    async train(examples) {
        await Promise.all(this.models.map(m => m.train(examples)));
    }
    /** Save all models. */
    async save() {
        await Promise.all(this.models.map(m => m.save()));
    }
    /** Load all models. */
    async load() {
        await Promise.all(this.models.map(m => m.load()));
    }
    /** Get ensemble info. */
    getInfo() {
        return {
            type: 'ensemble',
            version: '1.0.0',
            trainingExamples: this.models[0]?.getInfo().trainingExamples ?? 0,
            lastTrained: Math.max(...this.models.map(m => m.getInfo().lastTrained)),
        };
    }
    /** Extract features from candidate and context (delegates to first model). */
    extractFeatures(candidate, context, numCandidates) {
        if (this.models.length === 0) {
            // Return default features
            return {
                candidateConfidence: candidate.confidence,
                evidenceCount: candidate.evidence.length,
                avgEvidenceStrength: candidate.evidence.reduce((sum, e) => sum + e.strength, 0) * flooredRatio(1, candidate.evidence.length),
                sourceFaculty: -1,
                goalAlignment: 0,
                beliefSupport: 0,
                urgency: context.urgency,
                riskTolerance: context.riskTolerance,
                budgetFraction: context.budget > 0 ? 0.5 : 0,
                numCandidates,
                stageReached: 0,
            };
        }
        return this.models[0].extractFeatures(candidate, context, numCandidates);
    }
}
/** Judge calibration using isotonic regression. */
export class IsotonicCalibrator {
    bins = new Map();
    calibratedMap = new Map();
    /** Record a prediction outcome. */
    record(predicted, correct) {
        const bin = Math.round(predicted * 100) / 100; // 2 decimal places
        const entry = this.bins.get(bin) ?? { correct: 0, total: 0 };
        entry.total++;
        if (correct)
            entry.correct++;
        this.bins.set(bin, entry);
    }
    /** Calibrate a prediction. */
    calibrate(predicted) {
        if (this.calibratedMap.size === 0) {
            this.recompute();
        }
        return this.calibratedMap.get(predicted) ?? predicted;
    }
    /** Recompute calibration map using isotonic regression (PAVA). */
    recompute() {
        // Sort bins by predicted probability
        const sortedBins = Array.from(this.bins.entries())
            .sort(([a], [b]) => a - b)
            .map(([pred, { correct, total }]) => ({
            pred,
            observed: total > 0 ? correct / total : pred,
            weight: total,
        }));
        // Pool Adjacent Violators Algorithm (PAVA)
        const blocks = [];
        for (const bin of sortedBins) {
            blocks.push({ ...bin });
            // Merge if monotonicity violated
            while (blocks.length >= 2) {
                const last = blocks[blocks.length - 1];
                const prev = blocks[blocks.length - 2];
                if (last.observed < prev.observed) {
                    // Pool
                    const totalWeight = last.weight + prev.weight;
                    const pooledObserved = (last.observed * last.weight + prev.observed * prev.weight) / totalWeight;
                    blocks[blocks.length - 2] = {
                        pred: prev.pred,
                        observed: pooledObserved,
                        weight: totalWeight,
                    };
                    blocks.pop();
                }
                else {
                    break;
                }
            }
        }
        // Build calibrated map
        this.calibratedMap.clear();
        for (const block of blocks) {
            this.calibratedMap.set(block.pred, block.observed);
        }
    }
    /** Get calibration data. */
    getData() {
        return Array.from(this.bins.entries()).map(([pred, { correct, total }]) => ({
            predicted: pred,
            observed: total > 0 ? correct / total : 0,
            count: total,
        }));
    }
}
/** Create an isolated judge ensemble (deterministic when `rng`/`now` are supplied). */
export function createJudge(options = {}) {
    const ensemble = new JudgeEnsemble();
    ensemble.addModel(new LogisticJudge(options), 1.0);
    return ensemble;
}
/** Create a default judge ensemble. */
export function createDefaultJudge() {
    return createJudge();
}
/** Global judge instance (convenience; prefer {@link createJudge}). */
export const learnedJudge = createDefaultJudge();
