/**
 * FocusKind registry — open focus kinds (§3, §12).
 *
 * Every focus kind is a registered descriptor with key/encode/decode/label/icon.
 * The core kinds SeNARS registers by default are the 15 from coordinates.ts;
 * extensions add their own. This replaces the closed `FocusKind` union.
 */

import type { FocusRef, TaskType } from './coordinates.js';

/** A focus kind descriptor — how to address, serialize, and render a kind. */
export interface FocusKindDescriptor {
  readonly kind: string;
  key(ref: FocusRef): string;
  encode?(ref: FocusRef): string;
  decode?(value: string): FocusRef | null;
  label(ref: FocusRef): string;
  icon?(ref: FocusRef): string;
}

const focusKindRegistry = new Map<string, FocusKindDescriptor>();
const registrationOrder: string[] = [];

/** Register a focus kind descriptor. */
export const registerFocusKind = (descriptor: FocusKindDescriptor): void => {
  if (focusKindRegistry.has(descriptor.kind)) {
    console.warn(`FocusKind ${descriptor.kind} already registered; overwriting`);
  } else {
    registrationOrder.push(descriptor.kind);
  }
  focusKindRegistry.set(descriptor.kind, descriptor);
};

/** Get a registered focus kind descriptor. */
export const getFocusKind = (kind: string): FocusKindDescriptor | undefined => focusKindRegistry.get(kind);

/** All registered focus kind descriptors in registration order. */
export const getFocusKinds = (): readonly FocusKindDescriptor[] => registrationOrder.map((id) => focusKindRegistry.get(id)!);

/** Whether a focus kind is registered. */
export const hasFocusKind = (kind: string): boolean => focusKindRegistry.has(kind);

/** Focus kind IDs in registration order. */
export const focusKindIds = (): readonly string[] => [...registrationOrder];

/** Clear the registry (test-only). */
export const resetFocusKinds = (): void => {
  focusKindRegistry.clear();
  registrationOrder.length = 0;
};

/** Type guards for FocusRef variants. */
const isConceptRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'concept'; readonly term: string } => ref.kind === 'concept';
const isTaskRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'task'; readonly term: string; readonly taskType: TaskType } => ref.kind === 'task';
const isGoalRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'goal'; readonly term: string } => ref.kind === 'goal';
const isDerivationRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'derivation'; readonly id: string } => ref.kind === 'derivation';
const isStepRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'step'; readonly derivationId: string; readonly index: number } => ref.kind === 'step';
const isProposalRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'proposal'; readonly id: string } => ref.kind === 'proposal';
const isJudgmentRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'judgment'; readonly id: string } => ref.kind === 'judgment';
const isTurnRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'turn'; readonly id: string } => ref.kind === 'turn';
const isEventRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'event'; readonly id: string } => ref.kind === 'event';
const isCycleRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'cycle'; readonly id: string } => ref.kind === 'cycle';
const isTraceRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'trace'; readonly correlationId: string } => ref.kind === 'trace';
const isTimeRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'time'; readonly time: { readonly kind: string } } => ref.kind === 'time';
const isDriveRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'drive'; readonly name: string } => ref.kind === 'drive';
const isSpaceRef = (ref: FocusRef): ref is FocusRef & { readonly kind: 'space'; readonly id: string } => ref.kind === 'space';

/** The core focus kind descriptors SeNARS registers by default. */
export const CORE_FOCUS_KINDS: readonly FocusKindDescriptor[] = [
  {
    kind: 'concept',
    key: (ref) => isConceptRef(ref) ? `concept:${ref.term}` : `concept:`,
    encode: (ref) => isConceptRef(ref) ? `concept:${ref.term}` : `concept:`,
    decode: (value) => {
      const [, term] = value.split(':', 2);
      return term ? { kind: 'concept', term } : null;
    },
    label: (ref) => isConceptRef(ref) ? `Concept: ${ref.term}` : 'Concept',
    icon: () => 'brain',
  },
  {
    kind: 'task',
    key: (ref) => isTaskRef(ref) ? `task:${ref.taskType}:${ref.term}` : `task:`,
    encode: (ref) => isTaskRef(ref) ? `task:${ref.taskType}:${ref.term}` : `task:`,
    decode: (value) => {
      const [, taskType, ...rest] = value.split(':');
      const term = rest.join(':');
      return taskType && term && ['belief', 'goal', 'question'].includes(taskType)
        ? { kind: 'task', term, taskType: taskType as TaskType }
        : null;
    },
    label: (ref) => isTaskRef(ref) ? `Task (${ref.taskType}): ${ref.term}` : 'Task',
    icon: () => 'target',
  },
  {
    kind: 'goal',
    key: (ref) => isGoalRef(ref) ? `goal:${ref.term}` : `goal:`,
    encode: (ref) => isGoalRef(ref) ? `goal:${ref.term}` : `goal:`,
    decode: (value) => {
      const [, term] = value.split(':', 2);
      return term ? { kind: 'goal', term } : null;
    },
    label: (ref) => isGoalRef(ref) ? `Goal: ${ref.term}` : 'Goal',
    icon: () => 'flag',
  },
  {
    kind: 'derivation',
    key: (ref) => isDerivationRef(ref) ? `derivation:${ref.id}` : `derivation:`,
    encode: (ref) => isDerivationRef(ref) ? `derivation:${ref.id}` : `derivation:`,
    decode: (value) => {
      const [, id] = value.split(':', 2);
      return id ? { kind: 'derivation', id } : null;
    },
    label: (ref) => isDerivationRef(ref) ? `Derivation: ${ref.id}` : 'Derivation',
    icon: () => 'gitBranch',
  },
  {
    kind: 'step',
    key: (ref) => isStepRef(ref) ? `step:${ref.derivationId}#${ref.index}` : `step:`,
    encode: (ref) => isStepRef(ref) ? `step:${ref.derivationId}#${ref.index}` : `step:`,
    decode: (value) => {
      const [, rest] = value.split(':', 2);
      const [derivationId, indexStr] = (rest ?? '').split('#', 2);
      const index = Number(indexStr);
      return derivationId && !Number.isNaN(index)
        ? { kind: 'step', derivationId, index }
        : null;
    },
    label: (ref) => isStepRef(ref) ? `Step ${ref.index}: ${ref.derivationId}` : 'Step',
    icon: () => 'chevronRight',
  },
  {
    kind: 'proposal',
    key: (ref) => isProposalRef(ref) ? `proposal:${ref.id}` : `proposal:`,
    encode: (ref) => isProposalRef(ref) ? `proposal:${ref.id}` : `proposal:`,
    decode: (value) => {
      const [, id] = value.split(':', 2);
      return id ? { kind: 'proposal', id } : null;
    },
    label: (ref) => isProposalRef(ref) ? `Proposal: ${ref.id}` : 'Proposal',
    icon: () => 'lightbulb',
  },
  {
    kind: 'judgment',
    key: (ref) => isJudgmentRef(ref) ? `judgment:${ref.id}` : `judgment:`,
    encode: (ref) => isJudgmentRef(ref) ? `judgment:${ref.id}` : `judgment:`,
    decode: (value) => {
      const [, id] = value.split(':', 2);
      return id ? { kind: 'judgment', id } : null;
    },
    label: (ref) => isJudgmentRef(ref) ? `Judgment: ${ref.id}` : 'Judgment',
    icon: () => 'gavel',
  },
  {
    kind: 'turn',
    key: (ref) => isTurnRef(ref) ? `turn:${ref.id}` : `turn:`,
    encode: (ref) => isTurnRef(ref) ? `turn:${ref.id}` : `turn:`,
    decode: (value) => {
      const [, id] = value.split(':', 2);
      return id ? { kind: 'turn', id } : null;
    },
    label: (ref) => isTurnRef(ref) ? `Turn: ${ref.id}` : 'Turn',
    icon: () => 'messageSquare',
  },
  {
    kind: 'event',
    key: (ref) => isEventRef(ref) ? `event:${ref.id}` : `event:`,
    encode: (ref) => isEventRef(ref) ? `event:${ref.id}` : `event:`,
    decode: (value) => {
      const [, id] = value.split(':', 2);
      return id ? { kind: 'event', id } : null;
    },
    label: (ref) => isEventRef(ref) ? `Event: ${ref.id}` : 'Event',
    icon: () => 'zap',
  },
  {
    kind: 'cycle',
    key: (ref) => isCycleRef(ref) ? `cycle:${ref.id}` : `cycle:`,
    encode: (ref) => isCycleRef(ref) ? `cycle:${ref.id}` : `cycle:`,
    decode: (value) => {
      const [, id] = value.split(':', 2);
      return id ? { kind: 'cycle', id } : null;
    },
    label: (ref) => isCycleRef(ref) ? `Cycle: ${ref.id}` : 'Cycle',
    icon: () => 'repeat',
  },
  {
    kind: 'trace',
    key: (ref) => isTraceRef(ref) ? `trace:${ref.correlationId}` : `trace:`,
    encode: (ref) => isTraceRef(ref) ? `trace:${ref.correlationId}` : `trace:`,
    decode: (value) => {
      const [, correlationId] = value.split(':', 2);
      return correlationId ? { kind: 'trace', correlationId } : null;
    },
    label: (ref) => isTraceRef(ref) ? `Trace: ${ref.correlationId}` : 'Trace',
    icon: () => 'gitGraph',
  },
  {
    kind: 'time',
    key: (ref) => isTimeRef(ref) ? `time:${ref.time.kind}` : `time:`,
    encode: (ref) => isTimeRef(ref) ? `time:${ref.time.kind}` : `time:`,
    decode: (value) => {
      const [, timePart] = value.split(':', 2);
      if (!timePart) return null;
      return { kind: 'time', time: { kind: 'live' } };
    },
    label: (ref) => isTimeRef(ref) ? `Time: ${ref.time.kind}` : 'Time',
    icon: () => 'clock',
  },
  {
    kind: 'drive',
    key: (ref) => isDriveRef(ref) ? `drive:${ref.name}` : `drive:`,
    encode: (ref) => isDriveRef(ref) ? `drive:${ref.name}` : `drive:`,
    decode: (value) => {
      const [, name] = value.split(':', 2);
      return name ? { kind: 'drive', name } : null;
    },
    label: (ref) => isDriveRef(ref) ? `Drive: ${ref.name}` : 'Drive',
    icon: () => 'heart',
  },
  {
    kind: 'space',
    key: (ref) => isSpaceRef(ref) ? `space:${ref.id}` : `space:`,
    encode: (ref) => isSpaceRef(ref) ? `space:${ref.id}` : `space:`,
    decode: (value) => {
      const [, id] = value.split(':', 2);
      return id ? { kind: 'space', id } : null;
    },
    label: (ref) => isSpaceRef(ref) ? `Space: ${ref.id}` : 'Space',
    icon: () => 'globe',
  },
  {
    kind: 'mind',
    key: () => 'mind',
    encode: () => 'mind',
    decode: () => ({ kind: 'mind' }),
    label: () => 'Mind',
    icon: () => 'brain',
  },
] as const;

/** Register the core SeNARS focus kinds. */
export const registerCoreFocusKinds = (): void => {
  for (const descriptor of CORE_FOCUS_KINDS) registerFocusKind(descriptor);
};

/** Type of registered focus kind IDs (for exhaustiveness). */
export type RegisteredFocusKind = FocusKindDescriptor['kind'];

/** Get focus kinds applicable to a substrate (all by default). */
export const focusKindsForSubstrate = (_substrate: string): readonly FocusKindDescriptor[] =>
  getFocusKinds().filter((_k) => true);

/** Encode a FocusRef using its registered descriptor. */
export const encodeFocusRef = (ref: FocusRef): string | null => {
  const descriptor = getFocusKind(ref.kind);
  return descriptor?.encode?.(ref) ?? null;
};

/** Decode a FocusRef using its registered descriptor. */
export const decodeFocusRef = (encoded: string): FocusRef | null => {
  const parts = encoded.split(':');
  const kind = parts[0];
  if (!kind) return null;
  const descriptor = getFocusKind(kind);
  return descriptor?.decode?.(parts.slice(1).join(':')) ?? null;
};

/** Get label for a FocusRef using its registered descriptor. */
export const labelFocusRef = (ref: FocusRef): string => {
  const descriptor = getFocusKind(ref.kind);
  return descriptor?.label(ref) ?? ref.kind;
};

/** Get icon for a FocusRef using its registered descriptor. */
export const iconFocusRef = (ref: FocusRef): string | undefined => {
  const descriptor = getFocusKind(ref.kind);
  return descriptor?.icon?.(ref);
};