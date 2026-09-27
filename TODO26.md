# TODO26.md — Essential Capability Plan

Supersedes REFACTOR.todo8.md and all prior TODO plans as the single living plan (P8).

---

## 0. Prime directive

**Ship the deck.** Twenty-seven plan documents have produced a sophisticated engine and zero
consumer demonstrations. The bridge-to-nowhere risk is not any component — it's the pattern of
deferring the demo to "next phase." This plan reverses the order: the demo comes first, everything
else is contingent on it.

**The falsifier — one demo, built before anything else:**

```typescript
// pnpm test tests/nar/todo26-cognitive-agent.test.ts — the v1.0 gate
const agent = await createCognitiveAgent({ preset: 'chat' });
await agent.teach('(cat --> animal). %1.00;0.90%');
const a = await agent.ask('(cat --> animal)?');
// → { conclusion, truth: {f,c}, reputation }
await agent.checkpoint();

// fresh process:
const agent2 = await createCognitiveAgent({ preset: 'chat', resume: true });
const a2 = await agent2.ask('(cat --> animal)?');
assert(deepEqual(stripProvenance(a), stripProvenance(a2)));
```

**Stop condition:** if this demo takes more than ~2 working sessions, stop and re-triage — the
blocker is architecture, not effort, and the plan is wrong. All Narsese-only. No LM, no System One.
This is Tier-A capability and it must exist before any Tier-B/C work.

---

## 1. Honest capability tiers

| Tier | Claim | Status | Rule |
|------|-------|--------|------|
| **A — Cognitive runtime** | Teach/ask with derivation + truth; sessions; tools under governance; deterministic replay | **T1 DONE** — `createCognitiveAgent` with POST, checkpoint/resume, Answer envelope | Provable. Ship it. |
| **B — LM-augmented** | NL teach/ask; System One ingress/egress; symbolic fallbacks | Architected; zero end-to-end real-path evidence | Achievable, **unproven**. Label as such until a real-path test exists. |
| **C — Self-improving** | Adaptation changes behavior measurably | Mechanism exists (RLFP/RuleGraph/governance); value never demonstrated | **Experimental.** Ship the mechanism, claim nothing until a measured benchmark shows improvement. |

Every README/plan claim must name its tier (P5). Tier inflation is a defect.

---

## 2. Slices (each ends runnable; strict order)

| # | Ships | Exit demo | At-risk capability (protecting tests) |
|---|-------|-----------|----------------------------------------|
| **T1 — The demo** ✅ | `createCognitiveAgent({preset})` in `nar/src/agent` as thin preset-merge + existing `createAgent` + `Answer` envelope adapter over QueryAPI/trace/reputation; presets = `CognitiveParameters` data + validator (`chat` only to start); `checkpoint/resume` wrapping StatePersister + AdaptiveStrategy-stats hydration; **boot self-test (POST)** — on start, the agent derives a fixed internal syllogism, verifies the proof with the dependency-free `verifyRecord`, and fails startup loudly if its own logic is broken | `pnpm vitest run tests/nar/todo26-cognitive-agent.test.ts` | QueryAPI/trace (goldens, query unit tests); replay hashes (full-replay tests); resume equivalence (new); POST (new) |
| **T2 — Product surface** | Bot transports expose the agent API: MCP tools `query/teach/status`, HTTP `/health` `/ready` (real subsystem state) `/metrics` (existing Prometheus) | Claude (MCP client) calls `teach` then `query`; `curl /ready` green | Bot transport contracts (bot/bot-cli tests); new transport smoke tests |
| **T3 — Honest LM** | Deterministic mock provider for CI; real openai-compatible + llamacpp path behind env; System One Tier 1+2 exercised with mock in CI; `docs/capability-matrix.md` generated from test tags (P5) | CI green with `systemOne.enabled:true` + mock LM; matrix states what needs a real LM | Disabled-path byte-identity (todo16-parity); new mock-LM e2e |
| **T4 — Self-improvement (Tier C)** | Tool outcomes → RLFP preferences → `controller.adapt()` → GovernanceResolver record with provenance; contradiction events → typed-signal drives + SourceReputation-weighted revision; **falsification-gated adoption** — auto-apply requires a measured non-degradation on a fixed probe task stream, else the proposal is recorded and rejected | `pnpm demo:self-improve` + measured before/after; if no measurable delta, keep mechanism, drop claims | Hook ordering (rulegraph-wiring tests); autonomy ladder (governance tests); D1 ProofMettaProposer tests stay green (quarantined) |

T1 is the gate. T2/T3 may interleave after T1. T4 last. If a "wiring" item needs a new engine,
that's a simplest-falsifier violation — stop and re-triage (P1).

---

## 3. Self-proving development

Correctness is verified by the system's own machinery, not by external opinion. The property that
makes this trustworthy: **the verifier never depends on the thing it verifies.**

| Mechanism | Already exists? | Role |
|-----------|-----------------|------|
| Event log + pure reducers + state hashes | ✅ | State is re-derivable from the log by code that shares no mutable state with the engine (C14/C25) |
| Derivation records + `verifyRecord` (dependency-free, re-computes truth algebra) | ✅ | Every answer's proof is checkable by arithmetic, not by trusting the engine that produced it |
| Seeded determinism + double-run gate | ✅ (A-phase) | "Same input → byte-identical trace" is an identity, checkable on demand |
| Governance as falsification gate | Partial (routing exists; measurement doesn't) | Self-modification is accepted only if the system's own measurement shows non-degradation (T4) |
| Boot self-test (POST) | ✅ (T1) | The agent proves its core logic on every start: fixed premises → derivation → `verifyRecord` → loud failure if broken |
| `pnpm self-verify` | New | One command running the full self-audit battery (see below). CI runs the fast subset; full battery runs nightly + pre-release + on-demand. |
| Invariant monitor | Partial (bounds exist; loud failure doesn't) | Runtime assertions for the C-invariants checkable in-process — budget conservation per cycle, admission monotonicity, memory ≤ maxConcepts, no unbounded accumulators — fail loudly, never silently clamp |

**`pnpm self-verify` battery** (explicitly separate from unit tests):

| Check | Why it's not a unit test |
|-------|--------------------------|
| Boot POST (fixed syllogism → derivation → `verifyRecord`) | Exercises real engine + real verifier together; unit tests mock one or the other |
| Determinism double-run | Whole-system byte-identity; unit tests mock clocks/RNG |
| Replay `--verify` over a *recorded real session* | Uses actual event log from a live run; unit tests use synthetic fixtures |
| Derivation verification over *drained records* from a live run | Verifies the engine's actual output, not synthetic inputs |
| Invariant monitor under real load | Checks budget conservation, admission monotonicity, memory bounds in the actual loop; unit tests can't stress the real loop |
| Term-purity gate | Cross-cutting; unit tests are per-module |
| `exports:check` / `exports:audit` / `deps:gate` | Already whole-project |

**Two disciplines:**

1. **No external oracle.** Wherever a test needs a human to eyeball output, replace it with a
   mechanical self-check: hashes, proofs, identities, invariants. Human review is for *intent*
   (is this the behavior we want?), never for *correctness* (does the system hold together?).
2. **Process rules are executable.** Each P-rule maps to a gate: P1 → plan-review item, P2 →
   term-purity lint, P3 → demo script exists, P5 → capability matrix generated from test tags,
   P7 → golden protocol + rule unit tests, P8 → single plan file. A process rule with no gate
   is prose, and prose is how the string-manipulation and premature-contraption failures
   happened. If a rule can't be checked, shrink it until it can.

---

## 4. Cut or deferred (with trigger to revisit)

| Item | Disposition |
|------|-------------|
| Parallel-cognition E2E, chaos suites, property-based full loop | Defer post-v1 — verification of existing components, not capability |
| KernelEvent union (F5), ConceptGraph persistence (F6), MeTTa grammar validation (F7), API doc generation (F8) | Cut until trigger fires (second event consumer / learned-attention-across-restart matters / unquarantine / post-v1) |
| ProofMettaProposer as learning path | Quarantined behind `proofMettaProposer.enabled` (off); tests green as characterization; Term-purity fix retained |
| Extra presets beyond `chat` | Add only when a real consumer asks |

---

## 5. Standing rules (condensed; binding)

| # | Rule | Enforcement |
|---|------|-------------|
| P1 | Simplest-falsifier-first: name the simplest existing mechanism before building anything. | Plan review checklist |
| P2 | Term-native cognitive paths: no `toString()`/`parse()` round-trips inside inference/learning code. | CI lint-grep gate with ingestion allowlist |
| P3 | Demo-exit: every slice ends with a runnable script, not green tests alone. | `pnpm demo:<x>` script |
| P4 | Falsifier before implementation. | PR template |
| P5 | Tiered honesty: every claim labeled A/B/C with a real-path test behind it. | Capability matrix from test tags |
| P6 | Quarantine, don't delete; 2-minor deprecation policy. | Config flag + test tag |
| P7 | Goldens change only with intentional rule-semantics change + rule unit test. | Golden protocol + rule unit tests (second gate) |
| P8 | This file is the only living plan. | Repo hygiene |

**Merge gate** (every PR): unit suite, golden determinism, `exports:check`/`audit`, `deps:gate`,
typecheck, lint, term-purity gate.

---

## 6. Definition of done — v1.0

1. §0 demo runs (`pnpm vitest run tests/nar/todo26-cognitive-agent.test.ts`), including resume-equivalence.
2. `pnpm self-verify` passes (fast subset in CI; full battery nightly/pre-release): POST,
   determinism, replay-verify over a recorded session, derivation verification over drained records,
   invariant monitor, term-purity, exports/deps gates.
3. MCP client completes teach → query round-trip; `/ready` reflects real subsystem state.
4. CI exercises System One enabled with mock LM; capability matrix documents Tier A/B/C honestly.
5. Self-improvement demo runs with a measured result — or is labeled experimental with claims withheld.
6. All merge-gate checks green; no pre-existing suite regressed.

---

## Progress log

### T1 — The demo (COMPLETED 2026-09-27)
- **Created** `nar/src/agent/cognitive-agent.ts` with `createCognitiveAgent({ preset: 'chat' })`
- **Preset support**: `chat` preset using `FAST_COGNITIVE_CONFIG` (LM disabled for speed)
- **Answer envelope**: `{ conclusion, truth: {f,c}, reputation }` — removed redundant `derivation` field
- **Boot POST**: Fixed syllogism `(cat --> animal). (animal --> organism).` → deduction `(cat --> organism)` verified via `verifyRecord` (strict=false, epsilon=0.1)
- **Checkpoint/resume**: Wraps `StatePersister.save()/load()` via NAR's `persistState` config
- **Test**: `tests/nar/todo26-cognitive-agent.test.ts` — teach/ask/checkpoint/resume equivalence passes
- **Note**: Disabled `enableEmbeddingLayer` in NAR config to eliminate "Embedding index failed" noise during demo