import type {
  CognitiveEvent,
  FormalizationBatch,
  PerceptionGateInput,
  PerceptionGateOutput,
  SourceQuality,
  TaskAdmittedEvent,
} from '@senars/kernel/schemas';
import { SOURCE_QUALITY_CONFIDENCE, validateCognitiveEvent } from '@senars/kernel/schemas';
import { v4 as uuidv4 } from 'uuid';
import { normalizeNarsese } from '../nl/normalize.js';
import { recordGateDecision } from '../telemetry/index.js';
import type { TaskTypeName, Term } from '../terms';
import { termParser } from '../terms';
import type { IngressJudge, IngressVerdict } from './ingress.js';
import type { SourceReputation } from './source-reputation.js';

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
    /** X2 (TODO20): injected ingress judge — kernel never imports proposer internals. */
    judge?: IngressJudge;
  };
  /** Phase E (REFACTOR.todo1): optional source-reputation ceiling (trust-not-truth). */
  reputation?: SourceReputation;
}

export class KernelPerceptionGate {
  private eventLog: CognitiveEvent[] = [];
  private static readonly EVENT_LOG_CAPACITY = 1000;
  private config: KernelPerceptionGateConfig;
  private judge: IngressJudge | null = null;
  /** D23: optional DriveManager hook — ambiguity stimulates curiosity. */
  private driveManager: { stimulate(driveId: string, amount: number): void } | null = null;

  /** Wire the DriveManager so ambiguity-driven curiosity stimulation works. */
  setDriveManager(dm: { stimulate(driveId: string, amount: number): void }): void {
    this.driveManager = dm;
  }

  /** Phase E: attach source reputation (trust ceiling multiplier) post-construction. */
  setReputation(reputation: SourceReputation): void {
    this.config.reputation = reputation;
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

    if (this.config.systemOne?.enabled && this.config.systemOne.judge) {
      this.judge = this.config.systemOne.judge;
      // Judgment-resolved telemetry flows into the gate's event log via the judge.
      this.judge.setEventSink?.((event) => {
        this.#pushEvent(event as CognitiveEvent);
      });
    }
  }

  #pushEvent(event: CognitiveEvent): void {
    this.eventLog.push(event);
    if (this.eventLog.length > KernelPerceptionGate.EVENT_LOG_CAPACITY)
      this.eventLog.splice(0, this.eventLog.length - KernelPerceptionGate.EVENT_LOG_CAPACITY);
  }

  async admit(input: PerceptionGateInput): Promise<PerceptionGateOutput> {
    const correlationId = input.correlationId ?? uuidv4();

    const sourceQuality = input.sourceQuality;
    // Phase E: reputation multiplier lowers the trust ceiling for sources with
    // a contradiction-dominated track record; default (no record) is neutral.
    const reputationCeiling = this.config.reputation
      ? this.config.reputation.effectiveCeiling(
          this.sourceQualityToConfidence(sourceQuality),
          input.sourceId
        )
      : this.sourceQualityToConfidence(sourceQuality);
    const confidence = reputationCeiling * input.sensorConfidence;

    const term = this.rawObservationToTerm(input.rawObservation);
    if (!term) {
      return {
        admitted: false,
        rejectionReason: 'Failed to parse observation into valid Narsese term',
      };
    }

    const taskType = this.inferTaskType(input.rawObservation);

    if (this.config.systemOne?.enabled && this.judge) {
      const judged = await this.admitViaJudge(
        input,
        term,
        correlationId,
        sourceQuality,
        confidence,
        taskType
      );
      if (judged) return judged;
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

  private async admitViaJudge(
    input: PerceptionGateInput,
    term: Term,
    correlationId: string,
    sourceQuality: SourceQuality,
    baseConfidence: number,
    initialTaskType: TaskTypeName
  ): Promise<PerceptionGateOutput | null> {
    const rawObservation =
      typeof input.rawObservation === 'string'
        ? input.rawObservation
        : JSON.stringify(input.rawObservation);

    let verdict: IngressVerdict;
    try {
      verdict = await this.judge!.judge({
        rawObservation,
        sourceQuality,
        baseConfidence,
        taskType: initialTaskType,
      });
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
        admitted: false,
        rejectionReason: 'System One ingress fault: admission rejected (fail-closed)',
      };
    }

    if (verdict.vetoReason) return { admitted: false, rejectionReason: verdict.vetoReason };

    const taskType = verdict.taskType ?? initialTaskType;

    // D23 (TODO17b): ambiguity stimulates curiosity via the DriveManager
    // hook (wired by the NAR at init) — closes the TODO16c A4 gap.
    if (verdict.ambiguityFlag) this.driveManager?.stimulate('curiosity', 1);

    const budget = {
      priority: this.config.defaultBudget.priority * verdict.confidence,
      durability: this.config.defaultBudget.durability,
      quality: this.config.defaultBudget.quality,
      cycles: this.config.defaultBudget.cycles,
      depth: this.config.defaultBudget.depth,
    };

    const task: TaskAdmittedEvent['payload'] = {
      taskId: uuidv4(),
      term: term.toString(),
      taskType,
      truth: { frequency: verdict.truth.f, confidence: verdict.truth.c },
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
    const out = this.decideAdmission(term, taskType, truth, source, correlationId);
    recordGateDecision('perception', 'admitTask', out.admitted, out.rejectionReason);
    return out;
  }

  private decideAdmission(
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
      const out = this.decideAdmission(
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
