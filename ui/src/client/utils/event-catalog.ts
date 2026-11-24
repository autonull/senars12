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
import type { Shape } from '../core/view-spec';
import { defineCatalog } from '../framework/catalog';

/** Coarse grouping for filtering, narration tone and gallery/report sections. */
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
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

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

export const EVENT_CATALOG = defineCatalog({
  'input.user': {
    label: 'User input',
    category: 'input',
    severity: 'info',
    provenanceRole: 'stimulus',
    shapes: ['table', 'text'],
  },
  'derivation.made': {
    label: 'Derivation',
    category: 'reasoning',
    severity: 'info',
    provenanceRole: 'conclusion',
    shapes: ['graph', 'tree', 'table', 'series'],
  },
  'derivation.record': {
    label: 'Derivation Record',
    category: 'reasoning',
    severity: 'info',
    provenanceRole: 'conclusion',
    shapes: ['tree', 'table', 'text'],
  },
  'atom.derived': {
    label: 'Atom derived',
    category: 'memory',
    severity: 'info',
    provenanceRole: 'conclusion',
    shapes: ['graph', 'table'],
  },
  'atom.retracted': {
    label: 'Atom retracted',
    category: 'memory',
    severity: 'notice',
    provenanceRole: 'retraction',
    shapes: ['graph', 'table'],
  },
  'belief.added': {
    label: 'Belief added',
    category: 'belief',
    severity: 'info',
    provenanceRole: 'conclusion',
    shapes: ['graph', 'series', 'table'],
  },
  'belief.retracted': {
    label: 'Belief retracted',
    category: 'belief',
    severity: 'notice',
    provenanceRole: 'retraction',
    shapes: ['graph', 'table'],
  },
  'drive.changed': {
    label: 'Drive changed',
    category: 'goal',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['series', 'table'],
  },
  'goal.achieved': {
    label: 'Goal achieved',
    category: 'goal',
    severity: 'notice',
    provenanceRole: 'verdict',
    shapes: ['graph', 'table'],
  },
  'goal.failed': {
    label: 'Goal failed',
    category: 'goal',
    severity: 'warning',
    provenanceRole: 'verdict',
    shapes: ['graph', 'table'],
  },
  'skill.executed': {
    label: 'Skill executed',
    category: 'skill',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['graph', 'table'],
  },
  'tool.request': {
    label: 'Tool request',
    category: 'tool',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'tool.response': {
    label: 'Tool response',
    category: 'tool',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'config.set': {
    label: 'Config set',
    category: 'config',
    severity: 'info',
    provenanceRole: 'meta',
    shapes: ['table', 'text'],
  },
  'config.delete': {
    label: 'Config deleted',
    category: 'config',
    severity: 'info',
    provenanceRole: 'meta',
    shapes: ['table', 'text'],
  },
  'config.schema': {
    label: 'Config schema',
    category: 'config',
    severity: 'info',
    provenanceRole: 'meta',
    shapes: ['table'],
  },
  'kernel.ready': {
    label: 'Kernel ready',
    category: 'system',
    severity: 'notice',
    provenanceRole: 'meta',
    shapes: ['text', 'table'],
  },
  'backend.registered': {
    label: 'Backend registered',
    category: 'system',
    severity: 'notice',
    provenanceRole: 'meta',
    shapes: ['text', 'table'],
  },
  bootstrap: {
    label: 'Bootstrap',
    category: 'system',
    severity: 'notice',
    provenanceRole: 'meta',
    shapes: ['text', 'table'],
  },
  cycle: {
    label: 'Cycle',
    category: 'telemetry',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['series', 'table'],
  },
  health: {
    label: 'Health',
    category: 'telemetry',
    severity: 'notice',
    provenanceRole: 'activity',
    shapes: ['series', 'table'],
  },
  'conflict:detected': {
    label: 'Conflict detected',
    category: 'reasoning',
    severity: 'warning',
    provenanceRole: 'contradiction',
    shapes: ['graph', 'table', 'tree'],
  },
  'task.admitted': {
    label: 'Task admitted',
    category: 'reasoning',
    severity: 'info',
    provenanceRole: 'premise',
    shapes: ['graph', 'tree', 'table'],
  },
  'derivation.accepted': {
    label: 'Derivation accepted',
    category: 'reasoning',
    severity: 'info',
    provenanceRole: 'conclusion',
    shapes: ['graph', 'tree', 'table'],
  },
  'belief.revised': {
    label: 'Belief revised',
    category: 'belief',
    severity: 'notice',
    provenanceRole: 'revision',
    shapes: ['graph', 'series', 'table'],
  },
  'concept.activated': {
    label: 'Concept activated',
    category: 'memory',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['graph', 'series', 'table'],
  },
  'budget.exhausted': {
    label: 'Budget exhausted',
    category: 'budget',
    severity: 'warning',
    provenanceRole: 'resource',
    shapes: ['series', 'table'],
  },
  'budget.consumed': {
    label: 'Budget consumed',
    category: 'budget',
    severity: 'info',
    provenanceRole: 'resource',
    shapes: ['series', 'table'],
  },
  'policy.violation': {
    label: 'Policy violation',
    category: 'governance',
    severity: 'error',
    provenanceRole: 'policy',
    shapes: ['table', 'text'],
  },
  'autonomy.mode.changed': {
    label: 'Autonomy changed',
    category: 'governance',
    severity: 'notice',
    provenanceRole: 'policy',
    shapes: ['table', 'text'],
  },
  'self-mod.proposal': {
    label: 'Self-mod proposal',
    category: 'governance',
    severity: 'notice',
    provenanceRole: 'verdict',
    shapes: ['table', 'tree'],
  },
  'judgment.resolved': {
    label: 'Judgment resolved',
    category: 'judgment',
    severity: 'info',
    provenanceRole: 'verdict',
    shapes: ['table', 'series'],
  },
  'egress.gate.rejected': {
    label: 'Egress gate rejected',
    category: 'judgment',
    severity: 'warning',
    provenanceRole: 'verdict',
    shapes: ['table', 'text'],
  },
  'gate.failed': {
    label: 'Gate failed',
    category: 'judgment',
    severity: 'error',
    provenanceRole: 'verdict',
    shapes: ['table', 'text'],
  },
  'gate.passed': {
    label: 'Gate passed',
    category: 'judgment',
    severity: 'notice',
    provenanceRole: 'verdict',
    shapes: ['table', 'text'],
  },
  'shadow.validation.dropped': {
    label: 'Shadow validation dropped',
    category: 'memory',
    severity: 'notice',
    provenanceRole: 'retraction',
    shapes: ['table', 'text'],
  },
  'proposal.admitted': {
    label: 'Proposal admitted',
    category: 'proposal',
    severity: 'notice',
    provenanceRole: 'verdict',
    shapes: ['graph', 'table', 'tree'],
  },
  'proposal.rejected': {
    label: 'Proposal rejected',
    category: 'proposal',
    severity: 'warning',
    provenanceRole: 'verdict',
    shapes: ['graph', 'table', 'tree'],
  },
  'proposal.submitted': {
    label: 'Proposal submitted',
    category: 'proposal',
    severity: 'info',
    provenanceRole: 'premise',
    shapes: ['graph', 'table', 'tree'],
  },
  'snapshot.created': {
    label: 'Snapshot created',
    category: 'system',
    severity: 'notice',
    provenanceRole: 'meta',
    shapes: ['text', 'table'],
  },
  'snapshot.restored': {
    label: 'Snapshot restored',
    category: 'system',
    severity: 'notice',
    provenanceRole: 'meta',
    shapes: ['text', 'table'],
  },
  // --- Additional NAR events ---
  'memory.pressure': {
    label: 'Memory pressure',
    category: 'memory',
    severity: 'warning',
    provenanceRole: 'resource',
    shapes: ['series', 'table'],
  },
  'memory.consolidated': {
    label: 'Memory consolidated',
    category: 'memory',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['series', 'table'],
  },
  'lm.call': {
    label: 'LM call',
    category: 'skill',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'lm.error': {
    label: 'LM error',
    category: 'skill',
    severity: 'error',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  error: {
    label: 'Error',
    category: 'system',
    severity: 'error',
    provenanceRole: 'meta',
    shapes: ['table', 'text'],
  },
  'nl.analyzed': {
    label: 'NL analyzed',
    category: 'input',
    severity: 'info',
    provenanceRole: 'stimulus',
    shapes: ['table', 'text'],
  },
  'nl.translation': {
    label: 'NL translation',
    category: 'input',
    severity: 'info',
    provenanceRole: 'conclusion',
    shapes: ['table', 'text'],
  },
  'nl.clarification_needed': {
    label: 'NL clarification needed',
    category: 'input',
    severity: 'warning',
    provenanceRole: 'stimulus',
    shapes: ['table', 'text'],
  },
  'nal.derived': {
    label: 'NAL derived',
    category: 'reasoning',
    severity: 'info',
    provenanceRole: 'conclusion',
    shapes: ['table'],
  },
  'lm.validation_failed': {
    label: 'LM validation failed',
    category: 'skill',
    severity: 'warning',
    provenanceRole: 'verdict',
    shapes: ['table', 'text'],
  },
  'feedback.correction': {
    label: 'Feedback correction',
    category: 'reasoning',
    severity: 'info',
    provenanceRole: 'revision',
    shapes: ['table', 'text'],
  },
  'turn.start': {
    label: 'Turn start',
    category: 'system',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'turn.end': {
    label: 'Turn end',
    category: 'system',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'turn.error': {
    label: 'Turn error',
    category: 'system',
    severity: 'error',
    provenanceRole: 'meta',
    shapes: ['table', 'text'],
  },
  'stage.start': {
    label: 'Stage start',
    category: 'system',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'stage.end': {
    label: 'Stage end',
    category: 'system',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'stage.error': {
    label: 'Stage error',
    category: 'system',
    severity: 'error',
    provenanceRole: 'meta',
    shapes: ['table', 'text'],
  },
  'classify.result': {
    label: 'Classify result',
    category: 'reasoning',
    severity: 'info',
    provenanceRole: 'verdict',
    shapes: ['table', 'text'],
  },
  'trigger.score': {
    label: 'Trigger score',
    category: 'reasoning',
    severity: 'info',
    provenanceRole: 'verdict',
    shapes: ['series', 'table'],
  },
  'reasoning.start': {
    label: 'Reasoning start',
    category: 'reasoning',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'reasoning.end': {
    label: 'Reasoning end',
    category: 'reasoning',
    severity: 'info',
    provenanceRole: 'conclusion',
    shapes: ['table', 'text'],
  },
  'lm.start': {
    label: 'LM start',
    category: 'skill',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'lm.chunk': {
    label: 'LM chunk',
    category: 'skill',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'lm.end': {
    label: 'LM end',
    category: 'skill',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'lm.suggests_reasoning': {
    label: 'LM suggests reasoning',
    category: 'skill',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'lm_rule.executed': {
    label: 'LM rule executed',
    category: 'skill',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'lm_rule.failed': {
    label: 'LM rule failed',
    category: 'skill',
    severity: 'error',
    provenanceRole: 'verdict',
    shapes: ['table', 'text'],
  },
  'lm_rule.disabled': {
    label: 'LM rule disabled',
    category: 'skill',
    severity: 'notice',
    provenanceRole: 'meta',
    shapes: ['table', 'text'],
  },
  'directive.found': {
    label: 'Directive found',
    category: 'system',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'directive.execute': {
    label: 'Directive execute',
    category: 'system',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'directive.loop_requested': {
    label: 'Directive loop requested',
    category: 'system',
    severity: 'notice',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'loop.pass': {
    label: 'Loop pass',
    category: 'system',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['series', 'table'],
  },
  'conversation.message_added': {
    label: 'Conversation message added',
    category: 'system',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'conversation.artifact_added': {
    label: 'Conversation artifact added',
    category: 'system',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'conversation.belief_pinned': {
    label: 'Conversation belief pinned',
    category: 'belief',
    severity: 'notice',
    provenanceRole: 'meta',
    shapes: ['table', 'text'],
  },
  'conversation.summarized': {
    label: 'Conversation summarized',
    category: 'system',
    severity: 'info',
    provenanceRole: 'meta',
    shapes: ['table', 'text'],
  },
  'system_lm_rule.applied': {
    label: 'System LM rule applied',
    category: 'skill',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'system_lm_rule.skipped': {
    label: 'System LM rule skipped',
    category: 'skill',
    severity: 'notice',
    provenanceRole: 'meta',
    shapes: ['table', 'text'],
  },
  'system_lm_rule.structured': {
    label: 'System LM rule structured',
    category: 'skill',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'system_lm_rule.tool_called': {
    label: 'System LM rule tool called',
    category: 'tool',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'system_lm_rule.tool_result': {
    label: 'System LM rule tool result',
    category: 'tool',
    severity: 'info',
    provenanceRole: 'activity',
    shapes: ['table', 'text'],
  },
  'system_lm_rule.failed': {
    label: 'System LM rule failed',
    category: 'skill',
    severity: 'error',
    provenanceRole: 'verdict',
    shapes: ['table', 'text'],
  },
  'system_lm_rule.circuit_open': {
    label: 'System LM rule circuit open',
    category: 'skill',
    severity: 'warning',
    provenanceRole: 'policy',
    shapes: ['table', 'text'],
  },
  'system_lm_rule.circuit_half_open': {
    label: 'System LM rule circuit half-open',
    category: 'skill',
    severity: 'notice',
    provenanceRole: 'policy',
    shapes: ['table', 'text'],
  },
  'system_lm_rule.circuit_closed': {
    label: 'System LM rule circuit closed',
    category: 'skill',
    severity: 'info',
    provenanceRole: 'policy',
    shapes: ['table', 'text'],
  },
} as const satisfies Record<CognitiveEvent['type'], { label: string; category: EventCategory; severity: EventSeverity; provenanceRole: ProvenanceRole; shapes: readonly Shape[] }>);

export type EventType = keyof typeof EVENT_CATALOG.definition;

export const EVENT_TYPES = EVENT_CATALOG.ids;

export type EventEntry = typeof EVENT_CATALOG.definition[EventType];

export const eventMeta = (type: EventType): EventEntry => EVENT_CATALOG.get(type)!;

export const eventsByCategory = (category: EventCategory): EventType[] =>
  EVENT_CATALOG.ids.filter((id) => EVENT_CATALOG.get(id)!.category === category);

export const eventsByShape = (shape: Shape): EventType[] =>
  EVENT_CATALOG.ids.filter((id) => EVENT_CATALOG.get(id)!.shapes.some((candidate) => candidate === shape));

export const eventsBySeverity = (severity: EventSeverity): EventType[] =>
  EVENT_CATALOG.ids.filter((id) => EVENT_CATALOG.get(id)!.severity === severity);