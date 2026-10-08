/**
 * The one presentation registry for the cognitive event vocabulary — every
 * discriminant of `CognitiveEventSchema` gets exactly one metadata entry here,
 * and the bridge, reducers, event log, timeline, provenance and narration read
 * it instead of hardcoding labels, categories or severities.
 *
 * Exhaustiveness is a type, not a review catch: `satisfies Record<CognitiveEvent['type'], …>`
 * fails the build the moment a schema gains a variant without presentation metadata,
 * and rejects a typo the moment this map gains an unknown key.
 */

import type { CognitiveEvent } from '@senars/core';
import type { Shape } from '../core/view-spec.js';

/** Coarse grouping for filtering, narration tone and gallery/report sections. */
export type EventCategory =
  | 'input'
  | 'reasoning'
  | 'belief'
  | 'memory'
  | 'goal'
  | 'skill'
  | 'tool'
  | 'proposal'
  | 'judgment'
  | 'budget'
  | 'governance'
  | 'config'
  | 'system'
  | 'telemetry';

/** Visual/`aria-live` weight. `error` and `warning` must never be color-only (Phase 7.5). */
export type EventSeverity = 'info' | 'notice' | 'warning' | 'error';

/**
 * How the event participates in provenance — the seam the provenance tree (§6.2)
 * and revision inspector (§6.1) hang derivation edges and diffs off.
 */
export type ProvenanceRole =
  | 'stimulus'
  | 'premise'
  | 'conclusion'
  | 'revision'
  | 'retraction'
  | 'contradiction'
  | 'verdict'
  | 'resource'
  | 'policy'
  | 'meta'
  | 'activity';

/** Presentation shapes (§3.3). The view system owns the union; this is its event-side alias. */
export type ViewShape = Shape;

export type EventMeta = {
  readonly label: string;
  readonly category: EventCategory;
  readonly severity: EventSeverity;
  readonly provenanceRole: ProvenanceRole;
  readonly shapes: readonly Shape[];
};

export const EVENT_CATALOG = {
  'input.user': { label: 'User input', category: 'input', severity: 'info', provenanceRole: 'stimulus', shapes: ['table', 'text'] },
  'derivation.made': { label: 'Derivation', category: 'reasoning', severity: 'info', provenanceRole: 'conclusion', shapes: ['graph', 'tree', 'table', 'series'] },
  'atom.derived': { label: 'Atom derived', category: 'memory', severity: 'info', provenanceRole: 'conclusion', shapes: ['graph', 'table'] },
  'atom.retracted': { label: 'Atom retracted', category: 'memory', severity: 'notice', provenanceRole: 'retraction', shapes: ['graph', 'table'] },
  'belief.added': { label: 'Belief added', category: 'belief', severity: 'info', provenanceRole: 'conclusion', shapes: ['graph', 'series', 'table'] },
  'belief.retracted': { label: 'Belief retracted', category: 'belief', severity: 'notice', provenanceRole: 'retraction', shapes: ['graph', 'table'] },
  'drive.changed': { label: 'Drive changed', category: 'goal', severity: 'info', provenanceRole: 'activity', shapes: ['series', 'table'] },
  'goal.achieved': { label: 'Goal achieved', category: 'goal', severity: 'notice', provenanceRole: 'verdict', shapes: ['graph', 'table'] },
  'goal.failed': { label: 'Goal failed', category: 'goal', severity: 'warning', provenanceRole: 'verdict', shapes: ['graph', 'table'] },
  'skill.executed': { label: 'Skill executed', category: 'skill', severity: 'info', provenanceRole: 'activity', shapes: ['graph', 'table'] },
  'tool.request': { label: 'Tool request', category: 'tool', severity: 'info', provenanceRole: 'activity', shapes: ['table', 'text'] },
  'tool.response': { label: 'Tool response', category: 'tool', severity: 'info', provenanceRole: 'activity', shapes: ['table', 'text'] },
  'config.set': { label: 'Config set', category: 'config', severity: 'info', provenanceRole: 'meta', shapes: ['table', 'text'] },
  'config.delete': { label: 'Config deleted', category: 'config', severity: 'info', provenanceRole: 'meta', shapes: ['table', 'text'] },
  'config.schema': { label: 'Config schema', category: 'config', severity: 'info', provenanceRole: 'meta', shapes: ['table'] },
  'kernel.ready': { label: 'Kernel ready', category: 'system', severity: 'notice', provenanceRole: 'meta', shapes: ['text', 'table'] },
  'backend.registered': { label: 'Backend registered', category: 'system', severity: 'notice', provenanceRole: 'meta', shapes: ['text', 'table'] },
  bootstrap: { label: 'Bootstrap', category: 'system', severity: 'notice', provenanceRole: 'meta', shapes: ['text', 'table'] },
  cycle: { label: 'Cycle', category: 'telemetry', severity: 'info', provenanceRole: 'activity', shapes: ['series', 'table'] },
  health: { label: 'Health', category: 'telemetry', severity: 'notice', provenanceRole: 'activity', shapes: ['series', 'table'] },
  'conflict:detected': { label: 'Conflict detected', category: 'reasoning', severity: 'warning', provenanceRole: 'contradiction', shapes: ['graph', 'table', 'tree'] },
  'task.admitted': { label: 'Task admitted', category: 'reasoning', severity: 'info', provenanceRole: 'premise', shapes: ['graph', 'tree', 'table'] },
  'derivation.accepted': { label: 'Derivation accepted', category: 'reasoning', severity: 'info', provenanceRole: 'conclusion', shapes: ['graph', 'tree', 'table'] },
  'belief.revised': { label: 'Belief revised', category: 'belief', severity: 'notice', provenanceRole: 'revision', shapes: ['graph', 'series', 'table'] },
  'concept.activated': { label: 'Concept activated', category: 'memory', severity: 'info', provenanceRole: 'activity', shapes: ['graph', 'series', 'table'] },
  'budget.exhausted': { label: 'Budget exhausted', category: 'budget', severity: 'warning', provenanceRole: 'resource', shapes: ['series', 'table'] },
  'policy.violation': { label: 'Policy violation', category: 'governance', severity: 'error', provenanceRole: 'policy', shapes: ['table', 'text'] },
  'autonomy.mode.changed': { label: 'Autonomy changed', category: 'governance', severity: 'notice', provenanceRole: 'policy', shapes: ['table', 'text'] },
  'self-mod.proposal': { label: 'Self-mod proposal', category: 'governance', severity: 'notice', provenanceRole: 'verdict', shapes: ['table', 'tree'] },
  'judgment.resolved': { label: 'Judgment resolved', category: 'judgment', severity: 'info', provenanceRole: 'verdict', shapes: ['table', 'series'] },
  'egress.gate.rejected': { label: 'Egress gate rejected', category: 'judgment', severity: 'warning', provenanceRole: 'verdict', shapes: ['table', 'text'] },
  'shadow.validation.dropped': { label: 'Shadow validation dropped', category: 'memory', severity: 'notice', provenanceRole: 'retraction', shapes: ['table', 'text'] },
  'proposal.admitted': { label: 'Proposal admitted', category: 'proposal', severity: 'notice', provenanceRole: 'verdict', shapes: ['graph', 'table', 'tree'] },
  'proposal.rejected': { label: 'Proposal rejected', category: 'proposal', severity: 'warning', provenanceRole: 'verdict', shapes: ['graph', 'table', 'tree'] },
} satisfies Record<CognitiveEvent['type'], EventMeta>;

export type EventType = keyof typeof EVENT_CATALOG;

export const EVENT_TYPES = Object.keys(EVENT_CATALOG) as EventType[];

export const EVENT_CATEGORIES = [
  'input',
  'reasoning',
  'belief',
  'memory',
  'goal',
  'skill',
  'tool',
  'proposal',
  'judgment',
  'budget',
  'governance',
  'config',
  'system',
  'telemetry',
] as const satisfies readonly EventCategory[];

export const eventMeta = (type: EventType): EventMeta => EVENT_CATALOG[type];

export const eventsByCategory = (category: EventCategory): EventType[] =>
  EVENT_TYPES.filter((type) => EVENT_CATALOG[type].category === category);

export const eventsByShape = (shape: Shape): EventType[] =>
  EVENT_TYPES.filter((type) => EVENT_CATALOG[type].shapes.some((candidate) => candidate === shape));

export const eventsBySeverity = (severity: EventSeverity): EventType[] =>
  EVENT_TYPES.filter((type) => EVENT_CATALOG[type].severity === severity);
