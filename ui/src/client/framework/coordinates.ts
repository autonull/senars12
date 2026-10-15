/**
 * The four coordinates — the entire UI state (UI.17 §1).
 *
 * Every rendered thing is `render(focus, aspect, depth, time)`; every interaction
 * mutates exactly one coordinate. `FocusCell` is the unit of the interface (§3):
 * it renders anything because it renders coordinates, and it can contain other
 * cells at `depth + 1` — so a document, a graph and a chat are one kind, arranged
 * differently.
 */

import { aspectProjectionIds, registerCoreAspects, CORE_ASPECTS } from './aspect-registry.js';

/** What a task is about — the epistemic/teleological axis the kernel already names. */
export type TaskType = 'belief' | 'goal' | 'question';

/** The kinds of thing one can focus (§2). Every kind is a typed substrate reference. */
export type FocusKind =
  | 'concept'
  | 'task'
  | 'goal'
  | 'derivation'
  | 'step'
  | 'proposal'
  | 'judgment'
  | 'turn'
  | 'event'
  | 'cycle'
  | 'trace'
  | 'time'
  | 'drive'
  | 'space'
  | 'mind';

/**
 * A focus is a typed reference into the cognitive substrate, never a UI invention
 * (§2). Block-backed kinds address the one workspace id namespace; the remainder
 * (`time`, `drive`, `space`, `mind`) address the coordinates and the ambient.
 * `trace` is a process instance threaded by correlationId (§18.1).
 */
export type FocusRef =
  | { readonly kind: 'concept'; readonly term: string }
  | { readonly kind: 'task'; readonly term: string; readonly taskType: TaskType }
  | { readonly kind: 'goal'; readonly term: string }
  | { readonly kind: 'derivation'; readonly id: string }
  | { readonly kind: 'step'; readonly derivationId: string; readonly index: number }
  | { readonly kind: 'proposal'; readonly id: string }
  | { readonly kind: 'judgment'; readonly id: string }
  | { readonly kind: 'turn'; readonly id: string }
  | { readonly kind: 'event'; readonly id: string }
  | { readonly kind: 'cycle'; readonly id: string }
  | { readonly kind: 'trace'; readonly correlationId: string }
  | { readonly kind: 'time'; readonly time: TimeRef }
  | { readonly kind: 'drive'; readonly name: string }
  | { readonly kind: 'space'; readonly id: string }
  | { readonly kind: 'mind' };

/** The ambient root: the mind with no subject (§13). */
export const MIND_FOCUS: FocusRef = { kind: 'mind' };

/** Constructors, one per focus kind — the typed way to address the substrate. */
export const focus = {
  concept: (term: string): FocusRef => ({ kind: 'concept', term }),
  task: (term: string, taskType: TaskType = 'belief'): FocusRef => ({
    kind: 'task',
    term,
    taskType,
  }),
  goal: (term: string): FocusRef => ({ kind: 'goal', term }),
  derivation: (id: string): FocusRef => ({ kind: 'derivation', id }),
  step: (derivationId: string, index: number): FocusRef => ({ kind: 'step', derivationId, index }),
  proposal: (id: string): FocusRef => ({ kind: 'proposal', id }),
  judgment: (id: string): FocusRef => ({ kind: 'judgment', id }),
  turn: (id: string): FocusRef => ({ kind: 'turn', id }),
  event: (id: string): FocusRef => ({ kind: 'event', id }),
  cycle: (id: string): FocusRef => ({ kind: 'cycle', id }),
  trace: (correlationId: string): FocusRef => ({ kind: 'trace', correlationId }),
  time: (time: TimeRef): FocusRef => ({ kind: 'time', time }),
  drive: (name: string): FocusRef => ({ kind: 'drive', name }),
  space: (id: string): FocusRef => ({ kind: 'space', id }),
  mind: (): FocusRef => MIND_FOCUS,
} as const;

/** The three block-backed focus kinds whose subject is a term, not an id. */
const TERM_KINDS = new Set<FocusKind>(['concept', 'task', 'goal']);

/** The workspace id a focus addresses, when it is block-backed (`mind`/`time`/… are not). */
export const focusRefId = (ref: FocusRef): string | undefined => {
  switch (ref.kind) {
    case 'concept':
    case 'task':
    case 'goal':
      return ref.term;
    case 'derivation':
    case 'proposal':
    case 'judgment':
    case 'turn':
    case 'event':
    case 'cycle':
    case 'trace':
      return ref.kind === 'trace' ? ref.correlationId : ref.id;
    case 'step':
      return ref.derivationId;
    default:
      return undefined;
  }
};

/** Whether a focus's subject is a term (rather than a minted id). */
export const isTermFocus = (ref: FocusRef): boolean => TERM_KINDS.has(ref.kind);

/** A temporal coordinate — `live`, a point, or an interval (§9). */
export type TimeRef =
  | { readonly kind: 'live' }
  | { readonly kind: 'at'; readonly t: number }
  | { readonly kind: 'range'; readonly from: number; readonly to: number };

/** The present: the live stream. */
export const LIVE: TimeRef = { kind: 'live' };

/** A position on the timeline. */
export const atTime = (t: number): TimeRef => ({ kind: 'at', t });

/** An interval on the timeline. */
export const timeRange = (from: number, to: number): TimeRef => ({ kind: 'range', from, to });

/** Stable key for a temporal coordinate. */
export const timeKey = (time: TimeRef): string =>
  time.kind === 'live'
    ? 'live'
    : time.kind === 'at'
      ? `at:${time.t}`
      : `range:${time.from}-${time.to}`;

/** Stable identity for a focus — its dedup/compare/serialization key. */
export const focusKey = (ref: FocusRef): string => {
  switch (ref.kind) {
    case 'task':
      return `task:${ref.taskType}:${ref.term}`;
    case 'step':
      return `step:${ref.derivationId}#${ref.index}`;
    case 'time':
      return `time:${timeKey(ref.time)}`;
    case 'drive':
      return `drive:${ref.name}`;
    case 'space':
      return `space:${ref.id}`;
    case 'mind':
      return 'mind';
    case 'trace':
      return `trace:${ref.correlationId}`;
    default:
      return `${ref.kind}:${focusRefId(ref) ?? ''}`;
  }
};

/** Whether two foci address the same subject. */
export const focusEquals = (a: FocusRef, b: FocusRef): boolean => focusKey(a) === focusKey(b);

/** Every focus kind, in the order §2 lists them. */
export const FOCUS_KINDS: readonly FocusKind[] = [
  'concept',
  'task',
  'goal',
  'derivation',
  'step',
  'proposal',
  'judgment',
  'turn',
  'event',
  'cycle',
  'trace',
  'time',
  'drive',
  'space',
  'mind',
];

/** Whether a string names a focus kind. */
export const isFocusKind = (kind: string): kind is FocusKind =>
  (FOCUS_KINDS as readonly string[]).includes(kind);

/** How a focus is projected — the aspect *is* the intent (§7). Open registry. */
export type Aspect = string;

/** The core aspect IDs as a const tuple for exhaustiveness checking. */
export const ASPECTS = ['neighborhood', 'content', 'provenance', 'origin', 'history', 'ambient', 'direct'] as const;

/** Whether a string names a registered aspect. */
export const isAspect = (aspect: string): boolean => aspectProjectionIds().includes(aspect);

/**
 * The UI.16 surface each aspect absorbs (§7/§15) — where a projection is rendered
 * until it has a dedicated renderer. `undefined` means the aspect is new.
 */
export const ASPECT_SURFACES: Readonly<Record<string, string | undefined>> = {
  neighborhood: 'graph-viewport',
  content: 's-node-body',
  provenance: 's-explain',
  origin: undefined,
  history: 's-timeline',
  ambient: 's-events',
  direct: 's-settings',
};

/** Human-readable labels for aspects. */
export const ASPECT_LABELS: Record<string, string> = {
  neighborhood: 'Neighborhood',
  content: 'Content',
  provenance: 'Provenance',
  origin: 'Origin',
  history: 'History',
  ambient: 'Ambient',
  direct: 'Direct',
};

/** Icon names for aspects. */
export const ASPECT_ICONS: Record<string, string> = {
  neighborhood: 'gitBranch',
  content: 'fileText',
  provenance: 'gitFork',
  origin: 'source',
  history: 'history',
  ambient: 'radio',
  direct: 'settings',
};

/** Expansion into a focus's containment — the fractal's discrete ladder (§8, §19.1). */
export const DEPTHS = [0, 1, 2, 3] as const;

/** The deepest rung of the depth ladder. */
export const MAX_DEPTH = DEPTHS[DEPTHS.length - 1] as number;

/** A depth is an integer on the ladder. */
export type Depth = number;

/** Clamp a depth to the ladder — depth 0 flattens, higher reveals containment. */
export const clampDepth = (depth: number): Depth =>
  Math.max(0, Math.min(MAX_DEPTH, Math.round(depth)));

/**
 * The unit of the interface (§3): a focus projected by an aspect, at a depth, at a
 * time. `expanded` says whether this cell's children are shown.
 */
export interface FocusCell {
  readonly focus: FocusRef;
  readonly aspect: Aspect;
  readonly depth: Depth;
  readonly time: TimeRef;
  readonly expanded: boolean;
}

/** The aspect a cell takes when none is chosen. */
export const DEFAULT_ASPECT: Aspect = 'content';

/** Build a cell for a focus, overriding only the coordinates that differ. */
export const cellFor = (
  focusRef: FocusRef,
  overrides: Partial<Omit<FocusCell, 'focus'>> = {}
): FocusCell => ({
  focus: focusRef,
  aspect: overrides.aspect ?? DEFAULT_ASPECT,
  depth: clampDepth(overrides.depth ?? 0),
  time: overrides.time ?? LIVE,
  expanded: overrides.expanded ?? false,
});

/** Stable key for a cell — its full coordinate address. */
export const cellKey = (cell: FocusCell): string =>
  `${focusKey(cell.focus)}|${cell.aspect}|${cell.depth}|${timeKey(cell.time)}`;

/** Whether two cells render the same coordinates. */
export const cellEquals = (a: FocusCell, b: FocusCell): boolean => cellKey(a) === cellKey(b);

/** URL fragment prefix for focus coordinates. */
export const FOCUS_FRAGMENT_PREFIX = 'focus=';

/** Encode a FocusCell to a URL fragment string. */
export const encodeFocusFragment = (cell: FocusCell): string =>
  `${FOCUS_FRAGMENT_PREFIX}${cellKey(cell)}`;

/** Parse a URL fragment string back to a FocusCell, or null if invalid. */
export const decodeFocusFragment = (fragment: string): FocusCell | null => {
  if (!fragment.startsWith(FOCUS_FRAGMENT_PREFIX)) return null;
  const key = fragment.slice(FOCUS_FRAGMENT_PREFIX.length);
  const [focusPart, aspectPart, depthPart, timePart] = key.split('|');
  if (!focusPart || !aspectPart || !depthPart || !timePart) return null;

  const focus = parseFocusKey(focusPart);
  if (!focus) return null;

  const aspect = isAspect(aspectPart) ? aspectPart : DEFAULT_ASPECT;
  const depth = clampDepth(Number(depthPart));
  const time = parseTimeKey(timePart);
  if (!time) return null;

  return { focus, aspect, depth, time, expanded: false };
};

/** Parse a focusKey string back to a FocusRef. */
function parseFocusKey(key: string): FocusRef | null {
  const [kind, ...rest] = key.split(':');
  if (!kind) return null;
  const value = rest.join(':');

  switch (kind) {
    case 'concept':
      return focus.concept(value);
    case 'task': {
      const [taskType, term] = value.split(':', 2);
      if (!taskType || !term || !['belief', 'goal', 'question'].includes(taskType)) return null;
      return focus.task(term, taskType as TaskType);
    }
    case 'goal':
      return focus.goal(value);
    case 'derivation':
      return focus.derivation(value);
    case 'step': {
      const [derivationId, indexStr] = value.split('#', 2);
      const index = Number(indexStr);
      if (!derivationId || Number.isNaN(index)) return null;
      return focus.step(derivationId, index);
    }
    case 'proposal':
      return focus.proposal(value);
    case 'judgment':
      return focus.judgment(value);
    case 'turn':
      return focus.turn(value);
    case 'event':
      return focus.event(value);
    case 'cycle':
      return focus.cycle(value);
    case 'trace':
      return focus.trace(value);
    case 'time': {
      const time = parseTimeKey(value);
      return time ? focus.time(time) : null;
    }
    case 'drive':
      return focus.drive(value);
    case 'space':
      return focus.space(value);
    case 'mind':
      return MIND_FOCUS;
    default:
      return null;
  }
}

/** Parse a timeKey string back to a TimeRef. */
function parseTimeKey(key: string): TimeRef | null {
  if (key === 'live') return LIVE;
  if (key.startsWith('at:')) {
    const t = Number(key.slice(3));
    return Number.isNaN(t) ? null : atTime(t);
  }
  if (key.startsWith('range:')) {
    const [fromStr, toStr] = key.slice(6).split('-', 2);
    const from = Number(fromStr);
    const to = Number(toStr);
    if (Number.isNaN(from) || Number.isNaN(to)) return null;
    return timeRange(from, to);
  }
  return null;
}

/** Ensure core aspects are registered on first import. */
registerCoreAspects();