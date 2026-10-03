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
      "Any derivation a model rule produced, now admitted at the next cycle's `authorize` stage " +
      'through the perception gate. Was 33 inducer invocations per cycle (TODO29.a §13); the cycle ' +
      'now stages work and pumps it off-cycle.',
    note:
      'Moved by A1. `DefaultDerivation` calls `processor.stageModelRuleWork`, which is a bounded queue ' +
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
      'not, and lives in `induceIfPressured` — off the cycle path already. A2 gave the ' +
      'induction its own vocabulary: it holds a `TextGenerator` (`nar/src/ports`), not the ' +
      "layer's `LMService`.",
  },
  {
    id: 'embedding-config-read',
    behaviour: 'The embedding runtime reads provider settings and the mock flag on the cycle path.',
    disposition: 'synchronous',
    noticedBy:
      'Recall under a mock or CPU-only provider: the read decides whether embedding is mocked at all.',
    note:
      'A configuration read, not a provider call — no await, no I/O, so it stays synchronous. ' +
      'A2 moved the *read* off the cycle path instead: `nar/src/memory/embedding.ts` declares ' +
      '`EmbeddingRuntime` and takes a source function, and `nar/src/lm/embedding-runtime.ts` is ' +
      'the only module that answers it. The core can now say what it needs without naming who ' +
      'provides it.',
  },
  {
    id: 'stream-reasoner-flush',
    behaviour: 'A batch of queued requests is answered by a provider outside the cycle.',
    disposition: 'boundary',
    noticedBy:
      "The NAR's `proposals`: every model-backed derivation arrives through this queue, and the " +
      'backlog is `StreamReasoner.pending()` (TODO29.a §4 row 9 was "no production caller at all").',
    note:
      'A1 gave it both callers and a production caller: `LMProposalProducer` holds it, with this ' +
      "NAR's injected `GateRegistry` — the process global it used to import is gone.",
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
      'Nobody: `attemptLMCorrection` has no production caller — its only one is ' +
      '`scripts/fundamentals-bench.ts` — so the behaviour cannot be lost.',
    note:
      'Awaits `lm.tryGenerateText` and would be an unbounded seam if it were wired. A2 moved it ' +
      'from `nar/src/cognitive/impls/analyzers/` to `nar/src/lm/correction.ts`: it is a provider ' +
      'call under a layer-owned grammar, and the cycle path was carrying the edge for a bench ' +
      'script alone.',
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
 * **Empty since A2 (2026-10-01).** The census it annotates now reads *zero*
 * edges across zero files: no cycle-path module imports the induction layer at
 * all, so there is nothing to attribute. The constant stays because the rule it
 * feeds is the point — an edge that reappears must name a behaviour, and a rule
 * with nothing to check is the kind that stops being read.
 */
export const IN_CYCLE_EDGE_ATTRIBUTIONS: readonly {
  readonly file: string;
  readonly behaviour: string;
}[] = [];
