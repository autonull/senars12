# TODO24: Dialogue Flywheel — Conversational Capture, Reaction & Retrospective Consolidation

**Version:** 1.0 (2026-09-25) · **targets** the gap between dialogue and learning: conversations with the agent are currently graded thin (trace-grade ≥ 0.7 → positive label) and discarded — corrections, rejections, and clarifications never reach the training flywheel, and no session-level analysis exists.

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
| I5 | **Disabled-path byte-identical.** With dialogue capture off, the bot behaves identically to current behavior. No capture, no retrospection, no label emission. | Config gate: `dialogue.enabled: false` default. |

---

## 2. Naming & Vocabulary

All identifiers follow the codebase's established conventions: descriptive compound nouns (`JudgmentManifold`, `ContrastiveMemory`, `SchemaInductor`), lowercase verb commands (`.judge`, `.decide`, `.trace`, `.consolidate`), `Registry`/`Ledger` suffixes for catalogs, and the `flywheel` metaphor for closed training loops.

| Identifier | Kind | Meaning |
|---|---|---|
| `DialogueTurn` | type | One user↔agent exchange: utterance, response, formalization candidates, judgment, grounding verdict, reflex decisions, reaction, provenance. |
| `Reaction` / `ReactionKind` | type / enum | The human's (or AI agent's) explicit response to a prior turn. Six kinds: `accept · correct · reject · clarify · redirect · abandon`. |
| `Retrospective` | type | Post-session diagnostic artifact: turn summary, reaction distribution, correction analysis, strategy audit, contradictions, proposals. |
| `retrospect()` | fn / command | Produces a `Retrospective` from a session's captured turns. |
| `recordReactionLabel` | fn | Maps reactions → `DistillationLabel`s. Lives in `label-sources.ts`, following the existing `record*Label` convention (`recordCorrectionLabel`, `recordApprovalLabel`, …). |
| `DialogueCapture` | config section | Config gate + parameters for turn capture and reaction binding. |

**CLI commands** (all in `bot.ts`, lowercase `.` convention):

| Command | Purpose |
|---|---|
| `.react <kind> [correction]` | Bind an explicit `Reaction` to the most recent turn. |
| `.turns [session-id] [n]` | Show captured `DialogueTurn`s (default: current session, last 10). |
| `.retrospect [session-id]` | Run a retrospective (default: current session). |
| `.retrospectives [n]` | List past retrospectives. |
| `.lessons` | Show extracted lessons from retrospectives. |

---

## 3. Architecture

```
                    DIALOGUE  (developer / AI-agent  ⇄  bot)
                         │
        ┌────────────────┼────────────────────────────────────────┐
        │                │                                        │
        ▼                ▼                                        ▼
   1. CAPTURE       2. REACT                                4. DEMONSTRATE
   collectChat()    .react <kind>                           Each DialogueTurn
   emits            or programmatic                         carries a replayable
   DialogueTurn     bindReaction()                          thinking transcript:
   per exchange     → binds Reaction                        derivation trace,
        │           to a prior turn                         manifold judgments,
        │                │                                  gate verdicts,
        │                ▼                                  provenance chain
    │           3. LABEL
    │           recordReactionLabel()
    │           → DistillationLabel
        │             (source: 'reaction')
        │           → JudgmentDataset ──► existing distillation flywheel
        │           → ContrastiveMemory (hard negatives from corrections)
        │                │
        ▼                ▼
   5. RETROSPECT
   retrospect(sessionId)
     ├─ Turn summary + reaction distribution
     ├─ Correction analysis (what was corrected, what the corrections were)
     ├─ Strategy audit (which derivation strategies produced well-graded turns)
     ├─ Contradiction detection
     └─ emit SelfImprovementProposals → ProposalRouter (governance unchanged)
        │
        ▼
   Retrospective artifact (persisted as JSONL)
        │
        ├─► Agent consumer: labels → flywheel → better heads
        └─► Developer consumer: diagnostic artifacts → next development iteration
```

**Two consumers, one capture.** The loop serves both the agent (self-improvement via labels, schemas, proposals) and the developer (diagnostic artifacts, visible thinking transcripts, retrospectives that inform the next development iteration).

**Orthogonality.** All shared substrate lands in `nar/src/lm/system-one/` (extending existing files) or a new `nar/src/lm/system-one/dialogue/` folder. `bot.ts` gets CLI exposure only. Non-bot NAR consumers are unaffected. The disabled path is byte-identical.

**Storage model.** Reactions are stored as *new episodes* (`type: 'reaction'`) that reference the turn ID — consistent with the append-only, event-sourced kernel. `retrospect()` joins turns and reactions by `turnId` at read time. This preserves event-sourced replay and avoids in-place mutation of stored episodes. `EpisodeType` is a closed union in `util/src/types/episodic-memory.ts` — extending it with `'dialogue' | 'reaction'` is a package change to `@senars/util` (additive, non-breaking). The implementation is `EpisodicMemory` in `nar/src/memory/` (JSONL-backed, day-rolled, retention-bounded); its `getEpisodes({ type })` filter already supports type-scoped retrieval, so turn/reaction joins are a filter away.

---

## 4. Types & Contracts

```typescript
// nar/src/lm/system-one/dialogue/types.ts (NEW — leaf, no circular imports)

type ReactionKind = 'accept' | 'correct' | 'reject' | 'clarify' | 'redirect' | 'abandon';

interface Reaction {
  kind: ReactionKind;
  correction?: string;       // for 'correct': the corrected utterance or formalization
  at: number;                // timestamp
  turnId: string;            // the turn this reaction responds to
}

interface DialogueTurn {
  sessionId: string;
  turnId: string;
  seq: number;

  // Exchange content (hash-only; no raw text persisted — matches distillation policy)
  utteranceDigest?: string;   // sha256 of user utterance
  responseDigest?: string;    // sha256 of agent response

  // Reasoning artifacts (references, not copies — populated incrementally)
  formalizations?: FormalizationCandidate[];  // from NL understanding (ingress path)
  judgment?: DecideResult;                     // decide() result
  grounding?: { admitted: boolean; score: number };  // groundedness-gate verdict
  reflex?: { proposed: string[]; selected: string; vetoes: number };

  // Human/AI-agent reaction (bound retroactively via .react or bindReaction)
  reaction?: Reaction;

  // Provenance
  provenance: JudgmentProvenance;
}

interface Retrospective {
  sessionId: string;
  at: number;
  turnCount: number;
  reactionCount: number;
  reactionDistribution: Record<ReactionKind, number>;

  corrections: CorrectionAnalysis[];
  contradictions: Term[];
  strategyAudit: StrategyAuditEntry[];
  proposals: SelfImprovementProposal[];

  provenance: { turnIds: string[] };  // which turns were consolidated
}

interface CorrectionAnalysis {
  turnId: string;
  originalDigest: string;
  correction?: string;
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
  enabled: boolean;          // default: false (I5)
  captureAll: boolean;       // default: false — capture every turn vs. grade-sampled
  maxTurnsPerSession: number; // default: 500 — bounded per AIKR
};
```

---

## 5. Phases & Items

Three independent slices, each with its own bench and rollback. Each is independently shippable, independently testable, and independently valuable.

| Phase | Status | Focus | Effort |
|---|---|---|---|
| Phase A | ⬜ planned | Reactions → labels (close the core loop) | ~8h |
| Phase B | ⬜ planned | Full `DialogueTurn` capture | ~10h |
| Phase C | ⬜ planned | `retrospect()` diagnostic report | ~12h |

### Phase A — Reactions → Labels

**Goal:** When a user corrects the bot, the correction becomes a training label that feeds the distillation flywheel. This is the highest-value, lowest-effort slice.

**Design:** Reactions are explicit in v1 — bound via `.react <kind>` CLI or programmatic `bindReaction(turnId, reaction)`. No heuristic attribution. This eliminates the mis-attribution risk that would poison the flywheel.

| Task | File | Effort |
|---|---|---|
| Define `Reaction`, `ReactionKind` types | `nar/src/lm/system-one/dialogue/types.ts` (NEW) | 1h |
| Minimal turn tracking: turn ID + utterance/response digests per exchange in `collectChat()` | `src/bin/bot.ts` | 2h |
| `.react <kind> [correction]` CLI command: binds a `Reaction` to the most recent turn, stores as episode (`type: 'reaction'`) | `src/bin/bot.ts` | 2h |
| `recordReactionLabel`: map reactions → `DistillationLabel`s (`accept`→positive, `correct`→preference pair at embedding level, `reject`→negative). Labels carry `source: 'reaction'` | `nar/src/lm/system-one/label-sources.ts` (extend, `record*Label` convention) | 2h |
| Extend `createFrozenEvalSet` default exclusion to `REACTION_SOURCE` (add to `excludeSources ?? [CONVERSATION_SOURCE, REACTION_SOURCE]`) | `nar/src/lm/system-one/eval-set.ts` | 0.5h |
| Wire `recordReactionLabel` into the bot's post-grading capture path (`collectChat`/`.react` handler), not `distill.ts` — that file only defines `JudgmentDataset` | `src/bin/bot.ts` | 1h |
| Corrections as hard negatives: `correct` reactions feed `mineHardNegatives` → `ContrastiveMemory` | `nar/src/lm/system-one/hard-negatives.ts` | 1h |

**Design notes:**
- A `correct` reaction produces an embedding-level preference pair. Mechanics: `JudgmentDataset` stores **one embedding per `evidenceId`** (`#vectors: Map<string, Float32Array>`), so a pair is **two rows** sharing a `turnId`-derived pair id — the original response row with `observed: 0` and the correction row with `observed: 1`, each with its own embedding via `computeEvidenceId(turnId, 'original'|'correction')`. `observed` makes the pair directly calibration-consumable (frozen-set-adjacent but excluded by I1) and usable by `ContrastiveMemory` as a positive/negative exemplar pair. No Narsese formalization of the correction text required; that is deferred.
- `clarify` and `redirect` produce metadata flags, not labels. `abandon` produces a weak negative.
- Reaction binding is retroactive: `.react correct "I meant X"` binds to the most recent turn. The turn must already exist (minimal tracking from task 2).

**Acceptance (Bench 71):**
- A `correct` reaction yields a preference-pair label with `source: 'reaction'`
- An `accept` reaction yields a positive label
- A `reject` reaction yields a negative label
- `createFrozenEvalSet` excludes `source === 'reaction'` by construction
- Disabled path (no reactions) is byte-identical to current behavior

**Rollback:** Delete the `.react` command handler and the `recordReactionLabel` function. No other code is touched.

### Phase B — Full `DialogueTurn` Capture

**Goal:** Every dialogue exchange captures the full reasoning context — formalizations, judgment, grounding, reflex decisions, provenance — as a `DialogueTurn` stored in episodic memory. This makes each turn a self-contained, replayable demonstration artifact.

**Design:** The capture hook sits alongside the existing `captureDistillation` call in `collectChat()` — it does not restructure `collectChat()` or introduce a new pipeline abstraction. The existing auto-capture fires on grade ≥ 0.7 (positive labels only); the `DialogueTurn` capture fires on every turn (or every turn with a reaction, depending on `captureAll` config), because corrections and rejections are the highest-value signals.

| Task | File | Effort |
|---|---|---|
| Define `DialogueTurn` type (full schema) | `nar/src/lm/system-one/dialogue/types.ts` | 1h |
| Add `DialogueCapture` config section to `SystemOneConfig` (`util/src/config/system-one.ts`, zod schema + defaults) | `@senars/util/config` (extend) | 1h |
| Extend `EpisodeType` union with `'dialogue' \| 'reaction'` | `util/src/types/episodic-memory.ts` | 0.5h |
| Capture hook in `collectChat()`: emit `DialogueTurn` per exchange alongside existing `captureDistillation` | `src/bin/bot.ts` | 4h |
| Store turns as `Episode`s (`type: 'dialogue'`) in `EpisodicMemory` | `src/bin/bot.ts` + `nar/src/memory/EpisodicMemory` (retrieve via `getEpisodes({ type })`) | 2h |
| `.turns [session-id] [n]` CLI command | `src/bin/bot.ts` | 1h |
| Update `.react` to bind to full `DialogueTurn` (upgrade from minimal tracking) | `src/bin/bot.ts` | 1h |

**Design notes:**
- Capture aggregation draws from multiple sources: formalizations from `NLUnderstandingService.understand()` (ingress path), `decide()` results from the `Decider`, grounding verdicts from `GroundednessGate`, reflex decisions from `ManifoldReflex`/`LMReflex`, provenance from `DecideResult.provenance`. Some data isn't available until after the response is complete — capture is async, fire-and-forget, best-effort. Failures never disrupt chat.
- The `DialogueTurn` stores *references* to reasoning artifacts (digests, decision IDs), not full copies. This bounds storage per AIKR.
- Raw utterance text is never persisted — only sha256 digests, matching the distillation dataset's hash-only policy.

**Acceptance (Bench 72):**
- A `DialogueTurn` round-trips to `EpisodicMemory` with reaction + provenance
- Fan-out sinks idempotent per `(sessionId, turnId)`
- With `dialogue.captureAll: false`, only grade-sampled turns are captured
- With `dialogue.captureAll: true`, every turn is captured
- Disabled path (`dialogue.enabled: false`) is byte-identical

**Rollback:** Delete the capture hook from `collectChat()` and the `.turns` command. No other code is touched.

### Phase C — `retrospect()` Diagnostic Report

**Goal:** Produce a session-level diagnostic report that aggregates what happened during a dialogue: how many turns, how many reactions, what was corrected, which strategies were active, what contradictions surfaced. This is a diagnostic for the developer, not a learning engine.

**Design:** `retrospect()` is a thin aggregation function over captured turns and reactions. It does not implement new metacognition — it reads existing data and produces a structured report. Schema induction, lesson extraction, and proposal emission are thin wrappers over existing `SchemaInductor`, self-analyzer, and `SelfMetaGame`/`ProposalRouter`.

| Task | File | Effort |
|---|---|---|
| `retrospect(sessionId)`: load session episodes → aggregate turns + reactions → produce `Retrospective` | `nar/src/lm/system-one/dialogue/retrospect.ts` (NEW) | 4h |
| Correction analysis: which turns were corrected, what the corrections were | `retrospect.ts` | 1h |
| Strategy audit: which derivation strategies were active, correlated with quality scores | `retrospect.ts` | 2h |
| Contradiction detection: identify contradictions surfaced during the session | `retrospect.ts` | 1h |
| Lesson extraction: emit `Lesson` as Narsese self-belief, ingested via `nar.input` (non-LLM path, seeded truth) | `retrospect.ts` | 2h |
| Proposal emission: route retrospective findings → `SelfMetaGame`/`ProposalRouter` | `retrospect.ts` | 1h |
| Persist `Retrospective` as JSONL to `.cache/retrospectives/` | `retrospect.ts` | 0.5h |
| `.retrospect [session-id]` / `.retrospectives [n]` / `.lessons` CLI commands | `src/bin/bot.ts` | 2h |

**Design notes:**
- `retrospect()` is an *offline* operation triggered on demand (`.retrospect`) or at session end (opt-in), not a per-tick stage in the macro-cycle.
- Minimum viable session: retrospect is meaningful at ≥10 turns with ≥2 reactions. Below that, it produces a skeleton retrospective with no strategy audit or contradiction analysis.
- Lesson extraction criteria: a lesson requires ≥2 supporting turns, a non-trivial Narsese term (not a tautology), and a confidence above the seed-truth admission floor used for non-LLM inputs.
- The strategy audit correlates `DialogueTurn.provenance` with quality scores from the trace grader. This requires threading `turnId` into the tick context so derivation records carry the turn they belong to.

**Acceptance (Bench 73):**
- A seeded session (≥10 turns, ≥2 reactions) yields a `Retrospective` with turn summary, reaction distribution, ≥1 correction analysis, and ≥1 strategy audit entry
- `Retrospective` is persisted as JSONL and retrievable via `.retrospectives`
- Lessons are admitted as Narsese self-beliefs via `nar.input` (non-LLM path, seeded truth, `source: 'retrospect'` provenance)
- Proposals route through existing `ProposalRouter` (governance unchanged)
- Default consolidation behavior is unchanged

**Rollback:** Delete `retrospect.ts` and the CLI commands. No other code is touched.

---

## 6. Acceptance Benches (`tests/nar/todo24-*.test.ts`)

| # | Bench | File | Obligation |
|---|---|---|---|
| 71 | Reaction labels + frozen-set exclusion | `tests/nar/todo24-reactions.test.ts` | `correct` → two-row preference pair (original `observed: 0`, correction `observed: 1`, both `source: 'reaction'`); `accept` → positive; `reject` → negative; `createFrozenEvalSet` default-excludes `REACTION_SOURCE`; disabled path byte-identical |
| 72 | Capture round-trip | `tests/nar/todo24-capture.test.ts` | `DialogueTurn` round-trips to `EpisodicMemory` with reaction + provenance; fan-out idempotent per `(sessionId, turnId)`; `captureAll` config honored; disabled path byte-identical |
| 73 | Retrospect diagnostic | `tests/nar/todo24-retrospect.test.ts` | Seeded session yields `Retrospective` with turn summary, reaction distribution, correction analysis, strategy audit; persisted as JSONL; lessons admitted as Narsese self-beliefs via `nar.input`; proposals route through `ProposalRouter` |
| 74 | End-to-end flywheel | `tests/nar/todo24-e2e.test.ts` | Dialogue → capture → react → label → retrospect → proposal. Full loop executes without error. Governance pipeline receives proposals but does not auto-apply (unless low-risk `focus-weight`) |

---

## 7. Decision Points

| # | Question | Default Proposal |
|---|---|---|
| DQ1 | Episode storage — `EpisodicMemory` vs dedicated JSONL | `EpisodicMemory` (`type: 'dialogue'` + `type: 'reaction'`). Reuses AIKR bounds + persistence. Dedicated JSONL only if episode volume becomes a problem. |
| DQ2 | Reaction binding — explicit-only vs explicit + heuristic adjacency | Explicit-only in v1 (`.react` CLI + programmatic `bindReaction`). Heuristic adjacency deferred, gated by a falsifiable bench. |
| DQ3 | Retrospect trigger — on-demand vs session-end auto vs periodic | On-demand `.retrospect` first. Opt-in auto on session close later. |
| DQ4 | Lesson encoding — Narsese self-beliefs vs structured JSONL vs both | Both: self-beliefs for NAR reasoning (queryable via `nar.ask`), JSONL for tooling/developer inspection. |
| DQ5 | Capture scope — every turn vs sampled | Every turn with a reaction; grade-sampled for turns without reactions (match existing trace-grader sampling rate). Config: `dialogue.captureAll`. |
| DQ6 | Correction-to-label level — embedding-level preference pairs vs Narsese-level formalization | Embedding-level in v1 (no LM call needed). Narsese-level formalization deferred to when the NL understanding service is next touched. |

---

## 8. Out of Scope (Explicit)

❌ Self-modification auto-apply (proposals only; governance + autonomy modes unchanged)
❌ Distributed / multi-agent dialogue
❌ LLM weight fine-tuning (the "Ouroboros" compile-System-2-into-System-1 loop)
❌ New manifold heads, encoder replacement, additional `HEAD_SPECS`
❌ Embodiment / sensorimotor streams
❌ New workspace packages (consolidate in `nar/src/lm/system-one/`, per export-surface policy)
❌ `collectChat()` restructuring or pipeline abstraction (capture hooks alongside existing sites)
❌ Heuristic reaction attribution (explicit binding only in v1)
❌ Curriculum / probe selection (deferred until the flywheel produces data)
❌ Narsese-level formalization of corrections (embedding-level preference pairs in v1)

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Capture grows disk (turns + reactions) | Hash-only payloads (no raw text); rotation + `.turns` size visibility; `captureAll` off by default; bounded per session (`maxTurnsPerSession`) |
| Reaction mis-attribution poisons flywheel | Explicit binding only in v1 (DQ2). No heuristic inference. Mis-attribution is structurally impossible when reactions are explicitly tagged. |
| Retrospect proposes noisy changes | Proposals route through existing `ProposalRouter`; only low-risk `focus-weight` auto-applies; rest need approval |
| `retrospect()` becomes a god-function | Thin aggregation only; every capability delegates to an existing component (`SchemaInductor`, self-analyzer, `SelfMetaGame`). No new metacognition. |
| Frozen-set contamination | I1 invariant: `source: 'reaction'` excluded by construction. Bench 71 falsifies. |
| Semver: new exports | Land as internal (relative imports) first; promote to `exports` map only when an in-repo consumer exists (`pnpm exports:audit` gate) |
| Dialogue capture slows `collectChat()` | Capture is async, fire-and-forget, best-effort. Failures never disrupt chat (match existing auto-capture pattern) |
| Capture aggregation from multiple sources is complex | Start with minimal fields (utterance/response digests + grounding + provenance); add formalization/reflex fields incrementally |

---

## 10. Dependencies

```
nar/src/lm/system-one/
  ├── dialogue/                    (NEW folder)
  │   ├── types.ts                 DialogueTurn · Reaction · ReactionKind · Retrospective · Lesson
  │   └── retrospect.ts              retrospect() aggregation + persistence
  ├── label-sources.ts             (extended — recordReactionLabel)
  ├── distill.ts                   (existing — JudgmentDataset contract, unchanged)
  ├── eval-set.ts                  (extended — exclude source: 'reaction')
  ├── hard-negatives.ts            (extended — corrections as hard negatives)
  ├── decide.ts                    (existing — consumed, unchanged)
  ├── contrastive.ts               (existing — consumed, unchanged)
  └── trace-grader.ts              (existing — consumed, unchanged)

nar/src/learning/
  └── schema-induction.ts          (existing — consumed by retrospect)

nar/src/self/
  └── ReasoningAboutReasoning      (existing — consumed by retrospect)

nar/src/game/
  └── SelfMetaGame                 (existing — proposal emission, unchanged)

nar/src/memory
  └── EpisodicMemory               (existing impl — turn + reaction storage via getEpisodes({ type }))

util/src/types
  └── episodic-memory.ts           (extended — EpisodeType union + 'dialogue' | 'reaction')

@senars/core
  └── JsonlSessionManager          (existing — session persistence)

util/src/config
  └── system-one.ts                (extended — DialogueCapture section in SystemOneConfig)

src/bin/bot.ts                     (CLI exposure only: .react, .turns, .retrospect, .retrospectives, .lessons)
```

---

## 11. Definition of Done

```
Capture is canonical            Reactions are safe            Retrospect is diagnostic
─────────────────────           ─────────────────────         ────────────────────────
one DialogueTurn per exchange   explicit binding only         aggregates existing data
provenance on every turn        no heuristic attribution      no new metacognition
disabled path byte-identical    frozen-set excluded           proposals through governance

Two consumers served            Governance unchanged          Extension points open
─────────────────────           ─────────────────────         ────────────────────────
agent: labels → flywheel        proposals only, not apply     heuristic attribution (DQ2)
developer: retrospectives       epistemic firewall holds      Narsese-level corrections (DQ6)
+ visible thinking transcripts  autonomy modes intact         curriculum / probe selection
```

---

## 12. Leverage Notes

Highest-leverage items, in order:

1. **Phase A (`recordReactionLabel`)** — unlocks the single highest-value training signal currently being discarded (the human's explicit reaction), through the established `record*Label` contract in `label-sources.ts`. Every correction becomes a preference pair. Every rejection becomes a hard negative. ~8 hours to close the core loop.

2. **I1 (frozen-set exclusion)** — the single most important architectural constraint. It is the thing that prevents the dialogue flywheel from corrupting the trustworthy-self-improvement guarantee. Every phase must respect it. Bench 71 falsifies.

3. **Phase B (capture)** — pays compound interest; every later phase reads from the captured turns. Without it, retrospectives have no substrate. The capture hook is additive (alongside existing `captureDistillation`), not a restructuring.

4. **Phase C (retrospect)** — makes the system's own dialogue a first-class object of analysis. The retrospective is both the agent's learning artifact and the developer's diagnostic artifact. This is the "system in which we develop specific examples."

Non-binding extension points (revisit at phase boundaries): heuristic reaction attribution from subsequent user messages (DQ2); Narsese-level formalization of corrections (DQ6); OOD-tagging strongly-negative reflex outcomes as lessons; feeding `Retrospective` strategy audit into `CognitiveController.adapt()`; the "Ouroboros" flywheel (compile System 2 derivations into System 1 weights via LoRA/QLoRA fine-tuning — separate TODO); curriculum / probe selection (deferred until the flywheel produces data to select from).
