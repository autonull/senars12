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

*Last Updated: 2026-09-10 — Week 2 continued VII: records + all 8 benchmarks green (118/118), 5 latent bugs fixed. Next: external governance runner → RL domain split (External/SelfRewardGate) → AutonomyStateMachine enforcement.*