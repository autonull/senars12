# TODO24: Dialogue Flywheel — Conversational Capture, Reaction & Retrospective Consolidation

**Version:** 2.0 (2026-09-25) · **targets** the gap between dialogue and learning: conversations with the agent are currently graded thin (trace-grade ≥ 0.7 → positive label) and discarded — corrections, rejections, and clarifications never reach the training flywheel, and no session-level analysis exists.

**Philosophy:** Every conversation is simultaneously a live inference, a graded training event, an end-to-end demonstration, and a development probe. The Dialogue Flywheel closes the loop so a dialogue becomes durable experience that consolidates into learning and informs the next experiment.

**Core Principle:** Compose existing machinery. The flywheel is a thin connective layer over what already exists — `JudgmentDataset` + label sources (the distillation flywheel's fuel), `EpisodicMemory` (experience), `SchemaInductor` (pattern learning), `SelfMetaGame`/`ProposalRouter` (governed change), `decide()`/`JudgmentProvenance` (auditable judgment). New identifiers name the missing connective tissue, nothing else.

**Explicitly excluded:** Self-modification auto-apply (proposals only; governance unchanged). Distributed/multi-agent dialogue. LLM weight fine-tuning. New manifold heads, encoder changes. Embodiment/sensorimotor. New workspace packages. Curriculum/probe selection (deferred until the flywheel produces data to select from).

---

## 1. Design Invariants

These are non-negotiable. Every phase routes *through* them, never around them.

| # | Invariant | Enforcement |
|---|---|---|
| I1 | **Frozen-eval-set exclusion.** Dialogue-derived labels (`source: 'conversation'` or `source: 'reaction'`) never enter the frozen evaluation set. The dialogue flywheel can train heads without corrupting the trustworthy-self-improvement guarantee. | `createFrozenEvalSet` already excludes `source === 'conversation'` by construction (`CONVERSATION_SOURCE` default). Extend the default to also exclude `REACTION_SOURCE`. Bench 71 falsifies. |
| I2 | **Epistemic firewall.** Reactions may tune policy, attention, and reflex weights. They never mutate `Truth.frequency` or `Truth.confidence`. | `RewardGate` enforcement (existing). Lessons admitted as Narsese self-beliefs via `nar.input` (non-LLM ingestion, seeded truth) with `source: 'retrospect'` provenance. |
| I3 | **Governance unchanged.** Retrospectives emit `SelfImprovementProposal`s via the existing `ProposalRouter`. Only low-risk `focus-weight` auto-applies; medium/high require validation/approval. | `SelfMetaGame.applyProposal` + `GovernancePolicyEngine` (existing, untouched). |
| I4 | **Provenance on every capture.** Every `DialogueTurn` carries a `JudgmentProvenance`. Every `Retrospective` references the turns it consolidated. | `JudgmentProvenance` struct (model/calibration/input digests). |
| I5 | **Disabled-path byte-identical.** With dialogue capture off, the bot behaves identically to current behavior. No capture, no retrospection, no label emission. | Config gate: `dialogue.enabled: false` default. `DialogueCapture` guards every sink behind this single gate. |
| I6 | **Hash-only at rest.** No raw conversational text persists in `DialogueTurn`s, reactions, labels, or retrospectives — sha256 digests and embeddings only. A correction's *content* survives solely as an embedding (for contrastive use) and a digest (for identity); raw text lives only in the user's own transcript. | Capture writes digests; reaction correction text is embedded at bind time, then discarded. Bench 71 falsifies (assert no raw-text fields in persisted rows). |
| I7 | **Correlation by `correlationId`.** Session identity is the existing `correlationId` minted per message by `Agent.chat()` — never a parallel ID scheme. Turns, reactions, trace grades, and episodes all join on it. | `DialogueTurn.sessionId = correlationId` of the first message of the conversation; every downstream query filters `Episode.correlationId` / `TraceGradeInput.correlationId`. |

---

## 2. Naming & Vocabulary

All identifiers follow the codebase's established conventions: descriptive compound nouns (`JudgmentManifold`, `ContrastiveMemory`, `SchemaInductor`), lowercase verb commands (`.judge`, `.decide`, `.trace`, `.consolidate`), `Registry`/`Ledger` suffixes for catalogs, and the `flywheel` metaphor for closed training loops.

| Identifier | Kind | Meaning |
|---|---|---|
| `DialogueTurn` | type | One user↔agent exchange: digests, formalization candidates, judgment, grounding verdict, reflex decisions, reaction, provenance. |
| `Reaction` / `ReactionKind` | type / enum | The human's (or AI agent's) explicit response to a prior turn. Six kinds: `accept · correct · reject · clarify · redirect · abandon`. |
| `DialogueCapture` | class | The capture service: owns turn tracking, reaction binding, episode persistence, label fan-out. One instance per bot; `collectChat()` and every CLI surface call into it. Lives in `nar/src/dialogue/capture.ts`. |
| `bindReaction` | method | `DialogueCapture.bindReaction(turnId, reaction, { correctionEmbedding? })` — explicit, retroactive reaction binding. |
| `Retrospective` | type | Post-session diagnostic artifact: turn summary, reaction distribution, correction analysis, strategy audit, contradictions, proposals. |
| `retrospect()` | fn / command | Produces a `Retrospective` from a session's captured turns. |
| `recordReactionLabel` | fn | Maps reactions → `DistillationLabel`s. Lives in `label-sources.ts`, following the existing `record*Label` convention (`recordCorrectionLabel`, `recordApprovalLabel`, …). |
| `REACTION_SOURCE` | const | `'reaction'` — the `DistillationLabel.source` marker, exported from `eval-set.ts` beside `CONVERSATION_SOURCE` so the exclusion list and the emit path share one definition. |

**CLI commands** (all in `bot.ts`, lowercase `.` convention):

| Command | Purpose |
|---|---|
| `.react <kind> [correction]` | Bind an explicit `Reaction` to the most recent turn. |
| `.turns [session-id] [n]` | Show captured `DialogueTurn`s (default: current session, last 10). |
| `.retrospect [session-id]` | Run a retrospective (default: current session). |
| `.retrospectives [n]` | List past retrospectives. |
| `.lessons` | Show extracted lessons from retrospectives. |

Every command works identically from CLI, IRC, WS, and MCP surfaces — they route through the same `DialogueCapture`/`retrospect` API, not through `bot.ts`-local logic.

---

## 3. Architecture

```
                    DIALOGUE  (developer / AI-agent  ⇄  bot)
                         │
         ┌───────────────┼────────────────────────────────────────┐
         │               │                                        │
         ▼               ▼                                        ▼
    1. CAPTURE      2. REACT                                4. DEMONSTRATE
    DialogueCapture .react <kind>                           Each DialogueTurn
    .onExchange()   or DialogueCapture                      carries a replayable
    (from every     .bindReaction()                         thinking transcript:
    chat surface)   → binds Reaction                        derivation trace,
         │          to a prior turn                         manifold judgments,
         │               │                                  gate verdicts,
         │               ▼                                  provenance chain
         │          3. LABEL
         │          recordReactionLabel()
         │          → DistillationLabel
         │            (source: REACTION_SOURCE)
         │          → JudgmentDataset ──► existing distillation flywheel
         │          → ContrastiveMemory (hard negatives from corrections)
         │               │
         ▼               ▼
    5. RETROSPECT
    retrospect(sessionId)
      ├─ Turn summary + reaction distribution
      ├─ Correction analysis (what was corrected — digests + embeddings)
      ├─ Strategy audit (which derivation strategies produced well-graded turns)
      ├─ Contradiction detection
      └─ emit SelfImprovementProposals → ProposalRouter (governance unchanged)
         │
         ▼
    Retrospective artifact (JSONL, digest-pinned)
         │
         ├─► Agent consumer: labels → flywheel → better heads
         └─► Developer consumer: diagnostic artifacts → next development iteration
```

**Two consumers, one capture.** The loop serves both the agent (self-improvement via labels, schemas, proposals) and the developer (diagnostic artifacts, visible thinking transcripts, retrospectives that inform the next development iteration).

**Orthogonality.** All shared substrate lands in `nar/src/dialogue/` (types, capture, retrospect). `bot.ts` gets CLI exposure only — thin handlers that call `DialogueCapture` and `retrospect()`. Non-bot NAR consumers are unaffected. The disabled path is byte-identical (I5: one config gate in one class constructor).

**Multi-surface by construction.** `bot.ts` multiplexes CLI, IRC, WS, and MCP onto one `onMessage` path; `DialogueCapture.onExchange()` is called from that single funnel, so every transport inherits capture for free. Programmatic consumers (tests, future MCP tools) instantiate `DialogueCapture` directly — the class is the API.

**Storage model.** Turns and reactions are stored as *new episodes* (`type: 'dialogue'` / `type: 'reaction'`) keyed by `correlationId` (I7) — consistent with the append-only, event-sourced kernel. `retrospect()` joins turns and reactions by `turnId` at read time. This preserves event-sourced replay and avoids in-place mutation of stored episodes. `EpisodeType` is a closed union in `util/src/types/episodic-memory.ts` — extending it with `'dialogue' | 'reaction'` is a package change to `@senars/util` (additive, non-breaking). The implementation is `EpisodicMemory` in `nar/src/memory/` (JSONL-backed, day-rolled, retention-bounded); its `getEpisodes({ type })` filter already supports type-scoped retrieval, so turn/reaction joins are a filter away.

---

## 4. Types & Contracts

```typescript
// nar/src/dialogue/types.ts (NEW — leaf, no circular imports)

type ReactionKind = 'accept' | 'correct' | 'reject' | 'clarify' | 'redirect' | 'abandon';

interface Reaction {
  kind: ReactionKind;
  correctionDigest?: string;   // sha256 of corrected text (I6: no raw text at rest)
  correctionEmbedding?: Float32Array;  // embedded at bind time, before discard (I6)
  at: number;                  // timestamp
  turnId: string;              // the turn this reaction responds to
}

interface DialogueTurn {
  sessionId: string;           // = correlationId of the first message (I7)
  turnId: string;              // = correlationId of this message + seq (unique per exchange)
  seq: number;

  // Exchange content (hash-only; no raw text persisted — I6)
  utteranceDigest?: string;    // sha256 of user utterance
  responseDigest?: string;     // sha256 of agent response
  responseEmbedding?: string;  // evidenceId of the embedding in JudgmentDataset sidecar

  // Reasoning artifacts (references, not copies — populated incrementally)
  formalizations?: FormalizationCandidate[];  // from NLUnderstandingService (ingress path)
  judgment?: DecideResult;                     // decide() result
  grounding?: { admitted: boolean; score: number };  // groundedness-gate verdict
  reflex?: { proposed: string[]; selected: string; vetoes: number };

  // Provenance (I4) — set at capture; reaction joins by turnId at read time
  provenance: JudgmentProvenance;
}

interface Retrospective {
  version: 'retrospective-v1';
  sessionId: string;
  at: number;
  turnCount: number;
  reactionCount: number;
  reactionDistribution: Record<ReactionKind, number>;

  corrections: CorrectionAnalysis[];
  contradictions: Term[];
  strategyAudit: StrategyAuditEntry[];
  proposals: SelfImprovementProposal[];

  provenance: { turnIds: string[] };  // which turns were consolidated (I4)
  /** Digest pin over the consolidated turn ids + distributions (fail-closed integrity, cf. eval-set.ts). */
  digest: string;
}

interface CorrectionAnalysis {
  turnId: string;
  originalDigest: string;
  correctionDigest?: string;
  correctionEmbedding?: Float32Array;  // re-used for contrastive mining without re-embedding
  reaction: Reaction;
}

interface StrategyAuditEntry {
  strategy: string;                 // derivation strategy name
  gradedTurns: number;
  meanQuality: number;              // mean groundedness/contrastive score
}

interface Lesson {
  term: Term;                       // Narsese self-belief
  truth: Truth;
  source: 'retrospect';
  provenance: JudgmentProvenance;
}
```

**Config extension** (in `util/src/config/system-one.ts` — `SystemOneConfig` zod schema + `systemOneDefaults`, nested under `systemOne`):

```typescript
dialogue?: {
  enabled: boolean;           // default: false (I5)
  captureAll: boolean;        // default: false — capture every turn vs. grade-sampled + reacted
  maxTurnsPerSession: number; // default: 500 — bounded per AIKR
};
```

`DialogueCapture` reads this once at construction; runtime `.config-set systemOne.dialogue.*` re-instantiates it (matching the existing frozen-config-clone pattern in `buildExtraCommands`).

---

## 5. Phases & Items

Three independent slices, each with its own bench and rollback. Each is independently shippable, independently testable, and independently valuable.

| Phase | Status | Focus | Effort |
|---|---|---|---|
| Phase A | ✅ **done** | Reactions → labels (close the core loop) | ~9h |
| Phase B | ✅ **done** | Full `DialogueTurn` capture | ~10h |
| Phase C | ✅ **done** | `retrospect()` diagnostic report | ~12h |

> **Status (2026-09-25): all three phases implemented + benches 71–74 green (15 tests).**
> One deliberate deviation from this plan (reviewer-driven): the dialogue
> substrate was **relocated from `nar/src/lm/system-one/dialogue/` to
> `nar/src/dialogue/`** — dialogue is a *peer subsystem* that optional
> reasoners (System One) feed into, not a child of one. All System One
> artifacts (`JudgmentDataset`, `ContrastiveMemory`, `EmbeddingCache`) are
> injected optional deps of `DialogueCapture`; capture works without System
> One enabled. Config was hoisted accordingly: `dialogue` is a **top-level
> app config section** (`util/src/config/dialogue.ts`), not nested under
> `systemOne`.
>
> Implementation notes for future work:
> - **correlationId at the bot surface (I7 caveat):** the kernel mints its
>   correlationId inside `agent.chat()` and it is not surfaced to
>   `collectChat()`. The bot therefore uses a stable session-level join key
>   `bot:{sessionId}` — no parallel ID scheme, but per-message correlation
>   would require `chat()` plumbing (see improvement opportunities).
> - Benches instantiate `DialogueCapture`/`retrospect()` directly against an
>   in-memory/temp-dir `EpisodicMemory` — no mocks of System One, no bot
>   bootstrap (tests/utils/in-memory-episodic.ts is a conforming test double).
> - Reaction embedding at bind time writes the correction *text* through
>   `EmbeddingCache` (sidecar persists the vector; the cache dedups repeats).
> - `Retrospective.proposals` is `readonly unknown[]` — `SelfImprovementProposal`
>   flows through `ProposalRouter` at the call site (bench 74 verifies
>   high-risk never auto-applies); embedding the proposals in the artifact is
>   left to the MCP-tool extension.

### Phase A — Reactions → Labels

**Goal:** When a user corrects the bot, the correction becomes a training label that feeds the distillation flywheel. This is the highest-value, lowest-effort slice.

**Design:** Reactions are explicit in v1 — bound via `.react <kind>` CLI or programmatic `DialogueCapture.bindReaction(turnId, reaction)`. No heuristic attribution. This eliminates the mis-attribution risk that would poison the flywheel.

| Task | File | Effort |
|---|---|---|
| Define `Reaction`, `ReactionKind` types | `nar/src/dialogue/types.ts` (NEW) | 1h |
| Extend `EpisodeType` union with `'reaction'` | `util/src/types/episodic-memory.ts` | 0.25h |
| `DialogueCapture` class: minimal turn tracking (turn id, digests, `enabled` gate) + `onExchange` + `bindReaction` | `nar/src/dialogue/capture.ts` (NEW) | 2.5h |
| `.react <kind> [correction]` CLI command: thin handler → `bindReaction`, embeds correction text before discard (I6) | `src/bin/bot.ts` | 1.5h |
| `REACTION_SOURCE` const + `recordReactionLabel`: map reactions → `DistillationLabel`s (`accept`→positive, `correct`→preference pair, `reject`→negative) | `nar/src/lm/system-one/eval-set.ts` (const) + `label-sources.ts` (fn) | 2h |
| Extend `createFrozenEvalSet` default exclusion to `REACTION_SOURCE` | `nar/src/lm/system-one/eval-set.ts` | 0.25h |
| Wire label emission inside `DialogueCapture` on bind (dataset + embedding sidecar fan-out), invoked from bot | `dialogue/capture.ts` | 1h |
| Corrections as hard negatives: `correct` reactions feed `mineHardNegatives` → `ContrastiveMemory` | `nar/src/lm/system-one/hard-negatives.ts` | 0.5h |

**Design notes:**
- `DialogueCapture` is the single fan-out point: bind → label rows → `JudgmentDataset.record` (two rows for a preference pair) → episode `type: 'reaction'` → contrastive exemplar. All guarded by `dialogue.enabled` (I5) and wrapped best-effort (failures never disrupt chat — match the existing auto-capture pattern).
- A `correct` reaction produces an embedding-level preference pair. Mechanics: `JudgmentDataset` stores **one embedding per `evidenceId`** (`#vectors: Map<string, Float32Array>`), so a pair is **two rows** sharing a `turnId`-derived pair id — the original response row with `observed: 0` and the correction row with `observed: 1`, each with its own embedding via `computeEvidenceId(turnId, 'original'|'correction')`. `observed` makes the pair directly calibration-consumable (frozen-set-adjacent but excluded by I1) and usable by `ContrastiveMemory` as a positive/negative exemplar pair. No Narsese formalization of the correction text required; that is deferred.
- **Correction text lifecycle (I6):** `.react correct "I meant X"` → embed the correction text immediately (via the existing `embeddingCache`) → store digest + embedding on the `Reaction` → raw text never written to disk or logs. The `embeddingCache` write doubles as the persistence layer, consistent with `captureDistillation`.
- `clarify` and `redirect` produce metadata flags, not labels. `abandon` produces a weak negative.
- Reaction binding is retroactive: the turn must already exist in the tracker (task 3). Binding to a missing/expired turn is a no-op with a warning — never a synthetic turn.

**Acceptance (Bench 71):**
- A `correct` reaction yields two-row preference-pair labels with `source: REACTION_SOURCE`
- An `accept` reaction yields a positive label; a `reject` reaction yields a negative label
- `createFrozenEvalSet` excludes `REACTION_SOURCE` by construction (default exclusion list)
- No raw correction text appears in any persisted row (I6)
- Disabled path (no reactions, `dialogue.enabled: false`) is byte-identical to current behavior

**Rollback:** Delete the `.react` command handler and `dialogue/capture.ts`'s Phase-A surface. `eval-set.ts` reverts to `[CONVERSATION_SOURCE]`. No other code is touched.

### Phase B — Full `DialogueTurn` Capture

**Goal:** Every dialogue exchange captures the full reasoning context — formalizations, judgment, grounding, reflex decisions, provenance — as a `DialogueTurn` stored in episodic memory. This makes each turn a self-contained, replayable demonstration artifact.

**Design:** `DialogueCapture.onExchange(correlationId, input, response, capture)` is called from the single `onMessage` funnel in `bot.ts` — it does not restructure `collectChat()` or introduce a new pipeline abstraction. The existing auto-capture fires on grade ≥ 0.7 (positive labels only); the `DialogueTurn` capture fires on every turn (or every turn with a reaction / grade-sampled, per `captureAll` config), because corrections and rejections are the highest-value signals.

| Task | File | Effort |
|---|---|---|
| Define `DialogueTurn` type (full schema) | `nar/src/dialogue/types.ts` | 1h |
| Extend `EpisodeType` union with `'dialogue'` | `util/src/types/episodic-memory.ts` | 0.25h |
| Add `DialogueCapture` config section to `SystemOneConfig` (`util/src/config/system-one.ts`, zod schema + defaults) | `@senars/util/config` (extend) | 1h |
| Enrich `onExchange`: formalizations (`NLUnderstandingService`), judgment (`decide()`), grounding verdict, reflex decisions, `JudgmentProvenance` | `dialogue/capture.ts` | 4h |
| Store turns as `Episode`s (`type: 'dialogue'`, `correlationId` set, I7) in `EpisodicMemory` | `dialogue/capture.ts` (retrieve via `getEpisodes({ type })`) | 1.5h |
| `.turns [session-id] [n]` CLI command (joins episodes by `correlationId`) | `src/bin/bot.ts` | 1h |
| `.react` upgrade: bind to full `DialogueTurn` (no behavior change — same `bindReaction` API) | `src/bin/bot.ts` | 1h |

**Design notes:**
- Capture aggregation draws from multiple sources: formalizations from `NLUnderstandingService` (ingress path), `decide()` results from the `Decider`, grounding verdicts from `GroundednessGate`, reflex decisions from `ManifoldReflex`/`LMReflex`, provenance from `DecideResult.provenance`. Some data isn't available until after the response is complete — capture is async, fire-and-forget, best-effort. Failures never disrupt chat.
- The `DialogueTurn` stores *references* to reasoning artifacts (digests, decision IDs, embedding evidenceIds), not full copies. This bounds storage per AIKR.
- Raw utterance text is never persisted — only sha256 digests (I6), matching the distillation dataset's hash-only policy.
- **Session identity (I7):** `DialogueTurn.sessionId` is the `correlationId` of the first message in the conversation; `turnId` is `{correlationId}:{seq}`. No parallel ID scheme, no clock-based ids — joins against `Episode.correlationId` and `TraceGradeInput.correlationId` are exact.

**Acceptance (Bench 72):**
- A `DialogueTurn` round-trips to `EpisodicMemory` with reaction + provenance
- Fan-out sinks idempotent per `(sessionId, turnId)`
- `sessionId`/`turnId` equal the `correlationId` chain from `Agent.chat()` (I7)
- With `dialogue.captureAll: false`, only grade-sampled / reacted turns are captured
- With `dialogue.captureAll: true`, every turn is captured
- Disabled path (`dialogue.enabled: false`) is byte-identical

**Rollback:** Delete the `onExchange` enrichment and the `.turns` command. `DialogueCapture` degrades to its Phase-A surface. No other code is touched.

### Phase C — `retrospect()` Diagnostic Report

**Goal:** Produce a session-level diagnostic report that aggregates what happened during a dialogue: how many turns, how many reactions, what was corrected, which strategies were active, what contradictions surfaced. This is a diagnostic for the developer, not a learning engine.

**Design:** `retrospect()` is a thin aggregation function over captured turns and reactions. It does not implement new metacognition — it reads existing data and produces a structured report. Schema induction, lesson extraction, and proposal emission are thin wrappers over existing `SchemaInductor`, self-analyzer, and `SelfMetaGame`/`ProposalRouter`.

| Task | File | Effort |
|---|---|---|
| `retrospect(sessionId)`: load session episodes (filter `correlationId`) → aggregate turns + reactions → produce `Retrospective` | `nar/src/dialogue/retrospect.ts` (NEW) | 4h |
| Correction analysis: which turns were corrected, correction digests + embeddings | `retrospect.ts` | 1h |
| Strategy audit: correlate `TraceGradeInput.correlationId`-tagged grades with quality scores (existing plumbing — no new turnId threading needed) | `retrospect.ts` | 2h |
| Contradiction detection: identify contradictions surfaced during the session | `retrospect.ts` | 1h |
| Lesson extraction: emit `Lesson` as Narsese self-belief, ingested via `nar.input` (non-LLM path, seeded truth) | `retrospect.ts` | 2h |
| Proposal emission: route retrospective findings → `SelfMetaGame`/`ProposalRouter` | `retrospect.ts` | 1h |
| Persist `Retrospective` as JSONL to `.cache/retrospectives/`, digest-pinned (fail-closed on load, cf. `FrozenEvalSet.digest` / `DigestMismatchError`) | `retrospect.ts` | 0.5h |
| `.retrospect [session-id]` / `.retrospectives [n]` / `.lessons` CLI commands | `src/bin/bot.ts` | 1.5h |

**Design notes:**
- `retrospect()` is an *offline* operation triggered on demand (`.retrospect`) or at session end (opt-in), not a per-tick stage in the macro-cycle.
- Minimum viable session: retrospect is meaningful at ≥10 turns with ≥2 reactions. Below that, it produces a skeleton retrospective with no strategy audit or contradiction analysis.
- Lesson extraction criteria: a lesson requires ≥2 supporting turns, a non-trivial Narsese term (not a tautology), and a confidence above the seed-truth admission floor used for non-LLM inputs.
- **Strategy audit (I7 payoff):** trace grades already carry `correlationId` (`TraceGradeInput`); the audit joins `DialogueTurn.sessionId` ↔ graded rows by that key. No derivation-record threading, no tick-context changes — Phase C stays a read-only aggregator.
- **Digest pin (I4/I6):** `Retrospective.digest = sha256(turnIds + reactionDistribution + correction digests)`, verified fail-closed on `.retrospectives` load — the same integrity pattern as `FrozenEvalSet`, so a truncated/tampered artifact is detected, not silently served.

**Acceptance (Bench 73):**
- A seeded session (≥10 turns, ≥2 reactions) yields a `Retrospective` with turn summary, reaction distribution, ≥1 correction analysis, and ≥1 strategy audit entry
- `Retrospective` is persisted as JSONL, digest-pinned, and retrievable via `.retrospectives` (corrupted artifact → fail-closed error)
- Lessons are admitted as Narsese self-beliefs via `nar.input` (non-LLM path, seeded truth, `source: 'retrospect'` provenance)
- Proposals route through existing `ProposalRouter` (governance unchanged)
- Default consolidation behavior is unchanged

**Rollback:** Delete `retrospect.ts` and the CLI commands. No other code is touched.

---

## 6. Acceptance Benches (`tests/nar/todo24-*.test.ts`)

| # | Bench | File | Obligation |
|---|---|---|---|
| 71 | Reaction labels + exclusions + redaction | `tests/nar/todo24-reactions.test.ts` | ✅ **green** |
| 72 | Capture round-trip + correlation | `tests/nar/todo24-capture.test.ts` | ✅ **green** |
| 73 | Retrospect diagnostic | `tests/nar/todo24-retrospect.test.ts` | ✅ **green** |
| 74 | End-to-end flywheel | `tests/nar/todo24-e2e.test.ts` | ✅ **green** |

Benches instantiate `DialogueCapture`/`retrospect()` directly (no mocks, no bot bootstrap) — the class boundary from §3 is what makes this possible.

---

## 7. Decision Points

| # | Question | Default Proposal |
|---|---|---|
| DQ1 | Episode storage — `EpisodicMemory` vs dedicated JSONL | `EpisodicMemory` (`type: 'dialogue'` + `type: 'reaction'`). Reuses AIKR bounds + persistence + `correlationId` joins. Dedicated JSONL only if episode volume becomes a problem. |
| DQ2 | Reaction binding — explicit-only vs explicit + heuristic adjacency | Explicit-only in v1 (`DialogueCapture.bindReaction`). Heuristic adjacency deferred, gated by a falsifiable bench. |
| DQ3 | Retrospect trigger — on-demand vs session-end auto vs periodic | On-demand `.retrospect` first. Opt-in auto on session close later. |
| DQ4 | Lesson encoding — Narsese self-beliefs vs structured JSONL vs both | Both: self-beliefs for NAR reasoning (queryable via `nar.ask`), JSONL for tooling/developer inspection. |
| DQ5 | Capture scope — every turn vs sampled | Every turn with a reaction; grade-sampled for turns without reactions (match existing trace-grader sampling rate). Config: `dialogue.captureAll`. |
| DQ6 | Correction-to-label level — embedding-level preference pairs vs Narsese-level formalization | Embedding-level in v1 (no LM call needed; embedding is taken at bind time per I6). Narsese-level formalization deferred to when the NL understanding service is next touched. |
| DQ7 | Reaction embedding cache — embed correction per bind (fresh) vs reuse nearest cached embedding | Fresh per bind (deterministic, no stale-neighborhood risk). The `embeddingCache` dedup makes repeats cheap. |

---

## 8. Out of Scope (Explicit)

❌ Self-modification auto-apply (proposals only; governance + autonomy modes unchanged)
❌ Distributed / multi-agent dialogue
❌ LLM weight fine-tuning (the "Ouroboros" compile-System-2-into-System-1 loop)
❌ New manifold heads, encoder replacement, additional `HEAD_SPECS`
❌ Embodiment / sensorimotor streams
❌ New workspace packages (consolidate in `nar/src/dialogue/`, per export-surface policy)
❌ `collectChat()` restructuring or pipeline abstraction (one `onExchange` call from the existing message funnel)
❌ Heuristic reaction attribution (explicit binding only in v1)
❌ Curriculum / probe selection (deferred until the flywheel produces data)
❌ Narsese-level formalization of corrections (embedding-level preference pairs in v1)
❌ Raw conversational text at rest (I6 — digests + embeddings only, everywhere)

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Capture grows disk (turns + reactions) | Hash-only payloads (I6); rotation + `.turns` size visibility; `captureAll` off by default; bounded per session (`maxTurnsPerSession`) |
| Reaction mis-attribution poisons flywheel | Explicit binding only in v1 (DQ2). No heuristic inference. Mis-attribution is structurally impossible when reactions are explicitly tagged. |
| Correction text leaks at rest | I6: embedded at bind time, then discarded; digests only in episodes, labels, retrospectives. Bench 71 falsifies. |
| Session identity drifts from reasoning pipeline | I7: single `correlationId` key reused from `Agent.chat()`/`Episode`/`TraceGradeInput`; no new ID space. Bench 72 falsifies. |
| Retrospect proposes noisy changes | Proposals route through existing `ProposalRouter`; only low-risk `focus-weight` auto-applies; rest need approval |
| `retrospect()` becomes a god-function | Thin aggregation only; every capability delegates to an existing component (`SchemaInductor`, self-analyzer, `SelfMetaGame`). No new metacognition. |
| Frozen-set contamination | I1 invariant: `REACTION_SOURCE` excluded by construction. Bench 71 falsifies. |
| Semver: new exports | Land as internal (relative imports) first; promote to `exports` map only when an in-repo consumer exists (`pnpm exports:audit` gate) |
| Dialogue capture slows `collectChat()` | Capture is async, fire-and-forget, best-effort. Failures never disrupt chat (match existing auto-capture pattern) |
| Capture aggregation from multiple sources is complex | Start with minimal fields (digests + grounding + provenance); add formalization/reflex fields incrementally |

---

## 10. Dependencies

```
nar/src/lm/system-one/
  ├── dialogue/                    (NEW folder — the flywheel substrate)
  │   ├── types.ts                 DialogueTurn · Reaction · ReactionKind · Retrospective · Lesson
  │   ├── capture.ts               DialogueCapture class (turn tracking, reaction binding, label fan-out)
  │   └── retrospect.ts            retrospect() aggregation + digest-pinned persistence
  ├── label-sources.ts             (extended — recordReactionLabel)
  ├── eval-set.ts                  (extended — REACTION_SOURCE const + default exclusion)
  ├── hard-negatives.ts            (extended — corrections as hard negatives)
  ├── distill.ts                   (existing — JudgmentDataset contract, unchanged)
  ├── decide.ts                    (existing — consumed, unchanged)
  ├── contrastive.ts               (existing — consumed, unchanged)
  └── trace-grader.ts              (existing — consumed, unchanged; correlationId already present)

nar/src/learning/
  └── schema-induction.ts          (existing — consumed by retrospect)

nar/src/self/
  └── ReasoningAboutReasoning      (existing — consumed by retrospect)

nar/src/game/
  └── SelfMetaGame                 (existing — proposal emission, unchanged)

nar/src/memory/
  └── EpisodicMemory               (existing impl — turn + reaction storage via getEpisodes({ type }))

util/src/types/
  └── episodic-memory.ts           (extended — EpisodeType union + 'dialogue' | 'reaction')

util/src/config/
  └── system-one.ts                (extended — DialogueCapture section in SystemOneConfig)

@senars/core
  └── Agent.chat                   (existing — correlationId mint per message, I7; unchanged)

src/bin/bot.ts                     (CLI exposure only: .react, .turns, .retrospect, .retrospectives, .lessons — thin handlers over DialogueCapture/retrospect)
```

---

## 11. Definition of Done

```
Capture is canonical            Reactions are safe            Retrospect is diagnostic
─────────────────────           ─────────────────────         ────────────────────────
one DialogueTurn per exchange   explicit binding only         aggregates existing data
provenance on every turn        no heuristic attribution      no new metacognition
disabled path byte-identical    frozen-set excluded           proposals through governance
correlationId joins everything  hash-only at rest (I6)        digest-pinned artifacts

Two consumers served            Governance unchanged          Extension points open
─────────────────────           ─────────────────────         ────────────────────────
agent: labels → flywheel        proposals only, not apply     heuristic attribution (DQ2)
developer: retrospectives       epistemic firewall holds      Narsese-level corrections (DQ6)
+ visible thinking transcripts  autonomy modes intact         curriculum / probe selection
```

---

## 11. Progress Log (2026-09-25)

### Assumption audit (challenged post-implementation)

| # | Assumption | Verdict | Action |
|---|---|---|---|
| A1 | I6 (hash-only) is absolute | **Challenged** — legitimate needs exist (debugging retrospectives, NL-understanding training data, donated transcripts) | ✅ `dialogue.retention: 'hash-only' \| 'with-text'` (default hash-only). Raw text goes to a **dedicated sidecar** (`DialogueTextStore`, `.cache/dialogue/text/`, turnId-keyed, purgeable); labels, frozen eval sets, and retrospectives stay hash-only regardless. `bindReaction` upserts the correction into the exchange's sidecar record. Bench 71 scoped: redaction asserted for the default mode; new falsifier asserts sidecar-only-when-opted-in and text-free labels even in text mode |
| A2 | `retrospect()` scans all episodes per session | Accepted for now | Documented: O(all episodes) is fine for retention-bounded local stores; if volume grows, index episode metadata by correlationId (getEpisodes filter) |
| A3 | DQ2 explicit-only reactions | **Held** | Mis-attribution poisoning is structural; heuristic adjacency stays gated behind a falsifiable bench. Unchanged |
| A4 | DQ7 fresh-embed-per-bind | Held, with note | The `embeddingCache` dedup makes repeat corrections cheap; no stale-neighborhood risk. Unchanged |
| A5 | Correction embedding keyed by digest | Fine | Response embedding derives from the response digest (stable across binds), correction from fresh text |
| A6 | Per-turn capture always persists episodes (even without reactions) | Held | Event-sourced replay wants the full log; `captureAll` gates *label* sampling, not the event log. Storage bounded by hash-only payloads + maxTurnsPerSession + 30-day prune |
| A7 | Corrections dominate ⇒ one global focus-weight proposal | Adequate | Threshold (≥2 reactions, ≥50% corrections) is arbitrary but explicit and falsifiable; per-turn attribution would need DQ2 first |
| A8 | Trace-grade history is last-wins per correlationId | Fine for sessions | The audit averages over turns sharing the session prefix; aggregation is intentionally coarse — exact per-message joins already work |

- I6-relaxation pass: `dialogue.retention` config + `DialogueTextStore` sidecar (`nar/src/dialogue/text-store.ts`); `DialogueCapture` constructs it only on opt-in; bot logs when text retention is active.
- Docs pass: README.md gains a "Dialogue Flywheel" subsection (under System One, after Distillation Flywheel) covering capture/redaction, reaction labels, provenance enrichment, retrospectives/lessons, MCP tools, and the config section reference.

- Strategy-audit pass: `SystemOneRuntime` now records correlationId → trace quality per graded trace (`traceGradeHistory` map); `runSessionRetrospective` feeds it to `retrospect()`, so the audit's `meanQuality` reflects real trace grades joined by correlationId (I7 fully realized — no approximation).

- Proposal + auto-retrospect pass: `.retrospect` now runs the shared `runSessionRetrospective` (contradiction mining via `mineHardNegatives`, correction-dominated sessions emit a low-risk `focus-weight` proposal persisted in the artifact); `dialogue.autoRetrospect` (default false, DQ3 opt-in) runs it on graceful shutdown.

- MCP tool pass: `registerDialogueTools` (src/bin/lib/mcp/mcp-dialogue-tools.ts) exposes `dialogue_react`/`dialogue_turns`/`dialogue_retrospect` on the MCP server when `dialogue.enabled` — AI-agent clients can now drive the self-correction loop directly against the `DialogueCapture` class boundary.

- Enrichment pass: `DialogueCaptureDeps.enrich` (injectable per-turn enricher, best-effort, throw-degrades-to-base). Bot wires the System One decider to populate `judgment` (abstained/band) + full `JudgmentProvenance` per turn when System One is enabled. Remaining enrichment: `formalizations` (needs LM-backed NLUnderstandingService call per turn — cost-benefit gate) and `reflex` (needs ManifoldReflex selection readout, not currently exposed per message).

- Follow-up pass: per-message `correlationId` surfaced on `ChatStreamEvent.finish` (core/src/ChatService.ts, additive field) and consumed by `collectChat()` — turns now join the kernel's correlationId exactly (I7 closed). `.lessons` ingests lessons as Narsese self-beliefs via `nar.input` (seeded truth, best-effort).

- Phase A/B/C implemented; benches 71–74 green (`pnpm exec vitest run tests/nar/todo24-*.test.ts` → 15 passed).
- Files: `nar/src/dialogue/{types,capture,retrospect,index}.ts` (NEW), `nar/src/lm/system-one/{eval-set,label-sources}.ts` (extended), `util/src/types/episodic-memory.ts` (`'dialogue' | 'reaction'` episode types), `util/src/config/dialogue.ts` (NEW top-level section), `nar/package.json` (`./dialogue` subpath export), `src/bin/bot.ts` (capture wiring + `.react`/`.turns`/`.retrospect`/`.retrospectives`/`.lessons`), `tests/utils/in-memory-episodic.ts` (NEW test double).
- Deliberate scope trims vs. plan: Phase-B `onExchange` enrichment starts with digests + grounding + provenance (formalizations/judgment/reflex fields are typed but not yet populated at the bot surface — they need per-cycle hook plumbing); Phase-C lesson extraction emits `Lesson` structs (`.lessons` CLI) but does not yet `nar.input` Narsese self-beliefs; strategy audit joins session↔grades via the bot's session-level key only.

**New improvement opportunities (in leverage order):**
1. ~~**Surface per-message correlationId from `Agent.chat()`**~~ — ✅ **done** (`ChatStreamEvent.correlationId` on `finish`; `collectChat()` consumes it, falling back to `bot:{sessionId}` only if absent).
2. ~~**Phase-B enrichment hooks**~~ — ✅ **done** (`DialogueCaptureDeps.enrich`: injectable per-turn enricher; bot wires the System One decider for judgment bands + `JudgmentProvenance`, best-effort with graceful degradation. Formalizations (NLUnderstandingService, LM-bound) and reflex selection still unwired — see notes below).
3. ~~**Narsese lesson ingestion**~~ — ✅ **done** (`.lessons` ingests via `nar.input` with seeded truth, best-effort).
5. ~~**Embed persisted proposals** in `Retrospective`~~ — ✅ **done** (`.retrospect` now mines contradiction terms from live beliefs and emits a low-risk `focus-weight` proposal when corrections dominate — payload only, governance at the `ProposalRouter` consumer, I3).
6. ~~**Session-end auto-retrospect** (opt-in)~~ — ✅ **done** (`dialogue.autoRetrospect` config, default false; runs the shared runner in `setupGracefulShutdown`).
7. **Heuristic reaction attribution** (DQ2) and **Narsese-level correction formalization** (DQ6) — unchanged, still gated behind falsifiable benches.

## 12. Leverage Notes

Highest-leverage items, in order:

1. **Phase A (`DialogueCapture` + `recordReactionLabel`)** — unlocks the single highest-value training signal currently being discarded (the human's explicit reaction), through the established `record*Label` contract in `label-sources.ts`. Every correction becomes a preference pair. Every rejection becomes a hard negative. ~9 hours to close the core loop.

2. **I1 (frozen-set exclusion)** — the single most important architectural constraint. It is the thing that prevents the dialogue flywheel from corrupting the trustworthy-self-improvement guarantee. Every phase must respect it. Bench 71 falsifies.

3. **`DialogueCapture` as the single fan-out point (§3)** — every sink (labels, episodes, contrastive, future consumers) hangs off one class behind one config gate. Adding a sink is one method; disabling the flywheel is one boolean. This is what keeps Phases B/C additive and the disabled path byte-identical.

4. **I7 (correlationId as the join key)** — session identity for free: `Agent.chat()` already mints it, `Episode` already carries it, `TraceGradeInput` already grades by it. The strategy audit and `.turns`/`.retrospect` joins need zero new plumbing.

5. **Phase B (capture)** — pays compound interest; every later phase reads from the captured turns. Without it, retrospectives have no substrate. The capture hook is additive (one call from the message funnel), not a restructuring.

6. **Phase C (retrospect)** — makes the system's own dialogue a first-class object of analysis. The retrospective is both the agent's learning artifact and the developer's diagnostic artifact. This is the "system in which we develop specific examples."

Non-binding extension points (revisit at phase boundaries): heuristic reaction attribution from subsequent user messages (DQ2); Narsese-level formalization of corrections (DQ6); MCP tool exposure of `.react`/`.turns`/`.retrospect` for AI-agent-driven self-correction loops (the `DialogueCapture` class boundary makes this a thin adapter); OOD-tagging strongly-negative reflex outcomes as lessons; feeding `Retrospective` strategy audit into `CognitiveController.adapt()`; retrospective-triggered re-consolidation (feeding lessons back through `SchemaInductor` on the next session); the "Ouroboros" flywheel (compile System 2 derivations into System 1 weights via LoRA/QLoRA fine-tuning — separate TODO); curriculum / probe selection (deferred until the flywheel produces data to select from).
