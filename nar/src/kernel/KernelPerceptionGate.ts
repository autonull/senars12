import type {
  CognitiveEvent,
  FormalizationBatch,
  PerceptionGateInput,
  PerceptionGateOutput,
  ShadowValidationDropEvent,
  SourceQuality,
  TaskAdmittedEvent,
} from '@senars/core/schemas';
import { SOURCE_QUALITY_CONFIDENCE } from '@senars/core/schemas';
import {
  asBeliefTruth,
  boundedSignal,
  errMsg,
  makeId,
  raceDeadline,
  type TruthLike,
} from '@senars/util';
import { normalizeNarsese } from '../nl/normalize.js';
import { recordGateDecision } from '../telemetry/index.js';
import type { TaskTypeName, Term } from '../terms';
import { termParser } from '../terms';
import { recordPolicyViolation } from './event-ring.js';
import { KernelGate } from './gate-base.js';
import type { IngressJudge, IngressVerdict } from './ingress.js';
import { domainKey } from './reputation-keys.js';
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
    recordGateDecision('perception', 'admit', false, `ingress-${kind}`, correlationId);
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
    const correlationId = this.correlationOf(input.correlationId);

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

    const term = this.rawObservationToTerm(input.rawObservation);
    if (!term) {
      recordGateDecision('perception', 'admit', false, 'unparseable-observation', correlationId);
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

    return this.emitAdmitted({
      term,
      taskType,
      truth: taskType === 'belief' ? { frequency: 1.0, confidence } : undefined,
      source: input.source ?? this.mapSource(input.sourceId),
      confidence,
      correlationId,
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
    // The signal is an ask, not the bound: a judge that ignores it is still
    // bounded by the deadline, and one that honours it stops costing anything.
    const bounded = boundedSignal(timeoutMs);
    let verdict: IngressVerdict;
    try {
      const judged = await raceDeadline(
        this.judge!.judge({
          rawObservation,
          sourceQuality,
          baseConfidence,
          taskType: initialTaskType,
          signal: bounded.signal,
        }),
        timeoutMs
      );
      // Same outcome as a fault, and deliberately the same reason: both mean the
      // judgment did not arrive, and neither may fall through to legacy
      // admission — that is the injection veto, not a default.
      if (judged.timedOut) {
        return this.judgeFault(correlationId, `judge exceeded ${timeoutMs}ms`, 'timeout');
      }
      verdict = judged.value;
    } catch (error) {
      // Fail-closed (D1): a System One fault must never bypass the injection
      // veto via legacy admission — reject and emit ingress-error telemetry.
      return this.judgeFault(correlationId, errMsg(error), 'error');
    } finally {
      bounded.done();
    }

    if (verdict.vetoReason) {
      recordGateDecision('perception', 'admit', false, verdict.vetoReason, correlationId);
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
    truth?: TruthLike,
    source = 'derivation',
    correlationId?: string
  ): PerceptionGateOutput {
    const out = this.decideAdmission(term, taskType, truth, source, correlationId);
    recordGateDecision('perception', 'admitTask', out.admitted, out.rejectionReason, correlationId);
    return out;
  }

  private decideAdmission(
    term: Term,
    taskType: TaskTypeName,
    truth?: TruthLike,
    source = 'derivation',
    correlationId?: string
  ): PerceptionGateOutput {
    const normalized = asBeliefTruth(truth);
    return this.emitAdmitted({
      term,
      taskType,
      truth: normalized,
      source: this.mapSource(source),
      confidence: normalized?.confidence ?? 0.5,
      correlationId: this.correlationOf(correlationId),
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
    const event: TaskAdmittedEvent = {
      type: 'task.admitted',
      engine: 'kernel',
      timestamp: Date.now(),
      correlationId,
      payload: task,
    };
    this.emitEvent(event);
    recordGateDecision('perception', 'admit', true, undefined, correlationId);
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
}
