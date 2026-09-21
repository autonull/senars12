import { trace } from '@opentelemetry/api';
import type {
  CognitiveEvent,
  FormalizationBatch,
  JudgmentResolvedEvent,
  PerceptionGateInput,
  PerceptionGateOutput,
  ReasoningBudget,
  SourceQuality,
  TaskAdmittedEvent,
} from '@senars/kernel/schemas';
import { SOURCE_QUALITY_CONFIDENCE, validateCognitiveEvent } from '@senars/kernel/schemas';
import { v4 as uuidv4 } from 'uuid';
import type { DriveManager } from '../drives';
import { ingressQueries as buildIngressQueries } from '../lm/system-one/head-specs.js';
import { ConfidenceRouter } from '../lm/system-one/policy.js';
import { createProvisionalStamp } from '../lm/system-one/provisional-stamp.js';
import { seedTruth } from '../lm/system-one/seed.js';
import { createGateTelemetrySinks, createTelemetryEmitter } from '../lm/system-one/telemetry.js';
import type {
  EmbeddingCache,
  EmbeddingPointer,
  JudgmentManifold,
  JudgmentQuery,
} from '../lm/system-one/types.js';
import { recordJudgmentMetric } from '../metrics/prometheus.js';
import { normalizeNarsese } from '../nl/normalize.js';
import type { TaskTypeName, Term } from '../terms';
import { TermBuilder, termParser } from '../terms';
import type { Stamp } from '../terms/stamp.js';
import { Stamp as StampClass } from '../terms/stamp.js';
import { Truth } from '../terms/truth.js';

/** E1: ambiguity flag threshold defined once, via the shared ConfidenceRouter. */
const AMBIGUITY_ROUTER = new ConfidenceRouter({ act: 0.6, review: 0.6, block: 0 });

export interface KernelPerceptionGateConfig {
  defaultBudget: {
    priority: number;
    durability: number;
    quality: number;
    cycles: number;
    depth: number;
  };
  systemOne?: {
    enabled: boolean;
    manifold?: JudgmentManifold;
    embeddingCache?: EmbeddingCache;
    reasoningBudget?: ReasoningBudget;
    provisionalCInitial?: number;
    provisionalDecayRate?: number;
    provisionalMaxTtlMs?: number;
  };
}

export class KernelPerceptionGate {
  private eventLog: CognitiveEvent[] = [];
  private static readonly EVENT_LOG_CAPACITY = 1000;
  private config: KernelPerceptionGateConfig;
  private systemOneManifold: JudgmentManifold | null = null;
  private systemOneEmbeddingCache: EmbeddingCache | null = null;
  private systemOneBudget: ReasoningBudget | null = null;
  private systemOneProvisionalConfig: { cInitial: number; decayRate: number; maxTtlMs: number };
  /** D23: optional DriveManager hook — ambiguity stimulates curiosity. */
  private driveManager: { stimulate(driveId: string, amount: number): void } | null = null;

  /** Wire the DriveManager so ambiguity-driven curiosity stimulation works. */
  setDriveManager(dm: { stimulate(driveId: string, amount: number): void }): void {
    this.driveManager = dm;
  }

  constructor(config?: Partial<KernelPerceptionGateConfig>) {
    this.config = {
      defaultBudget: {
        priority: 0.5,
        durability: 0.8,
        quality: 0.9,
        cycles: 10,
        depth: 5,
        ...config?.defaultBudget,
      },
      systemOne: {
        enabled: false,
        ...config?.systemOne,
      },
    };

    if (this.config.systemOne?.enabled) {
      this.systemOneManifold = this.config.systemOne.manifold ?? null;
      this.systemOneEmbeddingCache = this.config.systemOne.embeddingCache ?? null;
      this.systemOneBudget = this.config.systemOne.reasoningBudget ?? {
        maxCycles: 100,
        maxDepth: 10,
        maxMemoryOps: 1000,
        maxLMCalls: 5,
        consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
      };

      // Register telemetry callback on the manifold if available.
      // Chains after any existing callback (e.g., NAR's bus emitter) instead of overwriting it.
      if (this.systemOneManifold && 'setPropositionCallback' in this.systemOneManifold) {
        const m = this.systemOneManifold as {
          setPropositionCallback: (cb: (prop: any, query: any) => void) => void;
          getPropositionCallback?: () => ((prop: any, query: any) => void) | undefined;
        };
        const previous = m.getPropositionCallback?.();
        m.setPropositionCallback((proposition, query) => {
          previous?.(proposition, query);
          this.emitJudgmentResolved(proposition, query);
        });
      }
    }

    this.systemOneProvisionalConfig = {
      cInitial: this.config.systemOne?.provisionalCInitial ?? 0.1,
      decayRate: this.config.systemOne?.provisionalDecayRate ?? 0.3,
      maxTtlMs: this.config.systemOne?.provisionalMaxTtlMs ?? 30000,
    };
  }

  #pushEvent(event: CognitiveEvent): void {
    this.eventLog.push(event);
    if (this.eventLog.length > KernelPerceptionGate.EVENT_LOG_CAPACITY)
      this.eventLog.splice(0, this.eventLog.length - KernelPerceptionGate.EVENT_LOG_CAPACITY);
  }

  private emitJudgmentResolved = createTelemetryEmitter(
    createGateTelemetrySinks({
      push: (event: unknown) => {
        this.#pushEvent(event as CognitiveEvent);
      },
    })
  );

  async admit(input: PerceptionGateInput): Promise<PerceptionGateOutput> {
    const correlationId = input.correlationId ?? uuidv4();

    const sourceQuality = input.sourceQuality;
    const confidence = this.sourceQualityToConfidence(sourceQuality) * input.sensorConfidence;

    const term = this.rawObservationToTerm(input.rawObservation);
    if (!term) {
      return {
        admitted: false,
        rejectionReason: 'Failed to parse observation into valid Narsese term',
      };
    }

    let taskType = this.inferTaskType(input.rawObservation);

    if (
      this.config.systemOne?.enabled &&
      this.systemOneManifold &&
      this.systemOneEmbeddingCache &&
      this.systemOneBudget
    ) {
      const systemOneResult = await this.admitWithSystemOne(
        input,
        term,
        correlationId,
        sourceQuality,
        confidence,
        taskType
      );
      if (systemOneResult) {
        if (systemOneResult.taskType) {
          taskType = systemOneResult.taskType;
        }
        if (systemOneResult.output) {
          return systemOneResult.output;
        }
      }
    }

    const truth = taskType === 'belief' ? { frequency: 1.0, confidence } : undefined;

    const budget = {
      priority: this.config.defaultBudget.priority * confidence,
      durability: this.config.defaultBudget.durability,
      quality: this.config.defaultBudget.quality,
      cycles: this.config.defaultBudget.cycles,
      depth: this.config.defaultBudget.depth,
    };

    const taskId = uuidv4();
    const task: TaskAdmittedEvent['payload'] = {
      taskId,
      term: term.toString(),
      taskType,
      truth,
      source: input.source ?? this.mapSource(input.sourceId),
      budget,
    };

    const event: TaskAdmittedEvent = {
      type: 'task.admitted',
      engine: 'kernel',
      timestamp: Date.now(),
      correlationId,
      payload: task,
    };

    validateCognitiveEvent(event);
    this.#pushEvent(event);

    return { admitted: true, task };
  }

  private async admitWithSystemOne(
    input: PerceptionGateInput,
    term: Term,
    correlationId: string,
    sourceQuality: SourceQuality,
    baseConfidence: number,
    initialTaskType: TaskTypeName
  ): Promise<{ output: PerceptionGateOutput | null; taskType?: TaskTypeName }> {
    if (!this.systemOneManifold || !this.systemOneEmbeddingCache || !this.systemOneBudget) {
      return { output: null };
    }

    const rawObservation =
      typeof input.rawObservation === 'string'
        ? input.rawObservation
        : JSON.stringify(input.rawObservation);
    const embeddingPointer = await this.systemOneEmbeddingCache.write(rawObservation);

    const queries: JudgmentQuery[] = buildIngressQueries();

    try {
      const results = await this.systemOneManifold.judgeBatch(
        embeddingPointer as EmbeddingPointer,
        queries,
        this.systemOneBudget
      );

      const taskTypeResult = results[0];
      const illocutionResult = results[1];
      const injectionResult = results[2];
      const ambiguityResult = results[3];
      const tenseResult = results[4];
      const sourceQualityResult = results[5];

      // Injection veto (critical safety floor)
      if (
        injectionResult &&
        !injectionResult.abstained &&
        injectionResult.kind === 'evaluate' &&
        injectionResult.score > 0.1
      ) {
        return {
          output: {
            admitted: false,
            rejectionReason: `Injection attack detected (score: ${injectionResult.score.toFixed(2)})`,
          },
        };
      }

      let taskType = initialTaskType;
      if (taskTypeResult && !taskTypeResult.abstained && taskTypeResult.kind === 'classify') {
        const mappedTaskType = this.mapTaskType(taskTypeResult.top.option);
        if (mappedTaskType) {
          taskType = mappedTaskType;
        }
      }

      // Illocution: store for FormalizationBatch flags (consumer will read from result)
      const illocution =
        illocutionResult && !illocutionResult.abstained && illocutionResult.kind === 'classify'
          ? illocutionResult.top.option
          : 'assert';

      // Ambiguity: if abstained or high ambiguity, inject question task and stimulate curiosity
      // (E1: single threshold definition site via ConfidenceRouter — act band = flag threshold)
      let ambiguityFlag = false;
      if (ambiguityResult && ambiguityResult.kind === 'evaluate') {
        const decision = AMBIGUITY_ROUTER.route(ambiguityResult);
        if (decision === 'abstain' || decision === 'act') {
          ambiguityFlag = true;
          // D23 (TODO17b): ambiguity stimulates curiosity via the DriveManager
          // hook (wired by the NAR at init) — closes the TODO16c A4 gap.
          this.driveManager?.stimulate('curiosity', 1);
        }
      }

      // Tense: map to occurrenceTime anchor
      let occurrenceTime: number | undefined;
      if (tenseResult && !tenseResult.abstained && tenseResult.kind === 'classify') {
        const tense = tenseResult.top.option;
        const now = Date.now();
        switch (tense) {
          case 'past':
            occurrenceTime = now - 86_400_000;
            break; // ~1 day ago
          case 'future':
            occurrenceTime = now + 86_400_000;
            break; // ~1 day ahead
          case 'present':
            occurrenceTime = now;
            break;
          case 'timeless':
            occurrenceTime = undefined;
            break;
        }
      }

      // Source quality: override confidence ceiling for admission
      let admissionSourceQuality: SourceQuality = sourceQuality;
      if (
        sourceQualityResult &&
        !sourceQualityResult.abstained &&
        sourceQualityResult.kind === 'classify'
      ) {
        const mapped = this.mapSourceQuality(sourceQualityResult.top.option);
        if (mapped) admissionSourceQuality = mapped;
      }
      const admissionConfidence =
        SOURCE_QUALITY_CONFIDENCE[admissionSourceQuality] ?? baseConfidence;

      // Admission truth computed via seedTruth using the task_type proposition (as the primary epistemic judgment)
      const seedProposition =
        taskTypeResult && !taskTypeResult.abstained && taskTypeResult.kind === 'classify'
          ? taskTypeResult
          : (results[0] ??
            ({
              kind: 'classify' as const,
              top: { option: 'belief', p: 1 },
              calibration: { version: 'v1.0.0', ece: 0 },
            } as any));
      const admissionTruth = seedTruth(seedProposition, admissionSourceQuality);

      const budget = {
        priority: this.config.defaultBudget.priority * admissionConfidence,
        durability: this.config.defaultBudget.durability,
        quality: this.config.defaultBudget.quality,
        cycles: this.config.defaultBudget.cycles,
        depth: this.config.defaultBudget.depth,
      };

      const taskId = uuidv4();
      const task: TaskAdmittedEvent['payload'] = {
        taskId,
        term: term.toString(),
        taskType,
        truth: { frequency: admissionTruth.f, confidence: admissionTruth.c },
        source: input.source ?? this.mapSource(input.sourceId),
        budget,
      };

      const event: TaskAdmittedEvent = {
        type: 'task.admitted',
        engine: 'kernel',
        timestamp: Date.now(),
        correlationId,
        payload: task,
      };

      validateCognitiveEvent(event);
      this.#pushEvent(event);

      return { output: { admitted: true, task }, taskType };
    } catch (error) {
      // Fail-closed (D1): a System One fault must never bypass the injection
      // veto via legacy admission — reject and emit ingress-error telemetry.
      this.#pushEvent({
        type: 'policy.violation',
        engine: 'kernel',
        timestamp: Date.now(),
        correlationId,
        payload: {
          policyId: 'systemone-ingress',
          violationType: 'epistemic-firewall',
          detail: `systemone_ingress_error: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'block',
        },
      } as CognitiveEvent);
      return {
        output: {
          admitted: false,
          rejectionReason: 'System One ingress fault: admission rejected (fail-closed)',
        },
      };
    }
  }

  private mapTaskType(option: string): TaskTypeName | null {
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

  private sourceQualityToConfidence(quality: SourceQuality): number {
    return SOURCE_QUALITY_CONFIDENCE[quality] ?? 0.5;
  }

  private mapSource(sourceId: string): TaskAdmittedEvent['payload']['source'] {
    if (sourceId.includes('user') || sourceId.includes('cli') || sourceId.includes('irc'))
      return 'user';
    if (sourceId.includes('llm') || sourceId.includes('lm')) return 'llm';
    if (sourceId.includes('derivation') || sourceId.includes('inference')) return 'derivation';
    if (sourceId.includes('reflex') || sourceId.includes('game')) return 'reflex';
    if (sourceId.includes('sensor') || sourceId.includes('perception')) return 'sensor';
    return 'user';
  }

  private mapSourceQuality(option: string): SourceQuality | null {
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

  private parseTaskTolerant(text: string): ReturnType<typeof termParser.parseTask> {
    return (
      termParser.parseTask(text) ??
      termParser.parseTask(`${text}.`) ??
      termParser.parseTask(`${text}?`) ??
      termParser.parseTask(`${text}!`)
    );
  }

  private inferTaskType(observation: unknown): TaskTypeName {
    if (typeof observation === 'string') {
      const parsed = this.parseTaskTolerant(observation);
      if (parsed) return parsed.taskType;
    }
    if (observation && typeof observation === 'object' && 'type' in observation) {
      const t = (observation as { type?: string }).type;
      if (t === 'goal') return 'goal';
      if (t === 'question') return 'question';
      if (t === 'command') return 'command';
    }
    return 'belief';
  }

  private rawObservationToTerm(observation: unknown): Term | null {
    if (typeof observation === 'string') {
      return this.parseTaskTolerant(observation)?.term ?? null;
    }
    if (observation && typeof observation === 'object') {
      if ('term' in observation && typeof (observation as { term: string }).term === 'string') {
        return this.parseTaskTolerant((observation as { term: string }).term)?.term ?? null;
      }
      if ('kind' in observation) {
        return observation as Term;
      }
    }
    return null;
  }

  admitTask(
    term: Term,
    taskType: TaskTypeName,
    truth?: { frequency: number; confidence: number } | { f: number; c: number },
    source = 'derivation',
    correlationId?: string
  ): PerceptionGateOutput {
    const cid = correlationId ?? uuidv4();
    const normalized = truth
      ? 'frequency' in truth
        ? truth
        : { frequency: truth.f, confidence: truth.c }
      : undefined;
    const confidence = normalized?.confidence ?? 0.5;
    const budget = {
      priority: this.config.defaultBudget.priority * confidence,
      durability: this.config.defaultBudget.durability,
      quality: this.config.defaultBudget.quality,
      cycles: this.config.defaultBudget.cycles,
      depth: this.config.defaultBudget.depth,
    };
    const task: TaskAdmittedEvent['payload'] = {
      taskId: uuidv4(),
      term: term.toString(),
      taskType,
      ...(normalized ? { truth: normalized } : {}),
      source: this.mapSource(source),
      budget,
    };
    const event: TaskAdmittedEvent = {
      type: 'task.admitted',
      engine: 'kernel',
      timestamp: Date.now(),
      correlationId: cid,
      payload: task,
    };
    validateCognitiveEvent(event);
    this.#pushEvent(event);
    return { admitted: true, task };
  }

  admitFormalization(
    batch: FormalizationBatch,
    sourceQuality: SourceQuality = 'LLM_PRIOR'
  ): {
    admitted: TaskAdmittedEvent['payload'][];
    rejected: { candidateId: string; reason: string }[];
  } {
    const admitted: TaskAdmittedEvent['payload'][] = [];
    const rejected: { candidateId: string; reason: string }[] = [];
    for (const candidate of batch.candidates) {
      const narsese = normalizeNarsese(candidate.narsese);
      const parsed = termParser.parseTask(
        candidate.taskType === 'belief'
          ? `${narsese}.`
          : candidate.taskType === 'goal'
            ? `${narsese}!`
            : `${narsese}?`
      );
      if (!parsed) {
        rejected.push({ candidateId: candidate.candidateId, reason: 'Unparseable Narsese' });
        continue;
      }
      const confidence =
        (candidate.truth?.confidence ?? candidate.confidence) *
        this.sourceQualityToConfidence(sourceQuality);
      const out = this.admitTask(
        parsed.term,
        candidate.taskType,
        candidate.truth
          ? { frequency: candidate.truth.frequency, confidence }
          : { frequency: 1.0, confidence },
        'llm'
      );
      if (out.admitted && out.task) admitted.push(out.task);
      else
        rejected.push({
          candidateId: candidate.candidateId,
          reason: out.rejectionReason ?? 'Gate rejected',
        });
    }
    return { admitted, rejected };
  }

  getEventLog(): ReadonlyArray<CognitiveEvent> {
    return this.eventLog;
  }

  clearEventLog(): void {
    this.eventLog = [];
  }
}
