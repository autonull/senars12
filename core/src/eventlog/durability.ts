/**
 * Which cognitive events the append-only log keeps, and which of those episodic
 * recall reads (CORE.19 C1.2).
 *
 * The durable log and the recall window answer different questions. The log is
 * the audit surface and wants every family a turn can be held to; recall is
 * prompt context and wants only the families a turn can reason about. Wiring the
 * NAR bridge into the log without saying which is which would let the per-cycle
 * heartbeat and per-fire derivation pings displace real memory from a window
 * that is capped at {@link RECALL_WINDOW} — so the two sets are declared here,
 * beside the log they bound, rather than inferred at the write site.
 *
 * `input.user` and `tool.request` are absent on purpose: both are appended
 * explicitly by the cycle because a later phase joins to the *returned* id, and
 * re-appending them here would double every turn.
 */
import type { CognitiveEvent } from '../schemas/index.js';

/**
 * Families the single emit funnel persists to the log. Excludes the ephemeral
 * telemetry (`cycle`, `health`, `config.*`), the priority/urgency churn
 * (`concept.activated`, `drive.changed`), and `derivation.made` — which is the
 * live ping whose durable form is `derivation.accepted`.
 */
export const DURABLE_EVENT_TYPES: ReadonlySet<CognitiveEvent['type']> = new Set([
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
]);

/**
 * The durable subset episodic recall reads. Keeps the conversational and belief
 * signal; drops the derivation firehose and the governance families that are
 * audit-only.
 */
export const RECALLED_EVENT_TYPES: ReadonlySet<CognitiveEvent['type']> = new Set([
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

export const isDurableEvent = (event: CognitiveEvent): boolean =>
  DURABLE_EVENT_TYPES.has(event.type);

/** The recalled allowlist as the array `EventLog.query` accepts, in a stable order. */
export const recalledEventTypes = (): string[] => [...RECALLED_EVENT_TYPES];
