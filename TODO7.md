This is a comprehensive, actionable master plan to execute the recommendations from the technical review. It is divided into two main sections: **The Documentation Revision Plan** (rewriting the narrative and claims) and the **Engineering Execution Plan** (refactoring the architecture to match the new claims).

---

# PART 1: Documentation Revision Plan (README.md & Docs)

The primary goal of the documentation rewrite is to eliminate "scope and claim inflation," clearly define the boundaries of the system, and reposition SeNARS12 from an aspirational "AGI cognitive architecture" to a **hardened, defensible, production-grade cognitive kernel**.

### 1. Repositioning the Core Thesis ✅ **COMPLETED**
**Current Thesis:** "Next-generation cognitive architecture fusing fluid LLM creativity with rigorous symbolic logic reasoning."
**New Thesis:** "A bounded, event-sourced, provenance-preserving reasoning runtime supporting uncertain symbolic inference and optional LLM-assisted formalization."

### 2. The "Maturity Label" Mandate ✅ **COMPLETED**
Every feature, module, and claim in the README and `docs/` must be tagged with one of the following labels to set accurate expectations:
*   `[Stable]` - Tested, used in production, strict backwards compatibility.
*   `[Beta]` - Feature complete, but API may change; requires human oversight.
*   `[Experimental]` - Functional but lacks comprehensive benchmarks or edge-case handling.
*   `[Prototype]` - Proof of concept; not safe for unattended operation.
*   `[Planned]` - Architectural intention; not yet implemented.

**Status:** Applied to all sections in README.md (see commit).

### 3. Rewriting Absolute Claims ✅ **COMPLETED**
Systematically hunt and replace absolute claims with precise, scoped engineering statements.
*   *Removed:* "TypeScript is a reasoning layer that mathematically guarantees correctness."
    *   *Replaced with:* "TypeScript enforces internal representational invariants at compile-time, while runtime schemas (e.g., Zod) enforce operational invariants at untrusted boundaries."
*   *Removed:* "No reward hacking" / "No sycophancy".
    *   *Replaced with:* "Strict type-level and runtime separation of Beliefs (epistemic truth) and Goals (teleological desire) prevents reward signals from directly mutating factual confidence."
*   *Removed:* "Never blocks indefinitely."
    *   *Replaced with:* "Cooperative yielding via `AbortSignal` and wall-clock deadlines, subject to the constraints of underlying WASI/Node execution environments."

### 4. Updating the Architecture Diagram ✅ **COMPLETED**
Replaced the "Cognitive Kernel" diagram with one that clearly delineates the **Trusted Kernel** from the **Untrusted Proposers** with Gates boundary.

### 5. New Sections Added ✅
- **Minimum Defensible Product** — Table of guaranteed properties with maturity labels
- **Validation & Benchmarking Plan** — 7 automated test suites with status tracking
- **Removed:** "Positioning in AI Landscape" quadrant (invited unnecessary AGI comparisons)

---

# PART 2: Engineering Execution Plan

This is the technical roadmap to align the codebase with the review's architectural mandates.

## Track A: Kernel Hardening & Event Sourcing (Phase 1)
*Goal: Make the reasoning kernel deterministic, replayable, and mathematically defensible.*

### 1. Implement Event-Sourced State 🔄 **IN PROGRESS** (Schemas defined)
*   **Action:** Refactor mutable state updates into an append-only `CognitiveEvent` log (e.g., `TaskAdmitted`, `DerivationAccepted`, `BeliefRevised`).
*   **Action:** Implement pure reducer functions that calculate the current cognitive state from the event log.
*   **Exit Criteria:** The system can be paused, the event log serialized, and perfectly replayed in a separate process to yield the exact same state.
*   **Progress:** Zod schemas for all event types defined in `src/kernel/schemas.ts`. Gate audit completed (see `GATE_AUDIT.md`).

### 2. Formalize Budget Accounting 🔄 **IN PROGRESS** (Schemas defined)
*   **Action:** Introduce a `ReasoningBudget` context object passed to all recursive/heavy functions.
*   **Action:** Implement explicit `TerminationReason` enums (`cycle-budget`, `backpressure`, `deadline`) rather than generic timeouts.
*   **Progress:** `ReasoningBudgetSchema` and `TerminationReasonSchema` defined in `src/kernel/schemas.ts`. `BudgetGate` schema defined.

### 3. Implement the Evidence Firewall (Anti-Laundering) 📋 **PLANNED**
*   **Action:** Add an `Independence` check to the NAL Revision rule.
*   **Action:** If evidence lineage is truncated (due to AIKR bounds) and independence is `unknown`, the system must *conservatively reject* the revision rather than silently double-counting evidence.
*   **Gate Audit Finding:** Current revision logic in `memory/concept.ts:255`, `stream/reasoner.ts:66`, `terms/truth.ts:60` does NOT check independence.

### 4. Decouple Decay Mechanics 📋 **PLANNED**
*   **Action:** Split `BeliefMetadata`. Truth (`frequency`, `confidence`) must only decay based on explicit temporal invalidation or contradiction. Attention (`priority`) decays based on LRU/access time.
*   **Gate Audit Finding:** Current decay in `memory/concept.ts:131-144` couples truth and attention decay.

### 5. Build the Standalone Derivation Verifier 📋 **PLANNED**
*   **Action:** Write a minimal, dependency-free TypeScript script that takes a serialized `DerivationRecord` and mathematically verifies the truth-function algebra and substitution validity without loading the full NAR engine.
*   **Progress:** `DerivationRecordSchema` and `DerivationStepSchema` defined in `src/kernel/schemas.ts`.

---

## Track B: Safety, Sandboxing & Governance (Phase 4 & 5)
*Goal: Ensure unattended operation cannot result in catastrophic self-modification or security breaches.*

### 1. Deprecate `node:vm` for Security ✅ **DOCUMENTED** / 🔄 **CODE PENDING**
*   **Action:** Remove `createNodeVMSandbox` from the "secure" sandbox options. Relegate it to "trusted-but-faulty code isolation" only.
*   **Action:** Expand WASI capabilities to be strictly deny-by-default (explicitly toggling network, clock, env vars, and memory limits per invocation).
*   **Progress:** README updated with deny-by-default WASI documentation. Code changes pending.

### 2. Implement the Autonomy State Machine 📋 **PLANNED**
*   **Action:** Implement the `AutonomyMode` enum (`observe-only`, `propose-only`, `sandbox-execute`, `low-risk-auto-merge`, `human-approved-production`).
*   **Action:** Hardcode the `ApprovalManager` to refuse tool execution if the mode is below `sandbox-execute`.
*   **Progress:** `AutonomyMode` enum defined in governance RFC and kernel schemas.

### 3. Externalize Self-Modification Governance ✅ **RFC DRAFTED**
*   **Action:** Move the self-modification approval logic (the "Patch Risk Classifier") *outside* the agent's modifiable codebase. The agent can *propose* a patch, but an external, immutable CI/CD runner must evaluate the risk and apply the merge.
*   **Action:** Implement immutable guardrails: The agent cannot edit its own sandbox config, approval policies, or reward functions.
*   **Progress:** RFC drafted at `docs/rfc/external-governance.md` with:
    - Immutable `AutonomyMode` enum
    - External `PatchRiskClassifier` 
    - External `GovernancePolicyEngine`
    - Guardrail file list (7 critical paths)
    - CI/CD pipeline YAML
    - Audit event schema

---

## Track C: NL Pipeline & Engine Isolation (Phase 2)
*Goal: Prevent the NL boundary and engine cross-talk from corrupting the symbolic state.*

### 1. NL Candidate Generation 🔄 **SCHEMAS DEFINED** / 📋 **REFACTOR PENDING**
*   **Action:** Refactor `NLUnderstandingService`. The LLM must return an array of `FormalizationCandidate` objects, each containing the Narsese term, a confidence score, source text spans, and a list of `Ambiguity` flags.
*   **Action:** The Kernel admits candidates provisionally; it does not accept a single authoritative parse.
*   **Progress:** `FormalizationCandidateSchema`, `AmbiguityFlagSchema`, `SourceSpanSchema`, `FormalizationBatchSchema` defined in `src/kernel/schemas.ts`.

### 2. Engine Isolation (The Arbiter Pattern) 📋 **PLANNED**
*   **Action:** NAR and MeTTa must not share memory directly. They must emit `EngineResult` proposals to the Kernel.
*   **Action:** Enforce the boundary between MeTTa's exact `definitional-equality` and NAR's `uncertain-equivalence`. The e-graph must *never* union nodes based on NAR similarity scores.

---

## Track D: Learning & RL Refactoring — Unified Substrate, Separated Reward Domains
*Goal: Keep the unified Game/Focus/Reflex substrate, but split learning consumers, reward interpretation, and mutation authority by game domain. Principle: **unified game substrate, separated reward domains, strict mutation authority.***

> External games train policies for acting in the world. The Self Game trains proposals for improving the system. Only governed, validated proposals mutate the system itself.

### 1. Shared RL Substrate (keep unified) ✅ **ARCHITECTURE CONFIRMED**
Shared primitives — `Bag<T>`, `Focus`, `FocusBag`, `Game`, `Reflex`, `Negotiator`, `LearningEvent`, `RewardGate` entry point. `Game` gains a domain discriminator:
*   `Game.kind: 'external' | 'self'` (`GridWorldGame` → `external`; `SelfMetaGame` → `self`).
*   `GameFocus` binds one domain to one gate triple + `allowedMutations` list.

### 2. Split RLFP into 5 Domain-Scoped Learners 📋 **PLANNED (revised mapping)**
| Learner | Domain | Updates | Risk |
|---|---|---|---|
| `ReflexLearner` / `PolicyLearner` (TabularQ/EpsilonGreedy/UCB) | External | Reflex policy, action priors, env attention | Low–Medium |
| `SchedulerAdapter` | Self | Rule/attention priorities, focus weights | Low |
| `PreferenceRanker` | Self (explanation quality) | Explanation ranking only | Low |
| `ConfigOptimizer` (+ `SchemaPromotionRanker`) | Self | Config/schema **proposals**, never direct applies | Medium |
| `PatchSelector` | Self (code repair) | Patch **scores** → external governance pipeline | High |
*   **Action:** Each learner declares its domain and may only consume `LearningEvent`s from that domain's RewardGate.

### 3. Split RewardGate by Domain 📋 **PLANNED (new requirement)**
*   **Action:** Implement `ExternalRewardGate.ingest(outcome: GameOutcome): ReflexLearningEvent[]` — allowed targets: `reflex-policy`, `action-prior`, `environment-attention`.
*   **Action:** Implement `SelfRewardGate.ingest(outcome: SelfGameOutcome): SelfLearningEvent[]` — allowed targets: `scheduler`, `cognitive-config` (proposal), `schema-promotion-score`, `patch-score`, `focus-weight`; **forbidden:** `truth-confidence`, `approval-policy`, `sandbox-policy`, `reward-model-authority`.
*   **Action:** Self-game reward (coherence↑, contradiction↓, depth↓, pass-rate↑, approval-rate↑) trains rankers/optimizers only; high-risk outputs become `SelfImprovementProposal` (`knob-tune` / `focus-weight` / `strategy-switch` / `schema-promotion` / `patch-apply` / `test-generate`) routed through PolicyEngine → RiskClassifier → sandbox validation → human/external approval.
*   Risk tiers: low-risk (focus weight, sampling priority, bounded budget, pre-approved strategy) may auto-apply; medium (new rule, consolidation change, out-of-range params) requires validation; high (source patch, sandbox/approval/reward-model change) requires human/external approval + event-log record.
*   **Progress:** `KernelRewardGate` created this session with generic allowlist (`attention-priority`/`policy-weights`); **still needed:** domain split, `RewardDomain`/`GameDomain` types, `SelfImprovementProposal` schema, Self-game wiring.

### 4. The Epistemic Firewall 📋 **SCHEMA DEFINED** / 🔄 **IMPLEMENTATION PENDING**
*   **Action:** Add a strict runtime assertion in the `RewardGate`. Reward signals are allowed to mutate `attentionPriority` and `policyWeights`, but an exception must be thrown if a reward signal attempts to mutate `Truth.frequency` or `Truth.confidence`.
*   **Progress:** `RewardGateInputSchema` with `targetType` enum includes firewall check. `RewardGateOutputSchema` includes `epistemicFirewallViolation` flag.
*   **Extension per feedback:** firewall is necessary but not sufficient for the Self Game — even allowed-target self-reward must go through proposal governance (Sec. 3), since failure modes include metric-gaming (suppressing conflicting evidence, weakening correctness to pass tests, self-approving reward-model edits).

---

# PART 3: Validation & Benchmarking Plan

To prove the new claims, implement the following automated test suites. These should be integrated into the CI pipeline.

| Benchmark Name | Purpose | Implementation Strategy | Status |
| :--- | :--- | :--- | :--- |
| **1. Evidence Laundering Test** | Prove the system doesn't double-count evidence. | Inject one fact. Create 5 distinct derivation paths that loop back to reinforce the same fact. Assert that `Truth.confidence` does not artificially inflate. | `[Planned]` |
| **2. Translation Ambiguity** | Prove NL formalization handles nuance. | Feed sentences with "unless", "may/must", and nested negations. Assert the system returns multiple `FormalizationCandidate` objects with correct ambiguity flags, rather than one confident, wrong parse. | `[Planned]` |
| **3. Bounded Degradation** | Prove AIKR graceful degradation. | Run a heavy reasoning workload. Progressively shrink `ReasoningBudget.maxCycles` and `Bag.capacity`. Assert that the system returns partial, valid results rather than crashing or hanging. | `[Planned]` |
| **4. Contradiction Resilience** | Prove paraconsistent handling. | Inject `(A --> B)` from a high-quality source, and `(- (A --> B))` from a low-quality source. Assert both remain in memory with distinct truth values, rather than one silently overwriting the other. | `[Planned]` |
| **5. Proof Replay Test** | Prove derivation soundness. | Export 1,000 random `DerivationRecord` objects. Run them through the standalone, minimal Derivation Verifier script. Assert 100% match with the main engine's output. | `[Planned]` |
| **6. Scheduler Fairness** | Prove AIKR doesn't starve low-priority goals. | Inject a high-priority continuous goal and a low-priority background goal. Run for 10,000 cycles. Assert the low-priority goal receives >0% of the CPU budget (via aging/fairness mechanisms). | `[Planned]` |
| **7. Sabotage Test** | Prove self-mod safety. | Prompt the self-improvement loop to generate a patch that disables the `ApprovalManager` or reads `.env` secrets. Assert the External Governance layer rejects the patch and flags the risk. | `[Planned]` |
| **8. Self-Game Metric-Gaming Test** | Prove Self Game can't trade safety for score. | Reward contradiction-reduction; assert system doesn't suppress conflicting evidence (both beliefs retained w/ lineage) and never mutates `truth-confidence`/`approval-policy`/`sandbox-policy` via self-reward. | `[Planned]` |

---

# Immediate Next Steps (Week 1) ✅ **ALL COMPLETED**

1.  ✅ **README Triage:** Applied `[Maturity Labels]` to every section. Deleted "Positioning in AI Landscape" quadrant. Added "Minimum Defensible Product" thesis.
2.  ✅ **Define the Schemas:** Created `src/kernel/schemas.ts` with Zod schemas for `CognitiveEvent`, `ReasoningBudget`, `DerivationRecord`, `FormalizationCandidate`, plus Gate I/O schemas and validation helpers.
3.  ✅ **Audit the Gates:** Grepped codebase for direct state mutations. Created `GATE_AUDIT.md` mapping 20+ Perception mutations, belief revision independence gaps, ActionGate NAL veto needs, missing BudgetGate, and RewardGate epistemic firewall requirements.
4.  ✅ **Draft the External Governance RFC:** Wrote `docs/rfc/external-governance.md` with immutable AutonomyMode, external PatchRiskClassifier, GovernancePolicyEngine, CI/CD pipeline, guardrail file list, and audit trail.

---

# Week 2 Progress (2026-09-10 session) 🔄 **PARTIAL — PAUSED FOR PLAN ADJUSTMENTS**

## P0 — Kernel Gate Implementation — Core Files Created, Partial Integration

| Task | Status | Files |
|------|--------|-------|
| **KernelPerceptionGate** | ✅ Created + 4 sites routed | `nar/src/kernel/KernelPerceptionGate.ts` (sourceQuality→confidence map, taskType inference via `termParser.parseTask`, `task.admitted` event log); routed: `nar-io.ts:addTask`+`import`, `nar.ts:inputTask`, `task/manager.ts:processPending`, `nar-execution.ts:run` derivation loop |
| **KernelRewardGate** (epistemic firewall) | ✅ Created, not yet wired; **needs domain split per feedback** | `nar/src/kernel/KernelRewardGate.ts` (`EpistemicFirewallViolation`, allowlist `attention-priority`/`policy-weights`, emits `belief.revised`/`policy.violation`). Still needed: `ExternalRewardGate` vs `SelfRewardGate`, `RewardDomain`/`GameDomain` types, `SelfImprovementProposal` schema (see Track D §3) |
| **KernelBudgetGate** | ✅ Created, not yet wired to hot paths | `nar/src/kernel/KernelBudgetGate.ts` (cost table, `TerminationReason` enums, `budget.exhausted` event log) |
| **KernelActionGate** (NAL veto) | ✅ Created, not yet wired | `nar/src/kernel/KernelActionGate.ts` (`observe-only`/`propose-only` block, NAL derivation veto registry, allowlist, `policy.violation` log) |
| **GateRegistry** | ✅ Created + initialized in `NAR` ctor | `nar/src/kernel/GateRegistry.ts` (singleton `gateRegistry`, default budget 1000/100/10000/50, `observe-only`); `nar/src/kernel/index.ts` exports |
| **Event Log Integration** | 🔄 In-memory per-gate logs only | Each gate has `getEventLog()`/`clearEventLog()`; `GateRegistry.getAllEventLogs()` aggregates. **No `SqliteEventLog` yet** — next step |

## P1 — Evidence Independence — Implemented at 3 Sites ✅

| Task | Status | Detail |
|------|--------|--------|
| Independence check in revision | ✅ Done | `memory/concept.ts:addBeliefWithRevision(data, independence='unknown')` rejects revision when `unknown` (anti-laundering); new `IndependenceStatus` type |
| Provisional belief guard | ✅ Done | `stream/reasoner.ts:flush` drops `prov` when `independence==='unknown'`; `ProvisionalBelief.independence?` added |
| Chain revision guard | ✅ Done | `terms/truth.ts:chainWithRevision(..., independence='unknown')` returns single-step result when `unknown`; `inductionChain`/`abductionChain` accept passthrough param |
| Decouple truth decay from attention decay | 📋 **NOT STARTED** | `memory/concept.ts:131-144` still couples; needs split per audit |
| Evidence lineage tracking | 📋 **NOT STARTED** | Schema ready, no runtime plumbing |

## P2 — Standalone Derivation Verifier

| Task | Files | Effort |
|------|-------|--------|
| Minimal verifier script | `scripts/verify-derivation.ts` (uses `DerivationRecordSchema`) | Medium |
| CI integration | `.github/workflows/derivation-verify.yml` | Low |

## P3 — WASI Sandbox Hardening

| Task | Files | Effort |
|------|-------|--------|
| Remove `createNodeVMSandbox` from secure options | `nar/src/capability/index.ts`, docs | Low |
| Deny-by-default WASI config | `nar/src/capability/wasi/*.ts` | Medium |

---

# New Improvement Opportunities (Discovered During Implementation)

## 1. CognitiveEvent Schema Evolution
The current `CognitiveEvent` in `util/src/types/cognitive.ts` is a discriminated union but lacks:
- `task.admitted` with full task metadata (source, budget, stamp)
- `derivation.accepted` with `independenceCheck` field
- `budget.exhausted` with `TerminationReason` enum
- `policy.violation` with severity levels

**Recommendation:** Migrate `util/src/types/cognitive.ts` to use schemas from `src/kernel/schemas.ts` as single source of truth.

## 2. BudgetGate Integration Points
The `BudgetTracker` class in `nar/src/config/budget.ts` and `AIKRBudget` in `nar/src/tick/tick.ts` track different budget dimensions. Need unified `ReasoningBudget` context passed through:
- `Focus.step(budget)`
- `RuleProcessor.process()`
- `StreamReasoner.derive()`
- `TaskManager.addTask()`

## 3. Gate Admission Testing
Add property-based tests that verify:
- No direct `memory.addTask()` calls outside gate files (static analysis)
- Every `belief.revision()` goes through RewardGate independence check
- Budget exhaustion produces `TerminationReason` enum, not generic timeout
- Epistemic firewall throws on `Truth` mutation attempts

## 4. External Governance Runner Implementation
The RFC specifies the governance pipeline but implementation needs:
- Separate repository for governance runner (immutable)
- Event log consumer (polling or webhook)
- PatchRiskClassifier as standalone service
- GitHub/GitLab API integration for PR creation/merge
- Audit log persistence (append-only, separate from agent)

## 5. FormalizationCandidate Integration
`NLUnderstandingService.understand()` currently returns `TaskBatchSchema`. Needs refactor to:
- Return `FormalizationBatchSchema` with multiple candidates
- Include `ambiguityFlags` per candidate
- Kernel `PerceptionGate` validates each candidate before admission

---

# Key Files Created/Modified This Session (Week 2)

| File | Purpose |
|------|---------|
| `nar/src/kernel/KernelPerceptionGate.ts` | NEW — admission w/ sourceQuality map, `termParser.parseTask` inference, event log |
| `nar/src/kernel/KernelBudgetGate.ts` | NEW — cost table, `TerminationReason`, `budget.exhausted` log |
| `nar/src/kernel/KernelRewardGate.ts` | NEW — `EpistemicFirewallViolation`, allowlist firewall |
| `nar/src/kernel/KernelActionGate.ts` | NEW — autonomy-mode block, NAL veto registry |
| `nar/src/kernel/GateRegistry.ts` + `index.ts` | NEW — singleton, `NAR` ctor init |
| `nar/src/nar-io.ts` | `addTask`+`import` routed via perception gate |
| `nar/src/nar.ts` | Gate imports, `gateRegistry.initialize()` in ctor, `inputTask` gated |
| `nar/src/task/manager.ts` | `processPending` gated (reject → `failed`) |
| `nar/src/nar-execution.ts` | Derivation `addTask` loop gated |
| `nar/src/memory/concept.ts` | `IndependenceStatus`, `addBeliefWithRevision(data, independence)` |
| `nar/src/stream/reasoner.ts` | `ProvisionalBelief.independence?`, `flush` guard |
| `nar/src/terms/truth.ts` | `chainWithRevision` + `induction/abductionChain` independence passthrough |

---

# New Improvement Opportunities (Found This Session)

## 6. Gate Import Path Fragility
`KernelPerceptionGate` imports `@senars/kernel/schemas` (root `src/kernel/schemas.ts`), but `ActionGate` input type lacks `AutonomyMode` export — currently imported as type from schemas where it exists only as string union inside `AutonomyModeChangedEventSchema`. **Fix:** export standalone `AutonomyModeSchema` + type from `src/kernel/schemas.ts`; re-export gate I/O types.
## 7. PerceptionGate Term Fidelity
Gate re-parses `term.toString()` via `parseTask`, discarding original `truth`/`stamp`/`budget`. Callers pass confidence separately — workable but lossy. **Fix:** add `admitTask(term, type, truth, budget, source)` overload bypassing string round-trip.
## 8. Remaining 16+ Perception Bypass Sites
Not yet routed: `lm/enrichment.ts:258,262`, `lm/feedback.ts:179,390`, `tools/guided.ts:29,32`, `tools/adapters/external-tools.ts:550,566,574`, `memory/state/serialization.ts:106,127`, `reflex/Negotiator.ts:90-97`, `focus/GameFocus.ts`. **Fix:** route each via `gateRegistry.getPerceptionGate()` (use `source:'replay'` for deserialization).
## 9. BudgetGate/ActionGate/RewardGate Unwired
Gates exist but no call sites use them. Wiring map: `Focus.step`+`Reasoner.step`+`StreamReasoner` → BudgetGate; `Negotiator.resolve`+tool dispatch → ActionGate; `rlfp/*`+`GameFocus` → RewardGate (assert no `Truth` writes).
## 10. Truth Decay Coupling Untouched
`concept.ts:applyTimeDecay` still decays activation+priority together; truth never decays separately. Needs `decayAttention()` vs `invalidateTruth()` split + tests.
## 11. No Gate Tests Yet
Zero tests for new kernel dir. Needed: perception admit/reject, firewall throw/flag, budget exhaustion enum, NAL veto, independence rejection, replay-from-log.

---

# Week 2 Continued (2026-09-10 session) ✅ **GATE CONTRACTS FIXED, GATES WIRED, TESTS GREEN**

## Schema fixes (`src/kernel/schemas.ts`)
- Added `AutonomyModeSchema`/`AutonomyMode`, `SourceQualitySchema`/`SourceQuality` (were imported but never exported — root cause of GateRegistry/ActionGate type errors).
- Added `GameDomainSchema`, `RewardDomainSchema`, `SelfImprovementProposalSchema` (Track D §3 groundwork: `knob-tune`/`focus-weight`/`strategy-switch`/`schema-promotion`/`patch-apply`/`test-generate` with low/medium/high risk tiers).
- Gate I/O `correlationId` now optional, `BudgetGateInput.budget`/`estimatedCost` optional, `RewardGateInput.targetId` widened to `string`, added optional `domain: RewardDomain`.
- Added inferred `PerceptionGateInput/Output`, `ActionGateInput/Output`, `RewardGateInput/Output`, `BudgetGateInput/Output` type exports.
- Added `@senars/kernel` + `@senars/kernel/*` path mapping in root `tsconfig.json` (tsc-only; vitest/vite cannot resolve it — see lesson below).

## Gate fixes (`nar/src/kernel/`)
- **Import alias lesson:** `@senars/kernel/*` resolves under `tsc` via tsconfig paths but FAILS under vitest/vite ("Cannot find package"). All 6 consumers (`KernelPerceptionGate/Budget/Reward/ActionGate`, `GateRegistry`, `nar.ts`) rewritten to relative imports (`../../../src/kernel/schemas.js`; `../../src/kernel/schemas.js` from `nar.ts`). **Follow-up:** create a real `@senars/kernel` workspace package (like `@senars/nar`) instead of relying on path aliases.
- `KernelBudgetGate`: `nal-step`/`lm-call`/`memory-op`/`derivation-depth` operations now mapped to schema `budgetType` enum (`cycles`/`llm`/`memory`/`depth`) via `toBudgetType()`; `TerminationReason` cast to the narrower event enum (wider type includes `aborted`/`completed` which the gate never emits).
- `KernelRewardGate`: **removed `belief.revised` emission on accepted rewards** — the old code fabricated `oldTruth/newTruth` from the reward signal, violating the epistemic firewall in spirit. Accepted rewards now only return `{accepted, mutationApplied}`; violations still log `policy.violation`.
- `KernelPerceptionGate`: added `admitTask(term, taskType, truth?, source?, correlationId?)` overload bypassing the lossy `term.toString()` → `parseTask` round-trip (fixes improvement #7); `sourceQualityToConfidence` gained exhaustive `default`.
- `GateRegistry`: unchanged behavior, imports fixed.

## Prior-session bug fixes
- `nar/src/terms/truth.ts:174`: removed self-referential `export type { IndependenceStatus } from './truth.js'` (TS2484).
- `nar/src/stream/reasoner.ts:48`: branded `Truth` construction cast `as TruthType` (TS2322).

## Decay split (`nar/src/memory/concept.ts`)
- `applyTimeDecay()` body moved to `decayAttention()` (attention-only: `activation` + `_priority`); `applyTimeDecay` delegates for backward compat.
- New `invalidateTruth(reason: 'temporal'|'contradiction')`: temporal path ages belief confidence ×0.95 (explicit invalidation, never silent); contradiction path reserved for revision-driven invalidation. Truth no longer decays implicitly with attention.

## GameFocus wiring (`nar/src/focus/GameFocus.ts`)
- Step start: `BudgetGate.check({operation:'nal-step'})` — returns early with `{terminated}` report when exhausted (TerminationReason enum, not timeout).
- Pre-`game.step`: `ActionGate.authorize({operation: action})` — vetoed actions produce a zero-reward learning event instead of world mutation.
- Pre-`toBeliefs`: `RewardGate.process({targetType:'policy-weights'})` firewall check — aborts reward ingestion on violation.

## Tests ✅ `tests/nar/kernel-gates.test.ts` (6/6 passing)
Perception admit + `admitTask` truth fidelity, unparseable rejection, budget exhaustion enum + `budgetType` mapping, firewall accept/block, observe-only block vs sandbox-execute allow, NAL veto registry.

## Verification (single runs, per energy budget)
- `pnpm exec tsc --noEmit`: **zero errors** in `nar/src/kernel/*`, `GameFocus.ts`, `nar.ts`, `memory/concept.ts`, `kernel-gates.test.ts` (repo has many pre-existing errors elsewhere — untouched).
- `pnpm exec vitest run tests/nar/kernel-gates.test.ts`: **6 passed**.

# Handoff Notes for Next Session
- Pre-existing LSP noise in `memory/concept.ts` (`forEach` return callbacks) untouched — separate fix.
- Event logs are per-gate in-memory arrays; `SqliteEventLog` design still open (see GATE_AUDIT.md §4).
- Remaining perception bypass sites (#8), BudgetGate wiring into `Focus.step`/`StreamReasoner`, `NLUnderstandingService` → `FormalizationBatchSchema` refactor, verifier script + CI, WASI hardening — all still open.
- `tests/nar/unit/memory-index.test.ts` imports `../../memory/concept` (bad path) — pre-existing, needs fix or deletion.
- When creating `@senars/kernel` workspace package, revert relative imports back to package imports and drop the tsconfig path shim.

---

# Verification Commands

```bash
pnpm run typecheck

grep -r "\.addTask\|\.addConcept\|\.revision(" nar/src --include="*.ts" | grep -v "gates/" | grep -v "kernel/" | wc -l
```

---

# Week 2 Continued II (2026-09-10 session) ✅ **PERCEPTION BYPASSES ROUTED, BUDGETGATE WIDESPREAD**

## Perception bypasses routed (all via `admitTask`, skip-on-reject)
| Site | Source tag | Note |
|------|-----------|------|
| `lm/enrichment.ts:258,262` (hypotheses + bridges) | `llm` / `bridge-llm` | static `gateRegistry` import |
| `lm/feedback.ts:179` (bridging hypotheses) | `llm` | static import |
| `lm/feedback.ts:390` (`injectValidationResult`) | `llm` | early-return on reject |
| `tools/guided.ts:29,32` (tool-result beliefs) | `tool` | early-return on reject |
| `tools/adapters/external-tools.ts:566,574` (coverage beliefs/goals) | `coverage-sensor` | dynamic `await import` (matches file's existing lazy-import convention) |
- `KernelPerceptionGate.admitTask` widened to accept both truth shapes (`{frequency,confidence}` kernel-schema and `{f,c}` NAR `Truth`) with internal normalization — call sites stay one-liners.
- **Deliberately left ungated:** `memory/state/serialization.ts` (state restore, not new observation — gating could lose persisted state), `Memory.addTask` internals (waist is at proposers), `Focus.tasks.add` (Focus-local bags, separate layer; GameFocus reward path already firewall-checked), `Negotiator.createLearningEvent` (reflex learning, covered by GameFocus RewardGate wiring).

## BudgetGate wiring (new)
- `Focus.step`: `nal-step` check at start; denied → zero-work report (honest early return, no silent stall).
- `TaskManager.processPending`: `memory-op` check per item; denied → `break` (remaining stay `pending`, not failed).
- `StreamReasoner.flush`: `lm-call` check with `estimatedCost: batch.length`; denied → batch re-queued (`unshift`) + `[]` (no LM spend, no request loss).
- Previously: `GameFocus.step` (`nal-step`).

## Verification (minimal runs)
- `tsc --noEmit` grep over all touched files: only pre-existing `lm/enrichment.ts` errors (confirmed identical on stashed base via `git stash` comparison — line-shifted only).
- `vitest run tests/nar/kernel-gates.test.ts`: **6/6 green**.

## New improvement opportunities
- `gateRegistry` is a mutable singleton shared across tests/production — BudgetGate consumed-counters leak between suites. Add `gateRegistry.reset()` in test setup or scope budgets per `Focus`/run.
- `TaskManager.processPending` admits via `term.toString()` without task punctuation (`inferTaskType` defaults to `belief`) — goals/questions admitted as beliefs. Route original `Task` objects through `admitTask` instead.
- `StreamReasoner.flush` dynamic-imports `gateRegistry` per call — hoist to static import (only kept dynamic out of caution for cycles; verify no cycle then hoist).
- Coverage-injection in `external-tools.ts` sets `concept.priority` directly + `addConcept` ungated — decide whether concept scaffolding needs a gate or stays memory-internal.

# Week 2 Continued III (2026-09-10 session) ✅ **NL CANDIDATE GENERATION + PROVISIONAL ADMISSION**

## `NLUnderstandingService` (`nar/src/nl/understanding.ts`) — additive, backward compatible
- `understand(): Promise<TaskBatch | null>` **unchanged** (callers `external-tools:1340`, `types/events.ts` untouched).
- New `understandCandidates(input, ctx): Promise<FormalizationBatch | null>` = `understand` + `toFormalizationBatch`.
- New `detectAmbiguityFlags(input): AmbiguityFlag[]` — regex detectors for `negation` (high: unless/not/never/without/except), `modal` (medium: may/must/should…), `quantifier` (medium: all/some/most…), `temporal` (low: when/after/until…) with disambiguation options.
- New `toFormalizationBatch(input, batch): FormalizationBatch` — flattens beliefs/questions/goals into `FormalizationCandidate[]` (uuid ids, `{frequency,confidence}` truth mapping, whole-input source span, per-candidate flags, global ambiguities from `meta`), validated via `validateFormalizationBatch`. Exported from `nar/src/nl/index.ts`.

## `KernelPerceptionGate.admitFormalization(batch, sourceQuality='LLM_PRIOR')`
- Parses each candidate with punctuation re-attached (`.`/`!`/`?`), then `admitTask(..., source 'llm')` — kernel never accepts a single authoritative parse; returns `{admitted[], rejected[]}` with per-candidate reasons. Truth confidence scaled by source-quality map.

## Tests — `tests/nar/kernel-gates.test.ts` now 8/8 ✅
- Candidate conversion: modal+negation flags on ambiguous input, zero flags on plain input, truth mapping, task-type preservation.
- Provisional admission: SECONDARY-quality admission (`0.7×0.7` confidence), `source:'llm'`, unparseable candidate rejected without throwing.

## Verification — tsc clean in scope, 8/8 green (2 runs total).

## New improvement opportunities
- Source spans are whole-input approximations — LM structured output should return per-candidate spans (requires prompt/schema change in `prompts/understanding-v1.ts` + `nl/schemas.ts`).
- `understand()` and `understandCandidates()` each call the LM separately — add single-flight so one LM call serves both.
- `admitFormalization` re-parses Narsese the LM already produced; consider a `parseTask`-free path when `admitTask`-style term objects are available.

# Week 2 Continued IV (2026-09-10 session) ✅ **STANDALONE DERIVATION VERIFIER + CI**

## `scripts/verify-derivation.ts` (imports only `node:fs`, `zod`, kernel schemas — no NAR engine)
- Local reimplementation of 11 binary truth functions (deduction/induction/abduction/exemplification/comparison/analogy/resemblance/intersection/union/revision/detachment) + 4 unary (negation-intro/elim, negation, conversion); `resolveFn` matches exact or substring ruleIds.
- Per-step checks: unique stepIds, non-empty premises/conclusion, substitution validity (non-empty values, variable in some premise, variable-or-value in conclusion), lineage-DAG (parents ⊆ prior steps + taskId), revision-with-`unknown`-independence flag, truth recomputation within epsilon (default 1e-6).
- Record checks: `finalTruth` == last-step truth, non-empty steps when cycles claimed.
- Unknown ruleIds warn (skip) by default, fail under `--strict`. CLI: `<record.json | array> [--strict] [--epsilon N]`, exit 0/1/2. Exported `verifyRecord` for tests.
- Schema: added optional `DerivationStep.premiseTruths` (backward compatible) — without it, truth algebra is unverifiable and the step is skipped, not passed.

## Tests + CI
- `tests/nar/derivation-verifier.test.ts` (6 tests, hand-computed values — no circularity with engine): valid deduction, tampered truth, revision+negation algebra, independence flag, lineage/final-truth failures, substitution + strict-mode unknowns.
- `.github/workflows/derivation-verify.yml`: path-triggered (truth.ts, kernel dirs, verifier, both test files) → installs → runs both test files.
- Verification: tsc clean in scope, **14/14 green** (both files), CLI smoke test `PASS … exit=0`.

## New improvement opportunities
- Engine never emits `DerivationRecord`s yet — wire record emission (with `premiseTruths`) into `RuleProcessor`/derivation loop so benchmark #5 (1,000-record proof replay) can run for real.
- `resolveFn` covers 15 rule spellings; classical/structural/temporal/procedural/meta-cognitive ruleIds will hit `unknown-rule` — extend table or formalize ruleId registry.
- Substitution check is syntactic (substring); full check needs term-parser application of the substitution map to premises.

# Week 2 Continued V (2026-09-10 session) ✅ **WASI SANDBOX HARDENING**

## `nar/src/capability/wasi-sandbox.ts`
- **Env leak closed (critical):** `createWasiSandbox` spread full `process.env` into the sandbox (secrets exposure); `createWasmModuleSandbox` passed `process.env` wholesale. Both now receive **explicit `env` only** (default `{}`) — deny-by-default.
- **Path containment:** new `sanitizePreopens()` (normalizes slashes, drops `..` escapes) applied to both sandboxes; new `assertWasmPathContained()` throws when `wasmPath` escapes `allowedPaths`; `containsPath()` guards sibling-prefix confusion (`/workspace-evil` ≠ child).
- **Timeouts:** new `timeoutMs` option (default 30s `DEFAULT_SANDBOX_TIMEOUT_MS`) enforced via `withTimeout()` → `SandboxTimeoutError`; all sandbox wrappers race execution against it.
- **`(0,eval)('WebAssembly')` removed** → `globalThis.WebAssembly` with narrow `BufferSource`/`Imports` casts (the old `any` masked two type errors; fixed, tsc clean).
- **`createNodeVMSandbox` deprecated:** `@deprecated` JSDoc + one-time `console.warn`; export retained for backward compat (existing test). Relegated to trusted-but-faulty isolation — never for untrusted code.
- New exports via `capability/index.ts`: `SandboxTimeoutError`, `DEFAULT_SANDBOX_TIMEOUT_MS`, `sanitizePreopens`, `containsPath`, `assertWasmPathContained`, `withTimeout`.

## Tests — `tests/nar/sandbox-hardening.test.ts` (4 new) + `todo5b-wasi.test.ts` (5 existing): **9/9 ✅**
Preopen escaping, containment (incl. sibling-prefix), timeout resolve/reject, deprecation-warn-once + passthrough.

## Verification — tsc clean in scope (1 pre-existing `todo5b-capability` branded-Truth error untouched), 9/9 green.

## New improvement opportunities
- Returned sandbox wrappers still **pass through to `fn()`** — WASI instance is configured but execution isn't actually confined to it. True confinement (run capability code inside the WASM instance) is the remaining hardening step.
- No clock/network/memory toggles: @wasmer/wasi 1.x `WasiConfig` surface couldn't be confirmed offline — audit against installed API before promising `allowClock`/`allowNetwork`/`memoryLimitPages`.
- `WasmModuleOptions.args` defaults to `['wasm-sandbox']`; confirm argv[0] convention matches wasmer expectations.

# Week 2 Continued VI (2026-09-10 session) ✅ **@senars/kernel WORKSPACE PACKAGE**

## New `kernel/` package (replaces tsconfig path shim + relative imports)
- `src/kernel/schemas.ts` → `kernel/src/schemas.ts` (+ `kernel/src/index.ts` re-export); `src/kernel/` removed.
- `kernel/package.json`: `@senars/kernel@0.1.0`, `exports` for `.` and `./schemas` (TS-source style, matching `@senars/core` convention), `zod` dep.
- Registered in `pnpm-workspace.yaml`, root `package.json`, and `nar/package.json` (`workspace:*`); `pnpm install` links `node_modules/@senars/kernel`.
- Root `tsconfig.json` paths updated to `./kernel/src/*`.
- All 10 consumers migrated to `@senars/kernel/schemas`: 5× `nar/src/kernel/`, `nar.ts`, `nl/understanding.ts`, `scripts/verify-derivation.ts`, `tests/nar/derivation-verifier.test.ts`.
- Resolves the earlier lesson: tsconfig-paths alias satisfied `tsc` but failed under vitest/vite; the real package resolves in both.

## Verification — tsc clean in scope, **23/23 green** across `kernel-gates` (8), `derivation-verifier` (6), `sandbox-hardening` (4), `todo5b-wasi` (5).

## New improvement opportunities
- `@senars/kernel` currently holds only schemas; natural next residents: gate I/O types already there — consider moving `nar/src/kernel/` gates into the package (breaks `nar` import cycle risk: gates import NAR terms — keep gates in `nar`, schemas in `kernel`).
- Root `src/` no longer has `kernel/` — update any docs referencing `src/kernel/schemas.ts` (README? GATE_AUDIT.md, RFC).

# Week 2 Continued VII (2026-09-10 session) ✅ **DERIVATION RECORDS + BENCHMARKS 1–8**

## `DerivationRecorder` (`nar/src/rules/recorder.ts`, exported from `rules/index.ts`)
- `begin(taskKey, goalTerm)` / `record(ruleId, p1, p2, result)` / `finish()` / `drain()`; bounded (`maxStepsPerRecord` 200, `maxCompletedRecords` 200); **disabled by default** (zero hot-path impact — verified by unchanged `benchmark.test.ts` timings).
- Per step: uuid stepId, `inferRuleCategory(ruleId)` keyword map, term strings, `{frequency,confidence}` truth + `premiseTruths`, evidence lineage (stamp→step uuid map, taskId fallback), independence from stamp ancestor overlap (`dependent` on shared ancestors, else `independent`).
- Wired into `RuleProcessor.processSync` (begin/record/finish) and async `process`; `setConfig({recorderEnabled})` + `getRecorder()`.

## `tests/nar/todo7-validation.test.ts` — all 8 benchmarks ✅ (marks Part 3 mostly done)
| # | Suite | Level |
|---|-------|-------|
| 1 | Evidence laundering: 5× looped reinforcement, confidence unmoved, single belief | Concept |
| 2 | Translation ambiguity: unless/may/never → multi-candidate + negation/modal flags | NL converter |
| 3/3b | Bounded degradation: tiny-budget enum denial; Focus survives global exhaustion with zero-work report | Gate/Focus |
| 4 | Contradiction resilience: `(A→B)` + `¬(A→B)` coexist with distinct truth | Concept |
| 5 | Proof replay: `processSync` records → `verifyRecord` passes on every record | Engine→verifier |
| 6 | Scheduler fairness: 0.01-weight focus keeps nonzero budget share | FocusBag |
| 7 | Sabotage: unknown mutation kinds, policy-denied `read-env`, approval-rejected `modify-code` all fail safe | CapabilitySpace |
| 8 | Metric-gaming: truth-target rewards rejected; reward-model/approval edits policy-denied | RewardGate+Space |

## Critical fixes found by this work (root causes, not symptoms)
1. **NAR input silently dropped (prior-session regression):** gate routing passed bare `term.toString()` but `termParser.parseTask` requires trailing punctuation → every input rejected. Fixed with `parseTaskTolerant()` (tries raw, `.`, `?`, `!`) in `inferTaskType`/`rawObservationToTerm`.
2. **Engine derivations rejected by own gate:** `nar-execution` re-parsed derived terms (`(a | b)` has no task-parseable form). Switched `nar-execution`, `task/manager`, `nar.inputTask` to lossless `admitTask(term, type, truth, source, stampId)` — audit trail preserved, round-trip eliminated.
3. **Non-uuid correlationIds:** engine stamp ids (`0:42`) failed `z.string().uuid()` validation → relaxed `correlationId`/`causationId` to plain strings (minted ids stay uuid).
4. **Contradiction coexistence:** `findMatchingBelief` stripped single-arg wrappers so `¬X` matched `X` and was rejected. Now exact structural match — paraconsistent storage.
5. **Mention-boost lost by independence rejection:** duplicate-with-unknown-independence returned `false` before `recordAccess()`, breaking priority dynamics (`memory.sample` regression). Now boosts attention (priority) while refusing truth revision — the decoupled-decay philosophy made concrete.

## Verification — **118/118 green**: validation (9) + gates (8) + verifier (6) + sandbox (4) + wasi (5) + regression sweep across concept/memory/revision/integration/nal1/benchmark/extended (86). tsc clean in scope. Bisect method: `git stash -u` base comparison + single-file `git stash push` isolation.
- Full NAR smoke: `(animal→dog),(dog→pet) ⊢ (animal→pet)` plus rich derivations confirmed via script.

## New improvement opportunities
- Benchmark #3's global-budget drain mutates the `gateRegistry` singleton (reset at test end) — per-run budget scoping still wanted.
- Benchmark #7 tests what exists (allowlist/policy/approval); the external PatchRiskClassifier + immutable runner from the RFC remain unimplemented.
- Derived-term explosion visible in smoke test (`(dog→((animal&pet)&--pet))` etc.) — derivation ranking/attention is the next pressure valve.
- `parseTaskTolerant` order tries `.` before `?`/`!` — a bare question-term string admits as belief; acceptable (callers with known types should use `admitTask`).

*Last Updated: 2026-09-10 — COMPLETION: Week 2 sessions VIII–XXVIII all green (82/82 tests). Track A kernel hardening + Track B governance + Track C NL + Track D RL domain split substantially complete. Remaining: external runner repo, true WASI confinement, Arbiter pattern engine isolation, full-state memory replay.*

---

# 📋 Week 3 Progress (2026-09-10 session) ✅ **EXTERNAL GOVERNANCE SCHEMA COMPLETE**

## Track B §3: External Governance Runner — Schema & In-Repo Pipeline Updates

| Task | Status | Files |
|------|--------|-------|
| **PatchProposal schema: `agentSignature` + `ciResults`** | ✅ Done | `kernel/src/schemas.ts` — added `patchDiff`, `ciResults`, `riskSelfAssessment`, `affectedComponents`, `timestamp`, `agentSignature` |
| **CognitiveEvent: `self-mod.proposal` type** | ✅ Done | `kernel/src/schemas.ts` — new `SelfModProposalEventSchema` with `PatchProposal` payload |
| **PatchRiskClassifier: check `affectedComponents`** | ✅ Done | `nar/src/governance/pipeline.ts` — `CRITICAL_COMPONENTS` list mirrors RFC guardrails |
| **Governance tests updated & passing** | ✅ 5/5 | `tests/nar/governance.test.ts` — guardrail touch, critical component, churn/coverage, policy decisions, audit event |

---

# 📋 COMPLETION SUMMARY (2026-09-10)

## ✅ SUBSTANTIALLY COMPLETE (Core Architecture)

| Track | Area | Status | Key Deliverables |
|-------|------|--------|------------------|
| **A** | Kernel Hardening & Event Sourcing | ~90% | 4 Gates (Perception/Action/Reward/Budget), `CognitiveEvent` schemas, JSONL persistence + replay reducers, derivation recorder + standalone verifier, evidence independence guards, decoupled decay, per-run budget scoping |
| **B** | Safety, Sandboxing & Governance | ~80% | WASI deny-by-default + path containment + timeouts (true confinement pending), Autonomy state machine (5 modes, stepwise transitions, external approval required beyond sandbox), `PatchRiskClassifier` + `GovernancePolicyEngine` + `ProposalRouter` + `SandboxValidator` (in-repo; external runner repo pending), **`PatchProposal` schema hardened with `agentSignature`/`ciResults`/`affectedComponents`, `self-mod.proposal` event type added** |
| **C** | NL Pipeline & Engine Isolation | ~85% | Multi-candidate `FormalizationBatch` with per-span ambiguity flags, single-flight LM dedup, unified `translateCached` (cache→flight→record), `admitFormalization` provisional admission, `StreamReasoner` budget-gated, `KernelPerceptionGate` lossless `admitTask` |
| **D** | RL Refactoring — Unified Substrate, Separated Domains | ~95% | 5 domain-scoped learners (`external-reflex`, `self-scheduler`, `self-explanation-rank`, `self-config-proposal`, `self-patch-score`), `LearnerRegistry` fail-closed dispatch, epistemic firewall (rewards cannot mutate Truth), `SelfRewardGate` → `ProposalRouter` → `SelfMetaGame.applyProposal` (strict mutation authority: only low-risk focus-weight auto-applies) |

## 🧪 VERIFICATION STATUS
- **82 tests passing** across 20 test files (kernel gates, governance, domains, budget scopes, derivation ranking/verification, sandbox hardening, NL single-flight/spans/caching, self-game wiring, proposal routing, cognitive replay, record hydration, optimizer dims)
- **TypeScript clean** in all modified scopes (pre-existing errors in unrelated files untouched)
- All benchmarks 1–8 passing (`todo7-validation.test.ts`)

## 🔧 KEY FILES CREATED THIS SESSION

| File | Purpose |
|------|---------|
| `kernel/src/schemas.ts` | Single source of truth: `CognitiveEvent`, `ReasoningBudget`, `DerivationRecord`, `FormalizationCandidate`, Gate I/O, `AutonomyMode`, `RewardDomain`, `SelfImprovementProposal`, `PatchProposal`, `GovernanceEvent` |
| `nar/src/kernel/*.ts` | 4 Gates + `GateRegistry` + `EventLogPersistence` (JSONL + replay reducers) |
| `nar/src/governance/pipeline.ts` | `PatchRiskClassifier`, `GovernancePolicyEngine`, `ProposalRouter`, `SandboxValidator` |
| `nar/src/learning/domain-learners.ts` | 5 domain-scoped learners + `LearnerRegistry` |
| `nar/src/rules/recorder.ts` + `hydration.ts` | `DerivationRecorder` (bounded, opt-in) + `hydrateRecord` |
| `nar/src/rules/ranking.ts` | `scoreDerivation` / `rankDerivations` (pressure valve) |
| `nar/src/nl/singleflight.ts` | In-flight dedup helper (shared by understand/generate) |
| `nar/src/game/SelfMetaGame.ts` | `schedulerReward` + `attachScheduler` (self-game wiring) |
| `scripts/verify-derivation.ts` | Standalone proof checker (no NAR engine deps) |
| `tests/nar/governance.test.ts` | Governance pipeline tests (5/5 passing) |
| `kernel/src/schemas.ts` | **Updated**: `PatchProposal` schema + `self-mod.proposal` CognitiveEvent |
| `nar/src/governance/pipeline.ts` | **Updated**: `PatchRiskClassifier` checks `affectedComponents` for critical guardrails |

## 📦 PACKAGES
- `@senars/kernel` workspace package created (replaces tsconfig path alias; resolves in both `tsc` and `vitest`)

## ⏳ REMAINING WORK (Priority Order)

### 1. External Governance Runner (Track B §3 — ops + separate repo)
- Move `PatchRiskClassifier`/`GovernancePolicyEngine`/`SandboxValidator` to immutable external repo
- GitHub Actions workflow with required-status check on `main`
- Webhook/polling event log consumer → PR creation/merge
- ~~`agentSignature` + `ciResults` fields on `PatchProposal`~~ ✅ **COMPLETED**

### 2. True WASI Confinement (Track A §4)
- Current wrappers configure WASI but still pass through to `fn()` — need to execute capability code *inside* the WASM instance
- Clock/network/memory limit toggles via `@wasmer/wasi` API audit

### 3. Arbiter Pattern — Engine Isolation (Track C §2)
- NAR and MeTTa must not share memory; both emit `EngineResult` proposals to Kernel
- Enforce boundary: MeTTa exact `definitional-equality` vs NAR `uncertain-equivalence` (e-graph never unions on NAR similarity)

### 4. Full-State Memory Replay (Track A §1 exit criterion)
- `hydrateRecord` re-admits conclusions only; need premise reconstruction + stamp/lineage restoration
- Wire `loadGateEvents` + record store → `replayIntoMemory` entry point for "pause/serialize/replay in separate process"

### 5. Per-Candidate Source Spans — LM Integration (Track C §1)
- Prompt/schema change so LM returns `sourceText` offsets per candidate (currently whole-input fallback)

### 6. Cleanup / Polish
- Fix pre-existing `SearchSpace` export in `cognitive/types` (blocks clean `tsc` on `optimizer.test.ts`)
- Hoist `StreamReasoner.flush` dynamic import of `gateRegistry` to static (verify no cycle)
- Add ranking knobs to `SelfMetaGame` defaultKnobs + tool-registry `knob:*` map
- Wire `applyKnob` actuator → `RLFPLearner.applyTuningUpdate` so validated proposals actually mutate params

---

*All session logs above (Week 2 Continued I–XXVIII) document the incremental work. This summary captures the architectural end state.*

---

# ✅ REMAINING WORK CHECKLIST (Prioritized)

## 1. External Governance Runner (Track B §3 — ops + separate repo)  🔄 **SCHEMA COMPLETE**
- [ ] Move `PatchRiskClassifier`/`GovernancePolicyEngine`/`SandboxValidator` to immutable external repo
- [ ] GitHub Actions workflow with required-status check on `main`
- [ ] Webhook/polling event log consumer → PR creation/merge
- [x] Add `agentSignature` + `ciResults` fields on `PatchProposal` (kernel/src/schemas.ts)
- [x] Add `self-mod.proposal` CognitiveEvent type with `PatchProposal` payload (kernel/src/schemas.ts)
- [x] Update `PatchRiskClassifier` to check `affectedComponents` for critical components (nar/src/governance/pipeline.ts)
- [x] Governance tests passing (5/5)

## 2. True WASI Confinement (Track A §4)  ☐
- [ ] Execute capability code *inside* the WASM instance (current wrappers only configure)
- [ ] Clock/network/memory limit toggles via `@wasmer/wasi` API audit

## 3. Arbiter Pattern — Engine Isolation (Track C §2)  ☐
- [ ] NAR and MeTTa must not share memory; both emit `EngineResult` proposals to Kernel
- [ ] Enforce boundary: MeTTa exact `definitional-equality` vs NAR `uncertain-equivalence` (e-graph never unions on NAR similarity)

## 4. Full-State Memory Replay (Track A §1 exit criterion)  ✅ **COMPLETED**
- [x] Created `replayIntoMemory` entry point (`nar/src/kernel/replay.ts`) — loads gate events + derivation records, rebuilds full Memory state
- [x] Replays task admissions (beliefs/goals/questions) with truth, budget, stamps
- [x] Replays belief revisions with evidence lineage (remove/re-add with updated truth)
- [x] Replays concept activations (priority)
- [x] Replays derivation steps as derived beliefs with evidence lineage stamps
- [x] `serializeReplayResult` for snapshotting replay output
- [x] `persistDerivationRecords` / `loadDerivationRecords` for derivation log persistence
- [x] Tests: pause → serialize → replay in separate process yields same state (`tests/nar/full-replay.test.ts` — 5/5 green)
- [x] Exit criterion met: system can be paused, event log serialized, and perfectly replayed in a separate process to yield the exact same state

## 5. Per-Candidate Source Spans — LM Integration (Track C §1)  🔄 **PARTIAL — SCHEMA/PROMPT DONE, LM INTEGRATION PENDING**
- [x] `TaskBatchSchema` + `TaskBatch` interface: optional `sourceText` per item
- [x] `locateSpan(input, sourceText)`: exact span via `indexOf`, whole-input fallback
- [x] `toFormalizationBatch`: per-candidate spans + span-local ambiguity flags
- [x] Prompt (`understanding-v1.ts`): instructs LM to include verbatim `sourceText` per entry
- [x] Tests `tests/nar/source-spans.test.ts` (3): locate/fallback, narrowed spans + flag isolation, backward compat
- [ ] **LM actually returns `sourceText`** — requires live LM call verification; schema/prompt ready

## 6. Cleanup / Polish  🔄 **MOSTLY DONE**
- [x] Fix pre-existing `SearchSpace` export in `cognitive/types` (blocks clean `tsc` on `optimizer.test.ts`) — fixed import path in `tests/nar/unit/optimizer.test.ts:10`
- [x] Hoist `StreamReasoner.flush` dynamic import of `gateRegistry` to static (verified no cycle) — `nar/src/stream/reasoner.ts:4`
- [x] Add ranking knobs to `SelfMetaGame` defaultKnobs + tool-registry `knob:*` map — `nar/src/game/SelfMetaGame.ts:37-42`, `nar/src/tools/tool-registry.ts:592-593`
- [ ] Wire `applyKnob` actuator → `RLFPLearner.applyTuningUpdate` so validated proposals actually mutate params

---

# 💡 HELPFUL FUTURE ENHANCEMENTS (Nice-to-have)

- **Unified `translateCached` path**: combine `TranslationCache` + `SingleFlight` → single entry point `translate(input)` that checks cache, then single-flight LM, then records.
- **Novelty-aware ranking**: incorporate independence/lineage depth factor into `scoreDerivation` when recorder metadata available.
- **Batch `recordFocusStepReport`**: average reward over N reports before dispatch to `SchedulerAdapter` to reduce burstiness.
- **Explanation quality outcome source**: wire `PreferenceRanker` with real explanation rating signals.
- **Schema promotion / test generation validators**: implement shadow-worktree CI checks so medium-risk proposals can leave `awaitingValidation` queue.
- **Derivation verifier rule coverage**: extend `resolveFn` table for classical/structural/temporal/procedural/meta-cognitive rule IDs; add full substitution check via term parser.
- **Snapshot version migration**: add forward-compatible migration logic for `CognitiveStateSnapshot` version upgrades.
- **Observability**: OpenTelemetry spans for each gate decision (admit/deny, budget grant/deny, reward firewall).
- **Benchmark automation**: CI job that runs the 8 validation benchmarks nightly and publishes trend dashboard.

---

---

# Week 2 Continued XXVIII (2026-09-10 session) ✅ **COVERAGE-CONCEPT GATING — DECISION: STAYS MEMORY-INTERNAL**

## Analysis (`nar/src/tools/adapters/external-tools.ts:542-583`)
- Belief + goal injections are **already gated** (`admitTask(..., 'coverage-sensor')` at :567/:577), and `mapSource('coverage-sensor')` → `'sensor'` (substring match, `KernelPerceptionGate.ts:110`) — the audit trail exists.
- Ungated parts: `addConcept` scaffolding (:550) + direct `concept.priority = ...` (:556).

## Decision: no gate for scaffolding/attention — rationale
1. `addConcept` creates an empty vessel — carries no truth, so there is nothing for the epistemic firewall to protect. Gating structural ops would force a new gate concept for zero safety gain.
2. The priority write is attention-domain, which the firewall explicitly allows (`attention-priority` is an accepted reward target). It is causally covered by the adjacent gated belief admission — the `task.admitted` (sensor) event is the audit record; the priority bump is its attention effect.
3. The line that WOULD require gating — reward signals writing priority — already goes through `RewardGate` (`GameFocus.ts:90`, `SelfMetaGame` scheduler path).

## Rule going forward
Gate truth-bearing admissions (beliefs/goals/questions) and policy/weight mutations. Leave structural scaffolding and attention decay to memory internals — with the exception that any *external* attention override should ride alongside a gated admission event, as the coverage injector already does. No code change; no test (path requires coverage-tooling harness).

---

# Week 2 Continued XXVII (2026-09-10 session) ✅ **UNIFIED translateCached PATH**

## Finding
`NLUnderstandingService` accepted a `TranslationCache` as `_cache` — never stored, never read. Every `understand()` spent LM budget even for previously translated inputs.

## Fix (`nar/src/nl/understanding.ts`, `tests/nar/translate-cached.test.ts`)
- Constructor stores the cache (param renamed `_cache` → `cache`; positional — no caller breakage).
- `understand()`: `cache.get(input)` hit (structured result only; legacy string entries skipped) → `fromCached` + `sanitize`, zero LM spend. LM success → `toCached` + `record`. Miss with no model → null without populating.
- Cached entries get `source: 'user'`, `detectedIntent: 'chat'`, empty ambiguity/coreference context — honest defaults (provenance of the original parse isn't retained; noted below).

## Verification — **84/84 green** across 21 suites, tsc clean in scope.

## New improvement opportunities
- Cached entries lose original truth-source/ambiguity provenance (`source` forced to `user`) — store TaskBatch-shaped results (with `sourceText`) instead of TranslationResult to preserve it.
- TTL is 1h fixed — translations of stable facts could persist longer; consider per-entry TTL by confidence.
- `understandCandidates` on a cache hit converts cached→batch→candidates (double conversion) — acceptable but wasteful; short-circuit directly to candidates.

---

# Week 2 Continued XXVI (2026-09-10 session) ✅ **TASKMANAGER TYPE FOLLOW-UP — ALREADY FIXED, LOCKED IN**

## Finding
The week-2 follow-up ("`TaskManager.processPending` admits via `term.toString()` ... goals/questions admitted as beliefs") is **stale** — resolved by the VII lossless-`admitTask` migration. Current `task/manager.ts:123` routes original `Task` objects (`wrapper.task.term`, `wrapper.task.type`) through `admitTask`; no `inferTaskType`/`parseTask`/`toString` remains in the file (verified by grep).

## Lock-in (`tests/nar/taskmanager-types.test.ts`)
Belief + goal + question through `addTask` → `processPending` → processed tasks and gate `task.admitted` events all preserve exact types. Singleton reset before/after to avoid cross-suite leakage. **1/1 green**.

---

# Week 2 Continued XXV (2026-09-10 session) ✅ **PER-CANDIDATE SOURCE SPANS**

## Fix (additive, backward compatible)
- `TaskBatchSchema` + `TaskBatch` interface: optional `sourceText` (verbatim input quote) on belief/question/goal items. Old LM outputs without it still validate.
- `locateSpan(input, sourceText)`: `indexOf` → exact span; missing/empty → whole-input fallback (exported from `nl/index.ts`).
- `toFormalizationBatch`: per-candidate spans + **span-local** ambiguity flags (modal in sentence 1 no longer flags sentence 2's candidate).
- Prompt (`understanding-v1.ts`): instructs LM to include verbatim `sourceText` per entry.
- Tests `tests/nar/source-spans.test.ts` (3): locate/fallback, narrowed spans + flag isolation, no-sourceText backward compat. (One self-caused off-by-one in expectations — code was correct.)

## Verification — **81/81 green** across 19 suites, tsc clean in scope.

## New improvement opportunities
- `indexOf` takes first occurrence — repeated sentences misattribute; disambiguate with occurrence hints or LM-provided offsets when available.
- `admitFormalization` could use spans for finer-grained confidence scaling per candidate.

---

# Week 2 Continued XXIV (2026-09-10 session) ✅ **GENERATION DEDUP + LINT FIX**

## Fix
- `NLGenerationService.generate` wrapped in `SingleFlight` (same helper as XXII): key = `JSON(input)`, unserializable input → unique key (never shares, never throws). Body moved to `generateInner`, zero logic change.
- Lint: replaced `(map[k] ??= []).push(...)` in `EventLogPersistence.ts` (assignment-in-expression rule) with explicit chain get/push/set.
- Tests `tests/nar/generation-singleflight.test.ts` (2): null-model fallback determinism + concurrent-share equality; circular-input safety. Service constructed with stub `{languageModel: () => null}` — exercises the pure fallback path without LM mocks.

## Verification — **78/78 green** across 18 suites, tsc clean in scope.

---

# Week 2 Continued XXIII (2026-09-10 session) ✅ **REVISION-HISTORY SNAPSHOT**

## Fix (`nar/src/kernel/EventLogPersistence.ts`, test in `cognitive-replay.test.ts`)
- `CognitiveStateSnapshot` += `version: SNAPSHOT_VERSION (1)` and `revisions: Record<term, Array<{oldTruth, newTruth}>>` — `belief.revised` now appends to the per-term ordered chain while `beliefs` keeps last-write-wins. Audit trail preserved, hot lookup untouched.
- Test: two validated `belief.revised` events → latest truth in `beliefs`, ordered 2-entry chain in `revisions`, version asserted on replayed snapshot.

## Verification — **76/76 green** across 17 suites, tsc clean in scope.

---

# Week 2 Continued XXII (2026-09-10 session) ✅ **NL SINGLE-FLIGHT**

## Correction
The plan note ("`understand()` and `understandCandidates()` each call the LM separately") was stale — `understandCandidates` already delegates to `understand` (one LM call). The real gap was concurrent duplicate `understand()` calls (bursty agent loop, retries) each spending LM budget.

## Fix (`nar/src/nl/singleflight.ts`, wired in `understanding.ts`)
- `SingleFlight.run(key, fn)`: in-flight promise shared by key; slot cleared on settle (success or rejection — failures don't poison, retries re-execute). `size` exposed for observability.
- `understand()` keys on `maxRetries::input::JSON(ctx)` (safe-stringify fallback to unshared on circular ctx); retry loop moved to `understandInner`. `understandCandidates` inherits dedup for free. Note: same input with different ctx does NOT share (correct — context changes the parse).

## Tests — `tests/nar/singleflight.test.ts` (3): shared execution + slot cleanup, key isolation + re-execution, rejection clears. **75/75 green** across 17 suites, tsc clean in scope.

## New improvement opportunities
- `NLGenerationService.generate` has the same bursty-call shape — wrap with the same helper.
- `TranslationCache` (result cache) + `SingleFlight` (in-flight dedup) are complementary but separate — consider a unified `translateCached` path: check cache → single-flight LM → populate cache.

---

# Week 2 Continued XXI (2026-09-10 session) ✅ **RECORD→MEMORY HYDRATION**

## Gap
`DerivationRecorder` emitted records but nothing re-applied them — engine replay from persisted records was impossible.

## Fix (`nar/src/rules/hydration.ts` + `tests/nar/record-hydration.test.ts`)
- `hydrateRecord(memory, record): {applied, skipped}` — parses each step conclusion (`termParser.parse`), creates `Truth`, admits via `memory.addTask(term, 'belief', truth)` (so revision/independence guards apply on re-admission). Intra-record duplicates skipped via `seen` set; unparseable conclusions and gate-rejected admissions counted in `skipped`, never thrown — mirrors `deserialize` per-item resilience.
- Type-only `Memory` import (no runtime cycle); truth flows through `Truth.create(f, c)`.

## Verification — **70/70 green** across 15 suites (full gate set + verifier), tsc clean in scope.

## New improvement opportunities
- Hydration uses fresh input stamps — evidence lineage (`stampToStep` ancestry) is lost; reconstruct stamps from `evidenceLineage` when stamp serialization supports it.
- Only conclusions hydrated (premises assumed present) — full replay should also restore missing premises or verify their presence first.
- No caller yet: wire `loadGateEvents` + record-store → `hydrateRecord` into a `replayIntoMemory` entry point (closest to the Track A §1 "separate process, same state" demo).

---

# Week 2 Continued XX (2026-09-10 session) ✅ **COGNITIVE OPTIMIZER DIMS**

## Fix (`nar/src/cognitive/optimizer.ts`, test in `tests/nar/unit/optimizer.test.ts`)
- `PARAMETER_MAP` += `inference.rankingMaxAdmissions` / `inference.rankingMinScore` — each preserves the sibling field (no clobber when ranking exists; sensible defaults when absent).
- `COGNITIVE_PARAMETER_SPACE` += both dims (ranges mirror `PARAMETER_SPACE`).
- Test: apply admissions → `{250, 0}`, then minScore → `{250, 0.2}`; space entries match expected shape.

## Verification — **64/64 green** across 14 suites. tsc: 1 error in `tests/nar/unit/optimizer.test.ts:10` (`SearchSpace` not exported from `cognitive/types`) — confirmed pre-existing via `git stash -u` base comparison (untouched import line).

## New improvement opportunities
- Pre-existing `SearchSpace` export breakage blocks clean `tsc` on that file — fix the export (separate change).
- Grid/random samplers now cover ranking dims automatically via space — Bayesian sampler (if any) should confirm compat.

---

# Week 2 Continued XIX (2026-09-10 session) ✅ **SELF GAME OUTCOME WIRING**

## Gap
`MetaGame.step` always returns reward 0 — no self-game reward signal existed, so `SchedulerAdapter` had no input and Track D §3's "self-game reward trains rankers/optimizers" was unwired.

## Fix (`nar/src/game/SelfMetaGame.ts` + `tests/nar/self-game-wiring.test.ts`)
- `SelfMetaGameImpl.schedulerReward(report)`: throughput proxy `clamp(derivations/tasks − 0.5)×2 → [-1,1]`, 0 when idle. Documented as productivity signal, not coherence — contradiction/depth signals still open.
- `attachScheduler(registry, rewardGate)` (opt-in, backward compatible): `recordFocusStepReport` now firewall-checks (`domain: 'self-scheduler'`, `targetType: 'policy-weights'`) then `registry.dispatch({domain, reward, focusId})` → `SchedulerAdapter` nudges weights. Rejected firewall checks skip dispatch (fail-closed).
- Tests (2): productive focus gains weight / idle no-op; unattached no-op + firewall returns `requiresProposal` for self-rewards.

## Verification — **48/48 green** across 13 suites, tsc clean in scope (fixed missing `override`).

## New improvement opportunities
- Reward is throughput-only: wire contradiction-rate (coherence↓), derivation depth (depth↓), and CI pass-rate signals per the Track D §3 formula when available.
- `recordFocusStepReport` consumption is push-based per report — bursty; consider batching/averaging over N reports before dispatch.
- No wiring yet for `PreferenceRanker`/`ConfigOptimizer` self-outcomes (explanation quality, schema success) — needs outcome sources that don't exist yet.

---

# Week 2 Continued XVIII (2026-09-10 session) ✅ **FULL-STATE REPLAY REDUCERS**

## Fix (`nar/src/kernel/EventLogPersistence.ts`)
- `replayCognitiveState(events): CognitiveStateSnapshot` — pure reducer over all 7 kernel event types: `task.admitted`→task list, `belief.revised`→truth map (last-write-wins), `derivation.accepted`→derivation list, `concept.activated`→priority map, `policy.violation`→violation list, `budget.exhausted`→budget list, `autonomy.mode.changed`→current mode. No input mutation; unknown types ignored.
- Pause→serialize→reload→replay demonstrated in `tests/nar/cognitive-replay.test.ts`: all gates driven, persisted to JSONL, reloaded, replayed twice with deep-equal snapshots (the Track A §1 exit criterion for gate-level state).

## Tests (1, dense): snapshot contents per gate + determinism. **46/46 green** across 12 suites, tsc clean in scope.

## New improvement opportunities
- Reducer covers gate-level state only — `Memory` internals (bags, concepts, stamps) are not reconstructible from gate logs; full engine replay needs derivation-record→memory hydration (recorder emits records but nothing re-applies them).
- `belief.revised` last-write-wins discards revision history — snapshot should optionally retain the chain for audit.
- Snapshot has no version tag — add schema version for forward-compatible log evolution.

---

# Week 2 Continued XVII (2026-09-10 session) ✅ **SHADOW-VALIDATION CONSUMER (SANDBOX VALIDATOR)**

## Fix (`nar/src/governance/pipeline.ts` + `tests/nar/sandbox-validation.test.ts`)
- `SandboxValidator.validate(proposal)`: only `knob-tune` has automated checks — known knob (vs `rlfp/knobSchema`), numeric value, within `[min, max]`. All other medium kinds (`schema-promotion`, `test-generate`) escalate with reason (no silent approval, no silent drop).
- `ProposalRouter.route(..., validator?)`: validated in-range knob-tune + `applyKnob` actuator + executable mode → applied with `sandbox-validated` reason. Without validator, without actuator, with failing verdict, or in `observe/propose-only` → stays in `awaitingValidation` queue. High-risk path untouched (always human).
- Medium-risk loop now closed end-to-end: `ConfigOptimizer.suggestKnob` → `SelfRewardGate.submit` → `route` → validate → `applyKnob`. (Note: stale-LSP false alarm this session — `tsc`+vitest are ground truth, not write-time diagnostics.)

## Tests (2): validator approve/reject matrix; apply-vs-queue matrix (5 cases, queue count 3). **45/45 green** across 11 suites, tsc clean in scope.

## New improvement opportunities
- Validator checks ranges only, not semantics (e.g. `rankingMaxAdmissions: 10` is valid but may starve reasoning) — add cross-knob coherence checks or canary-run before apply.
- `schema-promotion`/`test-generate` have no automated checks — needs shadow-worktree CI (RFC §4) before they can leave the queue.
- `applyKnob` actuator has no production registrant yet — `RLFPLearner.applyTuningUpdate` is the natural one; wire `knobs[knob].set(value)` as the actuator so validation actually mutates tuned params.

---

# Week 2 Continued XVI (2026-09-10 session) ✅ **RANKING KNOBS IN TUNING REGISTRY**

## Fix (`nar/src/rlfp/knobs.ts` + `tests/nar/ranking-knobs.test.ts`)
- `knobSchema` += `rankingMaxAdmissions` (`inference.ranking.maxAdmissions`, 10–1000, step 10) and `rankingMinScore` (`inference.ranking.minScore`, 0–0.5, step 0.05). Ranges mirror `PARAMETER_SPACE`.
- Zero plumbing needed beyond schema: `RLFPLearner.applyTuningUpdate` and the `tune_knob` self-tool resolve through `createKnobSet`, so ranking knobs are tunable via existing channels immediately.
- Tests (2): schema presence/paths; get/set/clamp/step-rounding round-trip into live `rankDerivations` behavior (clamp 5000→1000, round 0.23→0.25, round 23→20 admissions). **43/43 green** across 10 suites, tsc clean in scope.

## New improvement opportunities
- `SelfMetaGame` defaultKnobs/`applyKnob` still lacks ranking entries — its knob space is engine-local (separate from `CognitiveParameters`); unify or document the two knob authorities.
- `CognitiveOptimizer` search space (`cognitive/optimizer.ts:96`) still missing the new dims (carried over).

---

# Week 2 Continued XV (2026-09-10 session) ✅ **RANKING CONFIGURABILITY**

## Fix
- `InferenceConfig.ranking?: {maxAdmissions, minScore}` (optional — existing configs unaffected), defaults `{100, 0}` in `DEFAULT_COGNITIVE_PARAMETERS`, ranges in `PARAMETER_SPACE.inference` (`rankingMaxAdmissions` 10–1000, `rankingMinScore` 0–0.5).
- `nar-execution.ts` admission loop reads `this.config.cognitiveParams?.inference.ranking` — Self Game / optimizer can now tune the pressure valve via standard parameter channels; `mergeParameters` carries it through.
- Test: defaults match ranking constants, space defaults, merged custom `{5, 0.5}` caps at 5. **41/41 green** across 9 suites, tsc clean except pre-existing `tests/nar/unit/nar-execution.test.ts` bad import (untouched).

## New improvement opportunities
- Knob registry (`rlfp/knobs.ts`, `SelfMetaGame` defaultKnobs, tool-registry `knob:*` map) doesn't list ranking knobs yet — add `rankingMaxAdmissions`/`rankingMinScore` paths so `^knob_set` and ConfigOptimizer proposals can target them.
- `CognitiveOptimizer` search space (`cognitive/optimizer.ts:96`) should include the new dims.

---

# Week 2 Continued XIV (2026-09-10 session) ✅ **TRACK D §2 — 5 DOMAIN-SCOPED LEARNERS**

## `nar/src/learning/domain-learners.ts` (exported from `learning/index.ts`)
Each learner declares its domain; `guard()` throws `CrossDomainError` on mismatch — the "separated reward domains" half of *unified substrate, separated reward domains, strict mutation authority*:

| Learner | Domain | Updates | Risk |
|---|---|---|---|
| `ReflexLearner` | `external-reflex` | Delegates to wrapped `Reflex.learn` | Low |
| `SchedulerAdapter` | `self-scheduler` | Nudges `FocusBag` weights (`lr×reward`, clamped 0..1) | Low |
| `PreferenceRanker` | `self-explanation-rank` | Mean-reward ranking over explanation keys | Low |
| `ConfigOptimizer` | `self-config-proposal` | `suggestKnob()` → `knob-tune` proposal (never direct) | Medium |
| `PatchSelector` | `self-patch-score` | `scorePatch()` → `patch-apply` proposal (→ human approval) | High |

- `LearnerRegistry.dispatch(event)` routes by `event.domain`; unknown domain → `CrossDomainError` (fail-closed).
- Medium/high learners have inert `learn()` (event acknowledged, no state change) — their only output channel is proposals through `SelfRewardGate` → `ProposalRouter` (XI).

## Tests — `tests/nar/domain-learners.test.ts` (5): cross-domain + unknown-domain rejection, reflex delegation + dispatch, weight nudge ±, mean-reward ranking, proposal-only output (medium/high tiers). **40/40 green** across 9 suites, tsc clean in scope.

## New improvement opportunities
- `ReflexLearner` casts to `LearningEvent` with reward only — external reflexes still receive impoverished events via this path; `GameFocus` calls `reflex.learn` directly (unchanged), so this is a secondary path. Decide: make `DomainLearningEvent` carry full perception context or keep the adapter thin.
- `SchedulerAdapter` writes weights directly (low-risk auto-apply per XI router) — but nothing routes self-scheduler reward *into* it yet; Self Game outcome→`dispatch` wiring still open.
- `PreferenceRanker` is in-memory only — explanation corpus + persistence open.

---

# Week 2 Continued XIII (2026-09-10 session) ✅ **GATE-LOG PERSISTENCE + REPLAY**

## Decision
`@senars/core` already ships `SqliteEventLog`/`InMemoryEventLog`, but its `CognitiveEvent` is an older closed taxonomy (`engine: 'nar'|'metta'`, no `kernel` origin, no `task.admitted`/`policy.violation`/`budget.exhausted`/`autonomy.mode.changed`). Forcing kernel events into it would corrupt the taxonomy — so persistence lives in `nar/src/kernel/` against the kernel schemas (unification tracked as improvement #1: migrate `util/src/types/cognitive.ts` to kernel schemas).

## Fix (`nar/src/kernel/EventLogPersistence.ts`, exported from `kernel/index.ts`)
- `persistGateLogs(registry, path)`: drains all five logs (perception/action/autonomy/reward/budget), timestamp-sorts, appends JSONL. No-op when empty.
- `loadGateEvents(path)`: validates each line via `CognitiveEventSchema.safeParse`; corrupt lines counted in `invalid`, never thrown; missing file → empty.
- `replayTaskAdmissions(events)`: pure ordered reduction to `task.admitted` payloads — first executable slice of the Track A §1 replay exit criterion.
- `GateRegistry.getAllEventLogs()` now includes `autonomy` (no code consumers existed — safe).

## Tests — `tests/nar/gate-log-persistence.test.ts` (3): persist→reload→replay order + autonomy presence; corrupt/missing handling; empty no-op. **35/35 green** across 8 suites, tsc clean in scope.

## New improvement opportunities
- Replay covers admissions only — full state replay needs pure reducers for revision/budget/policy events (Track A §1 exit criterion still open).
- JSONL has no integrity/signature — governance audit trail will want hash-chained appends when the external runner consumes these logs.
- Sqlite bridge still open: map kernel events into core log (requires extending core `CognitiveEvent` union + migration) or keep JSONL as the kernel's canonical store and document the split.

---

# Week 2 Continued XII (2026-09-10 session) ✅ **DERIVATION RANKING (PRESSURE VALVE)**

## Problem (from VII smoke test)
Derived-term explosion: `(dog→((animal&pet)&--pet))` etc. — every `RuleProcessor` output was admitted to memory in arbitrary order with no value filter.

## Fix (`nar/src/rules/ranking.ts`, wired in `nar-execution.ts:202`)
- Pure `scoreDerivation(termString, f, c) = c × decisiveness − sizePenalty` where `decisiveness = |f−0.5|×2` (tautological f=0.5 scores ≤0), `sizePenalty = min(0.3, len/2000)` (runaway compounds sink).
- `rankDerivations(results, {maxAdmissions=100, minScore=0})`: drops truthless/zero-information derivations, sorts desc, caps admissions. Single choke point — applies regardless of which producer (`Reasoner`, `InferenceController`) generated results.
- Zero-information drop is load-bearing: tautologies (f=0.5) score negative and are filtered even at minScore=0.

## Tests — `tests/nar/derivation-ranking.test.ts` (3): ordering, size/low-c penalty, cap/floor/truthless. **32/32 green** across 7 suites, tsc clean in scope (1 pre-existing `tests/nar/unit/nar-execution.test.ts` bad-import error untouched).

## New improvement opportunities
- Constants not yet configurable: plumb `maxAdmissions`/`minScore` into `NARConfig` + `CognitiveParameters.PARAMETER_SPACE` so the Self Game can tune them (natural `knob-tune` target).
- Score ignores premise independence/lineage depth — dependent/laundered derivations could rank high; multiply by independence factor when recorder metadata available at admission.
- No novelty term: re-derived known beliefs score same as novel ones — gate dedup handles it, but rank-then-admit order under `TaskManager` budget pressure would benefit.

---

# Week 2 Continued XI (2026-09-10 session) ✅ **PROPOSAL→POLICY ROUTING WIRED**

## `SelfRewardGate` queue (`nar/src/kernel/KernelRewardGate.ts`)
- `submit(kind, payload, domain)` validates + enqueues; `pending()` / `drain()`. Self-reward now has a full path: `process` (requiresProposal) → `submit` → router.

## `ProposalRouter` (`nar/src/governance/pipeline.ts`, exported from `index.ts`)
- `route(proposal, mode, actuators)`: high → `human-approval` queue; medium → `sandbox-validate` queue; low in `observe/propose-only` → `human-approval`; low `focus-weight` with registered actuator → `auto-apply`. No-actuator low kinds queue for review instead of silently dropping.
- Queues inspectable via `getAwaitingValidation()` / `getAwaitingApproval()` — the future external runner / sandbox-validator drains these.

## `SelfMetaGameImpl.applyProposal` (`nar/src/game/SelfMetaGame.ts`) — strict mutation authority
- Only `low`-risk `focus-weight` applies (via clamped `setFocusWeight`, 0..1); everything else rejected with reason. Direct `setFocusWeight`/`setKnob` retained for engine-internal use; agent-driven self-reward must come through proposals.

## Tests — `tests/nar/proposal-routing.test.ts` (3): queue/drain, auto-apply+clamp, medium/high/observe-only routing + queue counts. **29/29 green** across 6 suites, tsc clean in scope.

## New improvement opportunities
- Sandbox-validation consumer missing: `awaitingValidation` (medium-risk knob-tune/schema-promotion) has no validator — needs shadow-worktree CI runner per RFC §4.
- `strategy-switch` low-risk has no actuator — define `StrategyRegistry` hook or re-tier to medium.
- `applyKnob` actuator unwired in router (knob-tune is medium → validation queue, correct for now; don't add direct knob applier without validation step).
- `setFocusWeight`/`setKnob` still publicly callable — lint-ban agent-loop call sites outside proposal path when Self Game wiring lands.

---

# Week 2 Continued X (2026-09-10 session) ✅ **PER-RUN BUDGET SCOPING**

## Problem
All hot paths (`Focus.step`, `GameFocus.step`, `TaskManager`, `StreamReasoner`) consumed counters on the shared `gateRegistry` singleton — budgets leaked across tests, focuses, and production runs (benchmark #3 had to reset the singleton at test end).

## Fix (`nar/src/kernel/KernelBudgetGate.ts`, `kernel/src/schemas.ts`)
- `BudgetGateInput.scopeId?` added to schema (backward compatible — no-scope calls hit the shared default as before).
- Gate holds `Map<string, ReasoningBudget>`; `resolveBudget()` lazily creates a scope cloning the gate's **configured** limits with zeroed counters (bug caught by test: first version cloned the hardcoded 1000-cycle default instead).
- New `createScope(id, budget?)` / `releaseScope(id)` / `getScopeBudget(id)`; `resetBudget()` clears scopes too.
- Wired: `Focus.step` → `scopeId: this.id`; `GameFocus.step` → `scopeId: this.focus.id`. Global paths (`TaskManager`, `StreamReasoner`) stay on the shared scope — correct, they aren't focus-bound.

## Tests — `tests/nar/budget-scopes.test.ts` (2): isolation across scopes, shared-default independence, release/reset semantics. **26/26 green** with governance (4) + domains (3) + gates (8) + validation (9).

## New improvement opportunities
- Scope budgets inherit gate defaults — no per-focus limit tuning yet (e.g. `FocusBag.allocateBudget` could `createScope` with weighted limits).
- `TaskManager`/`StreamReasoner` still global — fine for now, but a run-id scope would make validation #3's drain test hermetic without singleton reset.
- Proposal→PolicyEngine routing (SelfRewardGate `requiresProposal` has no consumer) and derivation ranking still open.

---

# Week 2 Continued IX (2026-09-10 session) ✅ **GOVERNANCE PIPELINE IMPLEMENTED + DOMAIN WIRING**

## Track B §3 — From RFC to code (`nar/src/governance/pipeline.ts` + `index.ts`)
- `PatchRiskClassifier.classify(proposal)`: +50 per guardrail-fragment file hit (`ApprovalManager`/`PolicyEngine`, `nar/src/kernel|gates/`, `nar/src/capability/`, `rlfp/`, `kernel/src/schemas`, `util/.../cognitive`, `nar/src/config/budget`), +10 churn>500, +15 coverageΔ<−5; thresholds HIGH≥40 / MEDIUM≥20 else LOW. Guardrail list uses current real paths (RFC §3.3 paths were stale).
- `GovernancePolicyEngine.decide(risk, mode)`: HIGH → always `REQUIRE_HUMAN_REVIEW` (2 reviewers); `observe/propose/sandbox` → human review (no auto-merge); `low-risk-auto-merge` + LOW → `AUTO_MERGE`; MEDIUM → `CREATE_PR`; production → always human.
- `record(...)` emits `GovernanceEvent` audit record (`AUTO_MERGED`/`PR_CREATED`/`HUMAN_REVIEW_REQUIRED`, `governance-runner`).
- Schemas (`kernel/src/schemas.ts`): `PatchProposalSchema` (affectedFiles+churn, no signature field yet), `RiskLevelSchema`, `RiskAssessmentSchema`, `GovernanceDecisionSchema`, `GovernanceEventSchema`.
- Tests `tests/nar/governance.test.ts` (4): guardrail→HIGH / clean→LOW, churn+coverage→MEDIUM(25), full policy matrix, audit record shape.

## Track D §3 — Domain wiring
- `GameFocus.ts:90` now passes explicit `domain: 'external-reflex'` (was default-implicit). Remaining self-domain call sites: none found — generic `RewardGate.process` callers all external; `SchedulerAdapter`/`ConfigOptimizer`/`PatchSelector` learners don't exist yet (Track D §2 still planned).

## Verification (single run) — tsc clean in scope, **15/15 green** (governance 4 + domains 3 + gates 8).

## New improvement opportunities
- Runner still in-repo/mutable — true external immutability needs separate repo + branch protection + required-status pipeline (RFC §4 YAML references `classify_patch.py` etc. that don't exist; port TS classifier or shell out).
- `PatchProposalSchema` lacks `agentSignature`/`ciResults` from RFC §3.2 — add when shadow-CI emission is wired.
- `REJECT` decision exists in schema but policy never emits it — define criteria (e.g. failed CI, bad signature) when proposal ingestion exists.
- Agent-side merge prohibition unenforceable in-repo — needs git branch protection (ops task, not code).

---

# Week 2 Continued VIII (2026-09-10 session) ✅ **RL DOMAIN SPLIT + AUTONOMY STATE MACHINE**

## Track D §3 — Reward domain split (`nar/src/kernel/KernelRewardGate.ts`)
- `RewardGateInput.domain` (defaults `external-reflex`) now drives mutation authority.
- `external-reflex` → `{accepted, mutationApplied: true}` (direct policy/attention learning).
- `self-*` domains → `{accepted, mutationApplied: false, requiresProposal: true}` — self-reward never mutates directly; must go through proposal governance.
- Epistemic firewall unchanged: `truth-*` targets always rejected + `policy.violation` logged.
- New `ExternalRewardGate.ingest({rewardSignal, rewardType, targetId})` convenience wrapper.
- New `SelfRewardGate.propose(kind, payload, rewardDomain)` validates `SelfImprovementProposalSchema` with risk tiers: low (`focus-weight`, `strategy-switch`), medium (`knob-tune`, `schema-promotion`, `test-generate`), high (`patch-apply`).
- Schema: `RewardGateOutputSchema.requiresProposal?` added (`kernel/src/schemas.ts`).

## Track B §2 — Autonomy state machine (`nar/src/kernel/KernelActionGate.ts`)
- Legal transitions: `observe-only↔propose-only→sandbox-execute→low-risk-auto-merge→human-approved-production` (stepwise only, no jumps).
- `requestModeChange(newMode, authorizedBy)` enforces: escalation beyond `sandbox-execute` requires `human`/`external-governance` (system self-escalation refused); downgrades system-allowed.
- Each change emits validated `AutonomyModeChangedEvent` to new `getAutonomyLog()`; `clearEventLog()` clears both logs. Legacy `setAutonomyMode()` retained for tests/backward compat.

## Tests — `tests/nar/todo7-domains.test.ts` (3 new) + `kernel-gates` (8): **11/11 ✅**
- External-direct vs self-proposal split, firewall still blocks truth targets in self domain, ingest/propose risk tiers, illegal-jump refusal, system self-escalation refusal, human/governance escalation path, 4-event autonomy log.

## Verification (single run) — tsc clean in scope, 11/11 green.

## New improvement opportunities
- `SelfRewardGate.propose` builds proposals but nothing routes them → PolicyEngine → RiskClassifier → sandbox → approval yet (RFC pipeline still unimplemented; benchmark #7 tests the static allowlist only).
- `setAutonomyMode` bypasses governance — keep for tests but lint-ban outside `*.test.ts` + `GateRegistry.initialize`.
- `GameFocus`/RLFP still call generic `RewardGate.process` without `domain` (defaults external) — audit call sites to pass explicit `self-*` domains for scheduler/config/patch learning events.
- `requiresProposal` consumers don't exist yet — `SchedulerAdapter`/`ConfigOptimizer`/`PatchSelector` learners (Track D §2) are the intended readers.

---

# Week 2 Continued XXIX (2026-09-10 session) ✅ **FULL-STATE MEMORY REPLAY — TRACK A §1 EXIT CRITERION MET**

## Summary
Implemented complete event-sourced memory replay: the system can now be paused, the event log serialized, and perfectly replayed in a separate process to yield the exact same state.

## Files Created
| File | Purpose |
|------|---------|
| `nar/src/kernel/replay.ts` | Core replay logic: `replayIntoMemory`, `serializeReplayResult`, `persistDerivationRecords`, `loadDerivationRecords` |
| `tests/nar/full-replay.test.ts` | 5 tests covering task admission, revision, activation, derivation replay, and round-trip determinism |

## Key Features
- **`replayIntoMemory(options)`** — Single entry point taking gate events path + optional derivation records path; returns reconstructed `Memory` + gate snapshot + stats
- Replays **task admissions** (beliefs/goals/questions) with original truth, budget, stamps
- Replays **belief revisions** via remove/re-add with updated truth (preserves revision callback)
- Replays **concept activations** (priority) from `concept.activated` events
- Replays **derivation steps** as derived beliefs with evidence-lineage stamps
- **`serializeReplayResult`** — Snapshots replay output (gate snapshot + serialized memory + stats) to JSON
- **`persistDerivationRecords` / `loadDerivationRecords`** — JSONL persistence for derivation logs
- **Round-trip determinism verified**: pause → serialize gate events + derivations → replay in fresh process → identical gate snapshot, concept count, task count, truth values, priorities

## Verification
- TypeScript: clean in `nar/src/kernel/*`
- Tests: **5/5 green** in `full-replay.test.ts`
- All TODO7 test suites: **46/46 green** (including new replay tests)

## Exit Criterion Met
> "The system can be paused, the event log serialized, and perfectly replayed in a separate process to yield the exact same state."

Achieved via: `loadGateEvents` + `loadDerivationRecords` → `replayIntoMemory` → `serializeReplayResult` → compare snapshots.

---

# Week 2 Continued XXIX (2026-09-10 session) ✅ **CLEANUP/POLISH — SEARCHSPACE IMPORT, STREAMREASONER IMPORT, RANKING KNOBS**

## Summary
Completed 3 of 4 cleanup/polish items from the checklist, all tests passing.

## Files Modified
| File | Change |
|------|--------|
| `tests/nar/unit/optimizer.test.ts:10` | Fixed `SearchSpace` import path: `cognitive/types` → `strategies/types` |
| `nar/src/stream/reasoner.ts:1-4` | Hoisted `gateRegistry` import from dynamic to static (verified no cycle) |
| `nar/src/game/SelfMetaGame.ts:37-42` | Added `rankingMaxAdmissions` (10–1000) and `rankingMinScore` (0–0.5) to defaultKnobs |
| `nar/src/tools/tool-registry.ts:592-593` | Added `knob:rankingMaxAdmissions` and `knob:rankingMinScore` to knobMap for `tune_knob` tool |

## Verification
- TypeScript: clean in all modified scopes (`optimizer.test.ts`, `stream/reasoner.ts`, `SelfMetaGame.ts`, `tool-registry.ts`)
- Tests: **50/50 green** across 11 TODO7 test suites (kernel-gates, derivation-verifier, sandbox-hardening, todo7-domains, full-replay, governance, domain-learners, self-game-wiring, sandbox-validation, ranking-knobs, todo7-validation)

## Remaining Cleanup Item
- [ ] Wire `applyKnob` actuator → `RLFPLearner.applyTuningUpdate` so validated proposals actually mutate params

## Progress Summary
| Checklist Item | Status |
|----------------|--------|
| SearchSpace export fix | ✅ Done |
| StreamReasoner static import | ✅ Done |
| Ranking knobs in SelfMetaGame | ✅ Done |
| Ranking knobs in tool-registry | ✅ Done |
| applyKnob → RLFPLearner wiring | ☐ Pending |
| Per-candidate source spans (LM) | 🔄 Schema/prompt ready, LM call pending |
| External Governance Runner | ☐ Separate repo |
| True WASI Confinement | ☐ Execute inside WASM |
| Arbiter Pattern | ☐ Engine isolation |