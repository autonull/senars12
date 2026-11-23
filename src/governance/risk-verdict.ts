/**
 * Risk–Verdict Gate Matrix — the spine that binds operator risk classes to verdict requirements.
 *
 * Three risk classes (reversible | bounded | irreversible) cross three-valued verdicts
 * (proved | refuted | unknown) to produce a binding gate decision. The rule:
 * - unchecked on irreversible ⇒ escalate or refuse with explanation
 * - bounded with unknown ⇒ bounded execution with monitoring
 * - reversible with unknown ⇒ allowed with audit trail
 */

import type { Verdict } from '../logic/verdict';
import type { CapabilityRisk } from '../util/capability-risk';

/** Operator risk classes — every operation must declare one. */
export const RISK_CLASSES = ['reversible', 'bounded', 'irreversible'] as const;
export type RiskClass = (typeof RISK_CLASSES)[number];

/** Gate decision outcomes. */
export const GATE_DECISIONS = ['allow', 'allow-monitored', 'escalate', 'refuse'] as const;
export type GateDecision = (typeof GATE_DECISIONS)[number];

/** Result of the risk–verdict gate evaluation. */
export interface RiskVerdict {
  readonly decision: GateDecision;
  readonly reason: string;
  readonly requiresExplanation: boolean;
  readonly escalationPath?: string;
}

/**
 * Map capability risk (low/medium/high) to operator risk class.
 * This is the single conversion between the two vocabularies.
 */
const RISK_CLASS_BY_CAPABILITY_RISK: Record<CapabilityRisk, RiskClass> = {
  low: 'reversible',
  medium: 'bounded',
  high: 'irreversible',
} as const satisfies Record<CapabilityRisk, RiskClass>;

/** Convert a capability risk to an operator risk class. */
export const riskClassOf = (risk: CapabilityRisk): RiskClass => RISK_CLASS_BY_CAPABILITY_RISK[risk];

/**
 * The risk × verdict gate matrix.
 *
 * Rows: risk class (reversible, bounded, irreversible)
 * Columns: verdict status (proved, refuted, unknown)
 * Cells: gate decision
 */
const GATE_MATRIX: Readonly<Record<RiskClass, Record<Verdict['status'], GateDecision>>> = {
  reversible: {
    proved: 'allow',
    refuted: 'refuse',
    unknown: 'allow', // reversible + unknown = allowed with audit trail
  },
  bounded: {
    proved: 'allow',
    refuted: 'refuse',
    unknown: 'allow-monitored', // bounded + unknown = bounded execution with monitoring
  },
  irreversible: {
    proved: 'allow',
    refuted: 'refuse',
    unknown: 'escalate', // irreversible + unknown = escalate/refuse with explanation
  },
} as const;

/**
 * Evaluate the risk–verdict gate for a given risk class and verdict.
 */
export const evaluateGate = (
  riskClass: RiskClass,
  verdict: Verdict
): RiskVerdict => {
  const decision = GATE_MATRIX[riskClass][verdict.status];

  switch (decision) {
    case 'allow':
      return {
        decision: 'allow',
        reason: `${riskClass} operation with ${verdict.status} verdict — allowed`,
        requiresExplanation: false,
      };
    case 'allow-monitored':
      return {
        decision: 'allow-monitored',
        reason: `${riskClass} operation with ${verdict.status} verdict — allowed under monitoring`,
        requiresExplanation: false,
      };
    case 'escalate':
      return {
        decision: 'escalate',
        reason: `${riskClass} operation with ${verdict.status} verdict — escalated (irreversible + unknown requires explanation)`,
        requiresExplanation: true,
        escalationPath: 'governance/escalation',
      };
    case 'refuse':
      return {
        decision: 'refuse',
        reason: `${riskClass} operation with ${verdict.status} verdict — refused`,
        requiresExplanation: true,
        escalationPath: 'governance/review',
      };
  }
};

/**
 * Evaluate the gate from a capability risk and verdict.
 * This is the main entry point for callers that have a CapabilityRisk.
 */
export const evaluateGateFromRisk = (
  risk: CapabilityRisk,
  verdict: Verdict
): RiskVerdict => evaluateGate(riskClassOf(risk), verdict);

/**
 * Check if an operation is permitted to execute based on gate result.
 */
export const isPermitted = (result: RiskVerdict): boolean =>
  result.decision === 'allow' || result.decision === 'allow-monitored';

/**
 * Get the required explanation for a refused/escalated gate.
 */
export const requiredExplanation = (result: RiskVerdict): string | undefined =>
  result.requiresExplanation ? result.reason : undefined;