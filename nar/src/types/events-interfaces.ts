import type { CognitiveEvent } from '@senars/kernel/schemas';

export interface CognitiveEventMap {
  'task.admitted': Extract<CognitiveEvent, { type: 'task.admitted' }>;
  'derivation.accepted': Extract<CognitiveEvent, { type: 'derivation.accepted' }>;
  'belief.revised': Extract<CognitiveEvent, { type: 'belief.revised' }>;
  'concept.activated': Extract<CognitiveEvent, { type: 'concept.activated' }>;
  'budget.exhausted': Extract<CognitiveEvent, { type: 'budget.exhausted' }>;
  'policy.violation': Extract<CognitiveEvent, { type: 'policy.violation' }>;
  'autonomy.mode.changed': Extract<CognitiveEvent, { type: 'autonomy.mode.changed' }>;
  'self-mod.proposal': Extract<CognitiveEvent, { type: 'self-mod.proposal' }>;
  'judgment.resolved': Extract<CognitiveEvent, { type: 'judgment.resolved' }>;
  'egress.gate.rejected': Extract<CognitiveEvent, { type: 'egress.gate.rejected' }>;
}

export type CognitiveEventType = keyof CognitiveEventMap;

export type TaskAdmittedEvent = CognitiveEventMap['task.admitted'];
export type DerivationAcceptedEvent = CognitiveEventMap['derivation.accepted'];
export type BeliefRevisedEvent = CognitiveEventMap['belief.revised'];
export type ConceptActivatedEvent = CognitiveEventMap['concept.activated'];
export type BudgetExhaustedEvent = CognitiveEventMap['budget.exhausted'];
export type PolicyViolationEvent = CognitiveEventMap['policy.violation'];
export type AutonomyModeChangedEvent = CognitiveEventMap['autonomy.mode.changed'];
export type SelfModProposalEvent = CognitiveEventMap['self-mod.proposal'];
export type JudgmentResolvedEvent = CognitiveEventMap['judgment.resolved'];
export type EgressGateRejectedEvent = CognitiveEventMap['egress.gate.rejected'];

export function isTaskAdmittedEvent(event: CognitiveEvent): event is TaskAdmittedEvent {
  return event.type === 'task.admitted';
}

export function isDerivationAcceptedEvent(event: CognitiveEvent): event is DerivationAcceptedEvent {
  return event.type === 'derivation.accepted';
}

export function isBeliefRevisedEvent(event: CognitiveEvent): event is BeliefRevisedEvent {
  return event.type === 'belief.revised';
}

export function isConceptActivatedEvent(event: CognitiveEvent): event is ConceptActivatedEvent {
  return event.type === 'concept.activated';
}

export function isBudgetExhaustedEvent(event: CognitiveEvent): event is BudgetExhaustedEvent {
  return event.type === 'budget.exhausted';
}

export function isPolicyViolationEvent(event: CognitiveEvent): event is PolicyViolationEvent {
  return event.type === 'policy.violation';
}

export function isAutonomyModeChangedEvent(event: CognitiveEvent): event is AutonomyModeChangedEvent {
  return event.type === 'autonomy.mode.changed';
}

export function isSelfModProposalEvent(event: CognitiveEvent): event is SelfModProposalEvent {
  return event.type === 'self-mod.proposal';
}

export function isJudgmentResolvedEvent(event: CognitiveEvent): event is JudgmentResolvedEvent {
  return event.type === 'judgment.resolved';
}

export function isEgressGateRejectedEvent(event: CognitiveEvent): event is EgressGateRejectedEvent {
  return event.type === 'egress.gate.rejected';
}