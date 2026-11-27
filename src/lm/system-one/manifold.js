import { clamp, clamp01, estimateTokens, mean, safeRatio, variance } from '@senars/util/numeric';
import { makeId } from '@senars/util/id';
import { monotonicNow, stopwatch } from '@senars/util/async';
import { unique } from '@senars/util/collections';
import { assertDefined } from '@senars/util/assert';
import { validateBatchQueries } from './algebra';
import { createDefaultCalibrationSuite, DriftDemotionManager, RollingECEMonitor, } from './calibration';
import { applyCalibrationLock, assertLockMatches, } from './calibration-fit';
import { rubricOf } from './contrastive';
import { composeProposition } from './distribution';
import { createAllHeads } from './head-specs';
import { SenarsError } from '../../errors/senars-error';
export class SystemOneManifold {
    #config;
    #health;
    #rollingECEMonitor;
    #driftDemotion;
    #cycleCounter = 0;
    #calibrators;
    #contrastive;
    /** Head-size recommendation (scaling laws): 0 when uncomputed. */
    #suggestedHeadSize = 0;
    constructor(config) {
        this.#config = config;
        this.#contrastive = config.contrastive;
        this.#calibrators = createDefaultCalibrationSuite(config.calibrationVersion);
        if (config.calibrationLock) {
            assertLockMatches(config.calibrationLock, config.modelDigest);
            applyCalibrationLock(this.#calibrators, config.calibrationLock);
        }
        this.#rollingECEMonitor = new RollingECEMonitor(config.rollingECEConfig);
        this.#driftDemotion = new DriftDemotionManager(config.driftDemotionConfig);
        this.#driftDemotion.registerBackend(config.backendId, this.#calibrators);
        this.#health = {
            backendId: config.backendId,
            ready: true,
            breakerOpen: false,
            rollingEce: 0,
            queueDepth: 0,
        };
    }
    async judgeBatch(sharedContext, queries, _budget) {
        const elapsedBatch = stopwatch(monotonicNow);
        if (queries.length > this.#config.maxBatchSize) {
            throw new SenarsError(`Batch size ${queries.length} exceeds max ${this.#config.maxBatchSize}`, 'CONFIGURATION_ERROR');
        }
        validateBatchQueries(queries);
        const contextEmbedding = this.#config.embeddingCache.read(sharedContext);
        if (!contextEmbedding) {
            throw new SenarsError(`Embedding not found for pointer ${sharedContext}`, 'VALIDATION_ERROR');
        }
        this.#health.queueDepth = queries.length;
        const results = [];
        // The batch's calibration reading, taken once: nothing in the loop records a
        // sample, so every query would otherwise recompute one number.
        const batchECE = this.#rollingECEMonitor.getRollingECE();
        for (const query of queries) {
            const rubric = rubricOf(query);
            const head = this.#config.heads.get(rubric);
            if (!head && !this.#contrastive?.has(rubric)) {
                throw new SenarsError(`No head registered for query: ${query.kind} ${rubric}`, 'OPERATION_ERROR');
            }
            const elapsedQuery = stopwatch(monotonicNow);
            let headResult;
            if (head) {
                try {
                    headResult = await head.evaluate(contextEmbedding, query);
                }
                catch (_e) {
                    headResult = {
                        score: 0.5,
                        abstained: true,
                        abstainReason: 'timeout',
                    };
                }
            }
            else {
                // Headless contrastive fallback (CLM zero-shot cosine scoring).
                const score = this.#contrastive?.score(contextEmbedding, rubric);
                headResult =
                    score === undefined
                        ? { score: 0.5, abstained: true, abstainReason: 'out-of-domain' }
                        : { score, abstained: false };
            }
            const latencyMs = Math.ceil(elapsedQuery());
            const proposition = composeProposition(query, {
                queryId: makeId(),
                backendId: this.#config.backendId,
                modelDigest: this.#config.modelDigest,
                calibration: {
                    version: this.#config.calibrationVersion,
                    ece: batchECE,
                    fitted: head?.fitted === true ||
                        (this.#calibrators.get(query.kind === 'classify' ? 'classify' : query.rubric)
                            ?.fitted ??
                            false),
                },
                latencyMs,
                cost: this.estimateCost(query, latencyMs),
                tier: 1,
                abstained: headResult.abstained,
                abstainReason: headResult.abstainReason,
            }, query.kind === 'classify'
                ? { kind: 'classify', distribution: headResult.distribution }
                : { kind: 'evaluate', score: headResult.score, legend: headResult.legend });
            results.push(proposition);
            // Emit telemetry via callback (kernel events + metrics)
            if (this.#config.onProposition) {
                this.#config.onProposition(proposition, query);
            }
        }
        const totalLatency = elapsedBatch();
        this.#setHealth('latency', totalLatency > this.#config.maxLatencyMs);
        this.#updateCalibration(results);
        this.#cycleCounter++;
        this.#checkDrift();
        this.#health.rollingEce = this.#rollingECEMonitor.getRollingECE();
        this.#health.queueDepth = 0;
        return results;
    }
    async consensus(sharedContext, query, k, budget) {
        const fanout = Math.min(k, 3);
        const runs = [];
        // Sampled self-consistency (open technique): heads are deterministic, so
        // repeated judgments are salted per run index — agreement then measures
        // stability under seeded perturbation rather than trivially reading 1.0.
        for (let i = 0; i < fanout; i++) {
            const runQuery = i === 0
                ? query
                : { ...query, instruction: query.instruction + '\u200b'.repeat(i) };
            const batch = await this.judgeBatch(sharedContext, [runQuery], budget);
            runs.push(batch);
        }
        const first = assertDefined(runs[0]?.[0], 'manifold ensemble produced no verdict');
        let agreement = 1.0;
        if (first.kind === 'classify') {
            const topOptions = runs.map((r) => r[0].top.option);
            agreement = safeRatio(1, unique(topOptions).length);
        }
        else {
            const scores = runs.map((r) => r[0].score);
            agreement = clamp01(1 - variance(scores) * 4);
        }
        return {
            proposition: first,
            agreement,
            independent: fanout <= 1,
        };
    }
    health() {
        return { ...this.#health };
    }
    getEmbeddingCache() {
        return this.#config.embeddingCache;
    }
    getCalibrators() {
        return this.#calibrators;
    }
    /** Registered judgment heads (Phase F, audit M4 — replaces private-name reach-in). */
    getHeads() {
        return this.#config.heads;
    }
    getDriftDemotionManager() {
        return this.#driftDemotion;
    }
    setDemoted(demoted) {
        this.#setHealth('manual', demoted);
    }
    registerHead(head) {
        this.#config.heads.set(head.rubric, head);
    }
    /** Per-head abstain thresholds from the loaded calibration lock (empty when unfitted). */
    getAbstainThresholds() {
        return new Map((this.#config.calibrationLock?.heads ?? []).map((e) => [e.headId, e.abstainThreshold]));
    }
    getCalibrationLock() {
        return this.#config.calibrationLock;
    }
    /**
     * Single health reducer (B9/X25): `ready`/`breakerOpen` derive exclusively from the
     * active cause set. Causes: 'latency' (trips on slow batch, recovers on next healthy
     * batch), 'drift' (demotion manager), 'manual' (setDemoted).
     */
    #healthCauses = {
        latency: false,
        drift: false,
        manual: false,
    };
    #setHealth(cause, active) {
        this.#healthCauses[cause] = active;
        const { latency, drift, manual } = this.#healthCauses;
        this.#health.ready = !(drift || manual);
        this.#health.breakerOpen = latency || drift || manual;
    }
    #estimateCost(query, latencyMs) {
        const baseTokens = estimateTokens(query.instruction);
        return {
            tokensIn: Math.ceil(baseTokens),
            tokensOut: 0,
            computeMs: latencyMs,
            memoryMb: 4,
        };
    }
    estimateCost = this.#estimateCost.bind(this);
    #updateCalibration(results) {
        // Do NOT update calibrators with self-supervised predictions (observed: predicted).
        // Calibrators are only updated from real labels sourced from JudgmentDataset (Phase D).
        // Until then, they remain in unfitted state (fitted: false) and report ECE honestly.
        const totalSamples = results.length;
        // `mean` already divides by the count: dividing again reported the mean
        // calibration error as its square, for every head.
        const avgECE = mean(this.#calibrators.values(), (c) => c.getECE());
        this.#rollingECEMonitor.record(avgECE, totalSamples);
    }
    #checkDrift() {
        const driftResult = this.#driftDemotion.updateCycle(this.#config.backendId, this.#cycleCounter);
        if (driftResult)
            this.#setHealth('drift', driftResult.demoted);
        const health = this.#driftDemotion.getHealth(this.#config.backendId);
        if (health)
            this.#setHealth('drift', health.isDemoted);
    }
    syncHealth() {
        const health = this.#driftDemotion.getHealth(this.#config.backendId);
        if (health)
            this.#setHealth('drift', health.isDemoted);
    }
    /** Register or update the telemetry callback for resolved propositions. */
    setPropositionCallback(callback) {
        this.#config.onProposition = callback;
    }
    /** Current telemetry callback (enables multi-consumer chaining). */
    getPropositionCallback() {
        return this.#config.onProposition;
    }
    getContrastiveMemory() {
        return this.#contrastive;
    }
    /**
     * CLM scaling-law head sizing (Kwok et al. 2026): optimal projection-head
     * width grows as a power law in the labeled-data budget. With N labels and
     * embedding dim D: width = clamp(D · (N/N₀)^0.18, 8, D) — N₀ = 64 labels at
     * full width. Returns the recommended width and stores it for telemetry.
     */
    suggestHeadSize(labelCount, embeddingDim = 384) {
        if (labelCount <= 0)
            return 0;
        const n0 = 64;
        const raw = embeddingDim * (labelCount / n0) ** 0.18;
        const width = Math.round(clamp(raw, 8, embeddingDim));
        this.#suggestedHeadSize = width;
        return width;
    }
    getLastSuggestedHeadSize() {
        return this.#suggestedHeadSize;
    }
}
export function createManifold(embeddingCache, config = {}) {
    const backendId = (config.backendId ?? 'encoder-wasm-s1');
    const modelDigest = (config.modelDigest ?? 'sha256:all-MiniLM-L6-v2-heads-v1');
    const calibrationVersion = (config.calibrationVersion ?? 'v2.4.1');
    const abstainThreshold = config.abstainThreshold ?? 0.3;
    const perHeadConfig = config.perHeadConfig ?? {};
    const factoryOptions = { calibrationVersion, embeddingCache, abstainThreshold, perHeadConfig };
    const heads = createAllHeads(factoryOptions);
    const manifoldConfig = {
        backendId,
        modelDigest,
        calibrationVersion,
        embeddingCache,
        heads,
        maxBatchSize: config.maxBatchSize ?? 64,
        maxLatencyMs: config.maxLatencyMs ?? 33,
        abstainThreshold,
        rollingECEConfig: config.rollingECEConfig,
        driftDemotionConfig: config.driftDemotionConfig,
        onProposition: config.onProposition,
        calibrationLock: config.calibrationLock,
        contrastive: config.contrastive,
    };
    return new SystemOneManifold(manifoldConfig);
}
