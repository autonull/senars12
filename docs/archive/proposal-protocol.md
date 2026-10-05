# The proposal protocol

**Status:** implemented 2026-10-01 · **Owner:** `nar/src/proposal/lifecycle.ts` ·
**Contract:** `@senars/core/schemas` → `proposal.ts` · **Gate:** `pnpm proposal:protocol`

The seam between the closed reasoner and the out-of-band induction layer. A
proposal is a **request to a gate**, never a write: it reaches state only through
the kernel gates, at a declared boundary, as one committed transition. Everything
below is a decision that had to be made deliberately rather than inherited from
whichever code path happened to run first, and each one is enforced in code
rather than documented and hoped for.

The eight decisions §5.3 named are D1–D8. D2–D5 and D8 were settled by A1 when
the seam first shipped; this document is where they are recorded, and D1, D6, D7
are new.

---

## The wire shape

Two kinds, and the distinction is in the **type** — `kind` selects a
`discriminatedUnion` arm whose payload is a different object with different
fields. There is no `Proposal` with a `kind` field and a union payload, because
that shape invites one queue with one policy for both, which is the specific
mistake §3.3 warns about.

```ts
interface Envelope {
  proposalId: string
  schemaVersion: number   // PROPOSAL_SCHEMA_VERSION; a mismatch is rejected loudly
  baseRevision: number    // the committed revision the proposer observed
  cyclesPerProposal: number  // the trigger as a work budget, never a rate
  issuedAtCycle: number
  references: string[]   // terms this proposal read; on the envelope because
}                        // both kinds read them and D6 checks them identically

interface ContentProposal extends Envelope {
  kind: 'content'
  payload: { taskType; term; truth? }
}

interface RuleProposal extends Envelope {
  kind: 'rule'
  payload: { ruleId; name; pattern; truthFn; priority; symbolicFallback }
}
```

Everything is data: no term objects, no closures over NAR internals, no rule
implementations. A proposer on the other side of the seam knows this shape and
nothing else about the core.

---

## D1 — Unit of work

**One premise pair, applied by one rule-selector pass, is one unit.** That is
`processLMRulesImpl`'s own granularity, kept because it is the unit the model
rules were written for. One derivation would split a two-premise inference in
half; one episode would put a provider's latency in the way of the whole run.

*Enforced by:* `LMProposalProducer.applyWork` — one staged `ModelRuleWork`, one
`StreamReasoner` request, one derived batch.

## D2 — Trigger

**A trigger, expressed as cycles per proposal — never a wall-clock rate.** The
`propose` stage of every cycle calls `pump()`, which is a no-op on an empty
queue, so "cycles per proposal" is governed by how much work the cycle stages:
one `stageLMRules` per premise pair, bounded by the queue's `maxPending`. The
envelope carries `cyclesPerProposal` so the contract travels with the proposal
rather than living in a config file nobody reads.

*Enforced by:* the `propose` stage's `pump()` being a no-op on an empty queue —
there is no timer anywhere in the seam.

## D3 — Overflow, per kind

**Content drops oldest. A rule is refused, never dropped.**

| kind | policy | why | cost of losing one |
|---|---|---|---|
| content | drop-oldest, recorded | the next derivation produces another | low |
| rule | bounded queue, refuse-newest, recorded | it *is* the learned capability | high |

Both record a `proposal.rejected` with reason `queue-overflow`. The difference is
which proposal survives, not whether the refusal is visible. **A queue with no
declared policy is an unbounded queue with extra steps**, which is why both
policies are code in `submit` rather than a note.

*Enforced by:* `ProposalLifecycle.submit` — `maxPendingContent` displaces from
the front, `maxPendingRules` refuses the newcomer and counts `rulesRefused`.

## D4 — A denied batch

**Retry, bounded; never drop, never raise a second reason.** A `BudgetGate`
denial re-queues the batch at the head and trims the tail — the pre-existing
behaviour, and the only path that can grow a backlog. The refusal is *already*
visible: the budget gate records `budget.exhausted` with the `llm-budget`
termination reason. A proposal-specific reason would be a second vocabulary for
one fact. Dropping a denied batch would discard work the core asked for.

*Enforced by:* `StreamReasoner.flush` — `unshift` then `trimCapped`, no drop
counter touched.

## D5 — Staleness

**A proposal is applied at the next declared boundary, never when it arrives.**
This is the decision that keeps the cycle closed, and it is structural rather
than a comment: `pumpProposals` is not awaited, and `takeDerived` is read only in
`authorize`. Staleness is then *bounded by construction* — everything staged
between two `authorize` stages was staged after the last commit, so no proposal
can be stale unless something outside the seam committed in between. The
`baseRevision` check catches exactly that case, and rejects with reason
`stale-revision` naming the base it carried and the revision it met.

*Enforced by:* the stage order (`authorize` before `propose`), and
`ProposalLifecycle.judge` comparing `baseRevision` against the committed
revision.

## D6 — A proposal referencing evicted concepts

**Reject. Do not salvage.** Applying the resolvable half of a proposal whose
evidence is half-gone lands a claim the proposer cannot support and the core
cannot audit. Rejection is also the simpler of the two answers, and it is
recorded, so a proposal failing on an eviction is an operator-visible event
rather than a silent divergence.

*Enforced by:* `ProposalLifecycle.judge` — every entry in `references` must
resolve, or the verdict is `evicted-reference` naming them.

## D7 — Versioning

**`PROPOSAL_SCHEMA_VERSION` travels on the envelope and a mismatch is rejected
loudly.** A run recorded against schema v1 must not replay against v2: the
proposal's meaning changes underneath the record, so a lenient reader would
produce state the proposer never proposed. Small, boring, and genuinely hard,
which is why it is a field on every proposal and a check in `judge` rather than
a migration note.

*Enforced by:* `ProposalLifecycle.judge` returning `schema-version`, and the
`proposal.admitted` event carrying the version that was applied.

## D8 — Replay and cancellation

**Replay reads the log; cancellation is recorded.** `ProposalLifecycle.fromEvents`
rebuilds the committed revision from `proposal.admitted` events alone — the
admitted table is a projection of the log and never independently authoritative,
so an interruption between admission and index update loses nothing. A cancelled
proposal emits `proposal.rejected` with reason `cancelled`, because a withdrawal
that leaves no trace is indistinguishable from one that never happened.

*Enforced by:* `fromEvents`, and `cancel` routing through the same `refuse` that
every other rejection uses.

---

## Atomicity

> The event that records admission is the source of truth for the resulting table
> revision. In-memory indexes are **derived** from that state and are **never
> independently authoritative**.

`commit` appends exactly one `proposal.admitted` event and returns the revision
that event states. There is exactly one write, so a crash cannot occur between
two. The failure this forecloses, in both directions:

```text
event log says proposal R exists   +  in-memory table says R does not   (after a crash)
in-memory table says proposal R exists  +  event log has no admission event  (a direct write)
```

## What the seam does not do

It does not let the reasoner read the inducer's intermediate state, and it does
not let a proposal land mid-cycle. A proposal may propose a rule, an abstraction
or an attention weight; it may never propose a truth value to be written without
`PerceptionGate`'s source-quality ceiling, and it may never reach `Truth.frequency`
or `Truth.confidence` through a reward path. The existing `provisionalConfidence`
of 0.3 is the correct instinct and survives the payload change.

## Related

- `TODO29.a.md` §3.3 (the spine), §5.3 (the item), §5.14 (the questions these
  decisions answer)
- `docs/induction-inventory.md` — which cycle-path behaviour reaches the layer
- `scripts/proposal-protocol.ts` — the gate that says this document and the code
  still agree