/**
 * Composer — contextual controls derived from (focus, aspect) (§7, §11, §12).
 *
 * `controls = composer(focus, aspect)` — derived, not heuristic. Graph controls
 * appear iff the focus's neighborhood is a graph; goal controls iff a goal is
 * focused; judgment panel iff a proposal is focused. No "which controls to show"
 * guesses.
 */

import { type FocusRef, type Aspect, type FocusKind, focus } from './coordinates.js';

/** An affordance — a user action available for a given (focus, aspect). */
export interface Affordance {
  readonly id: string;
  readonly label: string;
  readonly kind: 'primary' | 'secondary' | 'destructive';
  /** The kernel operation to invoke. */
  readonly op: KernelOp;
  /** Whether this affordance is available (can be computed from focus state). */
  readonly enabled: boolean;
  /** Optional keyboard shortcut. */
  readonly shortcut?: string;
}

/** A kernel operation that an affordance triggers. */
export interface KernelOp {
  readonly type: KernelOpType;
  readonly payload: Record<string, unknown>;
}

/** The types of kernel operations the UI can invoke. */
export type KernelOpType =
  | 'belief.assert'
  | 'belief.negate'
  | 'belief.query'
  | 'belief.revise'
  | 'belief.explain'
  | 'belief.pin'
  | 'proposal.accept'
  | 'proposal.correct'
  | 'proposal.reject'
  | 'question.answer'
  | 'question.clarify'
  | 'goal.decompose'
  | 'goal.achieve'
  | 'goal.abandon'
  | 'contradiction.weigh'
  | 'contradiction.resolve'
  | 'turn.reask'
  | 'turn.correct'
  | 'focus.set'
  | 'aspect.set'
  | 'depth.set'
  | 'time.set'
  | 'react';

/** The composer function — pure, derived from (focus, aspect). */
export function composer(focusRef: FocusRef, aspect: Aspect): readonly Affordance[] {
  const affordances: Affordance[] = [];

  // Universal affordances (available for any focus)
  affordances.push(
    ...universalAffordances(focusRef, aspect)
  );

  // Focus-kind-specific affordances
  affordances.push(
    ...kindAffordances(focusRef, aspect)
  );

  // Aspect-specific affordances
  affordances.push(
    ...aspectAffordances(focusRef, aspect)
  );

  return affordances;
}

/** Affordances available for any focus kind. */
function universalAffordances(focusRef: FocusRef, aspect: Aspect): Affordance[] {
  const result: Affordance[] = [];

  // Focus navigation
  result.push({
    id: 'focus.back',
    label: 'Back',
    kind: 'secondary',
    enabled: true,
    op: { type: 'focus.set', payload: { action: 'back' } },
    shortcut: 'Alt+Left',
  });

  result.push({
    id: 'focus.forward',
    label: 'Forward',
    kind: 'secondary',
    enabled: true,
    op: { type: 'focus.set', payload: { action: 'forward' } },
    shortcut: 'Alt+Right',
  });

  // Aspect switching
  const aspects: Aspect[] = ['content', 'neighborhood', 'provenance', 'origin', 'history', 'ambient', 'direct'];
  for (const a of aspects) {
    if (a !== aspect) {
      result.push({
        id: `aspect.${a}`,
        label: a.charAt(0).toUpperCase() + a.slice(1),
        kind: 'secondary',
        enabled: true,
        op: { type: 'aspect.set', payload: { aspect: a } },
      });
    }
  }

  // Depth control
  for (const depth of [0, 1, 2, 3]) {
    result.push({
      id: `depth.${depth}`,
      label: `Depth ${depth}`,
      kind: 'secondary',
      enabled: true,
      op: { type: 'depth.set', payload: { depth } },
    });
  }

  // Time control
  result.push({
    id: 'time.live',
    label: 'Live',
    kind: 'secondary',
    enabled: true,
    op: { type: 'time.set', payload: { time: { kind: 'live' } } },
  });

  return result;
}

/** Affordances specific to the focus kind. */
function kindAffordances(focusRef: FocusRef, aspect: Aspect): Affordance[] {
  switch (focusRef.kind) {
    case 'concept':
      return conceptAffordances(focusRef, aspect);
    case 'task':
      return taskAffordances(focusRef, aspect);
    case 'goal':
      return goalAffordances(focusRef, aspect);
    case 'derivation':
      return derivationAffordances(focusRef, aspect);
    case 'proposal':
      return proposalAffordances(focusRef, aspect);
    case 'judgment':
      return judgmentAffordances(focusRef, aspect);
    case 'turn':
      return turnAffordances(focusRef, aspect);
    case 'event':
    case 'cycle':
      return eventAffordances(focusRef, aspect);
    default:
      return [];
  }
}

/** Affordances specific to the aspect. */
function aspectAffordances(focusRef: FocusRef, aspect: Aspect): Affordance[] {
  switch (aspect) {
    case 'neighborhood':
      return neighborhoodAffordances(focusRef);
    case 'provenance':
      return provenanceAffordances(focusRef);
    case 'origin':
      return originAffordances(focusRef);
    case 'history':
      return historyAffordances(focusRef);
    case 'ambient':
      return ambientAffordances(focusRef);
    case 'direct':
      return directAffordances(focusRef);
    default:
      return [];
  }
}

/** Concept affordances — derived beliefs. */
function conceptAffordances(focusRef: FocusRef, aspect: Aspect): Affordance[] {
  const term = focusRef.kind === 'concept' ? focusRef.term : '';
  return [
    {
      id: 'concept.assert',
      label: 'Assert',
      kind: 'primary',
      enabled: true,
      op: { type: 'belief.assert', payload: { term } },
      shortcut: 'A',
    },
    {
      id: 'concept.negate',
      label: 'Negate',
      kind: 'secondary',
      enabled: true,
      op: { type: 'belief.negate', payload: { term } },
    },
    {
      id: 'concept.query',
      label: 'Query',
      kind: 'primary',
      enabled: true,
      op: { type: 'belief.query', payload: { term } },
      shortcut: 'Q',
    },
    {
      id: 'concept.revise',
      label: 'Revise',
      kind: 'secondary',
      enabled: true,
      op: { type: 'belief.revise', payload: { term } },
    },
    {
      id: 'concept.explain',
      label: 'Explain',
      kind: 'primary',
      enabled: true,
      op: { type: 'belief.explain', payload: { term } },
      shortcut: 'E',
    },
    {
      id: 'concept.pin',
      label: 'Pin',
      kind: 'secondary',
      enabled: true,
      op: { type: 'belief.pin', payload: { term } },
    },
  ];
}

/** Task affordances — belief/goal/question tasks. */
function taskAffordances(focusRef: FocusRef, aspect: Aspect): Affordance[] {
  if (focusRef.kind !== 'task') return [];
  const { term, taskType } = focusRef;
  if (taskType === 'belief') {
    return conceptAffordances(focus.concept(term), aspect);
  }
  if (taskType === 'goal') {
    return goalAffordances(focus.goal(term), aspect);
  }
  if (taskType === 'question') {
    return [
      {
        id: 'question.answer',
        label: 'Answer',
        kind: 'primary',
        enabled: true,
        op: { type: 'question.answer', payload: { term } },
      },
      {
        id: 'question.clarify',
        label: 'Clarify',
        kind: 'secondary',
        enabled: true,
        op: { type: 'question.clarify', payload: { term } },
      },
    ];
  }
  return [];
}

/** Goal affordances — teleological aims. */
function goalAffordances(focusRef: FocusRef, aspect: Aspect): Affordance[] {
  const term = focusRef.kind === 'goal' ? focusRef.term : '';
  return [
    {
      id: 'goal.decompose',
      label: 'Decompose',
      kind: 'primary',
      enabled: true,
      op: { type: 'goal.decompose', payload: { term } },
    },
    {
      id: 'goal.achieve',
      label: 'Achieve',
      kind: 'secondary',
      enabled: true,
      op: { type: 'goal.achieve', payload: { term } },
    },
    {
      id: 'goal.abandon',
      label: 'Abandon',
      kind: 'destructive',
      enabled: true,
      op: { type: 'goal.abandon', payload: { term } },
    },
  ];
}

/** Derivation affordances — System-2 proof records. */
function derivationAffordances(focusRef: FocusRef, aspect: Aspect): Affordance[] {
  const id = focusRef.kind === 'derivation' ? focusRef.id : '';
  return [
    {
      id: 'derivation.replay',
      label: 'Replay',
      kind: 'primary',
      enabled: true,
      op: { type: 'react', payload: { action: 'replay', derivationId: id } },
    },
    {
      id: 'derivation.step',
      label: 'Step Through',
      kind: 'secondary',
      enabled: true,
      op: { type: 'react', payload: { action: 'step', derivationId: id } },
    },
  ];
}

/** Proposal affordances — System-1 candidates (Dialogue Flywheel). */
function proposalAffordances(focusRef: FocusRef, aspect: Aspect): Affordance[] {
  const id = focusRef.kind === 'proposal' ? focusRef.id : '';
  return [
    {
      id: 'proposal.accept',
      label: 'Accept',
      kind: 'primary',
      enabled: true,
      op: { type: 'proposal.accept', payload: { proposalId: id } },
    },
    {
      id: 'proposal.correct',
      label: 'Correct',
      kind: 'secondary',
      enabled: true,
      op: { type: 'proposal.correct', payload: { proposalId: id } },
    },
    {
      id: 'proposal.reject',
      label: 'Reject',
      kind: 'destructive',
      enabled: true,
      op: { type: 'proposal.reject', payload: { proposalId: id } },
    },
  ];
}

/** Judgment affordances — Manifold score artifacts. */
function judgmentAffordances(focusRef: FocusRef, aspect: Aspect): Affordance[] {
  const id = focusRef.kind === 'judgment' ? focusRef.id : '';
  return [
    {
      id: 'judgment.view',
      label: 'View Scores',
      kind: 'primary',
      enabled: true,
      op: { type: 'react', payload: { action: 'view-judgment', judgmentId: id } },
    },
  ];
}

/** Turn affordances — perceived utterances (Dialogue Flywheel). */
function turnAffordances(focusRef: FocusRef, aspect: Aspect): Affordance[] {
  const id = focusRef.kind === 'turn' ? focusRef.id : '';
  return [
    {
      id: 'turn.reask',
      label: 'Re-ask',
      kind: 'secondary',
      enabled: true,
      op: { type: 'turn.reask', payload: { turnId: id } },
    },
    {
      id: 'turn.correct',
      label: 'Correct',
      kind: 'primary',
      enabled: true,
      op: { type: 'turn.correct', payload: { turnId: id } },
    },
  ];
}

/** Event/Cycle affordances — log entries. */
function eventAffordances(focusRef: FocusRef, aspect: Aspect): Affordance[] {
  const id = (focusRef.kind === 'event' || focusRef.kind === 'cycle') ? focusRef.id : '';
  return [
    {
      id: 'event.replay',
      label: 'Replay',
      kind: 'secondary',
      enabled: true,
      op: { type: 'react', payload: { action: 'replay-event', eventId: id } },
    },
  ];
}

/** Neighborhood aspect affordances — graph operations. */
function neighborhoodAffordances(focusRef: FocusRef): Affordance[] {
  return [
    {
      id: 'neighborhood.expand',
      label: 'Expand Ring',
      kind: 'secondary',
      enabled: true,
      op: { type: 'react', payload: { action: 'expand-ring', focus: focusRef } },
    },
    {
      id: 'neighborhood.layout',
      label: 'Relayout',
      kind: 'secondary',
      enabled: true,
      op: { type: 'react', payload: { action: 'relayout', focus: focusRef } },
    },
  ];
}

/** Provenance aspect affordances — derivation inspection. */
function provenanceAffordances(focusRef: FocusRef): Affordance[] {
  return [
    {
      id: 'provenance.trace',
      label: 'Trace',
      kind: 'primary',
      enabled: true,
      op: { type: 'react', payload: { action: 'trace', focus: focusRef } },
    },
    {
      id: 'provenance.counterfactual',
      label: 'Counterfactual',
      kind: 'secondary',
      enabled: true,
      op: { type: 'react', payload: { action: 'counterfactual', focus: focusRef } },
    },
  ];
}

/** Origin aspect affordances — proposed vs derived split. */
function originAffordances(focusRef: FocusRef): Affordance[] {
  return [
    {
      id: 'origin.show-proposed',
      label: 'Show Proposed',
      kind: 'secondary',
      enabled: true,
      op: { type: 'react', payload: { action: 'show-proposed', focus: focusRef } },
    },
    {
      id: 'origin.show-derived',
      label: 'Show Derived',
      kind: 'secondary',
      enabled: true,
      op: { type: 'react', payload: { action: 'show-derived', focus: focusRef } },
    },
  ];
}

/** History aspect affordances — timeline navigation. */
function historyAffordances(focusRef: FocusRef): Affordance[] {
  return [
    {
      id: 'history.revisions',
      label: 'Revisions',
      kind: 'secondary',
      enabled: true,
      op: { type: 'react', payload: { action: 'show-revisions', focus: focusRef } },
    },
  ];
}

/** Ambient aspect affordances — attention field, drives. */
function ambientAffordances(focusRef: FocusRef): Affordance[] {
  return [
    {
      id: 'ambient.drives',
      label: 'Drives',
      kind: 'secondary',
      enabled: true,
      op: { type: 'react', payload: { action: 'show-drives' } },
    },
    {
      id: 'ambient.vitals',
      label: 'Vitals',
      kind: 'secondary',
      enabled: true,
      op: { type: 'react', payload: { action: 'show-vitals' } },
    },
  ];
}

/** Direct aspect affordances — actions you can take. */
function directAffordances(focusRef: FocusRef): Affordance[] {
  return [
    {
      id: 'direct.configure',
      label: 'Configure',
      kind: 'secondary',
      enabled: true,
      op: { type: 'react', payload: { action: 'configure', focus: focusRef } },
    },
  ];
}

/** Execute a kernel operation. */
export async function executeKernelOp(op: KernelOp): Promise<{ ok: boolean; message?: string }> {
  // This will be wired to the actual kernel backend
  // For now, return a placeholder
  console.log('[Composer] Execute kernel op:', op);
  return { ok: true };
}