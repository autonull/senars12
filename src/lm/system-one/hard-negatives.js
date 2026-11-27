import { collectUpTo, getOrInsert, groupBy, mapToRecord, selectByPriority, unique } from '@senars/util/collections';
import { shortSha256Hex } from '@senars/util/hash';
import { AikrShell } from '../../learning/aikr-processor';
import { DEFAULT_DIVERGENCE_GAP, hasDivergence } from '@senars/util/divergence';
/** Stable hash identity for mined negatives (joins the Z1 sidecar convention). */
export const hardNegativeId = (text) => shortSha256Hex(`hard-neg::${text}`);
/**
 * Hard-negative mining (CLM) from existing SeNARS signals:
 * 1. NARS belief contradictions — same-term beliefs with divergent frequency.
 * 2. Episodic `error` episodes — failed tool calls / regressions.
 * Deterministic; reads only live NAR state + the episodic store.
 */
export async function mineHardNegatives(beliefs, episodic, options = {}) {
    const limit = options.limit ?? 64;
    const conflictGap = options.conflictGap ?? DEFAULT_DIVERGENCE_GAP;
    const negatives = [];
    const byTerm = new Map();
    for (const belief of beliefs.getBeliefs()) {
        if (!belief.truth)
            continue;
        const key = belief.term.toString();
        getOrInsert(byTerm, key, () => []).push({ f: belief.truth.f });
    }
    negatives.push(...collectUpTo(byTerm, limit / 2, ([term, truths]) => hasDivergence(truths.map((t) => t.f), conflictGap)
        ? { rubric: 'conflict', text: term, source: 'contradiction' }
        : undefined));
    if (episodic) {
        try {
            const errors = await episodic.getEpisodes({
                type: 'error',
                limit: limit - negatives.length,
            });
            for (const episode of errors) {
                negatives.push({
                    rubric: 'groundedness',
                    text: episode.content,
                    source: 'error-episode',
                });
            }
        }
        catch {
            // Episodic store unavailable — contradiction negatives only
        }
    }
    if (options.into) {
        for (const negative of negatives)
            options.into.admit(negative);
    }
    return negatives;
}
/**
 * Phase D (REFACTOR.todo2): Hard-Negative Mining as an AIKR process — mined
 * candidates accumulate with priority = margin × recency × rubric relevance;
 * under budget the highest-signal candidates drain first (low-margin ones are
 * skipped), and decay forgets stale accumulation.
 */
const RUBRIC_RELEVANCE = {
    conflict: 1.0,
    groundedness: 0.8,
};
/** Candidates examined per mining pass. */
const MINING_BUDGET = 8;
export class MiningBag extends AikrShell {
    constructor(options = {}) {
        const marginFloor = options.marginFloor ?? 0;
        super({
            capacity: options.capacity ?? 128,
            forgetRate: options.forgetRate,
            rng: options.rng,
            clock: options.clock,
            budget: options.budget ?? MINING_BUDGET,
            pressureThreshold: options.pressureThreshold,
            view: (candidate) => candidate.negative,
            // priority = margin × recency(1, decays) × rubric relevance
            admit: (negative) => ({
                id: hardNegativeId(negative.text),
                priority: (negative.margin ?? 0.5) * (RUBRIC_RELEVANCE[negative.rubric] ?? 0.5),
                negative,
            }),
            samplingStrategy: 'greedy-priority',
            select: (items, selectBudget) => greedyCandidateSelection(items, selectBudget, marginFloor),
            process: (picked) => picked.map((c) => c.negative),
        });
    }
}
/** Deterministic greedy selection over priority with margin floor. */
const greedyCandidateSelection = (items, budget, marginFloor) => selectByPriority(items, budget, (c) => (c.negative.margin ?? 0.5) >= marginFloor);
/**
 * Score margins against a ContrastiveMemory's stored positives and seed the
 * mined negatives under their rubrics. Returns exemplars actually stored.
 */
export async function seedContrastiveMemory(negatives, memory, cache) {
    const byRubric = mapToRecord(groupBy(negatives, (neg) => neg.rubric), (bucket) => unique(bucket.map((neg) => neg.text)));
    let added = 0;
    for (const [rubric, texts] of Object.entries(byRubric)) {
        added += await memory.add(rubric, { negatives: texts }, cache);
    }
    return added;
}
/** Attach discrimination margins (1 − best positive cosine) to mined negatives. */
export async function withMargins(negatives, memory, cache) {
    const out = [];
    for (const neg of negatives) {
        let margin;
        try {
            const pointer = await cache.write(neg.text);
            const embedding = cache.read(pointer);
            if (embedding) {
                const inDomain = memory.routingScore(embedding);
                margin = inDomain === undefined ? undefined : 1 - inDomain;
            }
        }
        catch {
            margin = undefined;
        }
        out.push({ ...neg, margin });
    }
    return out;
}
