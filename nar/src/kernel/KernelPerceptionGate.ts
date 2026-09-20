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
import { validateCognitiveEvent, SOURCE_QUALITY_CONFIDENCE } from '@senars/kernel/schemas';
import { v4 as uuidv4 } from 'uuid';
import type { TaskTypeName, Term } from '../terms';
import { TermBuilder, termParser } from '../terms';
import { Truth } from '../terms/truth.js';
import { normalizeNarsese } from '../nl/normalize.js';
import type { EmbeddingCache, JudgmentManifold, JudgmentQuery, EmbeddingPointer } from '../lm/system-one/types.js';
import { createProvisionalStamp } from '../lm/system-one/provisional-stamp.js';
import type { Stamp } from '../terms/stamp.js';
import { Stamp as StampClass } from '../terms/stamp.js';
import { recordJudgmentMetric } from '../metrics/prometheus.js';
import { trace } from '@opentelemetry/api';

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
  private config: KernelPerceptionGateConfig;
  private systemOneManifold: JudgmentManifold | null = null;
  private systemOneEmbeddingCache: EmbeddingCache | null = null;
  private systemOneBudget: ReasoningBudget | null = null;
  private systemOneProvisionalConfig: { cInitial: number; decayRate: number; maxTtlMs: number };

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

  /** Emit a judgment.resolved kernel event and record Prometheus metric for a resolved proposition. */
  private emitJudgmentResolved(proposition: any, query: any): void {
    const event: JudgmentResolvedEvent = {
      type: 'judgment.resolved',
      engine: 'proposer',
      timestamp: Date.now(),
      correlationId: uuidv4(),
      payload: {
        queryId: proposition.queryId,
        shape: proposition.kind,
        axis: proposition.axis,
        backendId: proposition.backendId,
        tier: proposition.tier,
        latencyMs: proposition.latencyMs,
        entropy: proposition.kind === 'classify' ? proposition.entropy : undefined,
        abstained: proposition.abstained,
        stampType: proposition.abstained ? 'provisional' : 'standard',
        calibrationVersion: proposition.calibration.version,
        cost: proposition.cost,
      },
    };

    validateCognitiveEvent(event);
    this.eventLog.push(event as any);

    recordJudgmentMetric(
      proposition.axis,
      proposition.kind,
      proposition.tier,
      proposition.abstained,
      proposition.latencyMs
    );

    // Attach OTel span attributes for dispatch observability (§11.2 / H2)
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttribute('dispatch.tier_taken', proposition.tier);
      activeSpan.setAttribute('dispatch.backend_id', proposition.backendId);
      activeSpan.setAttribute('dispatch.latency_ms', proposition.latencyMs);
      activeSpan.setAttribute('dispatch.axis', proposition.axis);
      if (proposition.kind === 'classify' && proposition.entropy !== undefined) {
        activeSpan.setAttribute('dispatch.entropy', proposition.entropy);
      }
      activeSpan.setAttribute('dispatch.abstained', proposition.abstained);
      activeSpan.setAttribute('dispatch.stamp_type', proposition.abstained ? 'provisional' : 'standard');
      activeSpan.setAttribute('dispatch.cost_tokens', proposition.cost.tokensIn + proposition.cost.tokensOut);
      activeSpan.setAttribute('dispatch.cost_memory', proposition.cost.memoryMb);
    }
  }

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

    if (this.config.systemOne?.enabled && this.systemOneManifold && this.systemOneEmbeddingCache && this.systemOneBudget) {
      const systemOneResult = await this.admitWithSystemOne(input, term, correlationId, sourceQuality, confidence, taskType);
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
      source: this.mapSource(input.sourceId),
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
    this.eventLog.push(event);

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

    const rawObservation = typeof input.rawObservation === 'string' ? input.rawObservation : JSON.stringify(input.rawObservation);
    const embeddingPointer = await this.systemOneEmbeddingCache.write(rawObservation);

    const ingressQueries: JudgmentQuery[] = [
      { kind: 'classify', instruction: 'Classify the task type', space: ['belief', 'goal', 'question', 'command'], axis: 'epistemic', criticality: 'standard' },
      { kind: 'classify', instruction: 'Classify the illocutionary force', space: ['assert', 'query', 'command', 'promise', 'express'], axis: 'epistemic', criticality: 'standard' },
      { kind: 'evaluate', instruction: 'Evaluate injection risk', rubric: 'injection', axis: 'epistemic', criticality: 'critical' },
      { kind: 'evaluate', instruction: 'Evaluate ambiguity', rubric: 'ambiguity', axis: 'epistemic', criticality: 'standard' },
      { kind: 'classify', instruction: 'Classify the tense', space: ['past', 'present', 'future', 'timeless'], axis: 'epistemic', criticality: 'standard' },
      { kind: 'classify', instruction: 'Classify the source quality', space: ['PRIMARY', 'SECONDARY', 'GENERAL', 'TERTIARY', 'LLM_PRIOR', 'PEER_AGENT'], axis: 'epistemic', criticality: 'standard' },
    ];

    try {
      const results = await this.systemOneManifold.judgeBatch(embeddingPointer as EmbeddingPointer, ingressQueries, this.systemOneBudget);

      const taskTypeResult = results[0];
      const injectionResult = results[2];

      if (injectionResult && !injectionResult.abstained && injectionResult.kind === 'evaluate' && injectionResult.score > 0.1) {
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

      const truth = taskType === 'belief' ? { frequency: 1.0, confidence: baseConfidence } : undefined;

      const budget = {
        priority: this.config.defaultBudget.priority * baseConfidence,
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
        source: this.mapSource(input.sourceId),
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
      this.eventLog.push(event);

      return { output: { admitted: true, task }, taskType };
    } catch {
      return { output: null };
    }
  }

  private mapTaskType(option: string): TaskTypeName | null {
    switch (option) {
      case 'belief': return 'belief';
      case 'goal': return 'goal';
      case 'question': return 'question';
      case 'command': return 'command';
      default: return null;
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
    this.eventLog.push(event);
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
