# TODO.ui.12.md — Operate the Reasoner

> **North star:** *A transparent operator console for a live SeNARS. You can **steer** it
> and **observe** it — and no control ever lies.*

> **The one-line test:** *Does this make the essential reasoning loop — ask, answer,
> why, steer — work or legible?* If not, it is Advanced (hidden) or Parked (deferred).

> **Reading order:** *Did we jump the shark?* → *Requirements* → *The Law* →
> *Flows (acceptance target)* → *Tracks P0–P2* → *Preserve-and-Hide inventory* →
> *Verification* → *Fresh-Session Handoff*.

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

### P1 · Hide the Advanced (preserve-and-hide)
- Introduce `$uiMode: 'simple' | 'advanced'` (a store atom; or a capability), and gate
  Advanced surfaces through the existing `capabilityGate` / `requiredCapability` /
  `hiddenInPalette` machinery (`core/capabilities.ts`, `core/overlay-registry.ts`).
- Default chrome renders only Essential (§3). Advanced surfaces stay registered and
  functional, disclosed via a palette "Advanced" group or a single toggle.
- Collapse the three composers to one (functionality preserved in `bottom-bar`); the
  duplicates become unreachable-from-chrome, not deleted.

**Acceptance:** fresh app shows only essential chrome; Advanced is one disclosure away;
nothing removed.

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
| **Advanced** | registered + functional; hidden by default; disclosed via toggle/palette group |
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

## 9. Fresh-Session Handoff

**Critical path:** P0 control path → P0 facade → P1 why → P1 state → P1 hide → P2 golden path.

**Commands** (from `ui/`):
```bash
pnpm typecheck && pnpm test:unit        # fast gate
pnpm test:visual                        # regression (not the measure)
pnpm test:scenarios                     # e2e (currently rotted — see P2)
```
Root: `pnpm ui:gate` · `pnpm ui:verify`.

**File map:**
| Track | Primary files |
|---|---|
| P0 control | `ui/src/server/index.ts` (handleClientMessage), `core/src/protocol/unions.ts`, `core/src/protocol/reasoning-control.ts`, `ui/src/client/core/nars-backend.ts`, `nar/src/nar.ts` |
| P0 facade | `ui/src/client/components/bottom-bar.ts`, `app-layout.ts`, `components/overlays/{palette,tool-approval}.ts`, `core/tool-registry.ts`, `components/connection-banner.ts`, `components/graph-legend.ts`, `components/graph-toolbar.ts` |
| P1 why | `ui/src/client/components/overlays/{explain,artifact}.ts`, `node-detail-drawer.ts`, `core/workspace-projection.ts`, `nar/src/nar.ts` (`askWithDerivation`) |
| P1 state | `ui/src/client/components/overlays/events.ts`, `core/capabilities.ts`, new goals/gates surface |
| P1 hide | `core/capabilities.ts`, `core/overlay-registry.ts`, `core/panel-defs.ts`, `core/store.ts` (`$uiMode`) |
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
- Client `makeControl` (`nars-backend.ts`) still returns optimistic `{ ok:true }`; await
  the response.
- Wire `retract | revise | adjust-budget | adjust-provider`, or set their `CAPS` false
  (`nars-backend.ts:77-87`) so the UI stops advertising them.
- The real proof is the golden-path e2e (P2): submit → node appears; step/run advances;
  abort cancels.

---

## 10. Capstone — certainty, guardrails, and the handoff

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

### 10.3 Instructions for you (the human)

- **Open the fresh session with:** *"Read `TODO.ui.12.md` (§0, §0.5, §2–§4, §10). Continue
  at P0.1 client, then P0 facade. One slice at a time; prove each on the real app."*
- **For every slice, require three things:** the change, a guard, and a **real-app proof**
  (a screenshot or a walkthrough) — not a green cell.
- **Judge with the walkthrough checklist**, not the gate output:
  - **Flow A** — I submit Narsese; it becomes a node.
  - **Flow B** — I click an answer and see *why* in one click, no modifier.
  - **Flow C** — I can see a contradiction and act on it.
  - **Flow D** — I can set a goal and see gates/termination.
  - **Flow E** — I can step/run/abort and watch state update.
- **Refuse any §10.2 tripwire.** If a slice spans many files with no user-visible effect,
  stop it.
- **Do not ask for a new plan.** Ask for the next slice, or to fix a failed walkthrough.

### 10.4 Instructions for the plan / the fresh session

**Read order:** §0 → §0.5 → §2 (Law) → §3 (ladder) → §4 (Flows) → §9 → §10.

**Critical path:** **P0.1 client → P0 facade → P1 why → P1 state → P1 hide → P2 golden-path.**

**Per-slice definition of done:** change + guard + **real-app proof**; `typecheck` + `unit`
+ the golden-path e2e green; **commit per slice** (Conventional Commits, per the repo).

**Commands** (`ui/`): `pnpm typecheck` · `pnpm test:unit` · `pnpm test:visual` (regression
only — *not* the measure) · `pnpm test:scenarios` (once green). Root: `pnpm ui:gate`.

**Evolution:** append to the **Progress Log**; never spawn a new plan document. If a Flow
needs a parked item, pull **that one item** and record why.

### 10.5 What to expect when complete

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
