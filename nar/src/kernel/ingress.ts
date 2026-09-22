import type { SourceQuality } from '@senars/kernel/schemas';
import type { TaskTypeName } from '../terms';

/**
 * X2 (TODO20): the kernel's ingress boundary. `KernelPerceptionGate` consumes this
 * structurally — the epistemic firewall is compile-time: kernel code never sees
 * the proposer's internals.
 */
export interface IngressJudgmentRequest {
  rawObservation: string;
  sourceQuality: SourceQuality;
  baseConfidence: number;
  taskType: TaskTypeName;
}

export interface IngressVerdict {
  /** Injection veto — admission must be rejected with this reason. */
  vetoReason?: string;
  taskType?: TaskTypeName;
  /** Ambiguity flagged (drive curiosity hook fires at the gate). */
  ambiguityFlag?: boolean;
  sourceQuality?: SourceQuality;
  /** Final admission confidence (source-quality ceiling applied). */
  confidence: number;
  truth: { f: number; c: number };
}

export interface IngressJudge {
  judge(request: IngressJudgmentRequest): Promise<IngressVerdict>;
  /** Optional telemetry sink for judgment.resolved events (gate event log). */
  setEventSink?(push: (event: unknown) => void): void;
}
