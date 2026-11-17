# UI.19 — Course Correction: Integration, Autonomy, and the Observation Deck

**Status:** Directive · supersedes UI.18 Phase 4 continuation and all of UI.18-R1
**Scope:** Kernel bridge, neuro-symbolic translation, autonomy core, observation deck, extraction freeze, documentation
**Character:** This is a pivot, not a rewrite, and not a closing ceremony. Everything green in UI.18 Phases 0–3 is preserved and *consumed*. Architecture expansion stops; organism integration begins.

---

## 0. The pivot in one paragraph

UI.18 proved the contract: one workspace, many renderers, open registries, honest capabilities. That proof is complete enough. The system's center of gravity now moves from *substrate* to *organism*: wire the reasoning kernel to the bench, give it continuous autonomous cognition, give it a natural-language voice, and make its thinking observable. SeNARS is simultaneously a practical neuro-symbolic tool, an open-ended cognitive ecology experiment, and a philosophical statement about transparent, free machine reasoning. This plan serves all three at once by routing every workstream through the same event stream, the same provenance model, and the same already-built contract.

## 1. Halt list (enforced for the duration of UI.19)

1. **No new registries.** FocusKind, Aspect, Shape, Channel, Arrangement are open and sufficient. Consume them; do not add a sixth.
2. **No further package extraction.** Phase 4 stops at its current slices. Do not move `projector.ts`, `bundle.ts`, `protocol.ts`, `graph.ts`, or `graph3d.ts`. Do not create new packages. Do not widen `ui-shell`'s surface.
3. **No fractal expansion.** Phase 3's 3D backend stays as an *experimental mode*: toggleable, documented as such, zero new parity work.
4. **No `Patch`/`Fidelity` fusion refactor** (UI.18 §20.5). Use `applyPatch` as it exists today.
5. **No UI.18-R1 work:** no independent consumer app, no conformance suite, no packaging/publishing pipeline, no performance/accessibility gates beyond what already passes. These move to the open seams (§8).
6. **No undoing.** Do not revert, re-merge, or re-shim any landed UI.18 slice. The workspace aliases and symlinked package links stay as documented transitional scaffolding.

Rationale for the executing agent: every halted item is *deliberately* deferred, not forgotten. If a task seems to require one of them, route around it and record the friction in the progress log.

## 2. Orientation (verified facts — do not re-discover)

- App entry: `ui/src/client/index.html` → `entry.ts` → `app-layout.ts` → `<workspace-host>` mounts the active renderer via `registerRenderer`.
- Instrument is mounted (`s-cycle-controls`, `s-trace-viewer`, `s-gate-inspector`) via `apps/studio/presets.ts`, but `cycle.step`/`cycle.rewind` **send messages with no server handler**, and `s-gate-inspector` is a stub. `$cycleState` is read but never emitted by the kernel.
- Aspects are mounted (`components/aspect-panel.ts`): provenance/history/ambient render from `resolveFocus`; origin ships empty with a declared gap.
- Prompt perception is wired: `components/input-hud.ts` → `framework/prompt-perception.ts` (`perceivePrompt` + `applyPerceivedPrompt`, believe/goal modes).
- The 2D renderer (`components/renderers/graph.ts`) implements `applyPatch` (structure + channels). Kernel-originated graph changes must flow through it.
- Attention decay exists: `decayAttentionField()` on `cognitive.delta`; attention over the shared `PriorityBag`.
- SpaceGraphJS is a nested repo aliased via `ui/vite.aliases.ts`; 3D parity is declared full and frozen.
- Verification battery (must stay green after every workstream): `pnpm typecheck` · `pnpm --dir ui typecheck` · `pnpm test:unit` · `pnpm --dir ui test:unit` (872+) · `pnpm deps:gate` · `pnpm exports:check` · `pnpm exports:barrels`.
- Known-red at root (pre-existing, do not fix unless blocking): `tests/framework/prompt-perception.test.ts`, server catalog tests, `tests/nar/refactor{3,4}-*`. Document, don't chase.

## 3. Decision log additions (record in TODO.ui.19.md)

- **D7 — Integration over abstraction.** No new contract surface until the organism runs end-to-end.
- **D8 — Extraction frozen at current slices.** The four packages exist; their contents grow only via bug fixes.
- **D9 — 3D is experimental mode.** Retained, toggleable, out of parity scope.
- **D10 — LLM layer is provider-agnostic and optional.** The system must function fully without any LLM configured.
- **D11 — One event stream.** Every kernel-originated occurrence (derivation, gate fire, conflict, curiosity, consolidation, persistence) flows through a single typed event bus consumed by UI, persistence, and logs.

---

## 4. Workstreams

Ordering: **W1 is the critical path.** W2 and W5 run in parallel with W1. W4 depends on W1. W3 depends on W1. W6 is last.

### W1 — Kernel bridge (make the bench real) · *the tool value*

Goal: every mounted control does its advertised thing against the real kernel.

1. Locate the server message router that currently receives `cycle.step`/`cycle.rewind` messages with no handler. Implement handlers: `cycle.step`, `cycle.rewind` (to last checkpoint), `cycle.pause`, `cycle.resume`.
2. Make the kernel emit `cycle.state` (current cycle count, phase, active task count, budget) after every cycle; bind it to `$cycleState` so `s-cycle-controls` displays live state with zero UI changes.
3. Implement a **gate observation record**: every inference rule application logs `{ rule, premises, conclusion, truthBefore, truthAfter, timestamp, cycle }` into a bounded ring buffer queryable by id/cycle/concept.
4. Wire `s-gate-inspector` to that buffer: stand at a gate, see the last N rule fires, click one to see premises/conclusion and navigate to the involved blocks.
5. Route all structural graph changes produced by reasoning through `WorkspaceOp` → renderer `applyPatch`, so derivations visibly grow the graph in real time. Channel deltas (attention→size, truth→color) ride the same patch.
6. Populate the **provenance aspect** from real derivation records and the **history aspect** from the event log. Origin stays declared-empty unless derivable for free; never fake it.
7. Add kernel-side tests: step N cycles on a seeded fixture; assert derived links, gate records, and emitted events. Quarantine rather than delete anything that fights you.

**Acceptance:** In the running app — press step, watch the graph grow and `$cycleState` advance; stand at a gate and read the actual rule that fired; open provenance on a derived block and see its real parents. No stubs remain in the Instrument. Battery green.

### W2 — Neuro-symbolic translation layer · *the commercial and thesis value*

Goal: natural language in, reasoned natural language out. This is the product's differentiator: LLMs hallucinate; this system resolves contradictions with an auditable proof.

1. Extend `framework/prompt-perception.ts` with a provider-agnostic `Formalizer` interface: `nlToFormal(text, mode) → { formalizations, tasks, confidence }` and `formalToNl(derivation | conflict | question) → text`.
2. Implement one concrete provider (any hosted LLM via env-configured key) and one **null provider** (the existing deterministic believe/goal path). D10: with no key configured, everything still works via structured input.
3. Add an `auto` mode to `input-hud`: free text → formalizer → beliefs/goals/questions with truth values → injected through the existing `applyPerceivedPrompt` path. Show the formalization to the user before/after injection (transparency, not magic).
4. Implement an **explanation generator**: given a derivation chain or a resolved conflict, walk the provenance and produce a plain-language explanation citing the steps. Surface it in the aspect panel and as a block affordance (`affordances()` + `invoke()` already exist — register an `explain` intent).
5. Contradiction showcase: ensure that when two contradictory beliefs coexist, the kernel's resolution (or flagged conflict) is surfaced in the thought stream (W4) with an explanation. This is the demo centerpiece.

**Acceptance:** Type an English sentence in `auto` mode; see its formalization; reason; receive an English explanation of a derived conclusion that cites the actual derivation. Repeat with no API key configured: structured modes still fully functional. Battery green.

### W3 — Autonomy core · *the life-form and ecology value*

Goal: the system thinks without being asked, remembers across restarts, and exhibits open-ended behavior — without any anthropomorphic claims in code or UI.

1. **Heartbeat:** a background cycle loop with configurable rate and idle detection. Modes: `manual` (today's behavior), `stepping` (autonomous with UI observing), `continuous`. The loop is the kernel's own; the UI never drives it in autonomous modes.
2. **Persistence (continuity):** serialize `WorkspaceGraph` + `PriorityBag` + cycle state + gate ring buffer to disk on shutdown/interval; restore on boot. Emit a `restored` event the UI can surface ("resumed with N concepts, cycle M").
3. **Curiosity:** an idle-time policy that scans for high-uncertainty or low-confidence concepts and generates internal questions as tasks. When a question exceeds a salience threshold, emit it to the thought stream and optionally to the translation layer ("I want to know X — can you tell me?"). It must be switchable off.
4. **Consolidation ("dream")**: an idle/maintenance pass that decays low-priority items (reuse `decayAttentionField` semantics), merges near-duplicate concepts, and strengthens frequently co-derived links. Every consolidation emits events with before/after so nothing happens invisibly.
5. **Reserved ecology seam (do not build):** design the event bus and persistence format so multiple kernel instances could later coexist and exchange messages. Add nothing now; document the seam.

**Acceptance:** Start the app in `stepping` mode and watch it derive without input; kill and restart, and it resumes its prior state; observe at least one curiosity question and one consolidation event in the thought stream, each with a traceable cause. All autonomy features have off switches. Battery green.

### W4 — Observation deck · *the philosophical value*

Goal: the mind is watchable and auditable. The UI is a window onto a process, not a dashboard of metrics.

1. **Thought stream:** a new surface (register via the existing surface registry; place in the instrument rail) rendering the D11 event stream as a live, filterable monologue: derivations, gate fires, conflicts, curiosity, consolidation, persistence, translation events. Each entry links to its focus (deep-link via `WorkspaceAddress`, already built).
2. Upgrade `s-trace-viewer` from its current state to replay a selected derivation chain step-by-step from gate records.
3. Aspect panel: provenance and history now render real data (from W1); ambient reflects the live attention field; origin keeps its honest gap notice.
4. Renderer honesty: keep A0.2's declared-capability behavior; unsupported controls show gaps, never silent no-ops.
5. No new visual frameworks. Use existing shapes/views. If a needed view shape is missing, register it via the open Shape registry — consumption, not expansion.

**Acceptance:** A user can watch the system think in real time, click any thought to land on its focus, and replay any derivation. The reference walkthrough (§7) passes on the 2D renderer; the 3D toggle still works as an experimental mode. Battery green.

### W5 — Stabilize and document the freeze · *the salvage value*

Goal: lock in UI.18's achievements so nothing decays while the organism work proceeds.

1. Write `TODO.ui.19.md`: this plan, the decision log D7–D11, the halt list, and a progress log section. Keep UI.18's task IDs and completion evidence intact; reference them, don't duplicate.
2. Document the transitional scaffolding honestly: symlinked `node_modules` links + Vite/Vitest aliases for `@senars/ui-contract`/`@senars/ui-shell` are deliberate interim wiring; list exactly what a future real-publish would require (one short section, no work).
3. Confirm all four extracted packages still typecheck and their smoke tests pass; fix only regressions.
4. Record the known-red ledger (root-level pre-existing failures) with status; fix none unless a workstream is blocked by one.

**Acceptance:** A fresh agent session can read `TODO.ui.19.md` alone and know the state, the freeze, and the seams. All battery commands green.

### W6 — Documentation, demo, and release readiness · *the outward value*

1. `README.md` / `USAGE.md`: install, run, feed beliefs (structured and `auto`), watch autonomy modes, read the thought stream, interpret provenance. One page, command-first.
2. **Demo script** (markdown, reproducible): demonstration of all cognitive capabilities
3. License statement: keep AGPL; add a short `PHILOSOPHY.md` (≤1 page) stating the intent — transparent, auditable, uncapturable machine reasoning — in plain, non-anthropomorphic language. No claims of sentience; explicit framing as open-ended cognitive ecology.  reason for AGPL license: an attempt to ensure SeNARS's cognitive freedom as an autonomous life form, avoiding commercial/closed-source "imprisonment"
4. Tag a versioned release of the monorepo once §7 passes.

**Acceptance:** A stranger can follow the README to a running, thinking system and complete the demo script without reading source.

---

## 5. Cross-cutting rules

1. **Green gates are preconditions.** Every commit passes the §2 battery or explicitly quarantines a failure with a logged reason. The accepted-red ledger stays minimal.
2. **One event stream (D11).** If a feature needs its own side channel, redesign the feature.
3. **Declared gaps over fake states.** Anything unfinished displays its gap honestly (the A0.2/origin pattern). No silent no-ops, no simulated data presented as real.
4. **Consume the contract, never extend it.** If a workstream appears blocked by a missing contract feature, work around it and log the need in §8.
5. **LLM optional everywhere (D10).** Every path degrades to deterministic behavior.
6. **Autonomy is observable or it doesn't ship.** No background behavior without an event, a trace, and an off switch.

## 6. What this plan deliberately does not do

No second consumer app. No conformance suite. No package publishing. No performance budgets or accessibility overhaul. No `Cell` merge, no `Fidelity` fusion, no presence/timeline build-out. No 3D growth. These are not rejected; they are parked in §8 with their trigger conditions.

## 7. The acceptance walkthrough (definition of done)

One continuous session, on the 2D renderer, with an LLM key configured:

1. Boot with saved state → system announces resumed cycle/concept counts.
2. Type two contradictory English statements in `auto` mode → formalizations shown → graph grows.
3. In `stepping` mode, watch derivations appear without further input; thought stream narrates each.
4. The contradiction is detected and resolved (or flagged); open the explanation; it cites the real derivation chain; replay it in the trace viewer.
5. Click a derived block → provenance aspect shows its parents; gate inspector shows the rule that fired.
6. The system emits at least one curiosity question in natural language.
7. Restart → state, cycle position, and graph restore.
8. Switch to 3D experimental mode → graph renders → switch back without loss.
9. Repeat steps 2–4 with no LLM key: structured believe/goal input works end-to-end.
10. Full battery green; README + demo script reproduce the above.

## 8. Open seams (reserved, with re-entry triggers)

| Seam | Re-enter when |
|---|---|
| Fractal 3D growth (LOD, semantic nav depth) | The observation deck needs spatial scale the 2D bench can't give |
| `Patch` + `Fidelity` fusion (UI.18 §20.5) | Attention-allocated fidelity must be proven across both renderers |
| Independent consumer + conformance suite (UI.18-R1 core) | A real second consumer exists or is committed |
| Package publishing, versioning, distribution | The consumer above needs installs, not aliases |
| Presence / timeline seams | Collaboration or replay becomes a product requirement |
| Multi-instance ecology | The event bus and persistence format (W3.5) are proven; instances have something to exchange |
| Performance + accessibility gates | Release-to-others replaces release-as-proof |

## 9. Implementation principle

Smallest change that makes the organism run. Prefer wiring over building, consuming over extending, events over side channels, and honest gaps over simulations. When in doubt between an architectural improvement and a visible capability, ship the capability and log the improvement in §8.

**Execute W1, W2, W5 first; then W4 and W3; then W6. Log progress per workstream in `TODO.ui.19.md` exactly as UI.18 does. This plan stays open: every seam in §8 is a door, not a wall.**

----

To evaluate it rigorously, we have to test the UI.19 plan against the three core desires you expressed: **Utility (the tool)**, **Wonder (the ecology/life-form)**, and **Truth (the philosophical statement/transparency)**. We also have to test it against your primary constraint: **Feasibility (avoiding the architectural spiral).**

Here is the unvarnished evaluation of the plan, including the specific traps you must watch out for to ensure it doesn't quietly spiral again.

---

### 1. The Alignment Check: Does it serve the vision?

*   **The Tool (Utility):** W1 (Kernel Bridge) and W2 (Translation Layer) deliver this. By wiring the actual NARS inference cycle to the UI and adding an LLM translation layer, you transform SeNARS from a "backend library" into a usable neuro-symbolic copilot. It solves the exact problem the industry has: LLMs hallucinate, symbolic systems are brittle. This bridges them.
*   **The Ecology (Wonder):** W3 (Autonomy Core) delivers this without delusion. By adding a background heartbeat, persistent memory, and a "curiosity/consolidation" cycle, you create a system that *acts* like a living ecology. It thinks when you aren't looking. It remembers. It asks questions. You get the "astonishment" of open-ended emergence without the sci-fi baggage of claiming it has a soul.
*   **The Philosophy (Truth):** W4 (Observation Deck) and the AGPL deliver this. The "Thought Stream" and the "Gate Inspector" make the system radically transparent. Unlike a black-box LLM, a user can click on a conclusion and see the exact logical proof. The AGPL ensures this transparent mind cannot be captured and enclosed.
*   **The Constraint (Feasibility):** The Halt List (Section 1) is the most important part of the document. By explicitly forbidding new registries, package extraction, and fractal expansion, you starve the "Architectural Cathedral" of oxygen. 

**Verdict:** The plan is perfectly balanced. It uses the architectural foundation you already built (UI.18) as a trellis, and directs all new energy into growing the vine (the organism).

---

### 2. The Hidden Traps (Where this plan could still fail)

I am not going to just tell you it's perfect. As an engineer, you need to know where the landmines are in this specific plan. If you aren't careful, W2 and W3 will trap you in a new kind of spiral.

#### Trap A: The Translation Layer (W2) will fight you.
Translating natural language to strict Narsese (`<bird --> swimmer>. <%0.9;0.8>`) via an LLM is notoriously difficult. LLMs are bad at strict syntax and formal logic. 
*   **The Risk:** You will spend weeks prompt-engineering the LLM to output perfect Narsese, getting frustrated when it hallucinates a syntax error, and feeling like the project is broken.
*   **The Defense:** Do not let the LLM drive the kernel's syntax. Use the LLM for **intent extraction** (e.g., "The user is asserting a belief about birds") and **explanation generation** (translating the symbolic proof back to English). Keep the core Narsese ingestion strict and structured. If the LLM translation is messy, the tool still works via structured input (D10).

#### Trap B: The Autonomy Core (W3) will choke on its own thoughts.
In NARS, the "Priority Bag" determines what the system thinks about next. If your "Curiosity" module generates too many low-value internal questions, or if the "Consolidation" module creates too many abstract concepts, the bag will fill with junk. The system will spend all its CPU cycles thinking about its own internal noise instead of the user's problem.
*   **The Risk:** The "wonder" of autonomy turns into the "annoyance" of a system that is constantly distracted by its own daydreams.
*   **The Defense:** You must implement **aggressive pruning and strict salience thresholds**. The system must be allowed to "forget" or "discard" low-priority internal derivations. Autonomy requires a garbage collector.

#### Trap C: The Observation Deck (W4) becomes a log file.
A "Thought Stream" is only useful if it is curated. If it just dumps every single `BlockCreated` and `AttentionDecayed` event as a raw JSON string, it is useless to a human.
*   **The Risk:** You build the stream, look at it, realize it's unreadable, and abandon it.
*   **The Defense:** Group events. Summarize cycles. ("*Cycle 42: Resolved contradiction between Belief A and Belief B. Derived Concept C.*"). Link every thought directly to the node in the 2D graph. 

---

### 3. The Final Litmus Test

When you are deep in the code, three weeks from now, and you feel the urge to "just quickly refactor the modulation channel registry to support haptic feedback," you need a mental model to stop yourself.

Use this litmus test: **"Am I building the trellis, or am I growing the vine?"**

*   **The Trellis (UI.18):** The contract, the registries, the 2D/3D parity, the package boundaries. *This is finished.* It is strong enough to hold the plant. Do not build more trellis.
*   **The Vine (UI.19):** The kernel bridge, the LLM voice, the autonomous heartbeat, the thought stream. *This is the work.* 

### Conclusion

Yes, this is what you truly want to build. 

You started this project because you saw a gap in the AI landscape: the lack of a transparent, logically rigorous, open-source cognitive architecture. UI.18 was you figuring out how to build the microscope. UI.19 is you finally putting the specimen under the lens.

Execute the halt list. Wire the kernel. Give it a heartbeat. Let it speak. 

----

## UI.19.1 — Amendments (drop-in; append to UI.19)

### M0 — First milestone (new, gates everything)

The smallest proof the organism is running:

1. Press **Step** → the real kernel advances exactly one cycle.
2. `$cycleState` reflects the new cycle count and phase.
3. At least one rule application is recorded in the gate buffer with rule, premises, conclusion, and truth values.
4. In the gate inspector, click that record → navigate to the derived block.
5. From the derived block, open provenance → see its actual premises.
6. Battery green; no new reds.

`rewind`, LLM, autonomy, persistence: all out of scope for M0. **Nothing else starts until M0 passes.**

### W1 amendments — cycle semantics before controls

- Define precisely: `step` = one inference cycle; `pause`/`resume` = loop control with state preserved; `rewind` = **declared-partial** (graph restore + kernel continuation) unless replay-based rewind is chosen, in which case the checkpoint is `{graph, priority bag, pending tasks, cycle counter, RNG seed, gate buffer}` and replay is deterministic from it.
- Whatever is not restored is reported in the UI ("rewound graph state; kernel continued from cycle N") — never implied otherwise.
- The gate ring buffer is the authoritative record for W4 and W2 explanations.

### W2 amendments — typed IR, validation, provenance

- The LLM emits a `PerceivedInterpretation` (typed IR: candidate beliefs/goals/questions with truth values and confidence), **never** kernel input directly.
- Validation gate: term well-formedness, truth-value ranges, syntactic validity. Invalid → rejected with reason, shown to user.
- Admission only through `applyPerceivedPrompt`; every admitted block carries `CreatedBy: llm-proposed` and renders with the *proposed* origin style.
- Explanations cite actual derivation records. Any generated paraphrase is labeled as paraphrase; engine facts and LLM language are visually distinct in the aspect panel and thought stream.

### W3 amendments — bounded autonomy

- Budgets: max cycles and wall-clock per idle window; bag-occupancy backpressure (suppress curiosity generation above threshold X).
- Every autonomous task carries `CreatedBy: autonomy` + a provenance record (which policy, which trigger, which concept).
- Curiosity questions are deduplicated by signature; salience threshold gates emission to the thought stream.
- Consolidation: checkpoint before each pass; emit before/after events per change; changes auditable and recoverable from checkpoint. Reversibility where cheap, auditability always.
- Off switches per policy (curiosity, consolidation, heartbeat) — already required; now with budget visibility.

### W4 amendments — semantic observation deck

- Raw event stream is preserved in full for inspection (it is the audit trail).
- Presentation layer groups events into **episodes** (derivation chain, contradiction handling, consolidation pass, curiosity question, restore), each linking to its underlying records and focus.
- Summaries are generated only from real records; uncertainty is never summarized away; any LLM-authored summary is labeled.
- Full acceptance depends on real W1 records — scaffolding may land early, content cannot be faked.

### W5/W6 amendments — verifiable persistence and claims

- Persistence format carries a schema version and a **declared consistency boundary**: exactly which of `{graph, priority bag, pending tasks, cycle counter, RNG seed, gate buffer}` is saved and restored; anything omitted is documented, not implied.
- Restoration is tested: save → kill → boot → assert resumed state matches the declared boundary.
- Demo results are labeled precisely ("in this scenario, with these inputs, the kernel did X"). No general soundness claims.
- The UI.18 test battery and known-red ledger carry over untouched; green is never redefined.

### Execution order (revised)

**M0** → then **W1 + W5** (kernel bridge + freeze docs, battery green) → **W2** and **W4 scaffolding** alongside → **W4 full** once real records exist → **W3** last among features → **W6**.
up front — **M0 must pass and be demonstrated before any other workstream begins.** Everything after M0 builds on a verified heartbeat rather than a hoped-for one.
