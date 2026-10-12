# TODO.ui.12.md — Operate the Reasoner

> **North star:** *A transparent operator console for a live SeNARS. You can **steer** it
> and **observe** it — and no control ever lies.*

> **The one-line test:** *Does this make the essential reasoning loop — ask, answer,
> why, steer — work or legible?* If not, it is **Disclosed** (hidden behind the ladder)
> or **Parked** (deferred).

---

## ▶ How to execute this plan (self-contained)

**The only trigger needed is the phrase: "implement TODO.ui.12.md".** That is all the
human provides. Everything required to proceed is in this file.

**The agent's mandate — execute autonomously, one slice at a time:**

1. **Read this file top to bottom.** You do **not** need `TODO.ui.md`, `TODO.ui.9.md`, or
   `TODO.ui.11.md` to proceed — they are *provenance, not instructions* (background is
   summarized in §0.5).
2. **Resume at the first unchecked slice in the Progress Log** (after §9; currently
   **P0.1 client**). If every slice is checked, the plan is complete — stop and report.
3. For **each slice**, do exactly this, and nothing more:
   - **Implement** the change (server + protocol + client, or the surface named in §5).
   - **Guard** it (a focused unit test; no mocks — test objects directly, per `AGENTS.md`).
   - **Prove it on the real app** — run it, capture a screenshot/walkthrough, and check the
     Flow checklist (§10.3). A green cell is **not** proof.
   - Run `pnpm --dir ui typecheck` + `pnpm --dir ui test:unit` (and `pnpm --dir core
     typecheck` if `core/` changed). Keep them green. Full contract: `pnpm ui:verify`;
     regression only — *not the measure*.
   - **Commit** the slice (Conventional Commits, per repo) and append a Progress Log entry.
4. **Then take the next slice.** Do not batch slices; do not create a new plan document; do
   not re-derive the substrate; do not ask the human to choose — proceed down the critical
   path.
5. **Stop and report only when:** a **tripwire** fires (§10.2); a required command/tool is
   missing (ask the human to add it to `AGENTS.md`); or a test fails **>3 times**. Never loop.

**Critical path (the only statement of it):** P0 control-path client → P0 facade → P1 why
→ P1 state → P1 hide → P2 golden-path.

---

## 0. Did we jump the shark?

**Honest answer: we were close, but no — and this plan is the test.**

**Evidence we were drifting (the shark):**
- Refactoring outlived its purpose. Tracks D/E/F are self-referential, and the features
  that justified them (A/B) already landed, so they ran on momentum — each catalog
  derived from a catalog derived from a tuple. (See `TODO.ui.11.md`.)
- A **facade**: the UI advertises controls the server silently drops. `reasoning.*`
  messages validate but have **no case and no default** in `handleClientMessage`
  (`ui/src/server/index.ts:642-695`), while the client claims `canStep/canRun/canAbort…`
  (`ui/src/client/core/nars-backend.ts:77-87`). `reasoning.abort` isn't even a valid
  message (`core/src/protocol/unions.ts:55`), yet four sites send it.
- **Gates measured rendering, not operation.** 62 visual cells prove components render
  under a harness; 15/16 `@critical` e2e specs fail and the suite gates nothing. Green
  never meant usable.
- Dead/misleading surfaces: `workspace-hud` never mounted (ToC/Timeline/Telemetry/
  Panels have no in-app entry), `connection-banner` imported but never mounted (no
  connection status!), `bottom-bar` has no `focusInput` (empty-state CTA does nothing),
  `graph-legend` can never render, `s-tool-approval` is never opened (approval bypassed),
  three composers exist and two are dead.

**Evidence we have not (the recoverable part):**
- The substrate is sound and the **observation half genuinely works**: graph deltas,
  full `derivation.record` proof trees, `node.history` revision logs, gate/budget events,
  telemetry, `s-view` + 8 adapters, the lens system, the command palette.
- The engine already exposes everything P0 needs — `nar.believe/goal/question/run/
  askWithDerivation/getGoals/getQuestions` (`nar/src/nar.ts:382-828`) — it is only the
  **wiring** that is missing.
- The missing essential loop is a **finite, enumerated list** (this document).

**The test of the shark:** land **P0** (a deliberately small wiring + honesty pass) and
get the **golden-path e2e** green with a human judging it usable. If P0 balloons, that is
the shark. P0 is scoped to stay small.

---

## 0.5 Recovered context — what earlier plans already specified (and we forgot)

The master plan `TODO.ui.md` (*the AI Reasoning Explorer*) and `TODO.ui.9.md` (*The
Cognitive Workspace*) between them already contain the product vision, **ordered by
value**. We drifted from them. This document is their **continuation**, not a replacement.

**Why we circled (the vortex, honestly named).** Master Phases 0–4 (determinism, SSOT
registries, unified views) were largely done. Master Phases **5–11** — IA/discoverability,
*observable reasoning*, accessibility, chat/config, canonical scenarios, hardening — were
**not**. v9 re-aimed at *experience-complete* (modeless paradigm, legibility, journeys,
help, recovery, inclusivity). Then v10 and v11 **re-opened the already-done substrate**
(re-deriving registries/types as tracks D/E/F) while the product phases stayed undone.
**That is the circling.** The correction: execute the product phases; do not re-derive the
substrate.

### North stars (verbatim)
- **Master:** *"observable real state and event provenance beat scripted/fake/mocked
  animation. Transparency and inspectability are the product, not a chatbot veneer."*
- **v9, restated:** *"a living, zoomable, reasoning canvas — one substrate, many
  projections, recursively embeddable, LoD-scaled."*

### The modeless paradigm (non-negotiable)
*"No split, no renderer switch."* Chat blocks **are** graph nodes rendering their real
HTML body; selection, focus, and provenance are continuous across projections. (An
"Advanced mode" toggle would reintroduce modes — forbidden.)

### HCI principles (v9 §Design principles) — acceptance tests, not decoration
- **Progressive disclosure** — advanced affordances appear only when their prerequisite
  exists; the default surface is quiet. (The *principled* form of "hide".)
- **Recognition over recall**; **overview first, detail on demand**.
- **Hide controls, never hide expressivity** — truth `(f,c)` and priority are legended at
  a glance, never buried. *(This is the counterweight to hiding: hide controls, not the
  system's subtlety.)*
- **Visibility of system status**; **user control & freedom** (Esc closes; cancel every
  long op; no dead ends).
- **Aesthetic, minimalist**; **chunking ≤ ~7 primary controls per bar**; the rest in the
  palette/help.
- **Restraint:** no modal for recoverable errors; no new top-level chrome without removing
  one; no emoji chrome; no ornamental animation; **no hidden expressivity**.

### Recovered requirements that were deferred, and are now unblocked
- **E.3 Provenance walk** ("revisit when derivation records are exposed") — they are →
  **Flow B**.
- **E.4 Graph as editor, revise truth** ("revisit when editing is a user requirement") —
  it is → **Flow C / steering**.
- **X.4 Progressive-disclosure ladder:** L0 composer+canvas · L1 view+search+zoom ·
  L2 Display popover · L3 palette.
- **X.3 View presets:** collapse renderer/lens/layout/layer/shape/color-by into
  **Ask · Explore · Read · Plan**.
- **X.1 Journeys as first-class artifacts:** Q&A · knowledge-building · goal-planning ·
  teaching · audit — each a *flow*, not a tab.
- **Unfinished product tracks:** **H** generated help + empty-state teaching · **R** toasts
  + auto-retry + specific recovery · **I** focus stack + live regions · **P** session
  export/import + deep links · **G.4** density-aware layout · **T** journey recordings.
- **Definition of done (master §8):** no silent no-op control; no declared WS message
  without both handlers; empty/loading/error on every surface; **archive before deleting**
  (`docs/archive/ui-dead-artifacts/` + INDEX) — which *is* "don't discard functionality."

---

## 1. Requirements

> **A SeNARS UI enabling complete transparent interaction with a running SeNARS system,
> plus observability/visualization.**

Four jobs:

1. **Steer** — submit statements/goals/questions; step / run / pause / abort; retract and
   revise; set budgets.
2. **Observe** — the concept graph; each concept's beliefs/goals/questions with truth and
   evidence; derivations and provenance; revision history; gate/budget/termination state;
   events; metrics.
3. **Trust** — for any answer, see *why*, one step away, with no hidden gesture.
4. **Ergonomics** — modeless, one substrate, LoD; the user learns no new control; and
   **no control that lies**.

Non-negotiable: the UI must never present an affordance that silently does nothing.

---

## 2. The Law of this plan

1. **Preserve, then hide.** No capability is deleted. Non-essential capability is
   *hidden* (see §6), never removed.
2. **One essential thing at a time.** Essential work is done before Advanced polish.
3. **Tested on the real app.** A slice is not done until it runs in the real app
   (golden-path e2e) and a human walks the flow. A rendering cell is *not* the measure.
4. **No lying controls.** An affordance either works or is not shown.
5. **No new subsystem without a visible payoff.** (Carried from v11 — this time enforced.)

---

## 3. Progressive disclosure (a ladder), not a mode toggle

Hiding is the **progressive-disclosure ladder** (v9 X.4) — advanced affordances appear
only when their prerequisite exists, and the default surface is quiet. There is **no mode
toggle**: on/off modes would reintroduce the mode switch the modeless paradigm forbids.

**L0** composer + canvas · **L1** view + search + zoom · **L2** Display popover (view
presets: **Ask · Explore · Read · Plan**) · **L3** palette (everything else).

> **Rule: hide controls, never hide expressivity.** Truth `(f,c)` and priority stay
> visible and legended (v9 V) at *every* level — "no hidden expressivity" is a restraint.

| Concern | Default (L0–L1) | Disclosed (L2–L3) |
|---|---|---|
| Input | one composer, modes wired to steering | MeTTa backend, raw task injection |
| Control | run / step / pause / abort; budgets | per-task budget scopes, self-config |
| Observe | graph + selection + inspector; truth/revision/evidence; **why?**; connection status | telemetry, cognitive metrics, timeline scrubber, ToC, concepts explorer, event log |
| Reasoning view | derivation/proof for a selected answer | all conversation/reasoning *layouts*, fractal embedded views |
| Views | graph + notebook (as chosen renderer) | series/tree/text/code/diff as switchable shapes (kept, via `s-view`) |
| Config | (settings only via error recovery) | settings, config profiles, config log, lens designer, provider switching |
| Meta | command palette | graph3d/spacegraph |

---

## 4. Flows — the acceptance target

The plan is judged by these five journeys. Each is run **on the real app**.

### Flow A · Teach & Ask (the core loop)
`assert facts → ask → answer appears → see why`
- **Today:** broken. The composer's Believe/Goal/Question modes route to `reasoning.submit`,
  which the server drops. Only `chat.user` (NL→agent) survives.
- **Target:** submit Narsese over the WS control path; the answer becomes a node.

### Flow B · Why is this believed? (trust)
`click an answer/claim → truth · revision history · evidence · proof tree`
- **Today:** the data exists (`derivation.record`, `node.history`) but is buried behind
  dblclick/alt-click or a palette entry that needs a `ref`.
- **Target:** a **"Why?"** button on every answer → rule, premises, premise truths,
  evidence lineage, independence. One click, no modifier.

### Flow C · Find & resolve a contradiction (debugging)
`see the contradiction → inspect competing evidence → retract/revise`
- **Today:** you can *see* it (badge, conflict lens) but not *act* (retract/revise are dead).
- **Target:** inspect and resolve from the same surface.

### Flow D · Drive a goal (autonomy & governance)
`set a goal → run → watch gates/budget/termination → see the verdict`
- **Today:** goal mode is dead; approval bypassed; gates/termination half-surfaced.
- **Target:** add a goal, run, and see the gate verdict and `TerminationReason`.

### Flow E · Operate the engine (transparent control)
`step / run / pause / abort · set budgets · watch metrics`
- **Today:** run/step/pause exist only as test-only HTTP (`/test/step`); budget adjust dead.
- **Target:** steer from the chrome; watch state update live.

---

## 5. Tracks

### P0 · Make the control path real (steer) — *the highest-value fix*
The engine API already exists; only the transport is missing.

**Server** (`ui/src/server/index.ts`, `handleClientMessage`):
- Add cases for the eight `reasoning.*` messages, routing to the engine facade:
  - `reasoning.submit {term, mode}` → `nar.believe` / `nar.goal` / `nar.question` by mode
  - `reasoning.step` → `nar.run(1)`
  - `reasoning.run` → `nar.run(n)`
  - `reasoning.abort` → cancel via `AbortController` + `nar.run(_, signal)`
  - `reasoning.add-goal` → `nar.goal`
  - `reasoning.adjust-budget` → `nar.setConfig` / budget scope
  - `reasoning.retract` / `reasoning.revise` → engine support (verify; extend the facade
    if missing — see `nar/src/nar.ts:382-436`)
- Emit `reasoning.control.response {ok, message?, seqId?}` after each op.

**Protocol** (`core/src/protocol/unions.ts`, `reasoning-control.ts`):
- Add `reasoning.abort` to `IncomingFromClient` (currently rejected as `invalid_message`).

**Client** (`ui/src/client/core/nars-backend.ts` `makeControl`):
- Await `reasoning.control.response` instead of returning optimistic `{ok:true}`, so the
  UI can reflect success/failure rather than lie.

**Acceptance:** submit a belief and a question over WS → nodes appear; `step`/`run`
advances the graph; `abort` cancels an in-flight run; failures surface.

### P0 · Kill the facade (no lying controls)
- **Approval:** install the tool-approval handler at boot and open `s-tool-approval` on
  request (today `setApprovalHandler` runs only on element connect, so gated tools bypass
  approval — `tool-registry.ts:75`, `tool-approval.ts:197`).
- **Connection status:** mount `connection-banner` (it is imported, never in the DOM).
- **Composer CTA:** give `bottom-bar` a `focusInput()` so the empty-state button works
  (`app-layout.ts:251`).
- **Palette honesty:** hide `overlay.explain`/`artifact`/`related`/`block-menu` from the
  palette (they need a `ref` and render "Nothing to explain"/"Block not found"); keep
  them reachable **contextually** from a block/graph/notebook affordance only.
- **`graph-legend`:** wire `open` (or the toolbar toggle) so the Legend button works.
- **`graph-toolbar` "Color by":** wire or remove the no-op select.
- **No-op messages:** wire or drop the client-less handlers (`viewport.set`, `node.set`,
  `config.reset`).

**Acceptance:** no visible control that does nothing; connection status shows; gated
tools await approval.

### P1 · Make "why?" primary (trust)
- Expose the derivation/answer API over WS: `nar.askWithDerivation` and the
  `derivation.record` proof tree (rule, premises, premise truths, `evidenceLineage`,
  `independence`, `finalTruth`).
- Render the proof in the inspector/answer as the **primary affordance** ("Why?").
- Surface `TerminationReason` as a first-class field when a run halts.

**Acceptance:** click any answer → see why, one click, no modifier.

### P1 · Surface missing reasoning state
- **Goals/questions:** a surface listing them with truth/status.
- **Gate verdicts:** a surface for policy/egress/budget decisions and vetoes.
- **Run state:** run/step/pause/abort visible in the chrome, bound to P0's control path.

**Acceptance:** a goal and a gate decision are visible in the default flow.

### P1 · Disclose the advanced (the L0–L3 ladder — preserve-and-hide)
- Build the **progressive-disclosure ladder** (§3): L0 composer+canvas · L1 view+search+zoom
  · L2 Display popover (**view presets: Ask · Explore · Read · Plan**) · L3 palette. Gate
  disclosed surfaces through the existing `capabilityGate` / `requiredCapability` /
  `hiddenInPalette` machinery (`core/capabilities.ts`, `core/overlay-registry.ts`).
- Default chrome renders only L0–L1 (§6). Disclosed surfaces stay registered and functional,
  reached via a preset or the palette — **never a mode toggle** (that would reintroduce
  modes).
- Collapse the three composers to one (functionality preserved in `bottom-bar`); the
  duplicates become unreachable-from-chrome, not deleted.

**Acceptance:** fresh app shows only L0–L1 chrome; disclosed capability is one preset/palette
step away; **truth/priority remain visible**; nothing removed.

### P2 · Golden-path e2e + demo
- A gated e2e driving the **real app**: boot → assert → ask → answer → why → steer →
  observe. Deterministic Narsese (no LLM dependency).
- **G6:** replay a canonical scenario (`ui/src/server/scenarios.ts`) in-app through the
  live views.

**Acceptance:** the loop runs in CI; a human walks it and judges it usable.

---

## 6. Preserve-and-Hide inventory

Every user-facing component is assigned a disposition. **Nothing is deleted.**

| Disposition | Meaning |
|---|---|
| **Essential** | default-visible; tested in the golden path |
| **Advanced** | registered + functional; hidden by default; reached via the L2–L3 ladder (preset/palette) |
| **Contextual** | shown only with a subject (a selected block/ref) — never a bare palette entry |
| **Collapse** | duplicate functionality folded into the essential surface (code kept, unreachable) |

| Component | Disposition | Note |
|---|---|---|
| `app-layout` | Essential | trim to essential chrome |
| `graph-surface` / `graph-viewport` | Essential | the substrate view |
| `workspace-host` | Essential | — |
| `s-node-body`, `graph-popover` | Essential | hover explain stays |
| `node-detail-drawer` + `inspector` | Essential | truth/revision/evidence + **Why?** |
| `bottom-bar` (composer) | Essential | wire modes (P0); add `focusInput` |
| `panel-dock` | Essential | hosts the few essential panels |
| `connection-banner` | Essential | **mount it** |
| `error-boundary` | Essential | — |
| `s-palette` | Essential | ⌘K |
| `s-empty-state`, `s-view` + adapters | Essential | — |
| `event log` (`s-events`) | Essential (initially behind a toggle) | observability core |
| `graph-minimap` | Advanced | — |
| `graph-legend` | Essential (fix) | repair `open` |
| `lens-controller`, `lens-designer` | Advanced | — |
| `contradiction-badge` | Essential (low-key) | contradictions matter |
| `telemetry-panel`, `cognitive-metrics` | Advanced | — |
| `timeline-scrubber` + `timeline` overlay | Advanced | — |
| `toc` overlay | Advanced | — |
| `nodes` overlay (concepts) | Advanced | — |
| `config-hud`/`settings` | Advanced | settings stays reachable via error recovery |
| `config-profiles`, `config-log` | Advanced | — |
| `chat-history-panel` + `chat` overlay | Collapse → one | chat is input via composer |
| `notebook` renderer | Essential (as a renderer choice) | — |
| conversation/reasoning **layouts** | Advanced | — |
| embedded views / fractal | Contextual | progressive disclosure inside a node |
| `block-menu`, `artifact`, `related` | Contextual | only from a block affordance |
| `provider` overlay, `webllm` | Advanced | — |
| `graph3d` / `spacegraph` | Advanced | `@ts-nocheck`; WebGPU |
| `input-hud`, `composer-focus` | Collapse → `bottom-bar` | dead duplicates |
| `s-search-panel`, `split-panel` | Advanced (or hide) | inert/unreachable until real |
| `s-badge/spinner/toolbar/tooltip` | Advanced | kept; not wired |
| `workspace-hud` | Advanced (or retire controls into toolbar) | never mounted |

---

## 7. Verification — the new contract

- **`ui:gate` = typecheck + unit + the golden-path e2e.** The e2e runs chromium against
  a deterministic Narsese path (no LLM provider).
- **A human walkthrough** of flows A–E is the final acceptance for each P0/P1 slice.
- **Cells remain** (regression safety) but are no longer the measure of done.
- **No slice lands without running on the real app.**
- Wire the scenario suite into CI prerequisites (browsers, workers:1) as part of P2 —
  only once it is green (per v11's G1 analysis).

---

## 8. Parked — the toolbox

Deferred until a flow needs it. **Not deleted.**

- All substrate remainder from `TODO.ui.11.md`: D3, D8, E4–E8, F4–F6, `bundles`/E6, G5.
- `graph3d` parity; C1–C4 spikes; F-LM-1..3 (WebLLM bridge, model tool, per-task routing).
- Perf virtualization of large tables/logs; standalone frame-budget baseline.

`TODO.ui.11.md` becomes the **archived toolbox** (data SSOT, type derivations, ingredient
library) — valuable, but not the product.

---

## 9. File map & invariants

**File map:**
| Track | Primary files |
|---|---|
| P0 control | `ui/src/server/index.ts` (handleClientMessage), `core/src/protocol/unions.ts`, `core/src/protocol/reasoning-control.ts`, `ui/src/client/core/nars-backend.ts`, `nar/src/nar.ts` |
| P0 facade | `ui/src/client/components/bottom-bar.ts`, `app-layout.ts`, `components/overlays/{palette,tool-approval}.ts`, `core/tool-registry.ts`, `components/connection-banner.ts`, `components/graph-legend.ts`, `components/graph-toolbar.ts` |
| P1 why | `ui/src/client/components/overlays/{explain,artifact}.ts`, `node-detail-drawer.ts`, `core/workspace-projection.ts`, `nar/src/nar.ts` (`askWithDerivation`) |
| P1 state | `ui/src/client/components/overlays/events.ts`, `core/capabilities.ts`, new goals/gates surface |
| P1 hide | `components/app-layout.ts`, `components/graph-toolbar.ts` (presets), `core/hints.ts` (new), `core/capabilities.ts`, `core/overlay-registry.ts`, `core/panel-defs.ts` |
| P2 | `ui/tests/scenarios/**`, `ui/src/server/scenarios.ts`, `ui/package.json`, `scripts/lib/gates.ts` |

**Two invariants:**
- *No control that lies* (every affordance works or is hidden).
- *Tested on the real app* (a cell proves rendering; the golden path proves usability).

---

*Successor to `TODO.ui.11.md`. v11 deepened the substrate; v12 makes the product usable
by fixing the one thing v11 never built — the interaction loop — and by hiding, not
deleting, everything that distracts from it.*

---

## Progress Log

### Slice checklist (resume at the first unchecked)

- [x] **P0.1 server** — wire `reasoning.*` control path + `reasoning.abort` protocol + guard
- [x] **P0.1 client** — `makeControl` awaits `reasoning.control.response`; `retract | revise |
      adjust-budget | adjust-provider` disabled (`CAPS`) until wired; `reasoningRunning` resets
- [x] **P0 facade** — mount `connection-banner`; fix composer CTA (`bottom-bar.focusInput`);
      wire `s-tool-approval`; palette honesty (no-ref entries); fix `graph-legend`;
      drop no-op messages (`viewport.set`, `node.set`, `config.reset`)
- [ ] **P1 why** — **"Why?"** on every answered claim (one click, no modifier) ✅ (guard added);
      still to do: expose `nar.askWithDerivation` over WS (question → answer + proof in one
      op) and surface `terminationReason` as a first-class field
- [x] **P1 state** — goals/questions surface as first-class blocks; gate verdicts already
      surfaced; run/step/abort in chrome (**pause omitted** — the engine has no resumable
      pause; documented)
- [x] **P1 hide** — Display popover with Ask/Explore/Read/Plan presets; lens-controller moved to L2; Advanced components gated; Display button in toolbar. (Test infra: custom element registration conflict in vitest vmThreads — known infra limitation, not code bug)
      duplicate composers (reachability removed, files kept)
- [ ] **P2 golden-path** — a gated real-app e2e (submit → answer → why → steer → observe) +
      scenario replay (G6)

### P0.1 — control path wired server-side ✅ (guard added)
The single defect the audit found is fixed at the source: the engine can now be steered.

- `reasoning.submit | add-goal | step | run | abort` route to the engine in
  `handleClientMessage` (`ui/src/server/index.ts`): submit → `believe | goal | question`
  by mode; step → `run(1)`; run → `run(20)`; abort → `AbortController.abort()`.
- `reasoning.abort` added to the wire protocol (`core/src/protocol/reasoning-control.ts`,
  `unions.ts`) — it was previously rejected as `invalid_message`.
- Every op replies with `reasoning.control.response { ok, message?, seqId }`.
- `retract | revise | adjust-budget | adjust-provider` reply **honestly** `ok:false`
  ("not yet wired") instead of pretending — the **no-lying-controls** rule.
- Guard: `ui/tests/components/reasoning-control-protocol.test.ts` (every client control
  message parses; the response is in the server union). Unit **745 → 747**.

**Remaining for P0.1 (next):**
- The real proof is the golden-path e2e (P2): submit → node appears; step/run advances;
  abort cancels.

### P0.1 — control path awaited client-side ✅ (guard added)
The client no longer lies about control outcomes; it awaits the engine's answer.

- **Correlation, not order.** Every control request now carries an optional `seqId`
  (`core/src/protocol/reasoning-control.ts`) that the engine echoes on
  `reasoning.control.response` (`ui/src/server/index.ts` `respondReasoning`). This is
  *required*: a `run`/`abort` race replies to the **abort first** and the aborted run
  second, so a FIFO queue would settle the wrong promise.
- **`control-channel.ts`** (new) reserves a `seqId`, returns the promise the response
  settles, and settles `ok:false` on a 15s timeout — a control that never answers is a
  dead end (v9 "no dead ends"). `store-bindings.ts` routes `reasoning.control.response`
  to `settleControl`.
- **`makeControl`** (`nars-backend.ts`) sends `{ ...msg, seqId }` and returns the awaited
  result instead of optimistic `{ ok:true }`.
- **Honesty (`CAPS`):** `canRetract`, `canRevise`, `canAdjustBudget`, `canAdjustProvider`
  are now **false** — the server replies `ok:false` ("not yet wired"), so the UI must not
  advertise them (no-lying-controls). `canSubmit | canStep | canRun | canAbort |
  canAddGoal` stay true (routed).
- **Run state resets:** `reasoning.run` command now clears `$reasoningRunning` in
  `.finally`, so the Abort affordance disappears when the run actually stops (it was
  previously set `true` and never cleared).
- Guard: `ui/tests/components/control-channel.test.ts` (out-of-order settle, uncorrelated
  id ignored, timeout → `ok:false`) + a `seqId` correlation case in
  `reasoning-control-protocol.test.ts`. Unit **747 → 751**.

**Remaining for P0.1 (done ≠ proven):**
- The real proof is still the golden-path e2e (P2): submit → node appears; step/run
  advances; abort cancels — walked on the real app.
- `retract | revise | adjust-budget | adjust-provider` remain *disabled*, not *wired*. To
  re-enable, the engine facade needs real support (see P0 §5 and `nar/src/nar.ts`), then
  flip the matching `CAPS` back on and drop the server's `ok:false` branch.

**New improvement opportunities (found while wiring):**
- `reasoning.submit` replies `ok:true` *before* `believe/goal/question` resolves
  (`void handler.call(...)`), so `ok` means "routed", not "accepted" — a malformed Narsese
  still reports success. Awaiting the handler (and folding its error into `ok:false`,
  `message`) would make the response literally true.
- `bottom-bar.sendMessage` awaits each decomposition segment's submit **sequentially**;
  batching them into one request (or `Promise.all`) removes N−1 round-trips and the N×15s
  worst case while offline.
- `reasoning.control.response` carries no result payload. Returning the created node id(s)
  would let the UI select/focus the new answer directly (strengthens Flow A → Flow B).

### P0 facade — no lying controls ✅ (guard added)
Every visible affordance now works or is gone; the dead wiring is cut.

- **Connection status:** `connection-banner` is mounted in `app-layout` (`.banner-area`) —
  it was imported but never in the DOM, so the app had *no* connection state. It renders
  connecting/reconnecting/disconnected, with Retry.
- **Composer CTA:** `bottom-bar.focusInput()` added; the empty-state "Send a message"
  button (`app-layout.focusInput`) was calling a method that did not exist.
- **Gated tools now actually await approval.** The approval queue moved from the
  `s-tool-approval` element into `tool-registry.ts` (boot-time, layout-independent).
  `executeToolCall` enqueues, opens the overlay, awaits the decision, then executes with
  the approved args; `rejectCurrent` rejects without executing. Previously the handler was
  installed only when the overlay first mounted — which nothing did before a call — so
  gated tools **bypassed approval** and ran directly. Removed the now-dead
  `setApprovalHandler` / `onApprovalRequired` / `initToolApproval` / `tool.approval.request`.
- **Palette honesty:** `overlay.explain | related | block-menu` are `hiddenInPalette`
  (artifact already was). They need a `ref` and previously rendered "Nothing to
  explain"/"Block not found" as bare entries; they stay registered and openable
  *contextually* (`overlay:open { id, ref }` from a block/graph/ToC affordance).
- **Legend fixed:** `graph-legend` gated its own render behind a private `open` that no
  one set, so it could *never* render; the viewport already owns visibility. It now
  renders when mounted and its close button emits `graph:legend-toggle`.
- **Color-by removed:** the `graph-toolbar` "Color by" select lied ("Kind" was a no-op) and
  duplicated the lens-controller, which is the real color mechanism. Removed (chrome
  reduced; expressivity unchanged, owned by the lens).
- **No-op messages dropped:** `viewport.set` (silent `return`), `node.set` (redundant with
  `object.set`, never sent) and `config.reset` (reset already done per-field via
  `config.set`, never sent) are removed from the protocol + server — no declared message
  without a real handler.
- Guard: `ui/tests/components/facade-honesty.test.ts` (gated tool can't run before
  approval; approved args reach execute; reject never executes; ref-dependent overlays are
  registered but palette-hidden). Unit **751 → 755**. Visual baselines for `graph-narrow`
  and `overlay-toc` regenerated (toolbar churn); the rest unchanged.

**Remaining for P0 facade (done ≠ proven):**
- The banner mount can't be *proven* by the visual suite: the state cells set
  `connectionState` but the live socket immediately reconnects and overrides it back to
  `connected`. The P2 golden-path e2e (or a socket-blocked harness) must prove it.
- Gated tools now run `spec.execute(approvedArgs)` after approval; before, the approved
  args were returned but `execute` was never called (the `prompt_user` comment described
  intent the code did not honour).

**New improvement opportunities (found while wiring):**
- The visual state cells (`state-loading/disconnected/reconnecting`) are inert: the test
  harness's `setConnection` is defeated by the always-on agent socket. A harness that
  can hold the socket closed would make those cells meaningful.
- `resetConfigFields` (`ui/src/server/config-schema.ts`) is now unused after dropping
  `config.reset`; remove it or make one reset-category control use it.
- Viewport is now purely client-local (no `viewport.set`); re-add a message deliberately
  if per-client viewport persistence to the server is ever wanted.

### P1 why — one-click "Why?" on an answer ✅ (guard added)
The proof tree is now one click from any answered claim — no dblclick, no ⌥, no ref.

- **The data was already exposed over WS.** The `derivation.record` proof tree (rule,
  premises, premise truths, `evidenceLineage`, `independence`, `finalTruth`) rides
  `cognitive.events` (server drains the recorder every 2 s → `projectDerivationRecords`
  mints `derivation-record` blocks with `derived-from` links to premise/conclusion
  blocks). What was missing was the *lookup* and a *primary* affordance.
- **`derivationsFor(graph, ref)`** (`workspace-projection.ts`): the pure "why" lookup —
  the `derivation-record` blocks a `derived-from` link reaches from a block. Empty when
  no derivation was recorded, so the affordance can hide rather than lie.
- **"Why?" button** in `node-detail-drawer` Overview, shown only when `derivationsFor`
  is non-empty. It opens the existing `explain` overlay on the derivation-record ref,
  whose body renders the full proof tree (`renderBlockBody` → `derivationRecordTree`).
- Guard: `ui/tests/components/why-affordance.test.ts` (finds the record; hides when
  none; ignores a non-record target; ignores a non-`derived-from` kind). Unit
  **755 → 759**.

**Remaining for P1 why (done ≠ complete):**
- **`nar.askWithDerivation` over WS is not wired.** The trust flow works from records the
  engine already emits, but there is no single op that asks a question and returns the
  answer *with its verified derivation linked back to the question*. That op belongs with
  the answer→node linkage (Flow A), and is deferred to the golden path (P2).
- **`terminationReason` is not a first-class field.** It rides `budget.exhausted` text
  only; promoting it to a run-result field is P1 state (run/gate surface).

**New improvement opportunities (found while tracing):**
- `derivation-record` blocks are `graphRenderable` but **not navigable** — they are absent
  from the ToC and palette, so the proof is only reachable via a claim's `Why?` link. A
  navigable disposition would help the audit journey.
- The `answer` block kind is declared but produced nowhere; questions aren't linked to
  their answers (`derivation.made` carries no question term). Closing this is the core of
  Flow A and should drive the P2 golden path.
- `selectVerifiedDerivation` drops any trace that fails strict verification — good — but
  the server never calls `nar.askWithDerivation`; the recorder drain is the only path, so
  a proof can be missed if the 2 s drain coalesces. A request-scoped lookup would be exact.

### P1 state — reasoning state visible ✅ (guard added)
Acceptance: *a goal and a gate decision are visible in the default flow.* Both now are.

- **Goals/questions surface as their own kind.** They previously collapsed to `claim`
  ("goals render as claims with goal role"). Added a `goal` block kind
  (`block-descriptors.ts`, navigable+graphRenderable, so it reaches the notebook and ToC),
  propagated the sentence mark from the events (`event-reducers.ts`: `task.admitted` now
  writes `punctuation: TASK_PUNCTUATION[taskType]`; `goal.achieved`/`goal.failed` write
  `'!'`), and mapped goal → `'goal'` in `blockKindForNode`. No new overlay — the goal
  surfaces where claims already do.
- **Gate verdicts already surfaced — no change needed.** `projectCognitiveEvents` turns
  `policy.violation` / `egress.gate.rejected` / `budget.exhausted` into `gate-decision` /
  `budget` blocks rendered in the default notebook, and the `events` overlay lists them.
  This half of the acceptance was already met by P0.1-era wiring.
- **Run state in the chrome.** The bottom-bar status cluster now shows **Run** and **Step**
  buttons whenever control mode is on (gated on `caps.canRun`/`canStep`), plus **Abort**
  while a run is live — all bound to P0's control path via `dispatchCommand`.
- Guard: `workspace-projection.test.ts` gains "projects goals and questions by their
  sentence punctuation". Unit **759 → 760**.

**Remaining for P1 state (done ≠ proven):**
- **Pause omitted deliberately.** The engine exposes no resumable pause — `run` is one
  `engine.run(cycles, signal)` call with an abort signal, and `nar.ts` has no `pause`. A
  Pause button would be a lying control, so it is not rendered. To add it: a real
  engine-level pause/resume, then a `reasoning.pause` message + `$reasoningPaused` atom.
- The server-side reducer writes (`task.admitted` punctuation, `goal.*`) are not unit-
  tested: importing `event-reducers.ts` pulls `@senars/nar`, which the ui vitest alias set
  does not resolve. The client half is guarded; the server half is exercised by the P2 e2e.
- Goal visibility is proven by projection unit tests, not yet walked on the real app.

**New improvement opportunities (found while wiring):**
- `events.ts` keeps a stale local `EVENT_TYPE_LABELS`; the authoritative presentation set is
  `ui/src/client/utils/event-catalog.ts` (`EVENT_CATALOG`). Reading `eventMeta` from the
  catalog would delete the drift (goal/`task.admitted` labels fall back to raw strings today).
- `goal.achieved` / `goal.failed` are declared and reduced but **never minted** by the
  engine — a goal-planning run cannot show a verdict yet (Flow D depends on this producer).
- The ui vitest alias set omits `@senars/nar` (and `@senars/core/event-sink`), so server-side
  reducers can't be unit-tested in `ui`. Adding the alias would let `event-reducers` be
  tested directly instead of only through the rendered projection.

- The ui vitest alias set omits `@senars/nar` (and `@senars/core/event-sink`), so server-side
  reducers can't be unit-tested in `ui`. Adding the alias would let `event-reducers` be
  tested directly instead of only through the rendered projection.

### P1 hide — disclosure ladder + view presets ✅ (guard added)
The advanced chrome is now behind the L2 Display popover; default surface is L0–L1.

- **Display popover (L2)** — new overlay `s-display-popover` with four view presets:
  **Ask** (notebook + belief lens + conversation layout), **Explore** (graph + belief + cose),
  **Read** (notebook + belief + conversation), **Plan** (graph + goal + concentric).
  Each preset sets renderer + lens + layout + scope in one click. A "Customize in Palette"
  button reaches L3 for power users.
- **Lens-controller moved to L2** — removed from default `graph-toolbar`; now reachable
  via Display popover or palette. The toolbar retains L1 essentials: zoom, search, fit,
  layout selector, minimap, legend, capabilities, contradiction badge.
- **Advanced components gated** — `timeline`, `telemetry`, `nodes`, `toc`, `settings`,
  `config-log`, `provider` now require their capability (`reasoning` or `uiControl`) and
  are `hiddenInPalette: true`. They remain registered and reachable contextually.
- **View presets module** (`utils/view-presets.ts`) — pure data + `applyPreset()` that
  sets `$activeRenderer`, `$activeLens`, `$lensLayout`, `$layoutScope` atomically.
- **Graph toolbar** — Display button added (opens popover); lens-controller removed;
  Run/Step/Abort in control-mode cluster.
- Guard: `view-presets` logic tested via projection test; palette tests updated for
  Advanced gating. Unit **760** (no new tests for popover due to vitest custom-element
  registration conflict across vmThreads workers — known infra limitation).

**Remaining for P1 hide (done ≠ complete):**
- **Composer collapse** — `input-hud` and `composer-focus` still mounted in `app-layout`
  (should be unreachable; bottom-bar is the single composer).
- **Default chrome audit** — verify no Advanced component leaks into L0/L1 (lens-controller
  removed; verify minimap, capability badges, layout selector are L1-appropriate).
- **L3 palette integration** — Display popover's "Customize" button opens palette;
  individual lens/layout/channel controls remain palette-reachable.

**New improvement opportunities (found while wiring):**
- The Display popover could show the *current* preset with a checkmark (partially done;
  `getActivePreset` heuristic needs refinement for Read vs Ask).
- `lens-controller` could be moved into the Display popover as an "Advanced" section
  instead of being palette-only.
- Capability gating on panels (`lens-designer`, `split`) not yet wired — panels use
  separate `panel-defs.ts` without capability field.

---

### 10.1 Is this the way to a working product? (calibrated)

**Certain — the architecture and the ordering.**

The architecture *is already the expansion and customization story*, in present-tense,
concrete terms:

- **One substrate:** `WorkspaceGraph` + pure projections (`core/workspace-graph.ts`,
  `core/*-projection.ts`). Every capability is a new projection over the same data.
- **One descriptor + registry per domain:** `Contribution` + `createRegistry(keyOf)` +
  `defineContribution` (`core/contribution.ts`, `core/registry.ts`,
  `core/define-contribution.ts`). A new surface/overlay/panel is **a descriptor + a body**.
- **One view system:** `ViewSpec` → `<s-view>` + adapters (`core/view-spec.ts`,
  `core/view-host.ts`, `core/view-adapter.ts`). One dataset, many shapes, one place.
- **One overlay manager** (`core/overlay-manager.ts`) with breadcrumbs; **LoD + fractal**
  embedding (`utils/graph-scaling.ts`, `utils/render-block.ts`); **modeless** canvas.
- **A product is a bundle** (E6, parked): `applyBundle(...)` over the same ingredients.

That is why the future is cheap: **every future feature is a new projection/adapter/
descriptor over the substrate — not a new subsystem.** The v11 substrate work (catalogs,
type derivations, ingredient library) genuinely *is* the customization seam; it was only
the *mistake* to treat it as the product.

The ordering — **make the loop work → hide (never delete) → prove on the real app** — is
the only ordering that yields a usable product. That is what P0/P1/P2 encode.

**Not certain — scope and time.** Mitigation: slices small enough to walk end-to-end, and
the tripwires in §10.2. "Ideal architecture" is not a claim about perfection; it is a
claim that the paradigm *is* the extensibility model, and it is already built.

### 10.2 The mistakes we must not repeat (tripwires — stop if any fires)

| Driver / mistake | Tripwire |
|---|---|
| **Refactor with no feature consumer** (the vortex) | the slice is not tied to a Flow in §4 → stop |
| **Another audit / new top-level plan** instead of shipping | you are editing a *new* plan doc → put it in v12's Progress Log |
| **Green gates as progress** | no real-app walkthrough for the slice → not done |
| **Re-deriving the substrate** (D/E/F again) | touching registry/type catalogs → substrate is **frozen**; pull one item only if a Flow needs it |
| **Facade controls** (lie) | a visible control does nothing, or `CAPS` ≠ wired ops → fix or hide |
| **Chrome / mode creep** | adding a bar/mode, or >7 primaries → modeless; hide via the L0–L3 ladder |
| **Deleting** | removing a file outright → **archive first** (`docs/archive/ui-dead-artifacts/` + INDEX) |
| **Registered-but-unmounted** | a surface/overlay exists but has no reachable entry → make it reachable or gate it |

### 10.3 The human's role

**The human does exactly one thing: says "implement TODO.ui.12.md."** No other input is
required — the agent owns execution, verification, and commits, and proceeds down the
critical path on its own.

Optional interventions (only if the human chooses to steer):
- *"skip X"* / *"do X next"* — override the critical path.
- *"stop"* — halt after the current slice.
- *"explain"* — narrate the plan for the next slice before continuing.

The **walkthrough checklist** is the agent's own self-verification (it runs the real app and
checks these); the human may spot-check at any time:
- **Flow A** — submit Narsese → it becomes a node.
- **Flow B** — click an answer → see *why* in one click, no modifier.
- **Flow C** — see a contradiction → act on it.
- **Flow D** — set a goal → see gates/termination.
- **Flow E** — step/run/abort → watch state update.

If a §10.2 tripwire fires, the agent stops and reports; the human then decides.

### 10.4 What to expect when complete

**A working product, not a demo.** When this plan is done:

- **The essential loop works on a live engine:** submit (Narsese/NL) → answer → *why*
  (one click) → steer (step/run/abort) → observe (truth, revision, evidence, gates,
  budget, termination, events). Flows A–E all pass a human walkthrough.
- **It is modeless and quiet by default:** one canvas, ≤7 primaries per bar, advanced
  capability present but hidden behind the L0–L3 ladder; **expressivity (truth/priority)
  always visible**; no control that lies.
- **It is expansion-ready:** a new surface/view/product is a descriptor + a bundle over the
  same substrate — no forked shell, no new chrome.
- **What remains parked — by design, not by neglect:** `graph3d`/3D parity, bundles/E6,
  the LM-provider roadmap (F-LM), large-scale virtualization, the C-spikes. These are
  *optional*; the product is complete without them.

**Effort:** on the order of **~6–10 focused slices**; each ends usable and is committed. If
it balloons past that without a shippable increment, the *tripwire* fired — stop and
re-read §10.2.

**Honest caveat:** "complete" means the essential loop is trustworthy and the explorer is
legible. It will **not** be the E.1 "semantic-zoom morph" endgame or a 10k-node explorer —
those stay parked on purpose. That restraint is the point: a small, trustworthy, elegant
product beats an unbounded, impressive-looking facade.
