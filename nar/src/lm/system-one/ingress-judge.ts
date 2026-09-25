import type { SourceQuality } from '@senars/kernel/schemas';
import { SOURCE_QUALITY_CONFIDENCE } from '@senars/kernel/schemas';
import type { IngressJudge, IngressJudgmentRequest, IngressVerdict } from '../../kernel/ingress.js';
import type { TaskTypeName } from '../../terms';
import { ingressQueries } from './head-specs.js';
import { type ConfidenceBands, ConfidenceRouter } from './policy.js';
import { seedTruth } from './seed.js';
import { createGateTelemetrySinks, createTelemetryEmitter } from './telemetry.js';
import type {
  EmbeddingCache,
  EmbeddingPointer,
  JudgmentManifold,
  JudgmentProposition,
} from './types.js';

/** E1: ambiguity flag threshold defined once, via the shared ConfidenceRouter. */
const AMBIGUITY_ROUTER = new ConfidenceRouter({ act: 0.6, review: 0.6, block: 0 });

export interface SystemOneIngressJudgeConfig {
  manifold: JudgmentManifold;
  embeddingCache: EmbeddingCache;
  budget: {
    maxCycles: number;
    maxDepth: number;
    maxMemoryOps: number;
    maxLMCalls: number;
    consumed: { cycles: number; depth: number; memoryOps: number; llmCalls: number };
  };
  ambiguityBands?: ConfidenceBands;
  /** Phase E (REFACTOR.todo1): lazy source-reputation lookup (trust-not-truth ceiling). */
  reputation?: () => { effectiveCeiling(base: number, key: string): number } | undefined;
  /** Reputation key for this judge's admissions (default 'system-one'). */
  sourceKey?: string;
}

/**
 * X2 (TODO20): System One ingress judge — the proposer-side half of the epistemic
 * firewall. Judges a batch of ingress heads and returns typed verdicts; faults
 * propagate so `KernelPerceptionGate` can fail closed (D1).
 */
export class SystemOneIngressJudge implements IngressJudge {
  private readonly manifold: JudgmentManifold;
  private readonly embeddingCache: EmbeddingCache;
  private readonly budget: SystemOneIngressJudgeConfig['budget'];
  private readonly ambiguityRouter: ConfidenceRouter;
  private readonly reputation?: () =>
    | { effectiveCeiling(base: number, key: string): number }
    | undefined;
  private readonly sourceKey?: string;
  private emitJudgmentResolved: ReturnType<typeof createTelemetryEmitter>;

  constructor(config: SystemOneIngressJudgeConfig) {
    this.manifold = config.manifold;
    this.embeddingCache = config.embeddingCache;
    this.budget = config.budget;
    this.ambiguityRouter = config.ambiguityBands
      ? new ConfidenceRouter(config.ambiguityBands)
      : AMBIGUITY_ROUTER;
    this.reputation = config.reputation;
    this.sourceKey = config.sourceKey;

    // Register telemetry callback on the manifold if available.
    // Chains after any existing callback (e.g., NAR's bus emitter) instead of overwriting it.
    if ('setPropositionCallback' in this.manifold) {
      const m = this.manifold as {
        setPropositionCallback: (cb: (prop: any, query: any) => void) => void;
        getPropositionCallback?: () => ((prop: any, query: any) => void) | undefined;
      };
      const previous = m.getPropositionCallback?.();
      m.setPropositionCallback((proposition, query) => {
        previous?.(proposition, query);
        this.emitJudgmentResolved(proposition, query);
      });
    }

    this.emitJudgmentResolved = createTelemetryEmitter({});
  }

  setEventSink(push: (event: unknown) => void): void {
    this.emitJudgmentResolved = createTelemetryEmitter(createGateTelemetrySinks({ push }));
  }

  async judge(request: IngressJudgmentRequest): Promise<IngressVerdict> {
    const embeddingPointer = await this.embeddingCache.write(request.rawObservation);
    const results = await this.manifold.judgeBatch(
      embeddingPointer as EmbeddingPointer,
      ingressQueries(),
      this.budget
    );

    const taskTypeResult = results[0];
    const injectionResult = results[2];
    const ambiguityResult = results[3];
    const sourceQualityResult = results[5];

    // Injection veto (critical safety floor)
    if (
      injectionResult &&
      !injectionResult.abstained &&
      injectionResult.kind === 'evaluate' &&
      injectionResult.score > 0.1
    ) {
      return {
        vetoReason: `Injection attack detected (score: ${injectionResult.score.toFixed(2)})`,
        confidence: 0,
        truth: { f: 0, c: 0 },
      };
    }

    let taskType = request.taskType;
    if (taskTypeResult && !taskTypeResult.abstained && taskTypeResult.kind === 'classify') {
      const mappedTaskType = mapTaskType(taskTypeResult.top.option);
      if (mappedTaskType) taskType = mappedTaskType;
    }

    // Ambiguity: abstained or high ambiguity flags the verdict; the gate
    // routes it to the curiosity drive (D23, TODO17b).
    let ambiguityFlag = false;
    if (ambiguityResult && ambiguityResult.kind === 'evaluate') {
      const decision = this.ambiguityRouter.route(ambiguityResult);
      if (decision === 'abstain' || decision === 'act') ambiguityFlag = true;
    }

    // Source quality: override confidence ceiling for admission
    let admissionSourceQuality: SourceQuality = request.sourceQuality;
    if (
      sourceQualityResult &&
      !sourceQualityResult.abstained &&
      sourceQualityResult.kind === 'classify'
    ) {
      const mapped = mapSourceQuality(sourceQualityResult.top.option);
      if (mapped) admissionSourceQuality = mapped;
    }
    const admissionConfidence =
      SOURCE_QUALITY_CONFIDENCE[admissionSourceQuality] ?? request.baseConfidence;

    // Admission truth computed via seedTruth using the task_type proposition (as the primary epistemic judgment)
    const seedProposition =
      taskTypeResult && !taskTypeResult.abstained && taskTypeResult.kind === 'classify'
        ? taskTypeResult
        : (results[0] ??
          ({
            kind: 'classify' as const,
            top: { option: 'belief', p: 1 },
            calibration: { version: 'v1.0.0', ece: 0 },
          } as JudgmentProposition));
    const admissionTruth = seedTruth(
      seedProposition,
      admissionSourceQuality,
      this.reputation?.(),
      this.sourceKey ?? 'system-one'
    );

    return {
      taskType,
      ambiguityFlag,
      sourceQuality: admissionSourceQuality,
      confidence: admissionConfidence,
      truth: { f: admissionTruth.f, c: admissionTruth.c },
    };
  }
}

function mapTaskType(option: string): TaskTypeName | null {
  switch (option) {
    case 'belief':
      return 'belief';
    case 'goal':
      return 'goal';
    case 'question':
      return 'question';
    case 'command':
      return 'command';
    default:
      return null;
  }
}

function mapSourceQuality(option: string): SourceQuality | null {
  switch (option) {
    case 'PRIMARY':
      return 'PRIMARY';
    case 'SECONDARY':
      return 'SECONDARY';
    case 'GENERAL':
      return 'GENERAL';
    case 'TERTIARY':
      return 'TERTIARY';
    case 'LLM_PRIOR':
      return 'LLM_PRIOR';
    case 'PEER_AGENT':
      return 'PEER_AGENT';
    default:
      return null;
  }
}
