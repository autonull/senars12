import type { ReasoningBudget } from '@senars/schemas';
import type { ContrastiveMemory } from './contrastive';
import type { JudgmentDataset } from './distill';
import type { EmbeddingCache, JudgmentManifold } from './types';
import type { AgentTrace } from '@senars/types/cognitive';
/** The graded cycle. `AgentTrace` is `util`'s record; the grader adds no fields. */
export type TraceGradeInput = AgentTrace;
export interface TraceGroundednessGrade {
    score: number;
    abstained: boolean;
}
export interface TraceRiskGrade {
    command: string;
    score: number;
    abstained: boolean;
}
export interface TraceGradeResult {
    groundedness?: TraceGroundednessGrade;
    risks: TraceRiskGrade[];
    /** CLM contrastive quality: in-domain-ness of the narration (0..1, undefined when no exemplars). */
    contrastiveQuality?: number;
}
export interface TraceGraderOptions {
    manifold: JudgmentManifold;
    embeddingCache: EmbeddingCache;
    /** Labels recorded per graded trace element when supplied (hash-only rows). */
    dataset?: JudgmentDataset;
    budget?: ReasoningBudget;
    source?: string;
    /** CLM contrastive memory factory: returns per-correlationId contrastive memory for isolation. */
    getContrastive?: (correlationId: string) => ContrastiveMemory;
}
/**
 * E4 agent-trace grading: after a cycle completes, grade the narration with the
 * `groundedness` head and each executed tool call with the `risk` head — one
 * joint judgeBatch on the shared narration embedding (same evaluate-with-rubric
 * convention as ManifoldRLAgent). Grades flow into `JudgmentDataset` as
 * hash-only labels; tool success is the ground-truth `observed` for the risk
 * rubric, feeding the distillation flywheel.
 */
export declare function createTraceGrader(options: TraceGraderOptions): (trace: TraceGradeInput) => Promise<TraceGradeResult>;
//# sourceMappingURL=trace-grader.d.ts.map