import { clamp, clamp01 } from '@senars/util/numeric';
import { minBy, selectTopN } from '@senars/util/collections';
import { Truth, termParser } from '../../terms';
import { createTask } from '../../types/core';
import { systemOneTaskWeight } from '../task-weights';
import { createSystemOneBudget, DEFAULT_SYNTHESIS_CANDIDATES } from './types';
export class SystemOneLMRuleAdapter {
    #dispatcher;
    #nar;
    #logger;
    constructor(config) {
        this.#dispatcher = config.dispatcher;
        this.#nar = config.nar;
        this.#logger = config.logger;
    }
    async translateToNarsese(input, context) {
        try {
            const cycleCount = this.#nar.getCycleCount();
            const cognitiveContext = {
                tickId: `cycle-${cycleCount}`,
                topBeliefs: [input],
                topGoals: context?.activeGoals ?? [],
                workingMemory: context?.recentDerivations ?? [],
            };
            const synthesisQuery = {
                kind: 'synthesize',
                instruction: `Translate to Narsese: ${input}`,
                grammar: 'narsese-term',
                maxCandidates: DEFAULT_SYNTHESIS_CANDIDATES,
            };
            const judgmentQueries = [
                {
                    kind: 'classify',
                    instruction: 'Select best Narsese candidate',
                    space: [],
                    axis: 'teleological',
                    criticality: 'standard',
                },
                {
                    kind: 'evaluate',
                    instruction: 'Evaluate conflict with current beliefs',
                    rubric: 'conflict',
                    axis: 'epistemic',
                    criticality: 'standard',
                },
            ];
            const budget = this.#budget();
            const peaResult = await this.#dispatcher.proposeAndJudge(cognitiveContext, synthesisQuery, judgmentQueries, budget);
            const tasks = [];
            for (const admitted of peaResult.admitted) {
                const parsed = termParser.parse(admitted.candidate);
                if (parsed) {
                    const taskBudget = systemOneTaskWeight(admitted.truth.c, {
                        durability: 0.8,
                        quality: 0.9,
                    });
                    tasks.push(createTask(parsed, 'belief', admitted.truth, taskBudget, {
                        stamp: admitted.stamp,
                    }));
                }
            }
            this.#logger?.debug?.('System One translation', {
                candidates: peaResult.candidates.length,
                admitted: tasks.length,
            });
            return tasks;
        }
        catch (e) {
            this.#logger?.warn?.('System One translation failed', { error: e });
            return [];
        }
    }
    #budget() {
        return createSystemOneBudget();
    }
    /**
     * REPLACE disposition (TODO16 §8, lm-meta-reasoning): continuous manifold
     * scoring over derivation traces. The top-ranked traces are re-admitted as
     * guidance beliefs; no generative LM call is made. Returns [] when there are
     * no traces to score (caller degrades silently — the symbolic fallback for
     * this rule is removed).
     */
    async metaReason(_primary, context) {
        try {
            const traces = context?.recentDerivations ?? [];
            const manifold = this.#nar.getSystemOneManifold();
            const cache = this.#nar.getSystemOneEmbeddingCache();
            if (traces.length === 0 || !manifold || !cache)
                return [];
            const scores = [];
            for (const trace of traces) {
                const pointer = await cache.write(trace);
                const props = await manifold.judgeBatch(pointer, [
                    {
                        kind: 'evaluate',
                        instruction: 'Evaluate conflict of derivation trace with current beliefs',
                        rubric: 'conflict',
                        axis: 'epistemic',
                        criticality: 'standard',
                    },
                    {
                        kind: 'evaluate',
                        instruction: 'Evaluate novelty of derivation trace',
                        rubric: 'novelty',
                        axis: 'epistemic',
                        criticality: 'low',
                    },
                ], this.#budget());
                if (props.some((p) => p.abstained) || props.length < 2)
                    continue;
                const conflictScore = props[0]?.kind === 'evaluate' ? props[0].score : 0.5;
                const noveltyScore = props[1]?.kind === 'evaluate' ? props[1].score : 0.5;
                scores.push({ trace, score: noveltyScore - conflictScore });
            }
            const tasks = [];
            for (const { trace, score } of selectTopN(scores, 2, (s) => s.score)) {
                const term = termParser.parse(trace);
                if (!term)
                    continue;
                tasks.push(createTask(term, 'belief', Truth.create(clamp(0.5 + score / 2, 0.5, 0.9), 0.7), systemOneTaskWeight(clamp01(score))));
            }
            this.#logger?.debug?.('System One meta-reasoning', {
                traces: traces.length,
                guided: tasks.length,
            });
            return tasks;
        }
        catch (e) {
            this.#logger?.warn?.('System One meta-reasoning failed', { error: e });
            return [];
        }
    }
    /**
     * REPLACE disposition (TODO16 §8, lm-uncertainty-calibration): recalibrate a
     * belief's confidence through the fitted isotonic calibrators + drift
     * monitor. No generative call — always returns exactly one recalibrated
     * task; identity when no calibrator is fitted (calibration honesty, B5).
     */
    async calibrateUncertainty(primary, context) {
        const truth = context?.truth;
        const f = truth?.f ?? 0.5;
        const c = truth?.c ?? 0.5;
        try {
            const manifold = this.#nar.getSystemOneManifold();
            const fitted = manifold
                ? [...manifold.getCalibrators().values()].filter((cal) => cal.fitted)
                : [];
            const best = minBy(fitted, (head) => head.getECE());
            let cPrime = best ? best.calibrate(c) : c;
            if (manifold && !manifold.health().ready)
                cPrime *= 0.8; // drift demotion
            const calibrated = Truth.normalize(f, clamp(cPrime, 0.01, 0.99));
            return [createTask(primary, 'belief', calibrated, systemOneTaskWeight(cPrime))];
        }
        catch (e) {
            this.#logger?.warn?.('System One uncertainty calibration failed', { error: e });
            return [createTask(primary, 'belief', Truth.create(f, c))];
        }
    }
    /** Score one term against a single evaluate-head. F5 heads differ only in their query spec. */
    async #headScore(term, query, failureLabel) {
        try {
            const manifold = this.#nar.getSystemOneManifold();
            const cache = this.#nar.getSystemOneEmbeddingCache();
            if (!manifold || !cache)
                return null;
            const sharedContext = await cache.write(term);
            const propositions = await manifold.judgeBatch(sharedContext, [query], this.#budget());
            const prop = propositions[0];
            if (prop?.kind !== 'evaluate')
                return null;
            return {
                score: prop.score,
                fitted: prop.calibration.fitted === true,
                abstained: prop.abstained,
            };
        }
        catch (e) {
            this.#logger?.warn?.(failureLabel, { error: e });
            return null;
        }
    }
    /** F5: conflict-head verdict on a candidate derivation (ShadowValidator consumer). */
    async conflictScore(candidateTerm) {
        return this.#headScore(candidateTerm, {
            kind: 'evaluate',
            instruction: 'Evaluate conflict of candidate with current beliefs',
            rubric: 'conflict',
            axis: 'epistemic',
            criticality: 'standard',
        }, 'System One conflict evaluation failed');
    }
    /** F5: novelty-head score for a concept (ProactiveEnricher budget gate). */
    async noveltyScore(conceptTerm) {
        return this.#headScore(conceptTerm, {
            kind: 'evaluate',
            instruction: 'Evaluate novelty of concept',
            rubric: 'novelty',
            axis: 'epistemic',
            criticality: 'low',
        }, 'System One novelty evaluation failed');
    }
}
export function createSystemOneLMRuleAdapter(config) {
    return new SystemOneLMRuleAdapter(config);
}
