/**
 * The resource inventory (TODO29.a §5.8, A8).
 *
 * > Every unbounded resource has an explicit owner and a declared lifecycle
 * > policy — what it holds, who owns it, its capacity, its retention rule, its
 * > overflow behaviour, and the signal it raises when capacity cannot be
 * > reclaimed.
 *
 * **The capacity is not written here.** Each record names the *module* and the
 * *binding* that holds the bound, so the inventory cannot drift from the code:
 * a bound changed in `Memory` or in `DEFAULT_MEMORY_CONFIG` moves the record,
 * and the `resource:policy` gate reads the real value rather than a copy. That
 * is the whole difference between this and TODO28's accumulator ledger, which
 * asserted that two hand-listed *paths contained the text `LruCache`* — a check
 * on spelling that could not notice the bound being raised.
 *
 * **What the inventory is not.** It is not a claim that these are every
 * unbounded container in the tree; TODO28's audit measured that a derived
 * detection rule yields 574 candidates, 302 unpruned, which is too noisy to be a
 * gate. It is the declaration, and the gate's job is that every declaration is
 * *live* — read by its owner, finite, and paired with a retention and overflow
 * rule — not that the list is exhaustive.
 */

import { DEFAULT_MEMORY_CONFIG } from '../memory/config.js';
import { GATE_LOG_CAPACITY } from '../kernel/event-ring.js';
import { DEFAULT_REPUTATION_CAPACITY } from '../kernel/source-reputation.js';
import { DEFAULT_QUEUE_LIMITS, PROPOSAL_LOG_CAPACITY } from '../proposal/lifecycle.js';
import { DEFAULT_QBELIEF_CAPACITY } from '../rl/impls/QBeliefStore.js';

/** Where a bound is *declared*, rather than a copy of it. */
export interface CapacitySource {
  /** Repo-relative module that declares the bound. */
  readonly module: string;
  /** The exported binding holding it — a number, or an object with `field`. */
  readonly symbol: string;
  /** For a numeric record: the property that carries the bound. */
  readonly field?: string;
}

/**
 * How a resource sheds once it is full. The four words are the ones the code can
 * actually do; anything else would be a policy with no implementation.
 */
export type Retention =
  | 'drop-oldest'
  | 'drop-lowest-value'
  | 'drop-newest'
  | 'refuse-newest'
  | 'archive-then-forget'
  | 'bounded-set';

/**
 * A resource's whole declaration, in the order §5.8 prints it:
 * `resource · owner · capacity · retention policy · overflow behaviour · pressure signal`.
 */
export interface ResourceContract {
  /** Stable id — what a violation names. */
  readonly id: string;
  readonly holds: string;
  readonly owner: string;
  readonly capacity: CapacitySource;
  readonly retention: Retention;
  readonly overflow: string;
  /**
   * What an operator sees when capacity cannot be reclaimed. `null` when the
   * resource genuinely cannot be reclaimed — the honest answer for an LRU over a
   * key space that never repeats, and a blank here would hide that.
   */
  readonly pressureSignal: string | null;
}

const memory = (field: string): CapacitySource => ({
  module: 'nar/src/memory/config.ts',
  symbol: 'DEFAULT_MEMORY_CONFIG',
  field,
});

export const RESOURCE_CONTRACTS: readonly ResourceContract[] = [
  {
    id: 'memory.concepts',
    holds: 'resident concepts, one per known term',
    owner: 'nar/src/memory/memory.ts',
    capacity: memory('maxConcepts'),
    retention: 'archive-then-forget',
    overflow:
      'two paths, both declared here. The consolidation pass (`evictUnderPressure`) archives the lowest-value idle concepts above PRESSURE.ARCHIVE and hardens to removal above PRESSURE.CRITICAL. The admission guard (`Memory.addConcept` at capacity) instead sheds one victim chosen by the configured `forgettingPolicy` — a second policy, outside this contract’s ranking, kept because removing it is a public-API break and TODO30 §7 owns the eviction containers',
    pressureSignal: 'getStatistics().memoryPressure, and checkHealth().forgettingNeeded',
  },
  {
    id: 'memory.tasks',
    holds: 'tasks held across every resident concept — the dominant consumer, not the concept count',
    owner: 'nar/src/memory/memory.ts',
    capacity: memory('maxTasks'),
    retention: 'drop-lowest-value',
    overflow:
      'a concept ages out while holding tasks once nothing idle remains, ranked by age × value; a store at capacity with nothing eligible says so',
    pressureSignal: 'getStatistics().memoryPressure',
  },
  {
    id: 'memory.archive',
    holds: 'archived concepts, evictable again by term',
    owner: 'nar/src/memory/lifecycle/archive.ts',
    capacity: memory('archiveMaxConcepts'),
    retention: 'drop-oldest',
    overflow: 'LruCache evicts the least recently retrieved; no signal — the archive is a cache, not a store',
    pressureSignal: null,
  },
  {
    id: 'memory.focus',
    holds: 'the focused working set every topK read serves',
    owner: 'nar/src/memory/focus.ts',
    capacity: memory('focusMaxConcepts'),
    retention: 'drop-lowest-value',
    overflow: 'the lowest-priority concept leaves focus; focus is a projection, so nothing is lost',
    pressureSignal: null,
  },
  {
    id: 'memory.revision-log',
    holds: 'revision entries, keyed by term key',
    owner: 'nar/src/memory/memory.ts',
    capacity: {
      module: 'nar/src/memory/memory.ts',
      symbol: 'Memory',
      field: 'REVISION_LOG_CAP',
    },
    retention: 'drop-oldest',
    overflow: 'BoundedRing drops the oldest entry; a dropped revision is a lost history, not a lost belief',
    pressureSignal: null,
  },
  {
    id: 'memory.links',
    holds: 'term-to-term association links, per layer',
    owner: 'nar/src/memory/links/LinkManager.ts',
    capacity: memory('linkCapacity'),
    retention: 'drop-lowest-value',
    overflow: `the configured forgetPolicy (${'priority'} by default) sheds the weakest link at capacity`,
    pressureSignal: null,
  },
  {
    id: 'kernel.gate-logs',
    holds: 'per-gate event rings — perception, action, autonomy, reward, budget',
    owner: 'nar/src/kernel/event-ring.ts',
    capacity: { module: 'nar/src/kernel/event-ring.ts', symbol: 'GATE_LOG_CAPACITY' },
    retention: 'drop-oldest',
    overflow: 'BoundedRing drops the oldest event; the ring is an audit window, not the source of truth',
    pressureSignal: null,
  },
  {
    id: 'kernel.source-reputation',
    holds: 'per-source reputation, keyed by a source id that arrives on the wire',
    owner: 'nar/src/kernel/source-reputation.ts',
    capacity: { module: 'nar/src/kernel/source-reputation.ts', symbol: 'DEFAULT_REPUTATION_CAPACITY' },
    retention: 'drop-oldest',
    overflow: 'LruCache evicts the least recently seen source',
    pressureSignal: null,
  },
  {
    id: 'stream.reasoner-queue',
    holds: 'in-flight synthesis requests awaiting a provider',
    owner: 'nar/src/stream/reasoner.ts',
    capacity: { module: 'nar/src/stream/reasoner.ts', symbol: 'REASONER_QUEUE_CAPACITY' },
    retention: 'drop-newest',
    overflow:
      'a queued request above capacity is refused and counted in stats().dropped — the request already paid for its place, so dropping the oldest would refund a decision the system acted on',
    pressureSignal: 'stats().dropped, and queuePressure()',
  },
  {
    id: 'proposal.content-queue',
    holds: 'content proposals awaiting the next boundary',
    owner: 'nar/src/proposal/lifecycle.ts',
    capacity: {
      module: 'nar/src/proposal/lifecycle.ts',
      symbol: 'DEFAULT_QUEUE_LIMITS',
      field: 'maxPendingContent',
    },
    retention: 'drop-oldest',
    overflow: 'the oldest content proposal is displaced and a queue-overflow rejection is recorded',
    pressureSignal: 'ProposalLifecycle.stats().contentDropped',
  },
  {
    id: 'proposal.rule-queue',
    holds: 'rule proposals awaiting the next boundary',
    owner: 'nar/src/proposal/lifecycle.ts',
    capacity: {
      module: 'nar/src/proposal/lifecycle.ts',
      symbol: 'DEFAULT_QUEUE_LIMITS',
      field: 'maxPendingRules',
    },
    retention: 'refuse-newest',
    overflow:
      'a rule proposal above capacity is refused with a recorded rejection — a rule is the learned capability, so it is never silently displaced',
    pressureSignal: 'ProposalLifecycle.stats().rulesRefused',
  },
  {
    id: 'decision.port-await',
    holds: 'one in-flight decision ask, while its deadline runs',
    owner: 'nar/src/ports/decision.ts',
    capacity: { module: 'nar/src/ports/decision.ts', symbol: 'DECISION_ASK_TIMEOUT_MS' },
    retention: 'drop-newest',
    overflow:
      'a decision that misses its deadline is abandoned and the caller takes its own path — a decision is advisory, so nothing is owed when one does not arrive',
    pressureSignal:
      'a cycle cannot be blocked by the port, which `tests/nar/todo29a-a11.test.ts` asserts with a never-settling port',
  },
  {
    id: 'proposal.log',
    holds: "the seam's own audit log of admissions and rejections",
    owner: 'nar/src/proposal/lifecycle.ts',
    capacity: { module: 'nar/src/proposal/lifecycle.ts', symbol: 'PROPOSAL_LOG_CAPACITY' },
    retention: 'drop-oldest',
    overflow: 'BoundedRing drops the oldest; the kernel event log is what a replay reads',
    pressureSignal: null,
  },
  {
    id: 'rl.qbelief-store',
    holds: 'beliefs over state-action pairs, keyed by an untrusted stream',
    owner: 'nar/src/rl/impls/QBeliefStore.ts',
    capacity: { module: 'nar/src/rl/impls/QBeliefStore.ts', symbol: 'DEFAULT_QBELIEF_CAPACITY' },
    retention: 'drop-oldest',
    overflow: 'LruCache evicts the least recently used state',
    pressureSignal: null,
  },
] as const satisfies readonly ResourceContract[];

/** Ids, for a gate's failure message and for a test to assert against. */
export const RESOURCE_IDS = RESOURCE_CONTRACTS.map((contract) => contract.id);
