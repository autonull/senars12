import { createHash } from 'node:crypto';
import { HEAD_SPECS, specToQuery } from './head-specs.js';
import type {
  JudgmentManifold,
  JudgmentQuery,
  JudgmentProposition,
  EmbeddingCache,
  EmbeddingPointer,
  EvaluateProposition,
} from './types.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { JudgmentDataset, DistillationLabel } from './distill.js';

/** A completed tool execution observed in the agent trace (E4 agent-trace grading). */
export interface TracedToolCall {
  command: string;
  success: boolean;
}

export interface TraceGradeInput {
  narration: string;
  toolCalls: readonly TracedToolCall[];
  correlationId?: string;
}

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
}

export interface TraceGraderOptions {
  manifold: JudgmentManifold;
  embeddingCache: EmbeddingCache;
  /** Labels recorded per graded trace element when supplied (hash-only rows). */
  dataset?: JudgmentDataset;
  budget?: ReasoningBudget;
  source?: string;
}

const RISK_LEVELS: readonly string[] = HEAD_SPECS.risk.space ?? [];

const DEFAULT_BUDGET: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const evidenceId = (kind: string, text: string): string =>
  createHash('sha256').update(`trace::${kind}::${text}`).digest('hex');

const labelBand = (score: number, levels: readonly string[]): string => {
  if (!levels.length) return score.toFixed(2);
  const idx = Math.min(levels.length - 1, Math.max(0, Math.round(score * (levels.length - 1))));
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
export function createTraceGrader(options: TraceGraderOptions) {
  const { manifold, embeddingCache, dataset, budget = DEFAULT_BUDGET, source = 'trace-grading' } = options;
  const groundednessQuery = specToQuery(HEAD_SPECS.groundedness);
  const riskQuery: JudgmentQuery = {
    kind: 'evaluate',
    instruction: HEAD_SPECS.risk.instruction,
    rubric: 'risk',
    axis: 'teleological',
  };

  const record = (
    rubric: string,
    id: string,
    label: string,
    axis: string,
    prop: JudgmentProposition,
    observed?: number
  ): void => {
    if (!dataset) return;
    const score = prop.kind === 'evaluate' ? prop.score : prop.top.p;
    const row: DistillationLabel = { evidenceId: id, rubric, axis, label, score, source };
    if (observed !== undefined) row.observed = observed;
    dataset.record(row);
  };

  return async (trace: TraceGradeInput): Promise<TraceGradeResult> => {
    const result: TraceGradeResult = { risks: [] };
    const narrationPointer = (await embeddingCache.write(trace.narration)) as EmbeddingPointer;

    const [groundedness] = await manifold.judgeBatch(narrationPointer, [groundednessQuery], budget);
    if (groundedness && groundedness.kind === 'evaluate') {
      const g = groundedness as EvaluateProposition;
      if (!g.abstained) result.groundedness = { score: g.score, abstained: false };
      record(
        HEAD_SPECS.groundedness.rubric,
        evidenceId('groundedness', trace.narration),
        labelBand(g.score, HEAD_SPECS.groundedness.levels ?? []),
        'epistemic',
        g
      );
    }

    for (const [i, call] of trace.toolCalls.entries()) {
      const callPointer = (await embeddingCache.write(`${call.command} ${call.success ? 'ok' : 'error'}`)) as EmbeddingPointer;
      const [risk] = await manifold.judgeBatch(callPointer, [riskQuery], budget);
      if (risk && risk.kind === 'evaluate') {
        const r = risk as EvaluateProposition;
        if (!r.abstained) result.risks.push({ command: call.command, score: r.score, abstained: false });
        record(
          HEAD_SPECS.risk.rubric,
          evidenceId('risk', `${call.command}::${i}`),
          r.abstained ? 'abstain' : labelBand(r.score, RISK_LEVELS),
          'teleological',
          r,
          call.success ? 0 : 1
        );
      }
    }

    return result;
  };
}
