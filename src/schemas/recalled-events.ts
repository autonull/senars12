/**
 * Event type allowlists for durable storage and episodic recall (CORE.19 C1.2).
 *
 * Separated from the schemas barrel to avoid circular dependency issues during
 * module evaluation. The original definitions lived in schemas/index.ts but
 * importing from that barrel pulls in the entire schema graph.
 */

/** Which cognitive events the append-only log keeps. */
export const DURABLE_EVENT_TYPES = new Set([
  'task.admitted',
  'derivation.accepted',
  'derivation.record',
  'belief.added',
  'belief.retracted',
  'belief.revised',
  'atom.derived',
  'atom.retracted',
  'goal.achieved',
  'goal.failed',
  'skill.executed',
  'tool.response',
  'conflict:detected',
  'budget.exhausted',
  'policy.violation',
  'autonomy.mode.changed',
  'egress.gate.rejected',
  'shadow.validation.dropped',
  'proposal.admitted',
  'proposal.rejected',
  'self-mod.proposal',
  'bootstrap',
]);

/**
 * The durable subset episodic recall reads. Keeps the conversational and belief
 * signal; drops the derivation firehose and the governance families that are
 * audit-only.
 */
export const RECALLED_EVENT_TYPES = new Set([
  'input.user',
  'belief.added',
  'belief.retracted',
  'belief.revised',
  'task.admitted',
  'derivation.accepted',
  'tool.request',
  'tool.response',
  'skill.executed',
  'goal.achieved',
  'goal.failed',
  'conflict:detected',
  'policy.violation',
  'budget.exhausted',
  'autonomy.mode.changed',
]);

export const isDurableEvent = (event: { type: string }): boolean =>
  DURABLE_EVENT_TYPES.has(event.type);

/** The recalled allowlist as the array `EventLog.query` accepts, in a stable order. */
export const recalledEventTypes = (): string[] => [...RECALLED_EVENT_TYPES];