/**
 * The in-cycle induction inventory (TODO29.a §11.1 Q1′).
 *
 * Q1′ asks which behaviours currently happen *inside a cycle* because of the
 * induction layer, and what happens to each once the cycle closes. The
 * dispositions are decisions, not derivations — which is why they are written
 * down here rather than inferred from the code, and why the gate that checks
 * them (`induction:inventory`) checks that they exist rather than what they
 * say.
 *
 * The column that carries the weight is `noticedBy`. Moving a behaviour and
 * losing it look identical from inside a diff; "who would notice its absence"
 * is the difference, and a behaviour nobody would notice is either dead code or
 * a claim nobody has tested.
 *
 * **Behaviours, not call sites.** A behaviour that the cycle reaches through
 * three routes is one row, because three rows would each look complete while
 * the behaviour had in fact been half-declared.
 */

/** Where a behaviour goes once the cycle is closed. */
export type InCycleDisposition =
  /** Runs outside the cycle, at a declared application boundary (A3). */
  | 'boundary'
  /** Stays on the cycle path, and says so. */
  | 'synchronous'
  /** Removed from the cycle path; the audit is what says it was safe. */
  | 'dropped';

export interface InCycleBehaviour {
  readonly id: string;
  /** What the system does because of the layer, named as a behaviour. */
  readonly behaviour: string;
  readonly disposition: InCycleDisposition;
  /** Who would notice, and as what, if this were absent. */
  readonly noticedBy: string;
  /** Why the disposition is the one it is. */
  readonly note?: string;
}

export const IN_CYCLE_INVENTORY: readonly InCycleBehaviour[] = [
  {
    id: 'lm-rule-derivation',
    behaviour: 'A model-backed rule derives from a premise pair, outside the cycle.',
    disposition: 'boundary',
    noticedBy:
      'Any derivation a model rule produced, now admitted at the next cycle\'s `authorize` stage ' +
      'through the perception gate. Was 33 inducer invocations per cycle (TODO29.a §13); the cycle ' +
      'now stages work and pumps it off-cycle.',
    note:
      'Moved by A1. `DefaultDerivation` calls `processor.stageLMRules`, which is a bounded queue ' +
      'push; the provider is reached only from `LMProposalProducer.pump`, which the cycle does ' +
      'not await, and every await inside it is a deadline.',
  },
  {
    id: 'ingress-judgment',
    behaviour: 'System One judges an untrusted observation before it is admitted.',
    disposition: 'synchronous',
    noticedBy:
      'The injection veto: `KernelPerceptionGate.admitViaJudge` rejects an observation scoring above 0.1.',
    note:
      'Stays synchronous by design and is not a learning behaviour — judging a precondition of ' +
      'admission is gating, and the plan does not ask for it to move.',
  },
  {
    id: 'schema-induction-admission',
    behaviour: 'Every derivation chain is offered to the SchemaInductor as induction fuel.',
    disposition: 'synchronous',
    noticedBy:
      "The AIKR bag's pressure: an empty bag means `.schemas-induce` has nothing to work on.",
    note:
      'Admission is synchronous and bounded (an LruCache-keyed bag); the model call it fuels is ' +
      'not, and lives in `induceIfPressured` — off the cycle path already.',
  },
  {
    id: 'embedding-config-read',
    behaviour: 'The embedding cache reads provider settings and the mock flag on the cycle path.',
    disposition: 'synchronous',
    noticedBy:
      'Recall under a mock or CPU-only provider: the read decides whether embedding is mocked at all.',
    note:
      'A configuration read, not a provider call — no await, no I/O. It stays, and A2 moves it out ' +
      'of the core rather than off the cycle, because the cache needs it wherever it lives.',
  },
  {
    id: 'stream-reasoner-flush',
    behaviour: 'A batch of queued requests is answered by a provider outside the cycle.',
    disposition: 'boundary',
    noticedBy:
      'The NAR\'s `proposals`: every model-backed derivation arrives through this queue, and the ' +
      'backlog is `StreamReasoner.pending()` (TODO29.a §4 row 9 was "no production caller at all").',
    note:
      'A1 gave it both callers and a production caller: `LMProposalProducer` holds it, with this ' +
      'NAR\'s injected `GateRegistry` — the process global it used to import is gone.',
  },
  {
    id: 'episode-consolidation',
    behaviour: 'Verified retrieval consolidates episodes with a model summarizing each window.',
    disposition: 'boundary',
    noticedBy: 'The lifecycle command: `src/bin/lib/lifecycle.ts` is its only production caller.',
    note: 'Already outside the cycle. Declared because its type-only edge is invisible in a diff.',
  },
  {
    id: 'narsese-correction',
    behaviour: 'A malformed term is re-prompted to the model as a correction.',
    disposition: 'dropped',
    noticedBy:
      'Nobody: `attemptLMCorrection` has no callers in the repository, so the behaviour cannot be lost.',
    note:
      'Awaits `lm.tryGenerateText` and would be an unbounded seam if it were wired. Listed because ' +
      'it is a value import of the layer from cycle-path code, and the audit is how it is shown dead.',
  },
];

/**
 * The cycle path, by directory. Everything outside it is assembly or agent-side
 * and is A2's subject rather than this inventory's.
 */
export const CYCLE_PATH_PREFIXES: readonly string[] = [
  'nar/src/cognitive/',
  'nar/src/kernel/',
  'nar/src/learning/',
  'nar/src/memory/',
  'nar/src/reason/',
  'nar/src/rules/',
  'nar/src/stream/',
  'nar/src/strategies/',
  'nar/src/terms/',
  'nar/src/nar-execution.ts',
];

/**
 * Which declared behaviour owns each cycle-path file's imports of the layer.
 *
 * The census is the point, and it is a good one: of the cycle path's imports of
 * the layer, three are values and the rest are types. `RuleProcessor` reaches
 * the layer through an `LMRule` *parameter* and no value import at all, so the
 * cycle already holds the layer as data in most places — which is what makes
 * A1 a wiring change rather than a rewrite (§4 row 9).
 */
export const IN_CYCLE_EDGE_ATTRIBUTIONS: readonly {
  readonly file: string;
  readonly behaviour: string;
}[] = [
  { file: 'nar/src/cognitive/impls/analyzers/corrections.ts', behaviour: 'narsese-correction' },
  { file: 'nar/src/learning/schema-induction.ts', behaviour: 'schema-induction-admission' },
  { file: 'nar/src/memory/embedding.ts', behaviour: 'embedding-config-read' },
];
