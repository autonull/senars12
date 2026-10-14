# TODO.ui.14.md — Finish the UI: green the gate, translate the substrate, default to conversation, compose the form-factors

> **Supersedes** `TODO.ui.13.md` §4 "Phase 2 — Completion backlog". `TODO.ui.13.md` remains
> the record of the P0–P12 refactor (the diagnosis and the normalized substrate); **this file
> is the single execution plan for completing, translating, *presenting*, and *composing* the
> UI.** Do not run both.

> **North star:** *the normalized substrate exists — make it gate-green, then **translate**
> complex cognitive states and autonomous governance into insight, **present them through a
> familiar conversational default** whose reasoning engine is revealed on demand, and **compose
> every view from form-factor-agnostic parts** so alternative experiences are experiments, not
> rewrites.* Stability first; value second; conversation third; composition always; never a new
> subsystem for any of them.

> **Paradigm:** the default experience is a **Conversational Assistant** (LLM-first), not a
> control panel. The LLM (System 1) handles language, tone and formatting; SeNARS (System 2)
> owns memory, tools, truth values and self-correction behind it. The graph / timeline / AIKR
> dashboards are **progressive disclosure** — one click away, never in the user's face.

> **Composability (keep options open):** a **view** (chat, timeline, governance card, belief
> panel, graph, explain) knows *nothing* about where it is mounted. A **form-factor** (chat-first,
> dashboard-first, notebook-first, single-pane-with-drawers, the multi-app suite) is a
> *composition* — a `defineApp` + a bundle of surfaces. Form-factors are **data**; the same
> components must be recomposable into a different one without copying code. The default is
> chat-first; the others are first-class experiments.

> **One-line test:** *Can a fresh session resume from this file alone, land one slice, watch
> `pnpm ui:gate` get greener (Phases A–C), understand the agent better (Phase D), get a
> ChatGPT-grade answer from the default surface (Phase E), or recompose the same views into a
> different form-factor (Phase F) — and see a screenshot proving it?*

---

## ▶ START HERE (fresh session)

**Context.** `TODO.ui.13.md`'s critical path (P0–P12) is **done**: the substrate is normalized
(`ui/src/client/framework/`), apps are built on it (`apps/{ask,explore,notebook,goals,console,hud}`),
and the client is served **dynamically** by the dev/test server (no `dist` build — commit
`5ca8fc8e`). **But the plan is not done by its own definition:** `pnpm ui:gate` is **red**.

**Four mandates, in this order:**

1. **Phases A–C (P13–P21) — stabilize.** Land the half-finished migrations and green the gate.
   *Nothing in Phase D, E or F may begin until `pnpm ui:gate` is green.*
2. **Phase D (P22–P26) — translate.** Translate existing substrate into operator-usable insight.
   Additive scope, still "translation", not "new subsystems."
3. **Phase E (P27–P32) — present.** Make the **conversational assistant the default surface**,
   with the rich reasoning views as on-demand disclosure. Additive product scope; reuses D's
   translations rather than duplicating them.
4. **Phase F (P33–P38) — compose.** Keep the **views form-factor-agnostic** so alternative
   form-factors are compositions (`defineApp` + bundle), not forks. Add first-run, an input-model
   contract, persistence and a chat perf budget — each a component any form-factor can mount.

**Current state — the resume point:**

| Check | State |
|---|---|
| `pnpm --dir ui typecheck` | ✅ clean |
| Ask prototype e2e (`@prototype`) | ✅ green (dynamic server, no build) |
| Golden-path e2e (`@golden`, real HUD) | ✅ green (dynamic server, no build) |
| `pnpm --dir ui build:client:test` | ✅ writes in-repo to `ui/dist/client` |
| `pnpm --dir ui test:unit` | ❌ **769/790 — 21 failures in 7 files** (the intent/bundle half-migration; the gate blocker) |
| Per-app e2e (Notebook/Goals/Console) | ❌ none exist |
| Visual contract | ✅ exists — 74 committed baselines, a journey-led gallery, a coverage gate |

**Already fixed (do not redo):** out-of-repo build output; no-build dynamic serving; the
client→server protocol import leak (`@senars/nar`/`node-llama-cpp` into the browser); dead server
dispatch (`entry.handle` → `entry.handleServer`); the `derived()` array-vs-value and unbound-`get`
bugs; `node:*` browser shims; the `COMPOSER_MODE_CATALOG`/`view-adapter` type errors.

**First slice: P13 — Land the intent/command migration** (§2, Phase A). Then P14 → … → P21
(gate green), **then** P22 → P26 (Phase D), **then** P27 → P32 (Phase E).

**Commands** (repo root unless noted):
- typecheck: `pnpm --dir ui typecheck`
- unit: `pnpm --dir ui test:unit`
- golden e2e: `cd ui && pnpm exec playwright test --config tests/playwright.config.ts tests/scenarios/golden-path/operate-reasoner.spec.ts --project=chromium --workers=1`
- Ask prototype e2e: `cd ui && pnpm exec playwright test --config tests/playwright.config.ts tests/scenarios/prototypes/ask.spec.ts --project=chromium --workers=1`
- full contract: `pnpm ui:gate` (= typecheck + unit + golden e2e)
- production build: `pnpm --dir ui build:client:test` → `ui/dist/client`
- **progress screenshot** (forward log, after e2e proof; dev server on `:3456`):
  `mkdir -p screenshots && pnpm exec playwright screenshot --project=chromium --output=screenshots/pXX-slug.png <url>`
- **visual contract** (existing regression system): `pnpm --dir ui test:visual` (diff vs baselines),
  `pnpm --dir ui test:visual:update` (re-baseline), `pnpm ui:gallery` (rebuild the contact sheet),
  `pnpm --dir ui test:design` (the qualitative gate + `ui/tests/design/CHECKLIST.md`).

**Record progress** in §6 — append one entry per slice (what changed, guard, proof, screenshot
path, remaining, new opportunities).

---

## ▶ How to execute this plan (self-contained)

**The only trigger needed is: "implement TODO.ui.14.md".**

1. **Read this file top to bottom.** §2 is the plan; §3 is the pre-mortem you must keep in mind.
2. **Resume at the first unchecked slice in §2.** Finish Phase A–C before starting Phase D; finish
   Phase D before Phase E (E reuses D's translations); Phase F last (it composes E).
3. **For each slice:** implement → guard (unit, no mocks; **a human-checklist item where the
   criterion is subjective**) → prove on a real app → **capture a progress screenshot** →
   `pnpm --dir ui typecheck && pnpm --dir ui test:unit` → confirm the golden e2e → commit
   (Conventional Commits) → append a §6 entry.
4. **Then take the next slice.** Do not batch. Do not invent new subsystems — every task is a
   migration finish, a guard, a **translation of existing substrate**, or its **presentation**.
5. **Stop and report only when:** a **tripwire** fires (§4); a required tool is missing; or a test
   fails **>3 times**. Never loop.

**Focus after each slice — the ledger:** `typecheck`, `unit pass count`, golden e2e, per-app e2e
(Phases A–C); operator-legibility criteria (Phase D). The plan is winning only if `unit` climbs
toward 790/790, stays there, and Phase D/E/F guards hold.

---

## 1. The remaining work, in one table

Rows 1–14 trace to a `TODO.ui.13.md` §8 "Remaining" bullet. Rows 15–19 are **Phase D — additive
strategic scope** (operator priority). Rows 20–25 are **Phase E — additive product scope** (the
conversational default; also operator priority).

| # | Item | From | Slice |
|---|---|---|---|
| 1 | `registerCommand` is a no-op; `dispatch`/`palette` tests fail | P8 | P13 |
| 2 | Bundle reset helpers (`resetSurfaces`/`resetViewAdapters`/`resetProjectors`) missing | P11 | P14 |
| 3 | `applyPlugins()` doesn't register commands; bundle tests fail | P11 | P14 |
| 4 | `$viewSelection`, `$runTerminations` still side-effect synced | P10 | P15 |
| 5 | Apps not on `defineBundle`/`defineApp`; `plugins.ts` not migrated | P11 | P16 |
| 6 | Settings/LM-provider/styles not on their catalogs | P12 | P17 |
| 7 | `reasoning-layout.ts` not on `defineCatalog`; `capabilities.ts` bespoke | P1 | P18 |
| 8 | `registerOverlay` merge loses `a11y`; overlays not consolidated | P2 | P18 |
| 9 | No §3.3 kernel-boundary check | P0 | P19 |
| 10 | No e2e for Notebook/Goals/Console | P7 | P19 |
| 11 | Static `/` has no built `index.html` | infra | P20 |
| 12 | `core/dist/*` committed artifacts | infra | P20 |
| 13 | Golden-path flakiness (pre-existing) | P9 | P21 |
| 14 | Protocol/derived/shim drift has no guard | pre-mortem | P21 |
| 15 | Derivation history is raw; no step-through "why" story | **D** | P22 |
| 16 | Tool approval shows approve/reject, not risk/diff/sandbox evidence | **D** | P23 |
| 17 | Graph becomes an unreadable hairball as concepts scale | **D** | P24 |
| 18 | Overlays (palette/inspector/settings) lack keyboard/ARIA completeness | **D** | P25 |
| 19 | Visual gallery has redundant coverage cells; some tiles illegible | **D** | P26 |
| 20 | Default `/` is the debugger HUD, not the conversational app | **E** | P27 |
| 21 | Chat surface lacks markdown / code blocks / copy / real streaming | **E** | P28 |
| 22 | No inline "Show My Work" reasoning expansion in chat | **E** | P29 |
| 23 | Tool use / self-modification interrupt chat with modal dialogs | **E** | P30 |
| 24 | No at-a-glance "what has it learned" belief/memory sidebar | **E** | P31 |
| 25 | No per-message jump to graph/timeline (disclosure) | **E** | P32 |
| 26 | Views assume their mount (HUD/placement); not recomposable | **F** | P33 |
| 27 | No way to try an alternate form-factor without forking an app | **F** | P34 |
| 28 | Input model (English↔Narsese, LM-optional) is implicit | **F** | P35 |
| 29 | No first-run onboarding, suggested prompts, empty/error states | **F** | P36 |
| 30 | No conversation persistence; no chat perf budget | **F** | P37 |
| 31 | Golden path + journey gallery assume the HUD is `/` | **F** | P38 |

---

## 2. Execution plan (slices)

> Each slice: implement → guard (unit; human-checklist item if subjective) → prove (real app +
> golden e2e) → **progress screenshot** → typecheck + unit → commit + §6 entry.

### Phase A — Green the unit gate (blocking)

- [x] **P13 — Land the intent/command migration.**
Switch the command path fully onto the `Intent` catalog: `registerCommand` must register a
`kind: 'command'` intent (or callers/tests migrate to `registerIntent`), and
`dispatchCommand`/`activeCommands`/`paletteCommands` must read it. Delete the deprecated no-op.
**Files:** `core/{commands,intent-registry}.ts`; `tests/components/{dispatch,palette}.test.ts`.
**Guard:** `dispatch`/`palette`/`facade-honesty` tests pass; no test calls a no-op API.
**Prove:** unit suite gains these files; Ask + golden e2e still green.
**Screenshot:** `http://localhost:3456/apps/ask/` (palette open if practical).

- [x] **P14 — Land the bundle/plugin migration.**
Export the catalog reset helpers the bundle tests expect (or migrate the tests to the registry's
real reset API); make `applyBundle`/`applyPlugins` register **commands** (via P13's intent registry)
as well as surfaces/adapters/facets/projectors.
**Files:** `framework/{bundle,surface}.ts`, `core/plugins.ts`; `tests/components/{bundle-composition,plugins}.test.ts`.
**Guard:** `bundle-composition` + `plugins` pass.
**Prove:** unit suite → **790/790**, so `pnpm ui:gate` is fully green.
**Screenshot:** `http://localhost:3456/apps/ask/`.

### Phase B — Finish the substrate migrations

- [x] **P15 — Finish the `derived` migration.**
`$viewSelection` and `$runTerminations` become `derived(...)`; remove their side-effect `subscribe`
syncs. Use `setEqual`/`mapEqual` where the value is a Set/Map so no churn fires.
**Files:** `core/store.ts`, `core/workspace-bindings.ts`.
**Guard:** a churn test (subscriber not called when the derived value is equal).
**Prove:** graph multi-select + run-termination rendering unchanged on the HUD.
**Screenshot:** `http://localhost:3456/apps/ask/` (graph viewport).

- [x] **P16 — Migrate apps + plugins to bundles.**
Each `apps/*` becomes `defineBundle(...)` + `defineApp(...)`; move `plugins.ts` contributions into
bundles; delete the `applyPlugins()` fan-out once callers move.
**Files:** `framework/{app,bundle}.ts`, `core/plugins.ts`, `apps/*`, `vite.config.ts`.
**Guard:** app-composition test (surfaces mount by placement); bundle-registry test.
**Prove:** each app runs at `/apps/<name>/` with the shell providing overlay/palette/connection.
**Screenshot:** `/apps/ask|explore|notebook|goals|console/`.

- [ ] **P17 — Adopt the domain catalogs.**
Settings UI reads `config-catalog`; `lm-provider.ts` uses `lm-provider-catalog`; styles consume
`design-catalog` CSS custom properties.
**Files:** `core/{config-catalog,lm-provider,lm-provider-catalog,design-catalog}.ts`, `components/overlays/settings.ts`, `styles/*`.
**Guard:** config-catalog client/server agree; a new provider/field needs no edit.
**Prove:** settings UI + change log render from the catalog; theming uses generated tokens.
**Screenshot:** `http://localhost:3456/apps/ask/` (settings panel open).

- [ ] **P18 — Unify the last catalogs + overlays.**
Put `reasoning-layout.ts` and `capabilities.ts` on `defineCatalog`; fold `registerOverlay` into
`defineSurface` so the tool-approval overlay keeps its `a11y`.
**Files:** `core/{reasoning-layout,capabilities,overlay-*.ts}`, `framework/surface.ts`.
**Guard:** catalog get/ids/where/size; overlay `a11y` preserved (the P2 test weakened).
**Prove:** reasoning layout + capability gating + tool-approval overlay unchanged on the HUD.
**Screenshot:** golden-path HUD `/`.

### Phase C — Guardrails, hygiene, hardening

- [ ] **P19 — Guardrails & app coverage.**
Add the §3.3 kernel-boundary check (`kernel/**` must not import lens/layout/panel/HUD); add an e2e
per app (Notebook, Goals, Console).
**Files:** boundary test/lint, `tests/scenarios/apps/*`.
**Guard:** the boundary fails on a chrome import (prove with a temporary one, then revert); each
new app e2e is deterministic (no mocks; drives the real server).
**Prove:** `pnpm ui:gate` extended with one e2e per app; all green.
**Screenshot:** each app route.

- [ ] **P20 — Build/serve hygiene.**
Give static serving a root document (add `src/client/index.html` — or make Ask the root app — to
the Vite inputs) so production `/` matches dev; untrack the committed `core/dist/*` artifacts
(`git rm -r --cached core/dist` + keep the ignore). Optional: split `@senars/util`'s root into a
browser-safe entry and drop `client/shims/node-builtins.ts`.
**Guard:** after `build:client:test`, a static fetch of `/` returns the app shell; `git ls-files core/dist` is empty.
**Prove:** static server serves `/` and `/apps/ask/`; dev path unchanged.
**Screenshot:** static `/` and `/apps/ask/`.

- [ ] **P21 — Hardening & de-flake (the pre-mortem, made mechanical).**
Add the guard tests §3 calls for: a **protocol-drift** test (every `PROTOCOL_SPECS` row is
direction-correct and round-trips a valid frame), a **derived single/multi** edge test, a
**node-builtin** allow-list check (fails if a client module imports an unshimmed `node:*`), and a
**dev/static coexistence** smoke. Investigate the golden-path flake (P9) and either fix or
`test.fixme` with a tracking note.
**Files:** `tests/` additions; `scripts/` if a check script is warranted.
**Guard/Prove:** the new tests pass; golden path is stable across 5 runs.
**Screenshot:** golden-path HUD `/`.

### Phase D — Cognitive Translation & Usability (additive scope; **gated on Phase C**)

> **Do not begin Phase D until `pnpm ui:gate` is green.** Each slice *translates existing
> substrate* into operator insight — raw `DerivationRecord`, `PatchRiskClassifier` scores,
> `SandboxValidator` verdicts, AIKR pressure — into things a human can read and act on. Where a
> criterion is subjective, it is a **human checklist item** (`ui/tests/design/CHECKLIST.md`
> precedent), not a fake test.

- [ ] **P22 — Timeline translation (derivation → story).**
Make the timeline navigable history: step forward/back through reasoning cycles, highlight which
NAL/MeTTa rules fired per step, and let the operator inspect a concept's before/after truth values.
Source data already streams (`derivation.record` events → the derivation projector).
**Files:** `components/timeline-scrubber.ts`, `components/overlays/{timeline,explain}.ts`,
`core/projectors.ts` / `core/workspace-projection.ts` (derivation fragment).
**Guard:** mechanical — a seeded reasoning run renders ≥N rule-id steps; steps are ordered by seq.
Human checklist — *using only the Timeline, explain why the agent retracted a belief.*
**Prove:** the golden path's derivation is steppable in the Timeline; screenshot
`http://localhost:3456/apps/ask/` with the timeline open.

- [ ] **P23 — Governance translation (risk → decision).**
Upgrade `components/overlays/tool-approval.ts` from approve/reject to evidence: render the
`PatchRiskClassifier` risk tier, a readable diff of the proposed change, and the
`SandboxValidator` verdict (e.g. "sandbox: network access refused"). Route low-risk proposals to a
grouped auto-approve list; demand explicit confirmation only for medium/high risk.
**Files:** `components/overlays/tool-approval.ts`, `core/tool-registry.ts`; server/wire:
`ui/src/server/handlers.ts`, `server/protocol-server.ts`, **`client/core/protocol-defs.ts`
(`PROTOCOL_SPECS` — this slice likely adds a `governance.proposal` toServer/`governance.verdict`
toClient pair)**; source: `nar/src/governance/pipeline.ts` (`PatchRiskClassifier`, `SandboxValidator`,
`ProposalRoute`).
**Guard:** mechanical — a seeded proposal renders risk + diff + sandbox verdict; low-risk ones
group. Human checklist — the overlay gives enough context to *make* the decision.
**Prove:** the tool-approval journey in the gallery; screenshot with a seeded high-risk proposal.

- [ ] **P24 — Scale translation (hairball → cluster).**
Level-of-detail clustering in the graph viewport: above a node threshold, cluster related concepts
into expandable "super-nodes".
**Files:** `components/graph-viewport.ts`, `components/renderers/{graph,graph3d}.ts`.
**Guard:** a headless load test seeded with 10,000 concepts renders at **≥30 FPS** and stays
navigable (measure frame time, not just correctness).
**Prove:** large seeded graph is navigable; screenshot of the clustered view.

- [ ] **P25 — Accessibility translation (DOM → ARIA).**
Extend `ui/tests/design/a11y.test.ts` and fix keyboard/focus trapping for the palette, inspector,
settings and tool-approval overlays; add ARIA so screen readers announce state changes (e.g.
"agent entered high-pressure AIKR state").
**Files:** `components/overlays/{palette,inspector,settings,tool-approval}.ts`, `tests/design/a11y.test.ts`.
**Guard:** Lighthouse a11y **> 95**; full keyboard navigation of the golden path (no mouse).
**Prove:** keyboard-only golden-path run; screenshot of focused overlay.

- [ ] **P26 — Visual curation (redundancy → legible journeys).**
The visual contract already exists (74 baselines, journey-led gallery, coverage gate). **Curate**
it: retire duplicate/illegible coverage cells, keep the coverage gate green with the minimum
required set, and add journey tiles for the new translation surfaces (timeline, tool-approval).
**Files:** `tests/visual/{matrix,generated-cells}.ts`, `scripts/build-gallery.ts`,
`tests/components/visual-coverage.test.ts`.
**Guard:** the coverage gate stays green (no required cell deleted); the gallery leads with ≤6
legible journeys; no tile is illegible at default zoom (`test:design` legibility).
**Prove:** `pnpm ui:gallery` renders a clean, journey-led sheet; screenshot the gallery header.

### Phase E — Conversational Assistant (LLM-first default; **gated on Phase C**, reuses Phase D)

> **Do not begin Phase E until `pnpm ui:gate` is green.** The paradigm: SeNARS should *feel* like a
> modern chatbot and *reveal* a rigorous reasoning engine on demand. The LLM (System 1) is the
> conversational cortex; SeNARS (System 2) is the reasoning core behind it. **The LLM is optional**
> — the chat must degrade to symbolic-only (the system already has universal symbolic fallbacks),
> because dev/test runs without an LM. Reuse Phase D: P29≈P22, P30≈P23, P32≈P24. No new plumbing —
> the wire already multiplexes `chat.agent.stream` (text) and `cognitive.delta` (state).

- [ ] **P27 — Make the chat the default surface.**
Promote the conversational app to `/`; demote the debugger HUD to `/apps/hud/`. Root
`src/client/index.html` becomes the chat (not `app-layout`/`entry.ts`). This realizes P20's
"or make Ask the root app."
**Files:** `src/client/index.html`, `apps/ask/*`, `vite.config.ts` entries; `apps/hud/*`.
**Guard:** `/` renders the chat surface; `/apps/hud/` still renders the HUD; golden path updated
to reach the HUD's affordances (or a new chat-first golden path added).
**Prove:** fresh `/` shows a chat, not a graph; screenshot `/`.

- [ ] **P28 — Chat parity (markdown, streaming, copy, history).**
Give the default surface ChatGPT-grade rendering: markdown, fenced code with copy buttons, real
token streaming, prompt history. Reuse the existing views (`components/views/{code-highlight,
code-view,token-render}.ts`, `overlays/chat.ts`) and `$streamingDelta` (client already accumulates
`chat.agent.stream`).
**Files:** `apps/ask/ask-app-v2.ts` (or a shared `components/chat-view.ts`), `core/store-bindings.ts`.
**Guard:** an assistant message renders markdown + a code block with copy; a streamed reply appends
deltas live (assert `$streamingDelta` grows, then clears on `chat.agent.complete`).
**Prove:** a streamed, markdown-formatted answer on `/`; screenshot mid-stream and complete.

- [ ] **P29 — Inline "Show My Work" reasoning.**
Each assistant answer carries an expandable "Reasoning Steps" disclosure fed by the derivation
data (the same source as P22): recalled memory → fired NAL/MeTTa rule → contradiction resolved →
response synthesized. The Ask app already has a `<details class="why">`; elevate it.
**Files:** `apps/ask/ask-app-v2.ts`, `core/projectors.ts`; reuses P22's step model.
**Guard:** mechanical — a seeded reasoning turn shows ordered rule-id steps. Human checklist — a
non-expert reads the steps and explains the answer.
**Prove:** expand "Show My Work" on `/`; screenshot expanded.

- [ ] **P30 — Asynchronous governance in the stream.**
Tool use and self-modification must not block the conversation. Render them as inline chat cards
("I found a way to optimize my tool. [Review & Approve]") that reuse P23's risk + diff + sandbox
evidence; approving/rejecting happens inline without leaving the chat.
**Files:** `apps/ask/ask-app-v2.ts`, `components/overlays/tool-approval.ts`, `core/tool-registry.ts`;
wire: P23's `governance.*` `PROTOCOL_SPECS` rows (build those first).
**Guard:** a seeded proposal appears as a non-blocking card; the chat remains usable while it's
pending; low-risk items group.
**Prove:** a governance card mid-conversation; screenshot with the card present.

- [ ] **P31 — Memory / belief sidebar ("what it learned").**
A persistent, real-time panel distinguishing **durably learned beliefs** (the belief lens /
workspace projection) from **current conversational context**. Updates as the chat progresses.
**Files:** `apps/ask/ask-app-v2.ts`, `core/` belief projection (`lens-catalog`, workspace projection).
**Guard:** asserting a fact in chat updates the sidebar's learned set; an ephemeral mention does not.
**Prove:** sidebar reflects a learned belief after a chat turn; screenshot.

- [ ] **P32 — Per-message progressive disclosure.**
Each message offers "View Belief Graph" / "Open Timeline" / "Explain" buttons that open the rich
views (P24 graph, P22 timeline, `overlays/explain.ts`) in a side drawer or split pane — keeping the
main chat clean.
**Files:** `apps/ask/ask-app-v2.ts`; reuses `components/graph-viewport.ts`, `timeline-scrubber.ts`,
`overlays/{explain,timeline}.ts`.
**Guard:** the button opens the drawer with the message's context focused; the chat stays primary.
**Prove:** open the timeline from a chat message; screenshot split view.

### Phase F — Form-factor composability & first-run (additive; **gated on Phase C**)

> **Do not begin Phase F until `pnpm ui:gate` is green.** This phase guarantees the plan's
> *integration* and *intuitiveness* axes **without locking a single product shape.** The rule:
> a **view** is form-factor-agnostic; a **form-factor** is a composition. We ship whitespace-first
> as the default, but keep alternates one `defineApp` away — *experiments, not forks.*

- [ ] **P33 — Decouple views from their form-factor.**
Make each reasoning view a self-contained composable surface that assumes **nothing** about where
it is mounted: `chat`, `timeline`, `governance card`, `belief/memory panel`, `graph`, `explain`.
No hard-coded placement; no import of shell/HUD chrome; props/host are passed in. (The framework's
placement-parameterized `Surface` + `defineSurface` already supports this — finish the migration.)
**Files:** `components/s-app-shell.ts`, `components/overlays/*`, `apps/ask/*`, `framework/surface.ts`.
**Guard:** a **recomposition test** — a minimal second `defineApp` mounts the *same* chat + belief
panel in a different arrangement (no drawer; side-by-side) with **zero** copied view code.
**Prove:** two form-factors render from one component set; screenshot both.

- [ ] **P34 — Form-factor = composition (keep options open).**
Express form-factors as data: the default is a chat-first `defineApp` (P27); alternates
(dashboard-first, notebook-first, single-pane-with-drawers, the multi-app suite) are **additional
`defineApp`s over the same surfaces**, not code forks. Provide a selector (route or config) to
switch/experiment, and a way to compare them.
**Files:** `framework/{app,bundle}.ts`, `apps/*`, `vite.config.ts` (entries are just form-factors).
**Guard:** adding a form-factor adds **no** view code; a shared-surface parity test asserts each
form-factor mounts the same component versions.
**Prove:** switch default↔alternate without a rebuild of view logic; screenshot the selector + an
alternate.

- [ ] **P35 — Input-model contract (English ↔ Narsese, LM-optional).**
Lift the Ask app's implicit routing (plain language → agent ingress; Narsese → reasoning;
`looksNarsese`/`modeFor`) into a **shared, documented** component any form-factor uses. State the
LM-optional behavior explicitly: with no LM, natural language still routes to the symbolic ingress
with universal fallbacks; the UI never blanks or lies about understanding.
**Files:** `apps/ask/ask-app-v2.ts` → shared `components/composer.*`, `core/` ingress binding.
**Guard:** the same input string routes identically in every form-factor; with the LM off, a plain
sentence still produces a symbolic result (no crash, honest status).
**Prove:** type English and Narsese in two form-factors; screenshot both.

- [ ] **P36 — First-run, empty & error states.**
Composable onboarding: a "what can I ask?" affordance, suggested prompts, and honest empty/error
states (engine absent, LM unavailable, malformed input) — as components any form-factor mounts.
**Files:** `apps/ask/*`, new `components/onboarding.*` / empty-state primitives.
**Guard:** a first-run (no history) renders the onboarding; an engine-less server renders the
error state, not a blank chat.
**Prove:** fresh browser shows onboarding; screenshot.

- [ ] **P37 — Conversation persistence + chat performance budget.**
Persist session history across reload (distinct from P31's belief sidebar). Set and measure a chat
budget: time-to-first-token and stream smoothness (the chat counterpart to P24's graph FPS).
**Files:** `core/store*` (session), server persistence, a perf test.
**Guard:** reload restores the conversation; TTFT and frame time stay within budget under a seeded
long transcript.
**Prove:** reload keeps history; screenshot after reload.

- [ ] **P38 — Reconcile the default (golden path + gallery).**
Promote R20 to a real task: with `/` now the chat, update the golden-path e2e and the journey-led
gallery so they cover the **default** experience *and* keep the HUD path — re-baseline the journeys.
**Files:** `tests/scenarios/golden-path/*`, `tests/visual/{matrix,baselines}/*`, `scripts/build-gallery.ts`.
**Guard:** the gate covers the default surface; no journey is lost; baselines re-committed.
**Prove:** `pnpm ui:gate` + `test:visual` green; screenshot the regenerated journey sheet.

---

## 3. Pre-mortem — how this could still go wrong

> Read before each slice. Each risk names its **detecting test**; P21/Phase D make the detectors
> mechanical. If we can't detect it, the mitigation below is what adds detection.

### Confirmed risks (we have seen the failure shape)

| # | Risk | Why it bites | Detector |
|---|---|---|---|
| R1 | **Command path stays a no-op** | `registerCommand` discards; the deprecation wasn't finished. | P13 (`dispatch`, `palette`). |
| R2 | **Bundle reset helpers never exported** | Tests call `resetSurfaces()` etc.; the API doesn't exist. | P14 (`bundle-composition`). |
| R3 | **Plugins don't register commands** | `applyPlugins` fans out surfaces but not intents. | P14 (`plugins`). |
| R4 | **`derived` equality churn** | New Set/Map identity each compute ⇒ subscribers fire every tick. | P15 churn test; `setEqual`/`mapEqual`. |
| R5 | **Dynamic vs static serving conflict** | Both want `/`; middleware/fallback ordering can regress. | P20 guard. |
| R6 | **Kernel boundary lint too loose/strict** | Transitive chrome imports; false positives. | P19 boundary test. |

### Speculative risks

| # | Risk | Why it might bite | Detector |
|---|---|---|---|
| R7 | **`derived([single], fn)` mis-typed** | A one-element array is treated as multi-source. | P21 derived edge test. |
| R8 | **`node:*` shim gap** | A new client import of `node:os`/`node:buffer` throws only at runtime. | P21 shim allow-list check. |
| R9 | **Protocol spec drift** | A new message type without a `PROTOCOL_SPECS` row is silently unrouted. | P21 protocol-drift test. |
| R10 | **Per-app e2e flakiness** | Notebook/Goals/Console were scaffolded, not proven. | P19 deterministic e2e. |
| R11 | **`core/dist` untracking breaks a script** | Something imports `core/dist` instead of `core/src`. | P20 guard + CI. |
| R12 | **`@senars/util` split breaks nar/core** | Other packages import the util root. | P20 optional — run full repo typecheck + their suites. |
| R13 | **Cognitive opacity (the black box)** | Substrate is perfect but the operator can't tell *why* an action happened — the raw timeline/derivation view is too dense. | P22 human heuristic (time-to-insight) + step-through guard. |
| R14 | **Graph hairball at scale** | Great at 50 concepts; freezes/unreadable at 2,000+ (realistic for long-running agents). | P24 10k-concept load test + frame-time profiling. |
| R15 | **Governance alert fatigue** | Approval demanded too often without risk context ⇒ operators blindly approve dangerous self-modifications. | P23: telemetry — approval time < 2 s for high-risk patches means the UI isn't being read. |
| R16 | **Translation without a wire path** | P23 needs governance data the client never receives; "just a UI change" becomes a protocol+server change and stalls. | Named explicitly in P23 files — extend `PROTOCOL_SPECS` first. |
| R17 | **Chat-first collapses without an LM** | Dev/test runs deliberately wire no LM; a "ChatGPT-like" default that assumes one feels broken. | P27/P28: chat must work symbolic-only (universal fallbacks); guard with the LM off. |
| R18 | **Chat parity gap ("worse than ChatGPT")** | Plain-text turns, no markdown/copy/streaming ⇒ users reject the default before seeing the reasoning value. | P28 parity test (markdown + streamed deltas + copy). |
| R19 | **Disclosure becomes concealment** | Hiding the reasoning so well that users never find the value (the whole point of SeNARS). | P29/P32: an e2e asserting "Show My Work" + disclosure buttons are reachable in ≤2 clicks from any answer. |
| R20 | **Default-surface breakage hides regressions** | Moving `/` to chat means the old HUD golden path no longer guards the default route. | P27/P38: update/extend the golden e2e to cover the new default and keep the HUD path. |
| R21 | **View assumes its form-factor** | Views quietly assume the shell/placement, so an alternate form-factor needs copies — the exact disease UI.13 cured, reintroduced at the product layer. | P33 recomposition test (second `defineApp`, zero copied view code). |
| R22 | **Intuitive only with an LM** | "ChatGPT-like" implies natural language; without an LM the intuitive path may be Narsese-only, which is not intuitive to a newcomer. | P35 input-model contract: English routes to symbolic ingress when no LM; honest status. |
| R23 | **Onboarding skipped → cold black box** | A clean chat with no prompts/help hides the system's value; users conclude it's "just a worse chatbot." | P36 first-run + suggested prompts; guard renders them on empty state. |
| R24 | **Alternate form-factors drift apart** | Each experiment slowly re-implements a view instead of recomposing. | P34 shared-surface parity test; P33 guard. |

### Blind spots (deliberately **out of scope** — park, don't forget)

- **No full kernel→projection→UI→kernel round-trip invariant test** (e2e covers apps, not the loop).
- **No load/stress test outside P24's graph case** (atom/listener leaks at scale are unmeasured).
- **No responsive/mobile pass**; viewport e2e is desktop-only.
- **No i18n** (English literals throughout).
- **a11y coverage exists but is partial** (`tests/design/a11y.test.ts`) — P25 extends it; it is not
  a greenfield blind spot.
- **Visual regression exists** (74 baselines) — the gap is *curation/legibility*, addressed by P26;
  it is **not** "no baseline."

**Two visual systems, kept distinct:**
- **Progress screenshots** (`screenshots/`, new) — a *forward log* of what was built per slice;
  no baseline to diff against. This is the thing that shows the GUI being built.
- **Visual regression** (`tests/visual/`, existing) — *guards* committed cells against unintended
  drift; the gallery leads with ≤6 Journeys. Curated/extended in P26.

**Rule:** a blind spot becomes a slice only when it becomes a *blocker* or an *operator
complaint*. Phases D, E and F are exactly that: the operator has asked for usability, a
conversational default, and **form-factor flexibility** — so they graduate here. (Still parked:
product analytics on *which* disclosure affordances operators actually use — worth adding once
Phase E ships.)

---

## 4. Tripwires (stop if any fires)

| Mistake | Tripwire |
|---|---|
| **New subsystem during completion** | a slice adds a registry/catalog/descriptor that isn't a migration finish, a translation, or a composition → stop |
| **Phase D/E/F starts early** | Phase D, E or F work begins before `pnpm ui:gate` is green → stop |
| **Chat hides the engine** | the default surface makes the reasoning/timeline/governance unreachable in ≤2 clicks → stop |
| **LM assumed** | the default chat breaks or blanks when no LM is wired → stop |
| **View forks its form-factor** | a view imports the shell or a second form-factor copies view code instead of recomposing → stop |
| **Weakening tests to pass** | a test's assertion is changed rather than the behavior fixed → stop |
| **Chrome in the kernel** | `kernel/**` imports a lens/layout/panel/HUD module → stop |
| **Reintroducing a build step** | `pnpm build:client:test` appears before an e2e command → stop |
| **Client imports server** | client code imports `server/**` (drags `@senars/nar` into the browser) → stop |
| **Green gates as progress** | no real-app walkthrough + screenshot for the slice → not done |
| **Screenshot spam** | more than a handful of shots per slice, or duplicate/illegible states → curate |
| **Fake usability test** | a subjective criterion asserted as an automated unit test → make it a checklist item |
| **Deleting by hope** | a file is removed before its callers migrate → archive first |
| **Going in circles** | a slice is retried >3 times → stop and report (the pre-mortem likely missed a risk) |

---

## 5. Definition of done

**Stability (Phases A–C):**
- **`pnpm ui:gate` green**, including **an e2e per app**.
- **Unit suite 790/790**, and no test leans on a deprecated no-op API.
- **One definition per fact:** no bespoke `*_IDS`/`*Where`/`d()`; `reasoning-layout` and
  `capabilities` on `defineCatalog`; overlays are surfaces.
- **Every app is `defineBundle` + `defineApp`**; `plugins.ts` no longer fans out.
- **Settings, LM providers and styles derive from their catalogs.**
- **The §3.3 kernel boundary is enforced** by a check that fails on a chrome import.
- **Static and dynamic serving both work**; no tracked build artifacts.
- **The §3 pre-mortem detectors exist and pass** (P21).

**Value (Phase D):**
- **Time-to-insight:** a new operator traces a belief retraction and explains the agent's reasoning
  in **≤3 minutes** using the Timeline (*human checklist*, not a unit test).
- **Safe governance:** the Tool Approval UI supplies risk score + diff + sandbox verdict so a human
  can make an informed decision on a self-modification patch.
- **Scale resilience:** the graph viewport stays interactive (**≥30 FPS**) with **>1,000** active
  concepts (10k in the guard test).
- **Accessibility:** Lighthouse a11y **> 95**; the golden path is fully keyboard-navigable.
- **A curated `screenshots/` log** shows the GUI state at each slice (progress, not baseline), and
  the visual gallery leads with ≤6 legible journeys.

**Conversation (Phase E):**
- **Default is chat:** `/` opens a conversational surface, not the debugger; the HUD lives at
  `/apps/hud/`.
- **Parity:** answers render markdown + code (copyable) and stream token-by-token.
- **Works without an LM:** the chat is fully usable symbolic-only.
- **Revealable engine:** "Show My Work" and per-message graph/timeline disclosure are reachable in
  **≤2 clicks** from any answer; governance is a non-blocking inline card.
- **Learned-vs-context:** a sidebar distinguishes durable beliefs from the current conversation.

**Integrated & composable (Phase F) — the axis §6 previously left unstated:**
- **One integrated default experience:** chat is the default surface, with reasoning views as
  disclosure — *not* a suite of disconnected demos. Every view is reachable from the default.
- **Views are form-factor-agnostic:** no view imports the shell or hard-codes its placement.
- **Form-factors are data:** the default is one `defineApp`; alternate form-factors are additional
  `defineApp`s over the **same** components. Adding one copies **no** view code (recomposition test).
- **Input contract holds everywhere:** English↔Narsese routing is one shared component; with no LM
  the chat is honest and functional, never blank.
- **First-run is not a black box:** onboarding + suggested prompts render on empty state.
- **Continuity:** conversations persist across reload; time-to-first-token is within budget.

---

## 6. Progress Log

> Append one entry per slice: what changed, guard, proof, screenshot path, remaining, opportunities.
> Keep it terse and factual. (Empty at hand-off.)

### P13 — Intent/command migration (2026-10-14)

**Changed**
- `core/intent-registry.ts`:
  - removed the build-time capability `.filter` in `rendererCommands()` — availability is gated only at
    `available()` now, so a capability flip adds/removes a renderer command without a catalog rebuild;
  - fixed `overlayCommands()` to derive `overlay.*` **only** from `placement === 'overlay'` surfaces and to
    read `presentation.hiddenInPalette` (it read a non-existent top-level field, leaking ref-dependent
    overlays — `overlay.explain` etc. — into the palette and spilling `overlay.notebook` for a viewport);
  - restored the static `overlay.palette` command (dropped in the P8 migration, breaking `openPalette()` /
    the HUD button / ⌘K);
  - the catalog now merges the framework's runtime intent registry and caches by `intentRegistryVersion()`;
    removed the duplicate `dispatchCommand`/`activeCommands`/`paletteCommands` (one definition lives in
    `commands.ts`).
- `core/commands.ts`: `registerCommand` is no longer a no-op — it adapts a `Command` to a `kind: 'command'`
  intent via `upsertIntent`; `dispatchCommand`/`activeCommands`/`paletteCommands`/`registeredCommands` read the
  one catalog.
- `framework/intent.ts`: added `upsertIntent` + `intentRegistryVersion()` (the single cache-invalidation seam).

**Guard:** `dispatch`, `palette`, `facade-honesty`, `app-layout`, `workspace-host` pass; no test calls a no-op API.
**Prove:** unit 790/790; golden e2e ✓; Ask prototype e2e ✓.
**Screenshot:** `ui/screenshots/p13-intent-command-migration.png` (`/apps/ask/`).

### P14 — Bundle/plugin migration (2026-10-14)

**Changed**
- Exported the reset helpers the bundle tests expect: `resetSurfaces` (`framework/surface.ts`),
  `resetViewAdapters` + `viewAdapterRegistry` (`core/view-adapter.ts`), renamed `clearProjectors` →
  `resetProjectors` (`framework/projector.ts`; `framework/index.ts`, `kernel/domain.ts`, `core/projectors.ts`
  re-exports updated).
- `core/plugins.ts`: `applyPlugins()` registers plugin commands through `registerCommand` instead of warning.

**Guard:** `bundle-composition` (21) + `plugins` green.
**Prove:** `pnpm ui:gate` = typecheck + unit (790/790) + golden e2e — **green**. Phase A gate blocker is cleared.
**Screenshot:** `ui/screenshots/p13-intent-command-migration.png` (shared surface).

**Remaining:** the gate is green except the per-app e2e (P19) and the build/serve hygiene (P20/P21). Next is
Phase B (P15 `derived` churn → P16 bundles → P17 catalogs → P18 catalogs/overlays).
**New opportunities**
- Any capability-gated *derived* command must gate at `available()` only, never at build time — the
  `rendererCommands` bug is a class; worth stating when P18 folds the remaining catalogs.
- Runtime command registration now has one invalidation path (`intentRegistryVersion`); P16's bundle migration
  should register commands via `registerIntent`, which already bumps it.
- `renderer.notebook`'s schema exists but `renderer.graph3d`/`explore` do not (`COMMAND_SCHEMAS`) — harmless
  (unknown ids pass), but the derived renderer schemas are incomplete.

### P15 — Finish the `derived` migration (2026-10-14)

**Changed**
- `core/store.ts`: `$viewSelection` is now `derived` from the one selection source — `$selectedNodeIds`
  (nodes) + `$selectedNodeId` (focus) — with a `setEqual`-based equality, so equal selections never churn.
- `core/view-host.ts`: an adapter row selection writes the *source* (`$selectedNodeId`), not the derived atom.
- `core/app-layout.ts`: removed the side-effect sync `watchWith($viewSelection, s => { if (s.focus)
  $selectedNodeId.set(s.focus) })`; the derivation replaces it, so focus can no longer desync.
- `tests/components/derived-churn.test.ts` (new): a subscriber of `$selectedNodeIds`/`$viewSelection` is not
  called when the source changes but the derived value is equal.

**Guard:** the churn test + `view-host` (incl. row-selection → shared selection) + `app-layout` +
`workspace-hud` pass.
**Prove:** unit 793/793; golden e2e ✓ (graph multi-select + steering unchanged).
**Screenshot:** `ui/screenshots/p15-derived-selection.png`.

**Note / deviation:** `$runTerminations` was named in the plan but is **not** side-effect synced: it is the
terminal output of the async engine call, written in exactly one place (`intent-registry`
`reasoning.step`/`run`), with no second atom to derive from. It is left as that single writable atom —
wrapping it in a `$runResult` atom just to call it `derived` would be ceremony, not dedup. The plan's
*actual* remaining side-effect syncs are `$view.subscribe → $workspaceGraph.timeCursor` and
`$activeLens.subscribe → $graphLayer` (both `core/store.ts`).

**Remaining:** Phase B continues at P16 (apps + `plugins.ts` → bundles), then P17/P18 catalogs.
**New opportunities**
- `$activeLens → $graphLayer` and `$view → $workspaceGraph.timeCursor` are the last two side-effect syncs;
  both are candidates for the same `derived` treatment.
- `apps/hud/hud-app.ts` imports `$viewSelection`/`$selectedNodeIds` without using them — dead imports to prune.

### P16 — Migrate apps + plugins to bundles (2026-10-14)

**Changed**
- `framework/app.ts`: `defineApp` now takes an `AppDefinition` — a `BundleDescriptor` plus presentation/lifecycle
  metadata — applies the bundle (`applyBundle`) and derives the runtime `AppDescriptor` (its `surfaces` are read
  from the bundle). Added `AppDefinition`; `registerApp` now returns the descriptor.
- `framework/bundle.ts`: `defineBundle` preserves the id literal (`BundleDescriptor & { id: K }`); removed the
  parked bundle-level `AppDescriptor`/`LayoutDescriptor`/`LayoutRegion`/`defineApp` (the app model lives in
  `app.ts` now). `framework/index.ts` export list updated.
- All six `apps/*`: each is now `defineApp({ bundle: defineBundle({ id, name, surfaces }), ...metadata })`;
  dropped the manual `registerSurface(...)` fan-out (the bundle applies its surfaces) and the now-unused
  `registerSurface` imports.
- Removed the dead plugin subsystem: deleted `core/plugins.ts`, `plugins/demo-plugin.ts` (never imported) and
  `tests/components/plugins.test.ts`; dropped the plugin exports from `core/index.ts`. `applyPlugins()` had no
  production caller (tests only), so the fan-out is gone rather than kept.
- `tests/components/app-composition.test.ts` (new): a composed app is registered under its bundle id, its
  surfaces are applied globally, and `appSurfaces` groups them by placement.

**Guard:** `app-composition` + `bundle-composition` (24) green; full unit 790/790.
**Prove:** golden-path (HUD) + Ask prototype e2e green; every route (`/apps/{ask,explore,notebook,goals,console,hud}/`
and `/`) returns 200 and each app boots.
**Screenshots:** `ui/screenshots/p16-app-{explore,notebook,goals,console}.png`.

**Remaining:** P17 (domain catalogs) → P18 (catalogs + overlays) close Phase B.
**New opportunities**
- Per-app metadata (icon/lens/connection) lives on `AppDefinition`, not the bundle; if a bundle should be
  independently mountable, add a `bundle.meta` and let `defineApp` read it.
- `apps/*/main.ts` import `APP_SHELL_TAG` without using it — dead imports to prune.
- `bundle.ts` now pulls the whole contributor registry set into every app entry; a future perf pass could
  lazy-register non-surface contributions.

### P17 — Adopt the domain catalogs (partial: LM providers done, 2026-10-14)

**Changed (part 1 — LM providers)**
- `core/lm-provider.ts`: dropped the duplicated `KNOWN_LABELS` map; `providerLabel` is now the catalog's
  `lmProviderLabel`, so a new provider is one `lm-provider-catalog.ts` entry with no edit in the façade.

**Guard:** `lm-provider` + `provider-overlay` pass; full unit 790/790.

**Reconnaissance for the rest (why it is its own effort)**
- `core/config-catalog.ts` and `core/design-catalog.ts` exist but are **not consumed** anywhere in `src/`.
  `config-hud.ts` still renders from its bespoke `FIELD_METADATA`, keyed by *flat* config paths (`theme`,
  `defaultLayout.concept`, `provider.name`), while `config-catalog` ids are prefixed (`ui.theme`,
  `ui.layout.concept`, …) and its `ui.*` ids do **not** match the `$config`/`UiConfig` keys. Adopting the
  catalog needs the id scheme reconciled first, then the 667-line `config-hud.ts` (and the change-log
  labelling) rewritten from `getConfigFields()`.
- `design-catalog.ts` declares each primitive's `cssProperty`, but tokens are generated from
  `design-tokens.json` by `scripts/build-tokens.ts` → `styles/tokens.css`. Adopting the catalog means making
  the token generator read the catalog (or the reverse) and re-baselining.

**New opportunities**
- Decide the canonical config id scheme (prefixed vs flat) *before* touching `config-hud`; the id mismatch is
  the real blocker, not the render.
- `design-tokens.json` and `design-catalog.ts` are two sources for one fact — unify before P26 curates.
- `apps/*/main.ts` import `APP_SHELL_TAG` without using it (also noted in P16).

---

## 7. Appendix — handoff notes & key facts

- **Serve dynamically; do not reintroduce a build step for e2e.** The dev/test server serves the
  client from source via Vite middleware (`createDevClient` in `server/index.ts`). Keep
  `root: 'src/client'` in `ui/vite.config.ts`; removing it silently shifts `outDir` outside the repo.
- **Node builtins.** `client/shims/node-builtins.ts` is aliased for `node:*` in `vite.config.ts`
  only (not vitest). A new client import of a node builtin needs an alias + shim entry — or make
  the util split (P20).
- **Protocol.** One definition: `PROTOCOL_SPECS` in `client/core/protocol-defs.ts`. Client routes via
  `handleClient`; server via `server/protocol-server.ts` → `server/handlers.ts`. **Never import
  server handlers from client code.** P23 may add protocol rows — do that first.
- **Chat/streaming (for Phase E).** Text and state are **already multiplexed**: `chat.user` (toServer),
  `chat.agent.stream` (`{delta}`, toClient) and `chat.agent.complete` (toClient) carry language;
  `cognitive.delta` carries state. The client already accumulates `$streamingDelta` from
  `chat.agent.stream` and clears it on `chat.agent.complete`. So P28 is rendering, not plumbing.
- **LLM is optional.** The test/agent server deliberately wires **no** LM (deterministic). The chat
  default must be fully usable symbolic-only (universal symbolic fallbacks). Do not assume a model.
- **Default surface today:** `src/client/index.html` is the **debugger HUD** (`app-layout` + `entry.ts`);
  the chat app is at `apps/ask/`. P27 swaps them.
- **Chat seed:** `apps/ask/ask-app-v2.ts` (474 lines) already has turns, a pending "reasoning…" state,
  a `<details class="why">` proof expansion, and the tagline "reasoning you can audit". Reuse it.
- **Input model today:** `apps/ask/ask-app-v2.ts` already routes plain language through the agent's
  ingress and Narsese through reasoning, via a `looksNarsese`/`modeFor` heuristic. P35 lifts this into
  a shared component — it is the plan's core intuitiveness decision, so centralize it.
- **Form-factors today:** the 6 apps (`ask, explore, notebook, goals, console, hud`) are effectively
  **6 form-factors over one substrate**, with **no cross-app navigation** — only a breadcrumb inside
  notebook. That is *fine* as an experiment set; Phase F makes them composable (P33), selectable
  (P34), and consistent (P35) **without collapsing the possibility space**. Do not "consolidate to one
  app" unless the operator later chooses to — the substrate supports whichever shape wins.
- **`derived`.** `derived(source, fn)` passes the single value; `derived([a, b], fn)` passes the
  array; `get` is bound. A single-source selector that indexes the array is the bug fixed in `5ca8fc8e`.
- **Existing visual contract.** `tests/visual/{matrix,generated-cells}.ts`, `visual-coverage.test.ts`,
  `scripts/build-gallery.ts`; ≤6 Journeys (chat⇄graph, streaming, tool approval, explain, fractal
  node body). 74 committed baselines in `tests/visual/baselines/chromium/`. Gates: `test:visual`,
  `test:design` (+ `CHECKLIST.md`), `ui:gallery`.
- **Governance source (for P23).** `nar/src/governance/pipeline.ts` — `PatchRiskClassifier`,
  `SandboxValidator`, `ProposalRoute = 'auto-apply' | 'sandbox-validate' | 'human-approval'`.
- **Layout.** `framework/` (micro-framework), `kernel/` (facade + atoms), `core/` (substrate + HUD
  chrome), `apps/*` (products), `components/` + `components/overlays/` (HUD chrome), `server/`
  (dynamic host + protocol-server), `shared/`, `core/src/protocol/` (the zod protocol).
- **Guards that must stay green:** `tests/scenarios/golden-path/operate-reasoner.spec.ts` (`@golden`),
  `tests/scenarios/prototypes/ask.spec.ts` (`@prototype`), `tests/components/*`, `tests/visual/*`.
- **Conventions (AGENTS.md):** terse self-documenting code; `pnpm`/`pnpx`; no `pkill`; don't edit
  generated `README.md`; unit tests without mocks; Conventional Commits.
