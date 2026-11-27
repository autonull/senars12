import { clamp, clampSigned, safeRatio, sigmoid, softmax, sumBy } from '@senars/util/numeric';
import { generateId } from '@senars/util/id';
import { mapToRecord, shareCount } from '@senars/util/collections';
import { createBag } from '@senars/bag';
import { AIKRProcessor, BagPrioritySampling } from '../../learning/aikr-processor';
import { cosine, cosineNormalized, normalize, } from '@senars/util/similarity';
import { embedCached } from './embedding-cache';
export { cosine as cosineF32 };
/** Domain-level rubric shared by all contrastive consumers (gate, grader, routing). */
export const DOMAIN_RUBRIC = 'domain';
/** Rubric a query is judged under (mirrors the manifold's head lookup rule). */
export function rubricOf(query) {
    return query.kind === 'classify' ? (query.rubric ?? 'task_type') : query.rubric;
}
/**
 * Bidirectional InfoNCE over frozen embeddings: learns (scale, bias) that
 * separate (query, positive) logits from (query, negative) logits via softmax
 * cross-entropy. Deterministic full-batch SGD; the contrastive analogue of a
 * calibrated decision head with no projection layer.
 */
export function fitInfoNCE(pairs, options = {}) {
    const epochs = options.epochs ?? 100;
    const lr = options.lr ?? 0.1;
    let scale = options.scaleInit ?? 10;
    let bias = 0;
    let loss = Number.POSITIVE_INFINITY;
    for (let epoch = 0; epoch < epochs; epoch++) {
        let dScale = 0;
        let dBias = 0;
        loss = 0;
        for (const { query, positive, negatives } of pairs) {
            const q = normalize(query);
            const cosPos = clampSigned(cosineNormalized(q, positive));
            const cosNegs = negatives.map((n) => clampSigned(cosineNormalized(q, n)));
            const logits = [scale * cosPos + bias, ...cosNegs.map((c) => scale * c + bias)];
            const probs = softmax(logits);
            loss += -Math.log(probs[0]);
            // dL/dz_0 = p_0 − 1; dL/dz_j = p_j; z_i = scale·c_i + bias
            dScale += (probs[0] - 1) * cosPos;
            dBias += probs[0] - 1;
            cosNegs.forEach((c, j) => {
                dScale += probs[j + 1] * c;
                dBias += probs[j + 1];
            });
        }
        const n = pairs.length || 1;
        scale = clamp(scale - (lr * dScale) / n, 0.1, 100);
        bias = clamp(bias - (lr * dBias) / n, -10, 10);
    }
    return { scale, bias, loss: safeRatio(loss, pairs.length) };
}
/**
 * Rubric-scoped contrastive exemplar memory (CLM System One): positives and
 * hard negatives per rubric under a 40/60 replay-mix cap, InfoNCE temperature
 * calibration, and zero-shot cosine scoring for uncalibrated heads.
 */
export class ContrastiveMemory {
    #maxPerRubric;
    #positiveShare;
    #zeroShotScale;
    #decayRate;
    #forgetRate;
    /** Phase C: per-rubric exemplar bags (priority eviction, decay, 40/60 caps). */
    #rubrics = new Map();
    #calibrations = new Map();
    constructor(config = {}) {
        this.#maxPerRubric = config.maxPerRubric ?? 128;
        this.#positiveShare = config.positiveShare ?? 0.6;
        this.#zeroShotScale = config.scale ?? 10;
        this.#decayRate = config.decayRate ?? 0;
        this.#forgetRate = config.forgetRate ?? 0;
    }
    /** Add exemplar texts (embedded via the shared cache) under a rubric; returns added count. */
    async add(rubric, exemplars, cache) {
        let added = 0;
        for (const text of exemplars.positives ?? []) {
            const emb = await embedCached(cache, text);
            if (emb && this.#admit(rubric, { kind: 'pos', embedding: emb }))
                added++;
        }
        for (const text of exemplars.negatives ?? []) {
            const emb = await embedCached(cache, text);
            if (emb && this.#admit(rubric, { kind: 'neg', embedding: emb }))
                added++;
        }
        return added;
    }
    /** Add pre-computed exemplar embeddings directly (for text-redacted sources
     *  like the distillation dataset); returns stored count. */
    addEmbeddings(rubric, exemplars) {
        let added = 0;
        for (const emb of exemplars.positives ?? []) {
            if (this.#admit(rubric, { kind: 'pos', embedding: emb }))
                added++;
        }
        for (const emb of exemplars.negatives ?? []) {
            if (this.#admit(rubric, { kind: 'neg', embedding: emb }))
                added++;
        }
        return added;
    }
    /** Fit InfoNCE scale/bias for a rubric from its stored exemplars (leave-one-out positives). */
    calibrate(rubric, options = {}) {
        const positives = this.#positives(rubric);
        const negatives = this.#negatives(rubric);
        if (positives.length < 2 || negatives.length === 0)
            return undefined;
        // Leave-one-out mean positive: each positive is judged against the rest of
        // its own class, so memorizable singletons cannot trivially win.
        const dim = positives[0].length;
        const meanPositive = (skip) => {
            const acc = new Float32Array(dim);
            let count = 0;
            for (const [i, p] of positives.entries()) {
                if (i === skip)
                    continue;
                for (let d = 0; d < dim; d++)
                    acc[d] += p[d];
                count++;
            }
            if (count === 0)
                return positives[skip];
            for (let d = 0; d < dim; d++)
                acc[d] = acc[d] / count;
            return acc;
        };
        const pairs = positives.map((query, i) => ({
            query,
            positive: meanPositive(i),
            negatives,
        }));
        const calibration = fitInfoNCE(pairs, options);
        this.#calibrations.set(rubric, calibration);
        return calibration;
    }
    /** Calibrate every rubric that has both classes; returns fitted rubric ids. */
    calibrateAll(options = {}) {
        return [...this.#rubrics.keys()].filter((rubric) => !!this.calibrate(rubric, options));
    }
    /**
     * Zero-shot/calibrated contrastive score in (0,1): best-positive similarity
     * minus best-negative similarity passed through the learned logit. When no
     * rubric is given, the best score across all stored rubrics is returned
     * (cross-rubric in-domain-ness). Undefined when no exemplars exist.
     */
    score(embedding, rubric) {
        if (rubric !== undefined && !this.has(rubric))
            return undefined;
        // Normalized once per call: the cross-rubric branch below scored every rubric,
        // and each of those scores normalized the same vector again.
        const query = normalize(embedding);
        if (rubric === undefined) {
            let best;
            for (const r of this.#rubrics.keys()) {
                const s = this.#scoreNormalized(query, r);
                if (s !== undefined && (best === undefined || s > best))
                    best = s;
            }
            return best;
        }
        return this.#scoreNormalized(query, rubric);
    }
    #scoreNormalized(query, rubric) {
        const state = this.#rubrics.get(rubric);
        if (!state || (state.pos.size === 0 && state.neg.size === 0))
            return undefined;
        const maxPos = this.#maxCosine(state.pos, query);
        const maxNeg = this.#maxCosine(state.neg, query);
        const calibration = this.#calibrations.get(rubric);
        const scale = calibration?.scale ?? this.#zeroShotScale;
        const bias = calibration?.bias ?? 0;
        return sigmoid(scale * (maxPos - maxNeg) + bias);
    }
    /** Max cosine over every stored exemplar — in-domain-ness for OOD routing. */
    routingScore(embedding) {
        let best = -1;
        let seen = 0;
        const query = normalize(embedding);
        for (const state of this.#rubrics.values()) {
            best = Math.max(best, this.#maxCosine(state.pos, query));
            best = Math.max(best, this.#maxCosine(state.neg, query));
            seen += state.pos.size + state.neg.size;
        }
        return seen === 0 ? undefined : Math.max(0, best);
    }
    has(rubric = DOMAIN_RUBRIC) {
        const state = this.#rubrics.get(rubric);
        return !!state && (state.pos.size > 0 || state.neg.size > 0);
    }
    isEmpty() {
        for (const state of this.#rubrics.values()) {
            if (state.pos.size > 0 || state.neg.size > 0)
                return false;
        }
        return true;
    }
    stats() {
        return mapToRecord(this.#rubrics, (s, rubric) => ({
            positives: s.pos.size,
            negatives: s.neg.size,
            calibrated: this.#calibrations.has(rubric),
        }));
    }
    clear() {
        this.#rubrics.clear();
        this.#calibrations.clear();
    }
    /**
     * Phase C: per-cycle decay — stale exemplar priority erodes; items below the
     * forget floor drop out, keeping the pool fresh (flywheel maintenance).
     * @param rate Optional decay rate override for this call (per second).
     */
    decay(rate) {
        const decayRate = rate ?? this.#decayRate;
        const forgetRate = rate !== undefined ? rate : this.#forgetRate;
        for (const state of this.#rubrics.values()) {
            state.pos.decayRateValue = decayRate;
            state.neg.decayRateValue = decayRate;
            state.pending.decayRateValue = decayRate;
            state.pos.decay();
            state.neg.decay();
            state.pending.decay();
        }
    }
    /**
     * Phase C: judgment auto-admission — a high-confidence decision is admitted
     * to the exemplar pool when it improves discrimination margin (flywheel:
     * judgments → exemplars → better calibrated judgments).
     */
    observeJudgment(rubric, embedding, judgment, options = {}) {
        if (judgment.confidence < (options.admitThreshold ?? 0.8))
            return false;
        const state = this.#rubricState(rubric);
        const margin = Math.max(0, this.#margin(state, embedding));
        return state.maintainer.admit({
            id: generateId(judgment.label),
            priority: margin * judgment.confidence,
            kind: judgment.label,
            embedding,
        });
    }
    /** Promote pending judgments into the exemplar pool when pressure allows. */
    async maintainIfPressured(options = {}) {
        let promoted = 0;
        for (const state of this.#rubrics.values()) {
            const counts = await state.maintainer.processIfPressured(options);
            promoted += sumBy(counts, (count) => count);
        }
        return promoted;
    }
    #rubricState(rubric) {
        let state = this.#rubrics.get(rubric);
        if (!state) {
            const posCap = shareCount(this.#maxPerRubric, this.#positiveShare, 1, Math.round);
            const negCap = shareCount(this.#maxPerRubric - posCap, 1, 1);
            const pos = createBag({ capacity: posCap, decayRate: this.#decayRate, forgetRate: this.#forgetRate });
            const neg = createBag({ capacity: negCap, decayRate: this.#decayRate, forgetRate: this.#forgetRate });
            const pending = createBag({ capacity: 64, decayRate: this.#decayRate, forgetRate: this.#forgetRate });
            // Phase C: the second AIKRProcessor instantiation — pending judgments
            // promote into the exemplar bags under pressure (flywheel closure).
            const maintainer = new AIKRProcessor({
                bag: pending,
                samplingStrategy: new BagPrioritySampling(1.0),
                pressureThreshold: 0.7,
                process: (items) => {
                    let promoted = 0;
                    for (const item of items) {
                        if ((item.kind === 'pos' ? pos : neg).add(item))
                            promoted++;
                    }
                    return [promoted];
                },
            });
            state = { pos, neg, pending, maintainer };
            this.#rubrics.set(rubric, state);
        }
        return state;
    }
    /** Margin-weighted admission into the priority bag (capacity-evicting). */
    #admit(rubric, exemplar, priority) {
        const state = this.#rubricState(rubric);
        const opposing = exemplar.kind === 'pos' ? state.neg : state.pos;
        // Discrimination against the opposing class; 1 when unopposed.
        const margin = opposing.size === 0 ? 1 : 1 - this.#maxCosine(opposing, normalize(exemplar.embedding));
        const item = {
            id: generateId(exemplar.kind),
            priority: Math.max(1e-6, priority ?? margin),
            kind: exemplar.kind,
            embedding: exemplar.embedding,
        };
        const bag = exemplar.kind === 'pos' ? state.pos : state.neg;
        const admitted = bag.add(item);
        if (admitted)
            state.maintainer?.admit(item);
        return admitted;
    }
    /**
     * Max cosine against a bag's exemplars — streams the bag, no array copies.
     * `query` carries its precomputed norm so the same embedding scored against
     * two bags (or a whole routing sweep) is measured once.
     */
    #maxCosine(bag, query) {
        let best = -1;
        for (const item of bag.values())
            best = Math.max(best, cosineNormalized(query, item.embedding));
        return best;
    }
    /** Positive-vs-negative cosine margin for a rubric state. */
    #margin(state, embedding) {
        const query = normalize(embedding);
        return this.#maxCosine(state.pos, query) - this.#maxCosine(state.neg, query);
    }
    #positives(rubric) {
        const state = this.#rubrics.get(rubric);
        if (!state)
            return [];
        return [...state.pos.values()].map((e) => e.embedding);
    }
    #negatives(rubric) {
        const state = this.#rubrics.get(rubric);
        if (!state)
            return [];
        return [...state.neg.values()].map((e) => e.embedding);
    }
}
export async function candidateProximity(memory, cache, candidates, floor = 0) {
    const penalties = new Map();
    const belowFloor = [];
    if (!memory || memory.isEmpty() || !cache)
        return { penalties, belowFloor };
    for (const candidate of candidates) {
        try {
            const pointer = (await cache.write(candidate));
            const embedding = cache.read(pointer);
            const score = embedding ? memory.score(embedding) : undefined;
            if (score === undefined)
                continue;
            penalties.set(candidate, 1 - score);
            if (score < floor)
                belowFloor.push(candidate);
        }
        catch {
            // Unembeddable candidate — no penalty, no veto
        }
    }
    return { penalties, belowFloor };
}
export function createContrastiveMemory(config) {
    return new ContrastiveMemory(config);
}
