import { clamp } from '@senars/util/numeric';
import { sha256HexParts } from '@senars/util/hash';
import { HEAD_SPECS, specToQuery } from './head-ontology';
import { createSystemOneBudget } from './types';
const RISK_LEVELS = HEAD_SPECS.risk.space ?? [];
const DEFAULT_BUDGET = createSystemOneBudget();
const evidenceId = (kind, text) => sha256HexParts(['trace', kind, text]);
const labelBand = (score, levels) => {
    if (!levels.length)
        return score.toFixed(2);
    const idx = clamp(Math.round(score * (levels.length - 1)), 0, levels.length - 1);
    return levels[idx] ?? score.toFixed(2);
};
/**
 * E4 agent-trace grading: after a cycle completes, grade the narration with the
 * `groundedness` head and each executed tool call with the `risk` head — one
 * joint judgeBatch on the shared narration embedding (same evaluate-with-rubric
 * convention as ManifoldRLAgent). Grades flow into `JudgmentDataset` as
 * hash-only labels; tool success is the ground-truth `observed` for the risk
 * rubric, feeding the distillation flywheel.
 */
export function createTraceGrader(options) {
    const { manifold, embeddingCache, dataset, budget = DEFAULT_BUDGET, source = 'trace-grading', getContrastive, } = options;
    const groundednessQuery = specToQuery(HEAD_SPECS.groundedness);
    const riskQuery = {
        kind: 'evaluate',
        instruction: HEAD_SPECS.risk.instruction,
        rubric: 'risk',
        axis: 'teleological',
    };
    const record = (rubric, id, label, axis, prop, observed) => {
        if (!dataset)
            return;
        const score = prop.kind === 'evaluate' ? prop.score : prop.top.p;
        const row = { evidenceId: id, rubric, axis, label, score, source };
        if (observed !== undefined)
            row.observed = observed;
        dataset.record(row);
    };
    return async (trace) => {
        const result = { risks: [] };
        const narrationPointer = (await embeddingCache.write(trace.narration));
        // CLM contrastive trace quality: zero-shot in-domain-ness of the narration.
        const narrationEmbedding = embeddingCache.read(narrationPointer);
        const { correlationId } = trace;
        const contrastive = getContrastive?.(correlationId);
        const contrastiveQuality = narrationEmbedding
            ? contrastive?.score(narrationEmbedding, 'groundedness')
            : undefined;
        if (contrastiveQuality !== undefined)
            result.contrastiveQuality = contrastiveQuality;
        const [groundedness] = await manifold.judgeBatch(narrationPointer, [groundednessQuery], budget);
        if (groundedness && groundedness.kind === 'evaluate') {
            const g = groundedness;
            if (!g.abstained)
                result.groundedness = { score: g.score, abstained: false };
            // E4 follow-up (b): the egress-gate verdict is the groundedness ground truth
            record(HEAD_SPECS.groundedness.rubric, evidenceId('groundedness', trace.narration), labelBand(g.score, HEAD_SPECS.groundedness.levels ?? []), 'epistemic', g, trace.egress ? (trace.egress.grounded ? 1 : 0) : undefined);
        }
        // One round trip per tool call, not one per risk: embed and judge concurrently.
        const risks = await Promise.all(trace.toolCalls.map(async (call) => {
            const pointer = (await embeddingCache.write(`${call.command} ${call.success ? 'ok' : 'error'}`));
            const [risk] = await manifold.judgeBatch(pointer, [riskQuery], budget);
            return risk;
        }));
        for (const [i, call] of trace.toolCalls.entries()) {
            const risk = risks[i];
            if (risk && risk.kind === 'evaluate') {
                const r = risk;
                if (!r.abstained)
                    result.risks.push({ command: call.command, score: r.score, abstained: false });
                record(HEAD_SPECS.risk.rubric, evidenceId('risk', `${call.command}::${i}`), r.abstained ? 'abstain' : labelBand(r.score, RISK_LEVELS), 'teleological', r, call.success ? 0 : 1);
            }
        }
        return result;
    };
}
