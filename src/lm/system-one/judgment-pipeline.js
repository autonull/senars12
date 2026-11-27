/**
 * JudgmentPipeline — composes over HEAD_SPECS (ordered heads + bands + calibrators + router + cascade).
 * Versioned pipeline ModelDigest for auditability.
 * HEAD_SPECS already declarative; pipeline adds composition + digest, does not replace the table.
 */
import { shortSha256Hex } from '@senars/util/hash';
import { HEAD_SPECS, headSpecsInGroup } from './head-ontology';
import { createHead, } from './head-specs';
import { DEFAULT_CONFIDENCE_BANDS } from './policy';
/** Scores below this in a cascade stage abstain instead of being judged. */
const CASCADE_THRESHOLD = 0.7;
const stageFor = (group, router, cascadeThreshold) => ({
    group,
    heads: headSpecsInGroup(group).map((spec) => spec.rubric),
    router,
    cascadeThreshold,
});
/** One stage per head group, in ontology order. The stage heads were a hand-written
 *  list of every rubric beside the table that already groups them, so a head added to
 *  a group joined the ontology and not the pipeline. */
export const DEFAULT_PIPELINE_STAGES = [
    stageFor('ingress', 'confidence'),
    stageFor('action', 'cascade', CASCADE_THRESHOLD),
    stageFor('synthesis', 'consensus'),
    stageFor('memory', 'confidence'),
];
/** Default bands for router. The two graded rungs are the confidence router's own
 *  thresholds; below `review` this pipeline abstains rather than blocking, which is
 *  its own policy and the reason it keeps a rung of its own. */
export const DEFAULT_PIPELINE_BANDS = [
    { threshold: DEFAULT_CONFIDENCE_BANDS.act, action: 'act' },
    { threshold: DEFAULT_CONFIDENCE_BANDS.review, action: 'review' },
    { threshold: 0.3, action: 'block' },
    { threshold: 0, action: 'abstain' },
];
export class JudgmentPipeline {
    spec;
    heads = new Map();
    modelDigest;
    constructor(spec = {}) {
        // Create a default embedding cache
        const defaultEmbeddingCache = {
            write: async () => 0,
            read: () => undefined,
        };
        this.spec = {
            id: spec.id ?? 'default',
            version: spec.version ?? '1.0.0',
            stages: spec.stages ?? DEFAULT_PIPELINE_STAGES,
            router: spec.router ?? { type: 'confidence', bands: DEFAULT_PIPELINE_BANDS },
            calibrators: spec.calibrators ?? {},
            headFactoryOptions: spec.headFactoryOptions ?? {
                calibrationVersion: 'v1',
                embeddingCache: defaultEmbeddingCache,
                abstainThreshold: 0.5,
            },
        };
        // Initialize heads from spec
        for (const stage of this.spec.stages) {
            for (const headId of stage.heads) {
                const headSpec = HEAD_SPECS[headId];
                if (headSpec) {
                    const calibratorConfig = this.spec.calibrators[headId] ?? {
                        version: 'v1',
                        abstainThreshold: 0.5,
                    };
                    const head = createHead(headSpec, {
                        ...this.spec.headFactoryOptions,
                        calibrationVersion: calibratorConfig.version,
                        abstainThreshold: calibratorConfig.abstainThreshold,
                    });
                    this.heads.set(headId, head);
                }
            }
        }
        // Compute model digest
        this.modelDigest = this.computeModelDigest();
    }
    /** Run the full pipeline on an embedding and query context. */
    async judge(embedding, queries) {
        const stageResults = new Map();
        const allPropositions = [];
        for (const stage of this.spec.stages) {
            const stageQueries = queries.filter((q) => stage.heads.includes(q.rubric));
            if (stageQueries.length === 0)
                continue;
            const stageProps = await this.judgeStage(embedding, stageQueries);
            stageResults.set(stage.group, stageProps);
            allPropositions.push(...stageProps);
        }
        // Apply router to combine/route propositions
        const routedProps = this.applyRouter(allPropositions);
        return {
            propositions: routedProps,
            modelDigest: this.modelDigest,
            stageResults,
        };
    }
    async judgeStage(embedding, queries) {
        const results = [];
        for (const query of queries) {
            const head = this.heads.get(query.rubric);
            if (!head)
                continue;
            const result = await head.evaluate(embedding, query);
            results.push(this.toResult(query.rubric, result, query));
        }
        return results;
    }
    toResult(rubric, result, query) {
        return {
            rubric,
            axis: query.axis,
            score: result.score,
            distribution: result.distribution,
            legend: result.legend,
            abstained: result.abstained,
            abstainReason: result.abstainReason,
        };
    }
    applyRouter(propositions) {
        const { type, bands } = this.spec.router;
        const bandFor = (score) => bands.find((b) => score >= b.threshold) ?? bands.at(-1);
        const withBand = (p) => ({
            ...p,
            decisionBand: bandFor(p.score).action,
        });
        if (type === 'cascade') {
            const threshold = this.spec.router.cascadeThreshold ?? CASCADE_THRESHOLD;
            return propositions.map((p) => p.abstained || p.score < threshold
                ? {
                    ...p,
                    decisionBand: 'abstain',
                    abstained: true,
                    abstainReason: 'cascade-threshold',
                }
                : withBand(p));
        }
        return propositions.map(withBand);
    }
    computeModelDigest() {
        const encoderDigest = 'encoder-v1';
        const headWeights = this.spec.stages.flatMap((s) => s.heads).join(',');
        const headWeightsDigest = shortSha256Hex(headWeights);
        const specStr = JSON.stringify({
            stages: this.spec.stages,
            router: this.spec.router,
            version: this.spec.version,
        });
        const specHash = shortSha256Hex(specStr);
        return {
            encoderDigest,
            headWeightsDigest,
            specHash,
            createdAt: Date.now(),
        };
    }
    getSpec() {
        return this.spec;
    }
    getModelDigest() {
        return this.modelDigest;
    }
    verifyDigest(digest) {
        return (digest.specHash === this.modelDigest.specHash &&
            digest.headWeightsDigest === this.modelDigest.headWeightsDigest &&
            digest.encoderDigest === this.modelDigest.encoderDigest);
    }
}
export function createJudgmentPipeline(overrides = {}) {
    return new JudgmentPipeline(overrides);
}
