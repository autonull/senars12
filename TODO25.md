# TODO25: Retrospective Consumers — Controller Adaptation, Re-consolidation & Curriculum

**Version:** 1.0 (2026-09-25) · **Follows** TODO24 (Dialogue Flywheel, complete). TODO24 produced the *substrate* — captured `DialogueTurn`s, reaction labels, digest-pinned `Retrospective`s, lessons. Nothing consumes the retrospective at the *decision* layer yet. This plan wires the two consumer-side extension points named in TODO24 §12, plus the now-unblocked curriculum probe.

**Philosophy:** The retrospective is already an auditable, digest-pinned, governance-clean artifact. Consumption must compose the same way TODO24 did: thin connective layers over existing machinery (`CognitiveController`, `SchemaInductor`, `ProposalRouter`), each gated behind its own falsifiable bench, each independently shippable.

---

## 1. Design Invariants (inherited + new)

TODO24's I1–I7 all carry forward unchanged. New:

| # | Invariant | Enforcement |
|---|---|---|
| N1 | **Adaptation is bounded and reversible.** Controller parameter deltas driven by retrospective evidence are clamped (≤ config max) and logged with the retrospective digest that caused them. A rollback command restores the pre-adaptation snapshot. | `CognitiveController` snapshot + delta clamp; bench asserts clamp + restore. |
| N2 | **One-shot consolidation.** A retrospective digest drives re-consolidation at most once (idempotency ledger keyed by digest); re-running `.retrospect` on the same session never re-induces schemas. | digest-keyed set in the consumer; bench asserts idempotency. |
| N3 | **Curriculum draws only from graded data.** Probes are selected from trace-graded, reaction-labeled, or lesson-derived items — never from raw text (I6) and never from frozen-eval rows (I1). | Selection filter by source; bench asserts exclusion. |

---

## 2. Naming & Vocabulary

| Identifier | Kind | Meaning |
|---|---|---|
| `adaptFromRetrospective` | fn | Consumes a `Retrospective`'s strategy audit → clamped `CognitiveController.adapt()` deltas (Phase A). |
| `reconsolidate` | fn | Feeds a retrospective's lessons + correction analyses through `SchemaInductor`; digest-keyed idempotent (Phase B). |
| `selectProbes` | fn | Curriculum selection over flywheel-produced graded data (Phase C). |
| `adaptationLedger` | type | Append-only log: { retrospectiveDigest, deltas, at } — N1 audit trail. |

---

## 3. Phases

### Phase A — Strategy audit → `CognitiveController.adapt()` — ✅ **done (2026-09-25)**
- Aggregate `Retrospective.strategyAudit` into controller parameter deltas (focus decay, reflex budgets), clamped per N1, routed with `JudgmentProvenance`.
- **Status (2026-09-25): Bench 77 green, implemented, bot-wired.** Deliberate design delta from the sketch above: the current strategy audit is a single coarse entry (`dialogue`/mean-quality), too thin to justify strategy *selection by name*. Instead `RetrospectiveAdapter` (`nar/src/dialogue/consumers/adapt.ts`) uses the correction-dominated signal (≥50% negative share of ≥2 reactions) to switch `derivation→focused`, `lm-rule→priority` — exactly the switch set `adaptWithRLFP` applies on RLFP preferences, so it reuses a proven precedent. N1: strategy-type switches only (no numeric mutation) + ledger + `restore()`; N2: digest-keyed one-shot. Bot wiring: `runSessionRetrospective` adapts via `nar.getController()` and reports `adapted=` in the output; Phase-A telemetry (ledger contents surfaced in a `.adaptations` command) is left for Phase-B pass.
- Files: `nar/src/dialogue/consumers/adapt.ts` (NEW), `nar/src/dialogue/index.ts` (re-export), `src/bin/bot.ts` (wiring), `tests/nar/todo25-adapt.test.ts` (NEW, Bench 77).
- Bench 77: clamp respected, restore byte-identical, low-risk-only (anything else routes through `ProposalRouter`, I3).
- Effort: ~3h actual.

### Phase B — Retrospective-triggered re-consolidation — ✅ **done (2026-09-25)**
- On `.retrospect` (or opt-in `dialogue.autoRetrospect`), feed lessons + correction embeddings through `SchemaInductor`; digest-keyed one-shot (N2).
- **Status (2026-09-25): Bench 78 green, implemented, bot-wired.** Deliberate design delta from the sketch: `SchemaInductor.induceFromDerivations` needs derivation `Task[]` chains, which dialogue turns deliberately don't persist (I6 — digests/references only). So "re-consolidation" is implemented at its actually-meaningful level: `Reconsolidator` (`nar/src/dialogue/consumers/reconsolidate.ts`) ingests lessons from *persisted retrospectives* as Narsese self-beliefs via a structural sink (`nar.input` at the bot), one-shot per digest with a **persisted ledger** (`.cache/dialogue/reconsolidated.jsonl`) so the one-shot survives restarts — the "next session" semantics of the original sketch. Source loading reuses the fail-closed `loadRetrospectives` (a hand-fabricated retrospective with a wrong digest pin aborts — Bench 78 falsifies). `digestPin` is now exported from `retrospect.ts` for consumer/test reuse. SchemaInductor-based pattern induction stays a non-goal until derivation chains are captured on turns.
- Files: `nar/src/dialogue/consumers/reconsolidate.ts` (NEW), `nar/src/dialogue/{index,retrospect}.ts` (export + `digestPin` export), `src/bin/bot.ts` (`.reconsolidate` command), `tests/nar/todo25-reconsolidate.test.ts` (NEW, Bench 78).
- Effort: ~2h actual.

### Phase C — Curriculum / probe selection (unblocked: the flywheel now produces data)
- `selectProbes(source = 'reaction' | 'trace' | 'lesson')` over graded data only (N3); exposed as `.probes` CLI + MCP tool.
- Files: `nar/src/dialogue/consumers/curriculum.ts` (NEW).
- Bench 79: frozen-set + raw-text exclusion; selection is deterministic given the same data.
- Effort: ~6h.

---

## 4. Out of Scope
❌ Per-message reflex attribution plumbing (kernel-cycle change; only if retrospectives demonstrate the last-cycle join misleads — decide after Phase A telemetry).
❌ Ouroboros fine-tuning (separate plan). ❌ Distributed dialogue. ❌ New exports without in-repo consumers (`pnpm exports:audit` gate).

## 5. Risks
| Risk | Mitigation |
|---|---|
| Controller drift from noisy retrospectives | N1 clamps + rollback snapshot; adaptation only from sessions meeting Bench 73's minimum-viable bar |
| Schema explosion from repeated consolidation | N2 digest idempotency + existing AIKR bounds |
| Curriculum leaks frozen data | N3 source filter, Bench 79 falsifies |

## 6. Notes for Implementation
- TODO24 status: all phases A–C done; benches 71–76 green; DQ1–DQ7 closed (DQ6 Bench 75, DQ2 Bench 76).
- `scripts/system-one-fit-thresholds.ts` lint debt fixed (2026-09-25) — repo lint clean.
- Each phase: bench first, then implement (the pattern that worked for DQ6/DQ2).
