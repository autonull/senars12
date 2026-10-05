import type {
  Budget,
  CognitiveEvent,
  FormalizationBatch,
  GateOutcome,
  PerceptionGateInput,
  PerceptionGateOutput,
  ShadowValidationDropEvent,
  SourceQuality,
  TaskAdmittedEvent,
} from '@senars/core/schemas';
import {
  mintCognitiveEvent,
  SOURCE_QUALITY_CONFIDENCE,
  TASK_PUNCTUATION,
  TOLERANT_PUNCTUATIONS,
} from '@senars/core/schemas';
import {
  asBeliefTruth,
  errMsg,
  makeId,
  TimeoutError,
  type TruthLike,
  withDeadline,
} from '@senars/util';
import { normalizeNarsese } from '../nl/normalize.js';
import { recordGateDecision } from '../telemetry/index.js';
import type { TaskTypeName, Term } from '../terms';
import { termParser } from '../terms';
import { recordPolicyViolation } from './event-ring.js';
import { KernelGate, projectOutcome } from './gate-base.js';
import type { IngressJudge, IngressVerdict } from './ingress.js';
import { domainKey } from './reputation-keys.js';
import type { SourceReputation } from './source-reputation.js';

export interface KernelPerceptionGateConfig {
  defaultBudget: Budget;
  systemOne?: {
    enabled: boolean;
    /** X2 (TODO20): injected ingress judge — kernel never imports proposer internals. */
    judge?: IngressJudge;
    /**
     * The bound on the judge. A judgment that misses it takes the same
     * fail-closed path a fault takes: judging an untrusted observation is
     * gating, and degrading to unjudged admission on expiry would bypass the
     * very veto the judge exists to apply (TODO29.a §5.1 step 7).
     */
    judgeTimeoutMs?: number;
  };
  /** Phase E (REFACTOR.todo1): optional source-reputation ceiling (trust-not-truth). */
  reputation?: SourceReputation;
}

/** The bound on the ingress judgment when config declares none. */
const DEFAULT_JUDGE_TIMEOUT_MS = 2000;

export class KernelPerceptionGate extends KernelGate {
  private config: KernelPerceptionGateConfig;
  private judge: IngressJudge | null = null;
  /** D23: optional DriveManager hook — ambiguity stimulates curiosity. */
  private driveManager: { stimulate(driveId: string, amount: number): void } | null = null;

  protected override outcomeOf(output: unknown): GateOutcome {
    return projectOutcome<PerceptionGateOutput>(
      output,
      (o) => o.admitted,
      (o) => o.rejectionReason
    );
  }

  /** Wire the DriveManager so ambiguity-driven curiosity stimulation works. */
  setDriveManager(dm: { stimulate(driveId: string, amount: number): void }): void {
    this.driveManager = dm;
  }

  /** Phase E: attach source reputation (trust ceiling multiplier) post-construction. */
  setReputation(reputation: SourceReputation): void {
    this.config.reputation = reputation;
  }

  constructor(config?: Partial<KernelPerceptionGateConfig>) {
    super();
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

  /** One refusal for both judge faults and judge deadlines. */
  private judgeFault(
    correlationId: string,
    detail: string,
    kind: 'error' | 'timeout'
  ): PerceptionGateOutput {
    recordPolicyViolation(this.eventLog, {
      policyId: 'systemone-ingress',
      violationType: 'epistemic-firewall',
      detail: `systemone_ingress_${kind}: ${detail}`,
      correlationId,
    });
    // recordGateDecision is called by decideAndRecord after this returns
    return {
      admitted: false,
      rejectionReason: 'System One ingress fault: admission rejected (fail-closed)',
    };
  }

  #pushEvent(event: CognitiveEvent): void {
    this.eventLog.push(event);
  }

  /** Emit a shadow validation drop event to the gate's event log. */
  emitShadowValidationDrop(event: ShadowValidationDropEvent): void {
    this.#pushEvent(event as CognitiveEvent);
  }

  async admit(input: PerceptionGateInput): Promise<PerceptionGateOutput> {
    return this.decideAndRecord(
      'perception',
      'admit',
      input,
      async (inp, correlation) => this.decideAdmission(inp, correlation),
      (inp) => inp.correlationId
    );
  }

  private async decideAdmission(
    input: PerceptionGateInput,
    correlation: () => string
  ): Promise<PerceptionGateOutput> {
    const sourceQuality = input.sourceQuality;
    // Phase E: reputation multiplier lowers the trust ceiling for sources with
    // a contradiction-dominated track record; default (no record) is neutral.
    // Phase E (REFACTOR.todo2): URL-bearing source ids key by `domain:<host>`;
    // plain ids keep their exact id (legacy fallback, R6).
    const reputationKey = domainKey(input.sourceId) ?? input.sourceId;
    const reputationCeiling = this.config.reputation
      ? this.config.reputation.effectiveCeiling(
          this.sourceQualityToConfidence(sourceQuality),
          reputationKey
        )
      : this.sourceQualityToConfidence(sourceQuality);
    const confidence = reputationCeiling * input.sensorConfidence;

    const observation = this.parseObservation(input.rawObservation);
    if (!observation.term) {
      return {
        admitted: false,
        rejectionReason: 'Failed to parse observation into valid Narsese term',
      };
    }

    const { term, taskType } = observation;

    if (this.config.systemOne?.enabled && this.judge) {
      const judged = await this.admitViaJudge(
        input,
        term,
        correlation(),
        sourceQuality,
        confidence,
        taskType
      );
      if (judged) return judged;
    }

    return this.emitAdmitted({
      term,
      taskType,
      truth: taskType === 'belief' ? { frequency: 1.0, confidence } : undefined,
      source: input.source ?? this.mapSource(input.sourceId),
      confidence,
      correlationId: correlation(),
    });
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

    const timeoutMs = this.config.systemOne?.judgeTimeoutMs ?? DEFAULT_JUDGE_TIMEOUT_MS;
    let verdict: IngressVerdict;
    try {
      // The signal is an ask, not the bound: a judge that ignores it is still
      // bounded by the deadline, and one that honours it stops costing anything.
      verdict = await withDeadline(
        (signal) =>
          this.judge!.judge({
            rawObservation,
            sourceQuality,
            baseConfidence,
            taskType: initialTaskType,
            signal,
          }),
        timeoutMs
      );
    } catch (error) {
      // Fail-closed (D1): a System One fault must never bypass the injection
      // veto via legacy admission — reject and emit ingress-error telemetry. A
      // deadline is reported as such rather than as a fault: only one of the two
      // is worth retrying.
      const expired = error instanceof TimeoutError;
      return this.judgeFault(
        correlationId,
        expired ? `judge exceeded ${timeoutMs}ms` : errMsg(error),
        expired ? 'timeout' : 'error'
      );
    }

    if (verdict.vetoReason) {
      // recordGateDecision is called by decideAndRecord after this returns
      return { admitted: false, rejectionReason: verdict.vetoReason };
    }

    const taskType = verdict.taskType ?? initialTaskType;

    // D23 (TODO17b): ambiguity stimulates curiosity via the DriveManager
    // hook (wired by the NAR at init) — closes the TODO16c A4 gap.
    if (verdict.ambiguityFlag) this.driveManager?.stimulate('curiosity', 1);

    return this.emitAdmitted({
      term,
      taskType,
      truth: verdict.truth,
      source: input.source ?? this.mapSource(input.sourceId),
      confidence: verdict.confidence,
      correlationId,
    });
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
    for (const punctuation of TOLERANT_PUNCTUATIONS) {
      const parsed = termParser.parseTask(`${text}${punctuation}`);
      if (parsed) return parsed;
    }
    return null;
  }

  /**
   * One parse, both answers. A string observation was parsed by `parseTask` up to
   * four times per admission — once to reach the term and again to reach the task
   * type, off the same text — so the text is read once here and each reader of the
   * result takes what it needs.
   */
  private parseObservation(observation: unknown): { term: Term | null; taskType: TaskTypeName } {
    if (typeof observation === 'string') {
      const parsed = this.parseTaskTolerant(observation);
      return { term: parsed?.term ?? null, taskType: parsed?.taskType ?? 'belief' };
    }
    if (observation && typeof observation === 'object') {
      const term =
        'term' in observation && typeof (observation as { term: string }).term === 'string'
          ? (this.parseTaskTolerant((observation as { term: string }).term)?.term ?? null)
          : 'kind' in observation
            ? (observation as Term)
            : null;
      const declared = (observation as { type?: string }).type;
      return {
        term,
        taskType:
          declared === 'goal' || declared === 'question' || declared === 'command'
            ? declared
            : 'belief',
      };
    }
    return { term: null, taskType: 'belief' };
  }

  admitTask(
    term: Term,
    taskType: TaskTypeName,
    truth?: TruthLike,
    source = 'derivation',
    correlationId?: string
  ): PerceptionGateOutput {
    return this.decideAndRecord(
      'perception',
      'admitTask',
      { term, taskType, truth, source, correlationId },
      ({ term, taskType, truth, source }, admitCorrelation) =>
        this.decideTaskAdmission(term, taskType, truth, source, admitCorrelation),
      ({ correlationId }) => correlationId
    );
  }

  private decideTaskAdmission(
    term: Term,
    taskType: TaskTypeName,
    truth: TruthLike | undefined,
    source: string,
    correlation: () => string
  ): PerceptionGateOutput {
    const normalized = asBeliefTruth(truth);
    return this.emitAdmitted({
      term,
      taskType,
      truth: normalized,
      source: this.mapSource(source),
      confidence: normalized?.confidence ?? 0.5,
      correlationId: correlation(),
    });
  }

  /**
   * The single admission path: budget derivation, `task.admitted` construction,
   * schema validation, and event push. Every gate entry point funnels here.
   */
  private emitAdmitted(params: {
    term: Term;
    taskType: TaskTypeName;
    truth?: TruthLike;
    source: TaskAdmittedEvent['payload']['source'];
    confidence: number;
    correlationId: string;
  }): PerceptionGateOutput {
    const { term, taskType, truth, source, confidence, correlationId } = params;
    const defaults = this.config.defaultBudget;
    const task: TaskAdmittedEvent['payload'] = {
      taskId: makeId(),
      term: term.toString(),
      taskType,
      ...(truth ? { truth: asBeliefTruth(truth) } : {}),
      source,
      budget: {
        priority: defaults.priority * confidence,
        durability: defaults.durability,
        quality: defaults.quality,
        cycles: defaults.cycles,
        depth: defaults.depth,
      },
    };
    const event = mintCognitiveEvent('task.admitted', {
      engine: 'kernel',
      correlationId,
      payload: task,
    });
    this.emitEvent(event);
    // recordGateDecision is called by decideAndRecord after this returns
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
    const correlation = (): string => batch.batchId;
    for (const candidate of batch.candidates) {
      const narsese = normalizeNarsese(candidate.narsese);
      const parsed = termParser.parseTask(`${narsese}${TASK_PUNCTUATION[candidate.taskType]}`);
      if (!parsed) {
        rejected.push({ candidateId: candidate.candidateId, reason: 'Unparseable Narsese' });
        continue;
      }
      const confidence =
        (candidate.truth?.confidence ?? candidate.confidence) *
        this.sourceQualityToConfidence(sourceQuality);
      const out = this.decideTaskAdmission(
        parsed.term,
        candidate.taskType,
        candidate.truth
          ? { frequency: candidate.truth.frequency, confidence }
          : { frequency: 1.0, confidence },
        'llm',
        correlation
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
}
