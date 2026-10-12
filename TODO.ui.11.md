# TODO.ui.11.md — Deepen the Paradigm, Don't Widen It

> **North Star:** *One substrate · many projections · recursively embeddable · LoD-scaled.*
>
> **One-line test for every decision:** *Does it make the system's reasoning more visible, more legible, or more enjoyable — without adding a control the user must learn?*

> **Reading order for a fresh session:** *Where We Are* → *Verification* →
> *Typical User Experience* → *Tracks A–G* → *Fresh-Session Handoff* (critical
> path, commands, file map). If short on time, read the Handoff first.

---

## Where We Are (v10 verified)

| Capability | Lives in | State |
|---|---|---|
| One substrate (WorkspaceGraph + projections) | `core/workspace-graph.ts`, `core/*-projection.ts` | ✅ |
| Conversation as graph nodes with real HTML bodies | `components/node-body.ts`, `utils/render-block.ts` | ✅ |
| 4-tier LoD (glyph→label→card→full) | `utils/graph-scaling.ts` | ✅ (+ token-driven transitions, B2) |
| Density-aware layout | `utils/layout-registry.ts` | ✅ |
| Fractal: block's `full` tier renders nested `<s-view>` | `utils/render-block.ts:54` (`embedded`) | ✅ (depth guard at 2) |
| Overlay system (popovers, registry, host, windows) | `core/overlay-*.ts` | ✅ (+ drill-down breadcrumbs, B1) |
| Conversation layouts (5) + reasoning layouts (4) | `core/conversation-layout.ts`, `core/reasoning-layout.ts` | ✅ |
| Depth budget + node budget + inert-until-engaged | `utils/render-block.ts`, `components/graph-viewport.ts`, `components/node-body.ts` | ✅ |
| Two demo cells proving the paradigm | `tests/visual/matrix.ts` | ✅ (`embedded-view-demo`, `derivation-record-demo`) |

**v10 is complete. All `verify` gates green (typecheck, unit 673, design 11, visual 59, craft 202).**

### Known consolidation debt (the substrate is under-abstracted)

The paradigm is proven but its **descriptor surface has drifted**: a `BlockKind` is
spread across 6+ partial maps and 3 if-chains, and they disagree. Two are live
bugs, not just DRY smells:

- ~~`GRAPH_BLOCK_KINDS` (`components/renderers/graph.ts:30`) **omits `derivation-record`
  and `command`**, so those blocks are not advertised to the graph renderer.~~
  **Fixed (D1):** `BLOCK_DESCRIPTORS` is the SSOT; all 25 kinds are graph-renderable.
- ~~`graph-scaling.ts:10` and `adapter-2d.ts:8` read `TOKENS.dark[...]` directly,
  **hardcoding the dark theme** — light/high-contrast are silently broken.~~
  **Fixed (D5):** both read `numericToken`; one `truthColor` replaces the 3 copies.
- `EVENT_TYPE_LABELS` (`components/overlays/events.ts:17`) keys do not match the
  `EVENT_CATALOG` discriminants (stale duplicate).

**Track D** below consolidates this, but only as *enablers* of Tracks A/B — each
refactor lands in the same commit as the feature that needs it (per the standing
rule "no new subsystem without a visible payoff"). The one exception is D5, which
is a correctness fix and may land standalone.

---

## Progress Log (v11 implementation)

> Durable record of what has landed since v10. One entry per completed item; the
> Fresh-Session Checklist below is the live to-do.

### F1 + F2 (categories/layout ids) + F3 (`LENS_MODULATION_MAP`) ✅ partial

**F1.** `Shape`/`Budget`/`Disclosure`/`Interaction` (`view-spec.ts`) are now each
an `as const` tuple with the union derived from it (`SHAPES`, `BUDGETS`,
`DISCLOSURES`, `INTERACTIONS`). The two hand copies — the `Shape[]` cast in
`view-projection.ts` and the `Disclosure` list in `explain.ts` — now iterate the
tuple.

**F2 (ready half).** `EventCategory` and `LinkCategory` derive from their existing
`as const` arrays (`EVENT_CATEGORIES`, `LINK_CATEGORIES`), and
`ConversationLayoutId` derives from the `CONVERSATION_LAYOUT_IDS` tuple; the
parallel hand unions are deleted. `BlockKind` (needs a `BLOCK_DESCRIPTORS`
catalog) and panel ids (needs `PANEL_DEFS`) are **deferred** — those catalogs land
with D1. **Landed: `BlockKind` now derives from `BLOCK_DESCRIPTORS` (see D1);
panel ids still need `PANEL_DEFS` (E9).**

**F3 (ready half).** `LENS_MODULATION_MAP` is now
`Partial<Record<BuiltinLens, Modulation>>`, so the lookup after `isBuiltinLens`
is checked and returns `Modulation | undefined` with no cast. The
`$lensViewport`/`$lensLayer`/`$lensLayout` maps stay `Record<string, …>` on
purpose: they are keyed by *custom* lens ids too (`setActiveLayout` writes
`[$activeLens.get()]`), so `Partial<Record<BuiltinLens, …>>` would be unsound.
`COMMAND_SCHEMAS` typing waits on F4's `CommandId`.

**Verified.** typecheck; ui unit **682**; lint clean. No runtime change — the
tuples/arrays keep identical values and order.

### A1 — config-change audit → durable store + dedicated overlay ✅

**What changed.** `$configChanges` (a capped `SemanticBlock<'config-change'>[]`
atom in `store.ts`, exported through `core/index.ts` and the test API) is now the
durable audit trail. `config-change-producer` pushes each diff there; the new
`config-log` overlay (`components/overlays/config-log.ts`, surface
`overlay:config-log`, tag `s-config-log`) renders the trail as a ViewSpec table
(time / key / before→after) with an empty state. It ships with a generated
coverage cell, a curated `overlay-config-log` visual cell seeded through the
store, and its baseline.

**Why the graph write stays (important).** The producer *also* mirrors the block
into `$workspaceGraph`, exactly as before. Dropping that write is **not**
behavior-neutral: `graph-viewport` re-syncs on every `$workspaceGraph` change
(`graph-viewport.ts:209`), and config hydrates in **5 separate `$config.set`
calls at boot** (runtime probe: `$configChanges` = 5), so those five writes drive
extra layout runs that four auto-fit cells were calibrated to
(`panel-search`, `overlay-toc`, `panel-lens-designer`, `layout-budget-resource`).
A store-only producer renders `panel-search` as the workspace layer instead of the
concept graph and is run-to-run flaky. Keeping the mirror keeps all 61 baselines
stable; the durable trail no longer depends on it — it survives
`syncWorkspaceGraph`, which replaces the graph wholesale.

**Guard.** `tests/components/config-change-producer.test.ts` (+2): an adjustment
lands in `$configChanges` *and* the live graph; the durable trail survives a graph
replacement.

**Verified.** typecheck; ui unit **682** (was 680); design **11**; full visual
**61/61** — no baseline move except the new `overlay-config-log`.

**Findings → new opportunities.**
- **Boot config churn is the root coupling.** Config hydrates in five separate
  `$config.set` calls, producing five audit entries *and* five graph writes. Batch
  hydration to one set: the hydration burst and the four-cell coupling both
  disappear, and then A1's graph mirror can be dropped entirely (config truly out
  of the graph).
- **The four auto-fit cells depend on incidental graph writes.** They should be
  made deterministic independent of config — e.g. force a settle/layout in their
  `prepare` — so removing the mirror no longer perturbs them.
- **`scripts/generate-surface-docs.ts` is stale** vs the committed
  `docs/readme/ui-gallery.md`: regenerating clobbers the Journeys/`test:design`
  prose paragraph. Realign the template; the surface row itself was added by hand.

### A2 + A3 — provenance links resolve; demo density through one helper ✅

**A2 — derivation-record provenance.** `projectDerivationRecords` minted
`derived-from` links to `claim:<term>` blocks that need not exist, so a record
floated with edges to nothing. It now takes a `resolveTerm` resolver and mints a
link **only when the term resolves to a real block**; `projectWorkspace` builds
that resolver from the already-projected chat/reasoning block ids (a term
resolves to `claim:<term>` iff that block exists). When nothing resolves, the
record keeps its proof tree in the block body — the visible provenance — and no
dangling edge is drawn.

**A3 — demo density.** The `manyBodiesDemo` direct `$workspaceGraph` write is
extracted to one `seedBlocks(page, blocks)` helper (`tests/visual/matrix.ts`)
that documents *why* it bypasses the projection pipeline (deterministic density;
it proves the **renderer**, not the projection). Any cell whose question is what
the pipeline emits must project instead.

**Guard.** `tests/components/workspace-projection.test.ts` (+2): every projected
link endpoint is a block in the merged graph and phantom premise terms are
dropped; a resolver-less `projectDerivationRecords` call keeps the block and
drops every link.

**Verified.** typecheck; ui unit **680** (was 678); the `derivation-record-demo`
and `html-body-budget` visual cells pass with **no baseline move** — the 2d
viewport already filtered dangling edges (`graph-viewport.ts:1110`), so A2
changes no pixels and A3 emits byte-identical blocks.

**Remaining (A1) + notes.**
- **A1 landed** — see the entry above: a dedicated `$configChanges` store plus a
  `config-log` overlay, with the live graph write retained so the four auto-fit
  cells' baselines stay stable.
- **A2's resolver is per-call.** A general `merge()` invariant — drop any link
  whose endpoints are not blocks in the merged graph — would protect every
  future producer, not just `projectDerivationRecords`. Deferred: only this one
  producer could dangle today, and a second pass over links is not yet earned.
- **New opportunity — `provenanceRefs` are rendered only as evidence lineage.**
  The record body's tree already lists `evidenceLineage` per step, but the
  block's `provenanceRefs` (its declared evidence set) is never surfaced as a
  field of its own. A small "provenance" group in the tree — or an `s-inspector`
  row — would make the declared evidence legible without a new control.

### B3 — descriptor-driven view states ✅ (`states: ViewStates` + `ViewSource.loading`)

**What landed.** The view system now carries its own non-ready slots as *data*:

- `core/view-spec.ts` — `ViewSpec.states?: ViewStates` (`empty` / `loading` /
  `error`), each a `ViewStateSpec { icon?, heading, description? }`; plus
  `ViewSource.loading?(): boolean`.
- `core/view-sources.ts` — `viewSource(readable, project, loading?)` forwards an
  optional loading readable (subscribes to both, unsubscribes both).
- `core/view-host.ts` — `surfaceState()` returns `loading` first when
  `source.loading?.()`; `renderLoading`/`renderEmpty`/`renderError` delegate to a
  private `renderState(template, fallback, role)`: a named slot renders
  `<s-empty-state>` inside the existing `.slot` wrapper (so `role="status" |
  "alert"` is preserved), an unnamed slot keeps the previous generic text — **so
  no existing baseline moves**.
- States attached to the real specs: `EMBEDDED_VIEWS` (derivation /
  contradiction / topic), `GRAPH_VIEW_SPEC`, telemetry panel + HUD popovers,
  `overlay:events`, `overlay:nodes`, `cognitive-metrics`.

**Guard.** `tests/components/view-host.test.ts` (+3): named empty state renders
through `<s-empty-state>`; loading slot renders while `source.loading()` is true;
generic fallback when a slot has no template.

**Cell.** `view-empty` (`tests/visual/matrix.ts`, `mountEmptyView`) captures a
real `<s-view>` in its named empty state; baseline committed. Visual suite is now
**60** cells (was 59), all green.

**Reinterpretation (important for whoever continues B3).** The plan's "9 layouts"
(5 conversation + 4 reasoning) are **graph layouts** — they arrange the shared
graph viewport (`utils/layout-registry.ts` runs `preset`/`cytoscape` layouts over
`$workspaceGraph`); they are **not** independent `<s-view>` surfaces. Their
empty/loading/error experience is therefore the *graph surface's*, delivered by
the shell's `app-layout` empty overlay plus `GRAPH_VIEW_SPEC.states`. Giving each
layout a *distinct* state would require rendering layouts as separate view
surfaces, which the modeless paradigm explicitly rejects — so B3 is complete as
"the view system owns its states as descriptor data", not as 9 separate screens.

**Remaining (facilitating the rest of B3's intent).**
- No producer emits `ViewSource.loading` yet, so the loading slot is reachable
  but inert at runtime. The natural first consumer is the events overlay (or the
  graph surface): derive a boolean from `$connectionState` (`'connecting'` /
  `'reconnecting'`) and pass it as `viewSource`'s third argument. Guard on the
  `connected` states in the visual cells so baselines do not move.
- `graph-surface.ts` renders `GRAPH_VIEW_SPEC` with `chrome=false`; it could pass
  shape-appropriate `states` (e.g. the graph shape's "engine disconnected").

**New improvement opportunities (found while landing B3).**
- **`ViewStateSpec` wants an action.** Every real empty state ends with a verb
  ("Send a message"). The shell hardcodes that button in `app-layout`; a
  `ViewStateSpec.action?: { label; command }` would let a spec name its own
  recovery (and reuse the command registry), so the empty experience is data too.
- **`datasetIsEmpty` is a switch over `ViewDataset`** (`core/view-projection.ts`)
  — fold it into a per-kind descriptor (already on the D8 list) so adding a shape
  cannot forget its emptiness rule.
- **The `s-empty-state` `icon` is literal text.** It renders the string as a big
  glyph (see the `view-empty` baseline: "brain"), not an `<s-icon>`. Either wire
  it to the icon primitive or rename it `glyph`/`emoji` — a small legibility
  bug worth a cell.

### D5 — token SSOT, remove the `TOKENS.dark` bypass ✅ (standalone correctness fix)

**What landed.** `utils/theme.ts` now exports `numericToken(path, fallback?)` and
one `truthColor(frequency)`. `utils/graph-scaling.ts` and `utils/adapter-2d.ts`
read every numeric token through `numericToken` (no more `TOKENS.dark[…]
hardcoding dark); the three duplicated truth-hue scales — `adapter-2d`,
`components/node-detail-drawer.ts`, `modulation/compile.ts` — all call
`truthColor`. No `TOKENS.dark` read remains outside `theme.ts`.

**Guard.** `tests/theme.test.ts` (+1): `numericToken` reads a token and honours a
fallback for an unknown path; `truthColor(0|0.5|1)` → `hsl(0|60|120, 70%, 50%)`.

**No baseline moves.** The token values are theme-invariant today (`0/120/70%/50%`),
so the emitted strings are byte-identical; graph + node-detail cells verified.

**Note for whoever continues D5/E7.** `NODE_SIZE`/`ZOOM`/… are still `const`s
folded at *module import*, so a later `setTheme` does not re-read them. The
`numericToken` fix removes the hardcoded-dark choice; making the scales truly live
is E7's job (or a `derived` atom, E5). This is why D5 is a *correctness* fix, not
yet a theming feature.

### G1 — behavioral e2e gate ⚠️ blocked (groundwork landed)

**Landed.** The composer was refactored from `<input-hud>` to `<bottom-bar>`, but
the whole scenario suite still targeted `input-hud`, so composer-driven specs
failed on a missing locator instead of their own assertion. Retargeted the
interaction helper (`sendMessage`) and 9 specs to `bottom-bar`. This turns those
specs back into real behavioral checks (prerequisite for gating).

**What actually runs (chromium, serial — the shared agent-server cannot isolate
parallel tests; a 4-worker run flipped already-green specs red).** `@critical` =
**15 passed / 16 failed**. `@smoke`: `app-loads` green, `full-bot` red.

**Remaining rot — three kinds:**
- *Stale selectors / moved UI:* `switch-llm-provider` wants `lm-status-panel`,
  which is **defined but never mounted** (`app-layout` shows "LM: None" in the
  composer status strip instead); `adjust-parameters` wants
  `graph-toolbar button[title="Open settings dialog"]` (settings is now a
  palette-launched overlay); `parity` clicks a toolbar "3D" button that no longer
  exists (`graph-surface.ts:36` still renders `<spacegraph-viewport>` when
  `$viewportMode === '3d'`, so the toggle just moved); `backpressure` /
  `high-throughput` assert `error-boundary .overlay` `toHaveCount(0)`, which
  reports `undefined`.
- *Brittle absolute expectations:* metta `expect(count).toBeGreaterThanOrEqual(86)`
  now receives 85; auto-link/timeline compare against hardcoded counts instead of
  a captured `before`.
- *Behavior/environment:* multi-clause Narsese `<nova --> star>. ; <star -->
  celestial>.` yields **+1** node, not the +3 the test expects; NL inputs
  (`the cat is black`, `cats are animals…`) need an LLM provider — the test server
  runs `LM: None`; `full-bot` asserts `nars.maxConcepts` /
  `nars.activationDecayRate` in the `config` store, which no longer matches the
  store shape.

**To promote the subset into `ui:gate` (CI prerequisites, in `.github/workflows/
ci.yml`):** the gates job installs **no Playwright browsers** and sets **no LM
provider**; it runs `pnpm ui:gate` only. Wiring requires (a)
`pnpm exec playwright install --with-deps chromium`, (b) a provider for the NL
specs **or** rewriting them to deterministic Narsese, (c) `workers: 1` for the
scenario project (or per-test server isolation), and (d) fixing the rot above so
the gate is green before it is added. Until then, adding e2e to `ui:gate` would
make CI red — so it stays out.

### B1 — overlay drill-down breadcrumbs ✅ (with a manager-identity fix)

**What landed.** `OverlayManager` gains `subscribe(listener)` and notifies on every
stack change (open / reorder / close); the shared `overlay-header` renders a
breadcrumb trail — e.g. `Table of contents › Related` — for any overlay above the
bottom of the stack. Each crumb but the current one is a button; clicking it closes
every overlay above it (`stack.slice(index + 1).reverse()` → `close`), so focus
returns to that level via the closed overlays' own anchor restoration. A lone
overlay has no trail and keeps its title. No new global state — the trail is read
from the existing `#stack`.

**The blocking bug B1 exposed (and fixed).** The header read `getOverlayManager()`
(the module singleton) for `stack()`/`pinned()`, but `app-layout`'s `OverlayHost`
constructed its **own** `new OverlayManager(doc)` — so the header,
`workspace-host`'s `overlayManager.stack()`, and `provider.ts`'s
`overlayManager.setPinned` all read an empty manager *distinct* from the one the
shell opens overlays on. `OverlayHost` now defaults to the singleton
(`getOverlayManager()`), so there is genuinely "one OverlayManager" as its own doc
claims; a caller may still inject a manager (the host test passes a fresh one for
isolation). This also makes pin/stack reads real — a latent correctness fix that
moves no pixels.

**Guards.** `overlay-manager.test.ts` (+1): subscribers fire on open / reorder /
close and stop after unsubscribe. New `overlay-header.test.ts` (+2): a nested
overlay renders the trail, a root overlay renders its title, and clicking a crumb
closes everything above it. Visual: new `overlay-breadcrumb` cell (opens `toc`
then `related` over `basic-derivation`) + its baseline.

**Verified.** typecheck; ui unit **685** (was 682); design **11**; full visual
**62/62** (was 61; only the new baseline added, no other moved); craft **202**;
`pnpm complexity:budget` unchanged (it tracks the workspace `src/` roots, not
`ui/src`).

**Findings → notes for whoever continues.**
- **B1 did not need D3.** `overlay-header` is already the *one* shared header (14
  overlays use it), so the trail lands once regardless. D3's remaining payoff is
  only the registration-tail collapse, not the breadcrumb.
- **Capability-gated overlay cells capture nothing.** `overlay-explain` /
  `overlay-timeline` open a `reasoning`-gated overlay, but `reasoning` defaults
  **off**, so `OverlayHost.open` returns `false` and those cells snapshot the bare
  workspace. If those cells are meant to prove the overlay, seed `$capabilities`
  (or the scenario) to enable `reasoning` first — a follow-up.
- **`--update-snapshots` did not overwrite the new cell's existing baseline**;
  adding a cell worked only after `rm`-ing the stale file first. Regenerate with
  the baseline deleted when adding a cell.

**New improvement opportunities.**
- **Focus restoration is implicit.** Clicking a crumb relies on each closed
  overlay's `anchor`; an explicit "focus the target overlay's first focusable"
  (the manager could expose `focus(id)`) would make the "returns focus to that
  level" contract exact.
- **The header's host lookups are dead.** `getHostElement()` reads
  `document.getElementById(overlayId)` then `.closest('[data-surface]')`, but
  `OverlayHost.#element` never sets an `id` (and overlay hosts carry no
  `data-surface`), so `updateWindowState` and the minimize/maximize host-attribute
  sync are no-ops. Setting `element.id = descriptor.id` in `OverlayHost.#element`
  (and matching the header's lookup) would make the header's host identity real.

### B2 — LoD transition polish ✅

**What landed.** The LoD motion is now one token-driven policy. `graph-scaling.ts`
exports `LOD_TRANSITION` (`property`, `duration`, `easing`) read from `motion.*`
tokens, and every LoD surface draws from it:
- **Cytoscape** (`graph-viewport.ts`): the node selector's `transition-*` now comes
  from `LOD_TRANSITION`, replacing the magic `0.25s` with
  `motion.durations.normal` (200 ms) + `motion.easings.ease-out`.
- **Node body** (`node-body.ts`): `:host` transitions `max-height` at
  `var(--transitions-normal)`, so a `card`↔`full` tier flip slides instead of
  snapping.
- **Embedded views** (`render-block.ts`): `embedded` / `cappedEmbed` fade in
  (`lod-enter`, `var(--transitions-fast)`), so a projection appears rather than pops.
- **Reduced motion:** `base.css` zeroes durations globally, but that reaches only the
  light DOM — shadow-DOM animation needs its own guard, so `blockBodyStyles` carries
  `@media (prefers-reduced-motion: reduce)`. The host transition (`node-body`) is
  covered by the global rule (the host is light DOM).

**Guard.** `tests/craft/motion.test.ts` (+1): `LOD_TRANSITION.duration` is the
`motion.durations.normal` token, the easing is `motion.easings.ease-out`, the
duration lands in the 150–200 ms band, and the property list covers `width` +
`opacity`. Motion is not statically capturable, so this is the guard (a cell /
recording is not applicable).

**Verified.** typecheck; ui unit **687**; craft **204**; design **11**; full visual
**62/62** vs the existing baselines (**no baseline moved**); `complexity:budget`
unchanged.

**Notes.**
- Motion lives behind the `motion.*` / `transitions.*` tokens. The global
  reduced-motion block does **not** pierce shadow DOM, so any future component
  animation needs its own `@media (prefers-reduced-motion: reduce)` guard.
- `LOD_TRANSITION` is read at module import (like the other scales), so a live
  `setTheme` will not re-read it — same E7/E5 caveat as D5.

**New improvement opportunity.** A craft rule forbidding raw `\d+ms` / `\d+s` time
literals in chrome source would prevent future token bypasses (the Cytoscape
`0.25s` was one).

### G4 — error-taxonomy surfacing ✅ (folds D8's error-title map)

**What landed.** `UiError` now declares an abstract `title`, and each of the 15
error classes owns its heading (`Connection Lost`, `Budget Exhausted`, …);
`toJSON()` carries it. The boundary no longer re-lists a `getTitle()` map — it
reads `error.title` — so the taxonomy is the one owner of the title (D8).

The boundary was also wired to the **actual** bus. It subscribed to a `window`
`'app-error'` event that nothing ever dispatched, while errors leave on
`eventBus` (`emitError`, `demo-plugin`) — so the modal never opened for them.
`handleAppError` now takes `UiSignals['app-error']` through
`eventBus.on('app-error', …)` and unsubscribes on disconnect. `addError` logs the
class, code and surface with context.

**Guard.** New `tests/components/error-boundary.test.ts` (+3): every class owns a
non-empty, distinct title and keeps it through `createError`; and an `app-error`
on `eventBus` renders the modal with the title, code and a recovery action.

**Verified.** typecheck; ui unit **690** (was 687; craft/design included in
`vitest run`); full visual **62/62** with no baseline moved; `complexity:budget`
unchanged.

**Note for whoever continues.** `createError` matches the code against a
**class-name**-keyed map, so it only resolves via the `name` field (`toJSON`
includes it); and `BudgetExhaustedError` / `GateRejectedError` have an extra first
ctor arg, so their `createError` round-trip is lossy. Neither is on a live path
today (nothing reconstructs them from a bare code), but a follow-up should key the
map by `code` and build through a descriptor. The boundary also is not covered by
any visual cell — an `error-modal` cell (seed an `app-error` through a small
`mountTestApi('events', …)` seam) would prove the modal's pixels.

### G2 — performance budgets ✅ (store patch-in-place; the fixture asserts)

**What landed.** `updateNodeData` / `updateEdgeData` now patch **in place**: they
mutate the live `Map` and `set` it (the atom notifies unconditionally), instead of
`new Map($graphNodes.get())` on every call — so a dense graph stops allocating a
full copy per node/edge edit. `PerfMonitor.assertWithinBudget` is no longer inert:
the `perfMonitor` fixture already asserts in teardown, so the dense
`high-throughput` spec just requests it and the frame-budget check runs.

**Guard.** New `tests/components/store-patch.test.ts` (+3): a node/edge patch keeps
the same `Map` identity (no clone), replaces the entry while the old entry is
untouched, and notifies subscribers once; a miss neither clones nor notifies.

**Verified.** typecheck; ui unit **693** (was 690; craft/design included); full
visual **62/62** (store patches are not on a boot path — no baseline moved);
`complexity:budget` unchanged.

**Blocked / notes.**
- The dense-graph **e2e** spec (`high-throughput`, now requesting `perfMonitor`)
  cannot be exercised here: the `bootstrap` scenario yields no nodes in this
  environment, so the spec already times out at `getGraphNodeCount() > 0` — the
  same G1 blocker. The perf assertion is wired and will run once the e2e gate is
  green; it is not part of `ui:verify`.
- Deferred (larger): virtualizing the event log / large tables and a standalone
  frame-budget baseline. `togglePanel` still clones its 3-entry map — harmless,
  left for consistency with a future `$panels` catalog (E9).

### G3 — descriptor-derived a11y gate ✅ (keyboard half rides G1)

**What landed.** `SurfaceDescriptor` gains an optional `a11y` contract (`role`,
`label`, `keyboard`, `keyboardReason`). `surfaceA11y` now derives the target from
it — role defaults to `region`, the label to the title, keyboard to `true` — and
the 16 overlay descriptors declare `a11y: { role: 'dialog' }`, matching the
`role="dialog"` their templates already render (the descriptor had been silently
saying `region`). A new pure `validateSurfaceA11y` is the gate: it throws when a
surface has no label, no role, or drops keyboard access with no reason.

**Guard.** New `tests/design/a11y.test.ts` (+3): imports the surfaces, asserts
`validateSurfaceA11y(generateSurfaces().a11y)` passes, asserts every overlay
declares the dialog role, and asserts the validator rejects a missing label, a
missing role, and a silent keyboard opt-out (accepting a reasoned one).

**Verified.** typecheck; ui unit **696** (was 693); the generator test updated for
the new `keyboard` field. No runtime/rendering path changed (descriptors are data),
so baselines are untouched — visual not rerun.

**Notes / remaining.**
- The **keyboard-walkthrough half** ("add it to G1's gate") rides the blocked G1
  e2e gate; the descriptor half is now gated in the unit suite.
- Wiring each surface's rendered `role` / `aria-label` to read from its descriptor
  instead of literals is Track E's job — the descriptor is the SSOT now, the
  templates still hardcode.
- The a11y test deliberately does **not** import `renderers/graph*` (they pull in
  `graph-viewport`/cytoscape, which is jsdom-hostile); widen the import set if the
  gate should also span those renderer surfaces.

### D1 — `BLOCK_DESCRIPTORS`: one record per `BlockKind` ✅ (folds 6 maps + 3 if-chains; fixes `GRAPH_BLOCK_KINDS`)

**What landed.** New `core/block-descriptors.ts` owns one `BlockDescriptor` per
kind — `label`, `artifact`, `navigable`, `jsonPanel`, `graphRenderable`,
`container`, `section` — with a `d()` helper defaulting every facet to `false`, so
a new kind names only what it is (an unknown facet key is an excess-property
error). `BlockKind` now derives as `keyof typeof BLOCK_DESCRIPTORS` (F2);
`workspace-graph.ts` re-exports it, so every existing import keeps working.
`BLOCK_KINDS` (catalog order) and `kindsWhere(facet)` are the one way a partial
set is read.

Deleted the drifting copies and wired the consumers to the facet:
`BLOCK_KIND_LABEL` (removed; `block-labels.ts` + ~10 call sites read
`blockDescriptor(kind).label`), `ARTIFACT_KINDS` (`conversation-layout.ts`),
the `TOC_KINDS_TYPE` literal (`toc.ts`, now `kindsWhere(d => d.navigable)`),
`JSON_KINDS` (`artifacts.ts`), `isContainer` (`graph-projection.ts`),
`isSection` (`notebook.ts`) and `GRAPH_BLOCK_KINDS` (`renderers/graph.ts`, now
`kindsWhere(d => d.graphRenderable)`).

**Bug fixed.** `GRAPH_BLOCK_KINDS` omitted `derivation-record` and `command`; both
are now graph-renderable, so all 25 kinds are advertised. No pixel moved —
`renderersForKind` has no production caller today; the change only corrects the
renderer capability data.

**F5 seeded.** `block-payload.ts` now asserts at compile time that
`ArtifactKind extends BlockKind` — the payload catalog cannot name a kind the
descriptors do not declare.

**Guard.** New `tests/components/block-descriptors.test.ts` (+4): `BlockKind`
equals the catalog keys; every descriptor has a non-empty, distinct label; each
facet selects **exactly** its former map's set; and `graphRenderable` covers every
kind (pins the stale-map fix).

**Verified.** typecheck; ui unit **704** (was 700); design **14**; craft **204**;
full visual **62/62** — **no baseline moved**.

**Remaining / notes.**
- The plan's `renderBody`/`artifactSpec` descriptor fields were **not** added:
  they would pull `lit` + `artifacts.ts` into `core/block-descriptors.ts` and risk
  a cycle for no current drift — the render/artifact if-chains are behavior, not
  duplicated facets. Fold them only if a second consumer appears.
- `payload` stays in `block-payload.ts`: it is already a single source
  (`BlockPayloads` + `NORMALIZERS`); moving it onto the descriptor adds coupling
  without removing a duplicate.
- F2 remainder unchanged: panel ids still need a `PANEL_DEFS` catalog (E9).
- `tests/visual/matrix.ts` has a local `ARTIFACT_KINDS` fixture used only to pick
  a ref for the `overlay-artifact` cell; left as-is because its ordering is
  deliberate (the baseline depends on the chosen ref).
- **New opportunity.** `icon` on the descriptor — B3's `s-empty-state` renders a
  literal glyph; when that is wired to the icon primitive, the per-kind icon
  belongs on `BLOCK_DESCRIPTORS` (no consumer today, so deferred).

---

## Progress Log — LM provider flexibility (user directive)

> New goal: the best, most flexible LM provider system — multiple configured
> providers/models, instant switching, concurrent use — with a working **offline**
> model first ($1–4 GB local GGUF), WebLLM later.

### Offline-first multi-provider registry ✅

**The gap.** WebLLM (`ui/src/webllm.ts`) was fully written but unreachable: the
nar model factory consumed it only in the *engine process* (the Node server), and
`configureWebLLM` was never called. Separately, the dev/test engine was
`new NAR(DEFAULT_CONFIG)` with **no `providerRegistry`**, so `LM: None` and no
model was ever used — the config's `lm.provider: 'llamacpp-embedded'` was ignored
because the registry gated embedded on the **env** var only
(`embeddedLlamaConfigured()`), not the config `llamacppModelPath`.

**What landed.**
- `createSeNARSRegistry` now builds **every configured provider**, not just the
  active one (`nar/src/lm/providers/model-factory.ts`): cloud when a key/base URL
  exists, llamacpp when a host is set, embedded when `s.llamacppModelPath` exists
  on disk, webllm when the runtime is installed. `provider` now only selects the
  default chain — so switching needs no rebuild and distinct providers coexist.
- Runtime selection: `ProviderRuntime.setActiveProvider`/`getActiveProvider` (an
  override applied on top of `resolveLMSettings`), surfaced as `setActiveProvider`
  in the provider API; `LMService.selectProvider(provider, model?)` +
  `LMService.getCatalog()` (per-provider availability). `lm.switch` now *applies*
  (`server/index.ts`), and `lm.status` carries `available` per provider.
- Offline live **in the app**: `senars.config.json` sets `provider: llamacpp-embedded`
  + `llamacppModelPath`, and `lifecycle.createAgentFromEnv` already builds the
  registry + LM service, so `pnpm bot` runs the repo GGUF. `lmSettingsShape`
  (`util/src/config/lm-schema.ts`) gained the embedded-llama fields so the config
  can name a GGUF. The **test/dev server stays LM-less on purpose** — loading a
  0.5 GB model into the single-threaded engine blocks cycles and starves the WS,
  so automated runs must remain fast and deterministic.
- UI: provider descriptors carry `available` (`core/lm-provider.ts`),
  `providerUsable` disables engine providers the engine reports unavailable, and
  the `s-provider` overlay shows an `unavailable` state (the stale "restart"
  notice was reworded — switching is instant now). Removed the **dead, unmounted**
  `lm-status-panel` (also fixes its scenario's stale selector → composer status).

**Verified.** `createLMService()` with `configureLM({ provider: 'llamacpp-embedded',
llamacppModelPath })` reports embedded available and `generateText(...)` returns
text (~4.8 s incl. load); `selectProvider('mock'|'transformers'|
'llamacpp-embedded')` flips instantly with a correct catalog. Gates unchanged:
typecheck, workspace **3402**, ui unit **678**, design **11**, craft **202**,
visual **60** (no baseline moves). `productionLOC` ledger ratcheted 72689 → 72758
(the workspace `src/` roots, not `ui/src`).

**Known gap / next.**
- **WebLLM browser bridge.** WebLLM still cannot run: the engine is Node-side and
  there is no in-browser NAR engine. To make it work, add a server↔browser
  generation bridge (server sends `lm.generate.request`, the browser runs WebLLM
  and returns; a proxy `LanguageModel` in nar), with the server-side providers as
  fallback. The `kind: 'browser'` catalog entry is the seam. It also can't be
  verified without WebGPU in CI.
- **Engine LM is on the cycle's critical path.** NL understanding issues ~15
  blocking model calls per chat turn; on a CPU GGUF that stalls a single-threaded
  server. Streaming/off-thread execution (or a faster model) is the real fix.
- **Model downloader/comparer.** A tool to fetch GGUFs and compare (quality/
  latency/size) so users can choose; local models are Qwen3.5-0.8B (fast, 0.56 GB)
  and gemma-4-E2B (quality, 3.35 GB).
- Runtime switching across *cloud* variants shares one `cloud` registry entry, so
  its base URL is fixed at boot — revisit if cloud multi-select is needed.

---

## Future Sessions — LM Provider Roadmap (planned, not started)

> Sequenced so each session ends with a green gate and a usable increment.
> Groundwork already landed: coexistence registry, `setActiveProvider` override,
> `LMService.selectProvider`/`getCatalog`, `lm.switch`/`lm.status` with
> availability, `s-provider` overlay, offline GGUF in `senars.config.json`.

### F-LM-1. WebLLM browser bridge (in-browser inference)

**Why it can't run today.** `ui/src/webllm.ts` is complete, and
`nar/src/lm/providers/model-factory.ts` consumes a runtime from
`ProviderRuntime.getWebLLMRuntime()` — but that factory runs in the **engine
process (Node)**, where there is no `navigator`/WebGPU, and no in-browser NAR
engine exists (`entry-standalone` is engine-free). `configureWebLLM` is never
called. The `kind: 'browser'` catalog entry (`ui/src/server/index.ts`) is the seam.

**Design — a server↔browser generation bridge.**
1. **Protocol** (`core/src/protocol/`, alongside `LMSwitchMsg`):
   `lm.generate.request { id, model, messages, temperature?, maxOutputTokens?,
   responseFormat? }` (server→client); `lm.generate.response { id, text, usage?,
   error? }` and (streaming) `lm.generate.delta { id, delta }` +
   `lm.generate.end { id, finishReason?, usage? }` (client→server).
2. **nar port** — mirror the `WebLLMRuntime` seam with a `BrowserLmDelegate`:
   `{ generate(req): Promise<{text,usage?}>; stream?(req): AsyncIterable<string> }`.
   Add `ProviderRuntime.configureBrowserDelegate(delegate)` /
   `getBrowserDelegate()` (and a delegated module API like `providers/webllm.ts`).
   Build `webllm:quality|fast|structured|compact` as a **proxy `LanguageModelV3`**
   that forwards to the delegate (not to `createWebLLMModel`, which is browser-only).
3. **ui/server** — on `lm.switch webllm` from a socket, register that socket as the
   host delegate (single-host: the opt-in socket; clear on close/disconnect, then
   the chain falls through to builtin/mock). Correlate by `id`; time out (~60 s) →
   error → circuit breaker.
4. **ui/client** — handle `lm.generate.request` by running
   `webllmRuntime.createModel(model)` (`doGenerate`/`doStream`), replying with
   response/deltas. The existing "Run locally" affordance already signals intent;
   surface load progress via the model progress callback.
5. **Fallback** — no host / no WebGPU ⇒ `getBrowserDelegate()` undefined ⇒ the
   webllm rungs are omitted and the chain degrades to `builtin`/`mock` (already).

**Acceptance.** With a fake delegate installed server-side, a webllm-model call
routes through the delegate and returns its text (unit test; no GPU). In a
WebGPU browser, `lm.switch webllm` makes a chat answer come from WebLLM; killing
the tab falls back to the server provider without wedging the cycle. A gate that
fails when the proxy is bypassed.

**Risks.** No WebGPU in CI → gate the protocol/proxy with a fake delegate; mind
per-socket ownership vs the process-global LM service; streaming back-pressure;
reconnect mid-generation.

**Files.** `core/src/protocol/chat.ts`, `core/src/protocol/unions.ts`,
`nar/src/lm/provider-runtime.ts`, `nar/src/lm/providers/model-factory.ts`,
`nar/src/lm/providers/` (new `browser-delegate.ts`), `ui/src/server/index.ts`,
`ui/src/client/core/lm-transport.ts` + a new client delegate handler,
`ui/src/webllm.ts` (reuse).

### F-LM-2. Model downloader / comparer tool

**Goal.** Fetch compact GGUFs on demand and compare them (quality / latency /
size) so users choose well; eventually expose a picker in the UI.

**Design.**
- **Fetch** — `scripts/model-tool.ts`: `list` (a small recommended catalog:
  Qwen3.5-0.8B ~0.56 GB, gemma-4-E2B ~3.35 GB, and 1–4 GB alternates),
  `pull <repo>:<file>` → download from the HF resolve URL into `.models/` with
  progress (learn from `scripts/fetch-model.ts` if present).
- **Bench/compare** — for each model: `configureLM({ provider:
  'llamacpp-embedded', llamacppModelPath })` (or `setActiveProvider`), run a fixed
  prompt set, read `LMService.getStats()` + `getSpend()` + the routing ledger,
  print a table (tokens/s, p50/p95 latency, pass@N on a small Narsese/NL set).
- **Select** — write the chosen `llamacppModelPath` (optionally per task) into
  `senars.config.json`; the UI picker (F-LM-3) can call the same list.

**Acceptance.** `pnpm model:pull <repo>:<file>` fetches to `.models/`;
`pnpm model:compare` prints a deterministic table; a model listed as available
in `getCatalog()` answers `generateText`.

**Risks.** Network in CI (gate offline with a fixture); disk/size; license.

**Files.** `scripts/model-tool.ts` (+ a `model:*` script in `package.json`),
reuse `nar/src/lm/providers/embedded-llamacpp.ts` (`probeEmbeddedLlama`).

### F-LM-3. Per-task / concurrent model selection in the UI

**Goal.** Pin different providers/models per LM task and use several at once —
the "ideal" the directive asked for. nar already supports this: `getModelForTask`
accepts `modelOverride`, and `setRouting({ candidates, objectives, offlineLadder })`
exists; the registry now holds every provider.

**Design.**
1. **nar** — `LMService.setModelForTask(task, modelId | undefined)` (persist via
   `configureLM`/routing; the process-global default `ProviderRuntime` already
   carries routing). Expose assignments in `getRoutingStatus()` →
   `{ policy, perTask, demoted, lastDecision }`.
2. **Protocol** — `lm.status` carries `perTask: Record<LMTask, modelId>`;
   add `lm.route.set { task?, modelId }` (and keep `lm.switch` for the default).
3. **UI** — extend `s-provider` (or a sibling "Routing" surface) with a
   task→model map: rows for `quality|fast|structured|compact`, each a select over
   the catalog's available `provider:slot` ids, plus "default". Read
   `$lmProvider.perTask`; write via `lm.route.set`.
4. **Concurrency** — per-call `modelOverride` already lets one cycle's tasks use
   different providers simultaneously; document the pattern and, if desired, add
   a "pin model" control on individual views.

**Acceptance.** A unit test pins `fast → builtin:mock`, `quality → builtin:quality`
and asserts `getModelForTask(registry, 'fast'|'quality')` resolves each; the
overlay renders and edits the map, and `lm.status` round-trips it.

**Risks.** Persisting per-task choices across restarts; conflict with routing
policy candidates (define precedence: per-task pin > routing policy > chain).

**Files.** `nar/src/lm/service/LMService.ts`, `nar/src/lm/providers/routing.ts`,
`core/src/protocol/chat.ts`, `ui/src/server/index.ts`,
`ui/src/client/core/lm-provider.ts` + `lm-transport.ts`, `s-provider` overlay.

### Cross-cutting (worth doing alongside)

- **Engine LM is on the cycle's critical path.** NL understanding issues ~15
  blocking calls per chat turn; a CPU GGUF stalls a single-threaded server.
  Off-thread/streaming execution (or a smaller model + caching) is the real fix.
- **Cloud multi-select.** One `cloud` registry entry fixes its base URL at boot;
  split per cloud variant if cloud + local concurrency is needed.

---

## Verification — does this plan reach the two goals?

**Goal 1 — a working, useful, robust SeNARS UI.**
**Goal 2 — an abstract, flexible foundation for growth into any application domain.**

### Evidence of the current state (v10, all green)

- `pnpm --dir ui verify`: typecheck + **673** unit + **11** design + **59** visual
  cells + **202** craft — green.
- **24 e2e scenario specs** exist: cognitive (7), configuration (3), conversations
  (3), resilience (3), relational (2), accessibility, security, spatial-parity,
  smoke, metta, full-bot, impressive-demo.
- The UI is wired to the real engine: `state.snapshot`, `node.history`, streaming
  chat, tool approval, and a real `derivation.record` projection (Move 2.9).

So the product is **substantially built** — well past the master plan
`TODO.ui.md`'s stale Phase 4.6 checkboxes.

### Coverage matrix — v11 tracks × goals

| Goal | A (bugs) | B (legibility) | C (spikes) | D/E/F (substrate) |
|---|---|---|---|---|
| Working | ✅ fixes 3 bugs | ✅ B1/B3 add affordances | ⚠️ deferred | ✅ enables |
| Useful | ✅ A2 makes provenance visible | ✅ B1/B3 | ⚠️ | — |
| Robust | ✅ A1/A3 | — | — | ✅ F5 compile guards |
| Any-domain foundation | — | — | ⚠️ all no-Go-likely | ✅✅ |

### The three gaps that block the goals

**G1 — the behavioral tests do not gate.** `ui:verify` runs
typecheck/unit/design/visual/craft but **not `test:e2e`**; the CI `ui:gate` is
typecheck + unit only (`scripts/lib/gates.ts:120`). The 24 e2e specs — resilience,
security, accessibility, spatial parity — can rot. Master-plan **11.4** ("scenario
seeds + visual regression in `pnpm gates`") is unchecked. *A UI that passes
`verify` can still be broken.*

**G2 — the performance harness is inert.** `PerfMonitor.assertWithinBudget`
(`tests/framework/utils/perf.ts`) exists but **no spec calls it**; the
`high-throughput` spec asserts only `nodeCount > 0` + no errors. The store clones
whole `Map`s per patch (`store.ts:510`, `:524`). No frame-budget assertion runs
anywhere. Master-plan **11.1** is unstarted and absent from v11.

**G3 — "any domain" is asserted, not proven.** Tracks C1–C4 are all "≤1 day,
likely no-Go"; **no second domain** (a non-cognitive bundle) is built. E6 (bundles)
enables product *variants*, but every ingredient still reads the cognitive stores.
The claim is architectural, not demonstrated.

### Verdict

| Goal | Verdict |
|---|---|
| Working | ✅ already true; v11 preserves it (D5 fixes a real theme bug) |
| Useful | ✅ already true; v11 adds B1/B3 marginally |
| Robust | ✅ **stronger** — A fixes 3 bugs, F5 adds compile guards, G2/G3/G4 close the perf/a11y/error gaps; only the e2e gate (G1) remains blocked |
| Any-domain foundation | ⚠️ **plausible, unproven** — D/E/F build the seams; no second domain demonstrates them (G3) |

**Conclusion: v11 is necessary but not sufficient.** It deepens the substrate
(D/E/F) and fixes known bugs (A), but it is **not** a robustness plan (no
perf/a11y/gating) and **not** a proof of domain-generality (no second bundle). To
*ultimately achieve* both goals, add **Track G** and promote **G1** to a standing
rule.

---

## Typical User Experience (the acceptance target)

> The plan is judged by one journey. Dana, a developer, asks *"Is the server
> reachable?"* and must be able to **decide whether to trust the answer** — seeing
> real state and provenance, learning no new control. Each beat names the surface
> and the track that makes it true. This is the concrete form of the north star.

| # | Beat | Surface | Delivered by |
|---|---|---|---|
| 0 | Arrival: connected, non-blank, plain-language status | `app-layout`, `connection-banner`, `s-empty-state`, status strip | **B3**, G3, 5.3 |
| 1 | Ask in natural language; the manifold judges before parsing | `bottom-bar`, ingress | exists; 6.4 |
| 2 | The turn becomes a node; the graph grows live | `graph-viewport`, projection | Move 2.6 ✅ |
| 3 | Select a claim → highlights in the graph | one `ViewSelection` | `chat-graph-context` ✅ |
| 4 | Zoom through LoD; the body embeds its children (bounded) | `s-node-body`, `render-block` | **B2**, Move 2.1–2.5 ✅ |
| 5 | Inspect: truth-history, revision diff, provenance | `s-inspector` | 6.1; **B1** breadcrumbs |
| 6 | Follow provenance; verify independently | `s-explain`, verifier | 6.2 |
| 7 | Watch System 1→2→gates; proposal ≠ conclusion | pipeline view | 6.4 |
| 8 | Hit a limit: explicit `TerminationReason` | resource panel | 6.5 |
| 9 | Filterable append-only event log; export | `s-events` | 6.6 |
| 10 | Switch shape: graph/table/tree/text/code/diff | `<s-view>` | Phase 4 (partial) |
| 11 | ⌘K palette indexes every registry | `s-palette` | 5.2 |
| 12 | Disconnect → reconnect → resync; specific errors | banner, `error-boundary` | exists; G4 |
| 13 | Run a seeded scenario against the real engine | Run view | **G6** |
| 14 | A second product from a bundle, no forks | `applyBundle` | **G5**, E6 |

**The one-line test across the session:** every beat makes reasoning more visible
and asks the user to learn **no new control** — chat, click, zoom, ⌘K are the only
verbs.

### The three experience-critical risks (from the journey)

1. **Scale.** Every beat assumes tens of nodes. At thousands, whole-`Map` clones
   (`store.ts:510`) and un-virtualized logs bite. **G2 is not optional** — it is
   what makes beats 2/4/9 hold at real density.
2. **The empty path.** Beat 0 is only good if **B3** lands; today the graph has a
   state, conversation/reasoning layouts do not.
3. **The demo claim.** Beat 13 is the only beat exercising the full loop as a user
   would; if the e2e scenarios do not gate (**G1**), trust is verified by hope.

### Coverage note

Beats 2/3/4 are already true (v10); beats 5–9, 11, 13 are the master-plan Phases
5–6/10 that v11 does **not** cover. So the experience target is **half-met**: the
paradigm is proven, the *explorer* half (provenance, pipeline, resources, demo) is
future work. The fresh session should decide whether v11 stays a substrate plan
(with G as the product bridge) or folds Phases 5–6 in.

---

## Track A — Fix Broken Things (do first, highest payoff)

### A1. Config-change audit trail → dedicated log/HUD surface

**Problem:** `config-change-producer.ts:65` writes `config-change` blocks directly to `$workspaceGraph`. The next `syncWorkspaceGraph()` (triggered by any chat/engine change) calls `projectWorkspace()` which creates a **new** `WorkspaceGraph`, wiping the audit blocks. A projection-based fix was attempted and reverted — two traps: (1) server config hydration bursts 5 `Config:` nodes on load; (2) projecting as graph roots perturbs auto-fit of 4 timed cells non-deterministically (`panel-search`, `overlay-toc`, `panel-lens-designer`, `layout-budget-resource`).

**Files:**
- `ui/src/client/core/config-change-producer.ts` — direct write to `$workspaceGraph`
- `ui/src/client/core/workspace-bindings.ts:24` — `syncWorkspaceGraph` replaces entire graph
- `ui/src/client/core/workspace-projection.ts:523` — `projectWorkspace` merges fragments

**Solution:** Keep config diffs **out of the graph root set**. Options:
- Dedicated `$configChanges` store + HUD overlay (not a graph projection)
- Audit blocks with `role: 'audit'` that are filtered from `roots` in `projectWorkspace` (but still queryable)
- Log panel in bottom bar (like a console for config)

**Acceptance:**
- Config changes persist across `syncWorkspaceGraph` calls
- No graph perturbation (visual baselines stable)
- Config hydration on load does not burst 5 nodes
- User can view history in a dedicated surface (overlay or panel)

---

### A2. Derivation-record provenance links float unlinked

**Problem:** `workspace-projection.ts:484–505` creates `derived-from` links from derivation-record steps to `claim:<term>` refs. Those claim blocks **may not exist** (the terms aren't in the current engine snapshot), so the derivation-record node floats with invisible provenance edges.

**Files:**
- `ui/src/client/core/workspace-projection.ts:484–505` — `projectDerivationRecords` creates links to `claim:${premise}` / `claim:${conclusion}`

**Solution:** Two paths, pick one:
1. **Wire premises to real blocks:** In `projectDerivationRecords`, resolve each premise/conclusion term to an existing block in the merged graph (from `projectChat` + `projectReasoning`). If found, link to that block; if not, drop the link (don't create dangling refs).
2. **Embed provenance in the block:** Store the term strings in `provenanceRefs` (already done at line 479) and render them in the derivation-record body via `renderBlockBody` — no graph links needed.

**Acceptance:**
- `derivation-record-demo` cell shows visible provenance (either graph edges or rendered in body)
- No `derived-from` links to non-existent `claim:<term>` refs
- `projectDerivationRecords` unit test asserts link targets exist in merged graph

---

### A3. Demo cells bypass projection (`manyBodiesDemo`)

**Problem:** `tests/visual/matrix.ts:435–472` (`manyBodiesDemo`) seeds `$workspaceGraph` directly with synthetic blocks. It does not exercise the projection pipeline (`$chatMessages → syncWorkspaceGraph → projectChat → ...`), so a budget regression at the projection layer would not be caught visually.

**Files:**
- `ui/tests/visual/matrix.ts:435` — `manyBodiesDemo` prepare function
- `ui/tests/visual/matrix.ts:667` — cell registration

**Solution:** Create a shared `seedBlocks` helper that:
- Documents the bypass (explicit comment: "Direct write for test density; does not exercise projection")
- Or better: feeds the budget cell a synthetic projection via `projectWorkspace` with fabricated `ChatMessage[]` that segment into many blocks

**Acceptance:**
- `html-body-budget` cell still captures the budget badge
- Cell either uses `seedBlocks` helper (documented bypass) or exercises real projection
- If synthetic projection: `typecheck` + repeat capture confirms determinism

---

## Track B — Deeper Legibility (compound payoff)

### B1. Overlay drill-down breadcrumbs

**Problem:** Overlay system (`overlay-manager.ts`, `overlay-host.ts`, `overlay-registry.ts`) supports stacking, pinning, windowing — but no way to navigate "back" from a nested overlay (e.g., artifact viewer → explanation popover → related blocks). User loses context.

**Files:**
- `ui/src/client/core/overlay-manager.ts` — `OverlayManager` class, `#stack`, `open()`, `close()`, `stack()`
- `ui/src/client/core/overlay-host.ts` — `OverlayHost` component
- `ui/src/client/components/overlays/overlay-header.ts` — header with minimize/maximize/close

**Solution:** Add a breadcrumb trail to `overlay-header` (or a dedicated breadcrumb bar):
- Read `overlayManager.stack()` (bottom → top)
- Render as clickable segments: `Graph → Artifact → Explanation → Related`
- Clicking a segment closes all overlays above it (focus returns to that level)
- Only show when stack depth > 1

**Acceptance:**
- Nested overlay stack shows breadcrumb trail in header
- Clicking a crumb closes overlays above it, restores focus to that overlay
- `Esc` still closes topmost; breadcrumb is an additional affordance
- No new global state — reads existing `#stack`

---

### B2. LoD transition polish

**Problem:** Glyph→label→card→full works (`graph-scaling.ts:119–135`, `getLoDTier`) but transitions feel mechanical — no visual continuity, no easing, no "intention" feel.

**Files:**
- `ui/src/client/utils/graph-scaling.ts:119–135` — `getLoDTier` thresholds
- `ui/src/client/components/node-body.ts` — `tier` property, `card`/`full` styles
- `ui/src/client/utils/render-block.ts` — `cappedEmbed` vs `embedded`
- Cytoscape style updates in `adapter-2d.ts` / graph renderer

**Solution:** Add transition affordances:
- CSS `transition` on node size/label opacity in Cytoscape styles (`adapter-2d.ts`)
- `s-node-body` tier change uses `animation` (slide/fade) instead of instant swap
- `embedded` ↔ `cappedEmbed` cross-fade (not pop)
- Respect `prefers-reduced-motion`

**Acceptance:**
- Zooming through LoD tiers feels smooth, not jarring
- Node size/label opacity animates (150–200ms)
- Tier change in `s-node-body` animates
- `prefers-reduced-motion` disables animations
- No layout thrashing during transition

---

### B3. Per-layout empty/loading/error states

**Problem:** Only the graph has an empty state (`app-layout.ts:222–238` — `<s-empty-state>`). Conversation layouts (`conversation-layout.ts`) and reasoning layouts (`reasoning-layout.ts`) render through `<s-view>` which has generic `renderEmpty()`/`renderError()` in `view-host.ts:65–71` ("No data", "No view adapter for this shape").

**Files:**
- `ui/src/client/components/app-layout.ts:222–238` — graph empty state
- `ui/src/client/core/view-host.ts:65–71` — generic empty/error slots
- `ui/src/client/core/conversation-layout.ts` — 5 conversation layouts
- `ui/src/client/core/reasoning-layout.ts` — 4 reasoning layouts
- `ui/src/client/primitives/empty-state.ts` — `<s-empty-state>` component

**Solution:** Each layout registers its own empty/loading/error template via the layout registry or view spec:
- Conversation layouts: "No conversation yet — send a message", "Loading turns…", "Failed to load"
- Reasoning layouts: "No reasoning trace", "Engine disconnected", "Budget exhausted"
- Graph: keep existing (works)
- Use `<s-empty-state>` with layout-specific icon/heading/description/action

**Acceptance:**
- Every layout (9 total) shows meaningful empty/loading/error state
- States use shared `<s-empty-state>` component (consistent style)
- Loading state shows while projection is in-flight (subscribe to source)
- Error state surfaces projection errors (not just "no adapter")

---

## Track C — Move 3 Gate Evaluation (spikes only, ≤1 day each)

> **Rule:** A spike that fails its gate is documented and closed. No implementation without a proven payoff.

### C1. Content adapter spike (fs · AST · call-graph · series · doc → graph)

**Question:** Can we demo **one** non-conversation source (e.g., file tree → graph) in <1 day?

**Spike:**
- Pick simplest source: filesystem tree (no parsing)
- Write `projectFiles` in `workspace-projection.ts` style: `readonly FileNode[] → WorkspaceFragment`
- Register as a backend in `workspace-bindings.ts` (like `narsBackend`/`mettaBackend`)
- Visual cell: `file-tree-demo` showing directory as graph

**Go/No-Go:**
- ✅ Go if: spike works in <1 day, cell renders, projection is pure/deterministic
- ❌ No-Go if: requires new substrate, or projection is not pure, or >1 day

---

### C2. Semantic-zoom morph spike (Chat⇄Notebook⇄Graph interpolation)

**Question:** Is there a shared coordinate space between Chat/Notebook/Graph?

**Spike:**
- Investigate: Do all three projections share a stable node ID space? (Yes: `turn:<msgId>`, `claim:<nodeId>`, `blk:<msgId>:<idx>`)
- Can a zoom gesture in Graph morph to Notebook column position? (Notebook is flex-column, not zoomable)
- Can a selection in Chat highlight in Graph? (Already works: `notebook.ts:424` calls `setWorkspaceSelection`)

**Go/No-Go:**
- ✅ Go if: shared coordinate space proven + concrete morph affordance designed
- ❌ No-Go if: coordinate spaces are fundamentally different (likely)

---

### C3. Node-renderer registry needfinding

**Question:** Does a 5th renderer (timeline, chat, 3D) need the shared descriptor?

**Spike:**
- Inventory current renderers: `graph` (cytoscape), `series`, `tree`, `text`, `code`, `diff` (6 shapes in `view-adapter.ts`)
- Check: Does any surface need to *dynamically* register a renderer? (No — all known at build)
- Check: Would a timeline renderer share the `ViewSpec` descriptor? (Yes, but doesn't need a registry)

**Go/No-Go:**
- ✅ Go if: a concrete 5th renderer is requested and needs dynamic registration
- ❌ No-Go if: current 4-tier `renderBlockBody` + `embedded` covers all cases (likely)

---

### C4. `graph3d` spike (3D-only affordance for fractal depth)

**Question:** Does 3D do something 2D *cannot* for fractal depth (z-axis embedding)?

**Spike:**
- Current: fractal depth = nested `<s-view>` in node body (2D, works)
- 3D idea: embed depth → z-axis position, so you "fly into" a node
- Check: Does `spacegraph` (three.js) support this? (`spacegraph-viewport.ts` exists)
- Check: Is there a user need for spatial fractal navigation?

**Go/No-Go:**
- ✅ Go if: concrete 3D-only affordance designed (e.g., "fly into node" = z-zoom)
- ❌ No-Go if: 2D nested view already solves it (likely)

---

## Track D — Consolidation & SSOT (ride along with A/B/C; each lands with its enabler)

> **Rule:** every refactor below is *justified by a feature it enables* — no pure
> cleanup for its own sake. Each lands in the same commit as the track that needs
> it, so `verify` stays green and the diff stays legible. The payoff is the
> paradigm's own rule generalised: **one descriptor, many consumers.**

### D1. `BLOCK_DESCRIPTORS` — one record per `BlockKind` (highest leverage)

A `BlockKind`'s facets live in 6+ partial maps and 3 if-chains that drift:
`BLOCK_KIND_LABEL` (`core/block-labels.ts:9`, the only exhaustive one),
`ARTIFACT_KINDS` (`core/conversation-layout.ts:78`), `GRAPH_BLOCK_KINDS`
(`components/renderers/graph.ts:30` — **stale**), `JSON_KINDS`
(`core/artifacts.ts:134`), `TOC_KINDS` (`core/toc.ts:16`),
`BlockPayloads`/`NORMALIZERS` (`core/block-payload.ts:105`/`:215`),
`isContainer` (`core/graph-projection.ts:52`), `isSection`
(`components/renderers/notebook.ts:42`), and the render if-chains
(`utils/render-block.ts:142`, `core/artifacts.ts:143`).

**Refactor — `core/block-descriptors.ts`:**
```ts
interface BlockDescriptor {
  label: string;
  artifact: boolean;        // ARTIFACT_KINDS
  navigable: boolean;       // TOC_KINDS
  jsonPanel: boolean;       // JSON_KINDS
  graphRenderable: boolean; // GRAPH_BLOCK_KINDS
  container: boolean;       // isContainer
  section: boolean;         // isSection
  payload: PayloadDescriptor;              // BlockPayloads + NORMALIZERS
  renderBody?: (block: SemanticBlock, ctx: BodyContext) => unknown; // render-block chain
  artifactSpec?: (block: SemanticBlock) => ViewSpec;               // artifacts chain
  icon?: string;
}
export const BLOCK_DESCRIPTORS = { turn: {…}, … } satisfies Record<BlockKind, BlockDescriptor>;
export const blockDescriptor = (kind: BlockKind): BlockDescriptor => BLOCK_DESCRIPTORS[kind];
```
`satisfies Record<BlockKind, …>` makes the **compiler the guard**: a new kind
cannot land with a facet missing. Every consumer becomes
`blockDescriptor(kind).artifact` / `.renderBody(block)` — the if-chains become
table lookups (table-driven dispatch).

**Enables:** Track B3 (a layout's empty state reads `descriptor.icon`), the "one
rendering" rule generalised (body and artifact are two fields of one descriptor),
and it **deletes the `GRAPH_BLOCK_KINDS` staleness bug**.

### D2. Extend `LINK_CATALOG` — link facets join the one catalog

`utils/link-catalog.ts:33` is already the SSOT for link label/category/style, but
two facet maps sit outside it and drift: `SYMMETRIC_LINK_KINDS`
(`core/workspace-projection.ts:49`) and `GATE_STAGES`
(`core/reasoning-layout.ts:108`). `graph-viewport.ts:704` also hardcodes
`edge[type="derivation"]` styling, bypassing `linkMeta(kind).edgeStyle`.

**Refactor:** add `symmetric: boolean` and `layoutStage?: number` to `LinkMeta`;
delete both partial maps; `canonicalizeLink`/`deduplicateSymmetricLinks` read
`linkMeta(kind).symmetric`; route the derivation edge style through the catalog.

**Enables:** Track A2 (provenance links resolve through one catalog), edge-style
correctness.

### D3. `defineOverlay` + `WINDOW_DEFAULTS` — one registration tail

16 overlay components repeat the same 4-step tail — `defineSurface` +
`registerOverlay` with an `id/title/tag` triple + a global tag map (e.g.
`overlays/nodes.ts:276–289`) — and 8 repeat the identical
`window: { draggable, resizable, minimize, persist }` literal.

**Refactor — `core/overlay.ts`:**
```ts
const WINDOW_DEFAULTS = { draggable: true, resizable: true, minimize: true, persist: true } as const;
export function defineOverlay(
  descriptor: SurfaceDescriptor & { window?: OverlayWindowOptions | 'standard' },
  ctor: CustomElementConstructor
): void {
  defineSurface(descriptor, ctor);
  registerOverlay({
    ...descriptor,
    tag: surfaceTag(descriptor),
    window: descriptor.window === 'standard' ? WINDOW_DEFAULTS : descriptor.window,
  });
}
```
Each overlay collapses to one `defineOverlay({ id, title, window: 'standard' }, XView)`.

**Enables:** Track B1 — the breadcrumb trail lands **once** in `defineOverlay`'s
generated header, not 16×.

### D4. One layout descriptor registry (merge conversation + reasoning)

`layout-registry.ts:225–243` and `:257–275` are near-identical registration
loops; `COLUMN`/`ROW` are duplicated (`conversation-layout.ts:74`,
`reasoning-layout.ts:56`); `SOURCE_ORDER`/`CREATED_BY_ORDER` are byte-identical;
`sourceView`/`budgetResource` are the same lane algorithm; each id is written 3×
(union, IDS array, catalog key).

**Refactor:** one `LayoutDescriptor { id, label, description, scope,
recommendedFor, positions, surface, states }`; a single registry loop; a shared
`placeInLanes(blocks, { COLUMN, ROW, order })`; derive ID arrays from catalog
keys. `validateLayoutId` (`core/contribution-validator.ts:164`, currently
**never called**) is wired into `validateAllContributions`.

**Enables:** Track B3 — the descriptor carries `states` (empty/loading/error
templates), so per-layout states are **data, not code**.

### D5. Token SSOT — remove the `TOKENS.dark` bypass (correctness bug)

`utils/graph-scaling.ts:10` and `utils/adapter-2d.ts:8–13` read `TOKENS.dark[…]`
directly instead of `utils/theme.ts:token()`, **hardcoding the dark theme**. The
truth-hue scale `hsl(…)` is reimplemented in 3 files (`adapter-2d.ts:17`,
`node-detail-drawer.ts:357`, `modulation/compile.ts:22`).

**Refactor:** `theme.ts` exposes `numericToken(path)`; both files import it. Add
one `truthColor(frequency)` helper shared by all three. `theme.colors` getters
generated from the token table.

**Enables:** Track B2 (LoD transition colors must be theme-aware). **This is the
one Track D item that may land standalone** — it is a live correctness bug.

### D6. `createRegistry<K, V>` — one registry shape (metaprogramming seam)

`surface-registry.ts:34`, `overlay-registry.ts:42`, `view-adapter.ts:17` and the
renderer registry are four structurally identical `Map` + `register`/`get`/`all`
closures with divergent getter names.

**Refactor — `core/registry.ts`:** `createRegistry(keyOf)` returning
`{ register, get, all, byKey }`; each domain instantiates it. The
descriptor→registration boilerplate half is already covered by D3.

**Enables:** D3; makes every registry enumerable for tests **without mocks**
(per AGENTS.md).

### D7. Projection `fragment()` builder + `systemEventBlock()`

`core/workspace-projection.ts` repeats the `{ blocks, links, roots }` skeleton 4×
(`:123`, `:239`, `:331`, `:436`), the `deduplicateSymmetricLinks` return 4×
(`:205`, `:319`, `:425`, `:508`), and `projectCognitiveEvents` repeats a
near-identical block literal 5× (`:339–418`). `projectDerivationRecords`
re-types `DerivationRecordData` inline (`:442–464`) instead of importing it from
`core/block-payload.ts`.

**Refactor:** a `fragment()` accumulator (`.block()/.link()/.root()/.finish()`)
and `systemEventBlock(event, { id, kind, title, text })`; import the payload
types from `block-payload.ts`.

**Enables:** Track A2 (provenance is built through the accumulator) and Track C1
(a new content adapter reuses the builder).

### D8. Stale duplicates to fold while nearby (verify, then delete)

- `EVENT_TYPE_LABELS` (`components/overlays/events.ts:17`) — **stale**: keys do
  not match `EVENT_CATALOG` discriminants; read the catalog instead.
- `SIGN` (`components/views/diff-view.ts:9`) vs `DIFF_SIGN`
  (`core/view-projection.ts:86`) — same map, two copies.
- error titles: `components/error-boundary.ts:203` re-lists the error-class-name
  key set that `core/error-taxonomy.ts:334` already owns; add a `title` field to
  the taxonomy's error descriptors and read it from the boundary.
- `projectDataset`/`datasetIsEmpty` (`core/view-projection.ts:111`/`:143`) — two
  switches over `ViewDataset`; fold into one per-kind descriptor.

---

## Track E — The Ingredient Library (parameterized OOP primitives for any UI)

> **Vision:** *A UI is a bundle of contributions over a small set of parameterized
> ingredients.* The ingredients already exist, but each domain hand-rolls them.
> Track E extracts the **six reusable layers** so a new surface/overlay/view/
> panel/command is *a descriptor + a body*, and a new product UI is *a bundle*.

### The taxonomy (what an ingredient is)

```
Layer 0  Reactive atoms      atom · derived · eventBus
Layer 1  Descriptors (data)  Contribution → Surface│Overlay│Panel│Command│
                             ViewAdapter│Renderer│Layout│Capability│Tool
Layer 2  Registries          createRegistry(keyOf)        (one factory, N domains)
Layer 3  Definitions (HOC)   defineContribution → defineSurface│defineOverlay│
                             definePanel│defineView│defineCommand│defineRenderer
Layer 4  Components          BaseComponent → SurfaceComponent (universal)
                             + mixins: withStore · withCapability · withCommands
Layer 5  Primitives (bricks) s-button · s-input · s-panel · s-toolbar · s-tooltip
                             s-badge · s-empty-state · s-banner · s-spinner ·
                             s-divider · s-icon
Layer 6  Bundles             defineBundle / applyBundle    (ingredients → a UI)
```

Every layer reads only from the layer below; every domain descriptor narrows the
one `Contribution` base. That is the library: **N domains, one shape.** Track D is
the *first consumer* of this — D6 is E2's first instance, D3 is E3's first
instance, D4 is E1+E3 applied to layouts. Track E names the general ingredients.

### E1. `Contribution` base descriptor (SSOT for the common fields)

Nine descriptors each re-declare `id`, `title|label`, `tag?`, `group?`,
`capability?`: `SurfaceDescriptor` (`surface-registry.ts:18`), `OverlayDescriptor`
(`overlay-registry.ts:25`), `Command` (`commands.ts:47`), `WorkspaceRenderer`
(`workspace-renderer.ts:79`), `CapabilityDescriptor` (`capabilities.ts:15`),
`ViewAdapter` (`view-adapter.ts:9`), `LayoutDefinition`
(`layout-registry.ts:32`), `ToolSpec` (`tool-registry.ts:22`),
`PluginContribution` (`plugins.ts:24`).

**Refactor:**
```ts
interface Contribution {
  readonly id: string;
  readonly title: string;   // `label` unified onto `title`
  readonly tag?: string;    // derived from id when absent
  readonly group?: string;
  readonly capability?: Capability;
}
```
Each domain descriptor `extends Contribution` and adds only its behavior
(`run`, `getLayout`, `present`, `budgets`…). `label` collapses to `title`; `tag`
derives via `surfaceTag`.

**Payoff:** one validation shape — kills the duplicated `checkUniqueId` +
per-type validators (`contribution-validator.ts:28`, `:41–175`) — one
palette/registry enumerator, one doc generator (`surface-codegen.ts` already
generates from descriptors).

### E2. `createRegistry(keyOf)` — one registry, N domains (metaprogramming core)

Nine hand-rolled `Map` + `register`/`get`/`all` closures with divergent getter
names (`registerSurface`/`surfaceFor`, `registerOverlay`/`overlayDescriptor`,
`registerViewAdapter`/`viewAdapterFor`, `registerRenderer`/`workspaceRenderer`,
`registerTool`/`getTool`, `layoutRegistry`, …). No shared factory exists.

**Refactor — `core/registry.ts`:**
```ts
interface Registry<K, V> {
  register(value: V): void;
  get(key: K): V | undefined;
  all(): readonly V[];
  readonly byKey: ReadonlyMap<K, V>;
}
function createRegistry<K, V>(keyOf: (value: V) => K, opts?: { unique?: boolean }): Registry<K, V>;
```
Each domain is `createRegistry<Shape, ViewAdapter>(a => a.shape)`. A
`createMultiRegistry` covers the one `Map<Shape, V[]>` case (`view-adapter.ts:17`).

**Payoff:** **subsumes D6**; every registry becomes enumerable for tests without
mocks (AGENTS.md); the uniqueness guard lives in one place.

### E3. `defineContribution` + the `defineX` family (one registration HOC)

Every domain repeats the tail: build descriptor → register → derive tag →
`customElements.define` → declare the global tag map. `defineSurface`
(`surface.ts:102`) is the only one that exists.

**Refactor:**
```ts
function defineContribution<T extends Contribution>(
  registry: Registry<string, T>,
  descriptor: T,
  ctor: CustomElementConstructor,
  options?: { bindings?: boolean; window?: 'standard' | OverlayWindowOptions }
): void;
```
`defineSurface`, `defineOverlay` (**D3**), `definePanel`, `defineView`,
`defineCommand`, `defineRenderer` become one-line wrappers. The 16 overlay tails,
9 view-adapter tails and every `@customElement` + `declare global` collapse to
one call each.

**Payoff:** **subsumes D3**; a new ingredient is a descriptor + a body, nothing else.

### E4. Universal `SurfaceComponent` — one component base for every element

Two bases split the codebase: `BaseComponent` (cleanup + `watch`, 27 lines) for
primitives/views, `SurfaceComponent` (state slots + bindings + test API,
`surface.ts:33`) for overlays/renderers/`ViewHost`. The state-slot machinery is
useful for **any** data-backed component.

**Refactor:**
- Promote `SurfaceComponent` to the one base; fold `BaseComponent.watch` in.
- Parameterize `surfaceState()` with an optional descriptor field
  `state?: (self) => SurfaceState`, so a component is data-driven **without
  overriding a method**; replace the `switch` (`surface.ts:62`) with a
  `renderState` dispatch table keyed by `SurfaceState` (table-driven, per D1).
- Primitives opt in for free empty/loading/error slots (e.g. `s-panel` shows a
  spinner while its source loads).

**Payoff:** one lifecycle, one test API, one slot contract for every element;
B3's per-layout states ride the same slots.

### E5. `derived` — a reactive derived atom

`Atom<T>` (`store.ts:36`) has no first-class derived store; three derivations are
ad-hoc subscriptions: `$selectedNodeIds` from `$workspaceGraph.selection`
(`store.ts:239`), `$graphLayer` from `$activeLens` (`store.ts:224`),
`$workspaceGraph.timeCursor` from `$view.timeline.t` (`store.ts:298`).

**Refactor — `store.ts`:**
```ts
function derived<D extends readonly Readable<unknown>[], T>(
  deps: D,
  project: (...values: { [K in keyof D]: D[K] extends Readable<infer U> ? U : never }) => T
): Readable<T>;
```
Parameterized by the projection; value-compared like `$selectedNodeIds` already is.

**Payoff:** reactivity is a *parameter*, not a pattern; fewer manual
subscribe/unsubscribe pairs (a leak source).

### E6. `defineBundle` / `applyBundle` — package any ingredients into a UI

`PluginContribution` (`plugins.ts:24`) already bundles seven domains and fans them
out (`applyPlugins`, `:67`), but the interface and the fan-out are hand-written per
domain.

**Refactor:** generalize over **any** registry:
```ts
interface Bundle {
  readonly id: string;
  readonly name: string;
  readonly contributions: ReadonlyArray<{
    registry: Registry<string, Contribution>;
    values: readonly Contribution[];
  }>;
}
function defineBundle(bundle: Bundle): void;
function applyBundle(id: string): void;   // fans out through defineContribution
```
`PluginContribution` becomes typed sugar over `defineBundle`. A product UI =
`applyBundle('core')` + `applyBundle('reasoning')` + …

**Payoff:** the "any potential UI" seam — ingredients compose into products with
no shell edits (the existing plugin goal, generalized).

### E7. Style factory — tokens by name, composition over duplication

Component styles are inline `css\`…\`` with hand-written `var(--…)` strings;
`blockBodyStyles` (`render-block.ts:22`) is the only shared fragment. Tokens are
read via `TOKENS.dark[…]` in two places (**D5 bug**) and `cssVar()` in
`theme.ts:27`.

**Refactor:** a `styles(...fragments)` composer + `t('colors.semantic.accent-primary')`
helper emitting `var(--colors-semantic-accent-primary)`, typed from the `TOKENS`
key union, so a token typo is a compile error. Shared fragments (`panelChrome`,
`stateSlots`, `overlayHeader`) compose like `blockBodyStyles`.

**Payoff:** theming is parameterized; **D5's fix is the same helper**.

### E8. Mixins — cross-cutting concerns without inheritance

Capability gating, store bindings and command registration recur across
components and are wired by hand.

**Refactor:** composable mixins (functions over a class):
`withStore(Class, bindings)`, `withCapability(Class, cap)`,
`withCommands(Class, commands)`. Composition over inheritance (AGENTS.md); a
primitive gains store-watching without joining a base hierarchy.

**Payoff:** concerns compose; the base stays thin.

### E9. Panel descriptor + registry (fill the one gap)

Panels are the only domain with no descriptor registry: `PanelState` lives in
`$panels` (`store.ts:466`), labels are hardcoded (`commands.ts:33`), and
`panel-dock.ts:7` switches on tab id.

**Refactor:** `PanelDescriptor extends Contribution { icon; scope; tag }` +
`createRegistry`, so panels join the palette, the doc generator and the bundle
fan-out like every other ingredient.

**Payoff:** the taxonomy is complete — no domain is special-cased.

### Track E — parameterization levers (the summary)

| Lever | Today | Parameterized by |
|---|---|---|
| Registry | 9 hand-rolled closures | `keyOf` (E2) |
| Descriptor | 9 overlapping interfaces | `Contribution` base (E1) |
| Definition | 1 `defineSurface` + 15 hand-tails | `defineContribution` (E3) |
| Component | 2 bases | one `SurfaceComponent` + `state` field (E4) |
| Reactivity | ad-hoc subscriptions | `derived(deps, project)` (E5) |
| Product | bespoke `PluginContribution` | `Bundle` (E6) |
| Style | inline `var(--…)` strings | `styles`/`t` (E7) |
| Concern | hand-wired | mixins (E8) |
| Panel | no registry | `PanelDescriptor` (E9) |

**Track E's one-line test:** each ingredient must make a *real* surface/overlay/
view cheaper to add. A layer that no domain instantiates is deferred, not built.

---

## Track F — Type-Model Utilization (derive, don't declare)

> **One principle:** *every vocabulary has exactly one source; every union, array,
> map and schema derives from it.* The codebase already does this well in places —
> `field-catalog.ts` (template literals), `block-payload.ts` (`PayloadOf<K>`),
> `composer-modes.ts`/`graph-layer.ts` (`as const` + `(typeof X)[number]`),
> `lens-catalog.ts` (`as const satisfies`). Track F applies that discipline to the
> remaining hand-written unions and **fixes three drift bugs the duplication hid**.
> It is the type-level twin of Track D (data SSOT) and Track E (ingredient library).

### The five derivation patterns (with the codebase's own good examples)

| # | Pattern | Source → derived | Good example already in-tree |
|---|---|---|---|
| P1 | **`as const` tuple → union + list** | `const SHAPES = [...] as const` → `type Shape = (typeof SHAPES)[number]`; export the tuple for iteration | `composer-modes.ts:12`, `graph-layer.ts:8` |
| P2 | **catalog object → union** | `const CATALOG = {…} as const` → `type K = keyof typeof CATALOG` | `link-catalog.ts:204`, `block-payload.ts:117` |
| P3 | **`as const satisfies Record<Union, V>`** | exhaustive **and** literal values (no widening) | `block-labels.ts:35`, `lens-catalog.ts:124` |
| P4 | **mapped type `{ [K in Union]: V }`** | one entry per key, compiler-enforced | `block-payload.ts:215` (`NORMALIZERS`) |
| P5 | **conditional + template-literal types** | `PayloadOf<K>`, `FieldId = \`telemetry.${Field}\`` | `block-payload.ts:123`, `field-catalog.ts:47` |

### The three drift bugs the duplication hid

- **`PanelTab` declared twice verbatim** (`store.ts:482` **and** `:487`) — TS
  *merges* the two interfaces silently, so the duplicate is invisible and
  harmless until one is edited. **Fix (P2):** delete one; derive the shape from
  `panelTabs()`'s return or a `PANEL_DEFS` catalog.
- **Two `Theme` vocabularies** — `config-schema.ts:9` (`'dark'|'light'|'auto'`) vs
  `tokens.generated.ts:2` / `theme.ts:8` (`'dark'|'light'|'high-contrast'`).
  `high-contrast` is unreachable from config; `auto` is unknown to the token
  facade — a live runtime/type mismatch. **Fix (P1):** one `THEMES` tuple;
  `z.enum(THEMES)`; `ThemeName` derives from it.
- **`ArtifactKind ⊄ BlockKind` is unenforced** — `BlockPayloads`
  (`block-payload.ts:105`) keys must be a subset of `BlockKind`, but nothing
  checks it. **Fix (F5):** a compile-time assertion.

### The "one source" table (what derives from what)

| Vocabulary | Today | One source (fix) |
|---|---|---|
| `Shape`/`Budget`/`Disclosure`/`Interaction` | 4 hand unions; `Shape` re-listed (`view-projection.ts:134`), `Disclosure` re-listed (`explain.ts:38`) | `SHAPES`/`BUDGETS`/`DISCLOSURES`/`INTERACTIONS` tuples (P1) |
| `BlockKind` | hand union (`workspace-graph.ts:34`) + re-spelled in `BLOCK_KIND_LABEL` | `keyof typeof BLOCK_DESCRIPTORS` (P2, rides **D1**) |
| `ConversationLayoutId`/`ReasoningLayoutId` | union + `_IDS` array + `_CATALOG` keys (3×) | catalog keys (P2, rides **D4**) |
| `LinkCategory`/`EventCategory` | union + `as const` array (2×) | the array is the source (P1) |
| `TelemetryRange`/`LoDTier`/`PanelDock` | union + `Record` + `as` cast | `keyof typeof MAP` (P2) |
| built-in lens (`'belief'\|'goal'\|'contradiction'`) | literal ×3 + array ×1 (`store.ts:577`, `:625`, `:693`) | `PRIMARY_LENSES` ids (P1) |
| reasoning mode (`'belief'\|'goal'\|'question'`) | ×4 (`reasoning-backend.ts:70`, `commands.ts:221`/`:225`, `command-schemas.ts:72`) | `REASONING_MODES` tuple (P1) |
| panel ids/labels | ×3 (`$panels` seed, `panelTabs()`, `PANEL_LABELS`) | `PANEL_DEFS` catalog (P2, rides **E9**) |
| lens-keyed maps (`$lensViewport`, `$lensLayer`, `$lensLayout`, `LENS_MODULATION_MAP`) | `Record<string, …>` | `Partial<Record<BuiltinLens, …>>` (P4) |
| `COMMAND_SCHEMAS` | `Record<string, Zod>` | `Partial<Record<CommandId, Zod>>` (P4) |
| `RendererParity` | re-declares `parity`/`interactions`/`controls` | `Pick<WorkspaceRendererCaps, …>` (utility type) |
| `FIELD_CATALOG` | `satisfies` but not `as const` (values widen) | `as const satisfies` (P3) |

### F1. `as const` tuples for the view unions (rides D1/E1)

`Shape`/`Budget`/`Disclosure`/`Interaction` (`view-spec.ts:10–19`) are four hand
unions; `Shape` is re-listed in `view-projection.ts:134` and `Disclosure` in
`explain.ts:38`. Declare one tuple each, derive the union, export the tuple so
iteration and the switcher read the same list.

### F2. Derive domain unions from catalogs (rides D1/D4/E9)

Make the catalog the source and delete the parallel union: `BlockKind = keyof
typeof BLOCK_DESCRIPTORS`, `ConversationLayoutId = keyof typeof CATALOG`, panel
ids from `PANEL_DEFS`, `LinkCategory`/`EventCategory` from their `as const`
arrays. Each union loses one hand-maintained copy.

### F3. Key every map to its vocabulary (mapped types)

`$lensViewport`/`$lensLayer`/`$lensLayout`/`LENS_MODULATION_MAP` (`store.ts:164`,
`:212`, `:424`, `:441`) are `Record<string, …>` though conceptually lens-keyed;
`COMMAND_SCHEMAS` (`command-schemas.ts:107`) is `Record<string, Zod>`. Type them
`Partial<Record<BuiltinLens, …>>` / `Partial<Record<CommandId, …>>` so indexing is
checked and the `as` casts at `store.ts:747`/`:757` disappear.

### F4. Generic `Command<Args>` + typed command ids (biggest cast cleanup)

`CommandArgs = Record<string, unknown>` (`commands.ts:31`) forces every command to
re-cast inside `run`/`parse` (`:201`, `:221`, `:256`, `:266`) while
`command-schemas.ts` already has a typed Zod schema per id. Make `Command<A>` 
generic and derive `CommandArgs<K extends CommandId> = z.infer<(typeof
COMMAND_SCHEMAS)[K]>`; a mapped `{ [K in CommandId]: Command<CommandArgs<K>> }`
removes most `String(args.x ?? '')` guards. Also fix `ComposerFocusSchema`
(`command-schemas.ts:14`) to `z.enum(COMPOSER_MODE_IDS)` — it hand-lists a
*different* vocabulary than `composer-modes.ts`.

### F5. Compile-time assertions + exhaustive `match`

Add a zero-runtime helper to relate two unions and to exhaust a switch:
```ts
type Assert<T extends true> = T;
type _ArtifactKindsAreBlockKinds = Assert<ArtifactKind extends BlockKind ? true : false>;
const assertNever = (x: never): never => { throw new Error(`unreachable: ${x}`); };
```
Use `assertNever` in the discriminated-union switches (`render-block.ts:142`,
`artifacts.ts:143`, `workspace-graph.ts:196`) so a new variant fails the build
instead of falling through — the runtime twin of `satisfies`.

### F6. Resolve the dead `LayoutId` brand; fix `Theme`/`ArtifactKind`

`LayoutId` (`layout-ids.ts:14`) is branded but every consumer takes plain
`string`; it is dead abstraction. Either **commit** (thread it through
`LayoutDefinition`, `UrlState.layout`, `$lensLayout`) or **drop** it. Same
"commit or drop" test for the `Theme` and `ArtifactKind` drift above.

### Track F — the payoff

| Goal | Mechanism |
|---|---|
| **Elegance** | `satisfies`, `as const`, `assertNever` — intent visible, drift impossible |
| **Flexibility** | generics (`Command<Args>`, `PayloadOf<K>`) + mapped types |
| **Code sharing** | one source per vocabulary; template-literal namespaces (`FieldId`) |
| **Less redundancy** | the "one source" table removes ~15 hand-maintained copies |
| **Correctness** | the three drift bugs above become compile errors |

**Track F's guard:** a derivation must not lose type-safety. `as const satisfies`
is the gold standard — it keeps literal values *and* proves exhaustiveness. If a
derivation widens a type (e.g. `Object.keys()` → `string[]`), add the one cast
back and document why.

---

## Track G — Product & Robustness Completion (closes the verification gaps)

> The verification above found v11 necessary but not sufficient. Track G closes
> G1–G3. Unlike D/E/F, these are *not* refactors — they are the product work the
> two goals require. Mapped to the master plan's phases so nothing is re-invented.

### G1. Wire the behavioral tests into the gate (master-plan 11.4)

`ui:verify` omits `test:e2e`; `ui:gate` is typecheck+unit. The 24 scenario specs
(resilience, security, a11y, parity) exist but gate nothing.

**Refactor:** add a fast scenario subset (`@smoke`/`@critical`) to `ui:verify`;
make `ui:gate` = typecheck + unit + that subset; add the full e2e to the
pre-merge `ui:verify`. A capability is not done until a gate fails when it
regresses.

**Acceptance:** breaking a resilience/security scenario fails `ui:gate`.

### G2. Performance budgets (master-plan 11.1)

`PerfMonitor.assertWithinBudget` is dead; `high-throughput` asserts nothing
performance-shaped; the store clones whole `Map`s per patch (`store.ts:510`,
`:524`).

**Refactor:** call `assertWithinBudget` from a dense-graph spec; patch-in-place
(or structural share) in `updateNodeData`/`updateEdgeData`; virtualize the event
log / large tables; add a frame-budget baseline.

**Acceptance:** a dense-graph spec asserts a frame budget and passes; no
whole-`Map` clone remains in a hot store patch.

### G3. Automated accessibility (master-plan 7.7)

A keyboard spec exists (`scenarios/accessibility/keyboard-navigation.spec.ts`) but
no automated a11y checks derived from descriptor metadata, and it is not gated.

**Refactor:** derive a11y checks from the descriptor `a11y` metadata (the
`surface-codegen.ts` seam already sketches it); add the keyboard walkthrough to
G1's gate.

**Acceptance:** a surface without a label/keyboard path fails the gate.

### G4. Error-taxonomy surfacing (master-plan 11.2)

`error-taxonomy.ts` is rich but the boundary re-lists titles (D8 de-dupes the
map). Wire the taxonomy's `title`/recovery into the boundary + log with context.

**Acceptance:** each error class surfaces its title + recovery action; no
hand-listed title map remains.

### G5. A second bundle proves Goal 2 (master-plan 10.5)

**The falsifiable test of the foundation.** Build the smallest non-default
product — e.g. an **event-log console** or **graph explorer** — as
`applyBundle(...)` over the same ingredients, with **no cognitive-chat store**.

**Acceptance:** the second product runs from a bundle with zero forked
components; if it needs a fork, E is not yet a library and the gap is named.

### G6. Demo/scenario productization (master-plan 10.2/10.6)

Surface the scenario runner as a Run view; each beat sets a `ViewSpec` so demos
reuse the live UI, not a separate player.

**Acceptance:** a canonical scenario replays in-app through live views, seeded and
deterministic.

### Track G — the one-line test

Each G item makes the product **more trustworthy**, not larger: a gate that
catches regressions, a budget that catches jank, a check that catches an
inaccessible control, a second product that proves the library. None adds a
control the user must learn.

---

## Standing Rules (carry forward from v10)

- **No new subsystem without a visible payoff.** A registry that changes no pixels fails the one-line test.
- **Legibility before content.** Every capability ends with a cell/recording **and** a guard.
- **A track is not done until its behavior gates.** A cell proves it *renders*; a gate proves it *cannot regress*. Promote v10's rule from "a cell" to "a cell in `verify`".
- **No formatting / line-length / craft polish.** D is closed.
- **No split, no renderer switch** — modeless is the paradigm.
- **Keep `typecheck` + `test:unit` green; commit per Track.**
- **If a spike fails its gate → document why, close it.**

---

## Fresh-Session Checklist (v11)

> Ordering follows the **Fresh-Session Handoff** critical path (B3+G1 first).
> Items are grouped by track; the handoff gives the recommended sequence.

- [x] **Track A1**: Config-change audit → dedicated log/HUD (no graph perturbation)
- [x] **Track A2**: Derivation-record provenance → wire to real blocks or embed in body
- [x] **Track A3**: Demo cells → shared `seedBlocks` helper or synthetic projection
- [x] **Track B1**: Overlay breadcrumbs in header (read `overlayManager.stack()`)
- [x] **Track B2**: LoD transition animations (CSS transitions, respect reduced-motion)
- [x] **Track B3**: Per-layout empty/loading/error states (9 layouts, use `<s-empty-state>`)
- [ ] **Track C1**: Content adapter spike (filesystem → graph, <1 day)
- [ ] **Track C2**: Semantic-zoom coordinate space spike
- [ ] **Track C3**: Node-renderer registry needfinding
- [ ] **Track C4**: `graph3d` z-axis fractal spike
- [x] **Track D1**: `BLOCK_DESCRIPTORS` registry (folds 6 maps + 3 if-chains; fixes `GRAPH_BLOCK_KINDS`)
- [ ] **Track D2**: extend `LINK_CATALOG` (`symmetric`, `layoutStage`); delete the two partial maps
- [ ] **Track D3**: `defineOverlay` + `WINDOW_DEFAULTS` (16 overlays + 8 window literals)
- [ ] **Track D4**: one layout descriptor registry (merge conversation + reasoning; wire `validateLayoutId`)
- [x] **Track D5**: token SSOT — remove `TOKENS.dark` bypass (**correctness bug**, may land standalone)
- [ ] **Track D6**: `createRegistry<K, V>` shared registry factory
- [ ] **Track D7**: projection `fragment()` builder + `systemEventBlock()`
- [ ] **Track D8**: fold stale duplicates (`EVENT_TYPE_LABELS`, `SIGN`/`DIFF_SIGN`, error titles, `ViewDataset` switches)
- [ ] **Track E1**: `Contribution` base descriptor (unify 9 descriptor interfaces)
- [ ] **Track E2**: `createRegistry(keyOf)` (subsumes D6; 9 domains)
- [ ] **Track E3**: `defineContribution` + `defineX` family (subsumes D3)
- [ ] **Track E4**: universal `SurfaceComponent` (one base; `state` field; `renderState` table)
- [ ] **Track E5**: `derived(deps, project)` reactive atom (absorbs 3 ad-hoc derivations)
- [ ] **Track E6**: `defineBundle`/`applyBundle` (generalize `PluginContribution`)
- [ ] **Track E7**: style factory (`styles` + typed token helper; D5's fix)
- [ ] **Track E8**: mixins (`withStore`/`withCapability`/`withCommands`)
- [ ] **Track E9**: `PanelDescriptor` + registry (fill the one gap)
- [x] **Track F1**: `as const` tuples for `Shape`/`Budget`/`Disclosure`/`Interaction`
- [~] **Track F2**: derive domain unions from catalogs (`BlockKind`, layout ids, panel ids, categories) — `BlockKind` (D1), categories + layout ids done; panel ids need `PANEL_DEFS` (E9)
- [~] **Track F3**: key every map to its vocabulary (lens maps, `COMMAND_SCHEMAS`) — `LENS_MODULATION_MAP` done; the `$lens*` maps are custom-lens-keyed (see Progress Log)
- [ ] **Track F4**: generic `Command<Args>` + typed command ids (biggest cast cleanup)
- [~] **Track F5**: compile-time assertions + `assertNever` in union switches — `ArtifactKind extends BlockKind` assert landed with D1; `assertNever` switches remain
- [ ] **Track F6**: resolve dead `LayoutId` brand; fix `Theme`/`ArtifactKind` drift
- [ ] **Track G1** (⚠️ blocked — composer selectors fixed; suite rot + CI browser/provider prerequisites remain, see Progress Log): wire `test:e2e` scenario subset into `ui:verify` / `ui:gate` (master-plan 11.4)
- [x] **Track G2**: performance budgets — call `assertWithinBudget`; stop whole-`Map` clones (11.1)
- [x] **Track G3**: automated a11y checks from descriptor metadata + keyboard walkthrough in the gate (7.7)
- [x] **Track G4**: error-taxonomy surfacing (title + recovery) in boundary + log (11.2)
- [ ] **Track G5**: a second bundle (event-log console / graph explorer) proves Goal 2 (10.5)
- [ ] **Track G6**: demo/scenario productization — Run view, ViewSpec-native beats (10.2/10.6)
- [ ] Do **not** implement Track C items unless spike passes gate
- [ ] Do **not** land a Track D/E/F refactor without the feature it enables (except D5)
- [ ] Do **not** build an E layer no domain instantiates (defer it)
- [ ] Do **not** derive a type if it widens safety (keep the one cast, document why)
- [ ] Commit per Track; regenerate baselines deliberately; keep `verify` green

---

## Delete List (capability kept, complexity removed)

| Remove | Keep capability via |
|---|---|
| Direct `$workspaceGraph` writes in producers | Projection pipeline (`$chatMessages → syncWorkspaceGraph → projectWorkspace`) |
| Dangling `derived-from` links to non-existent refs | Resolved links or embedded provenance in block body |
| Demo cells that bypass projection | `seedBlocks` helper (documented) or synthetic projection |
| Generic "No data" / "No adapter" empty states | Layout-specific `<s-empty-state>` with action |
| Mechanical LoD transitions | Animated transitions (size, opacity, tier) |
| Overlay stack with no back-navigation | Breadcrumb trail in overlay header |
| `BLOCK_KIND_LABEL` + `ARTIFACT_KINDS` + `GRAPH_BLOCK_KINDS` + `JSON_KINDS` + `TOC_KINDS` + `isContainer` + `isSection` | `BLOCK_DESCRIPTORS: Record<BlockKind, BlockDescriptor>` (D1) — ✅ folded |
| `SYMMETRIC_LINK_KINDS` + `GATE_STAGES` | `linkMeta(kind).symmetric` / `.layoutStage` (D2) |
| 16 overlay registration tails + 8 `window` literals | `defineOverlay` + `WINDOW_DEFAULTS` (D3) |
| Two layout registration loops + duplicated `COLUMN`/`ROW`/`SOURCE_ORDER` | one `LayoutDescriptor` registry + `placeInLanes` (D4) |
| `TOKENS.dark[…]` direct reads + 3 truth-hue copies | `numericToken` + one `truthColor` (D5) |
| 4 near-identical registry closures | `createRegistry<K, V>` (D6) |
| 4× projection skeleton + 5× event block literal | `fragment()` + `systemEventBlock()` (D7) |
| `EVENT_TYPE_LABELS`, `SIGN`/`DIFF_SIGN`, error-title map | read `EVENT_CATALOG`, one `DIFF_SIGN`, `error-taxonomy` (D8) |
| 9 overlapping descriptor interfaces | `Contribution` base (E1) |
| 9 hand-rolled registry closures | `createRegistry(keyOf)` (E2) |
| 15 hand-written registration tails | `defineContribution` (E3) |
| 2 component bases (`BaseComponent`/`SurfaceComponent`) | one universal `SurfaceComponent` (E4) |
| 3 ad-hoc derived-store subscriptions | `derived(deps, project)` (E5) |
| bespoke `PluginContribution` fan-out | `Bundle` / `applyBundle` (E6) |
| inline `var(--…)` style strings | `styles` + typed token helper (E7) |
| hand-wired cross-cutting concerns | `withStore`/`withCapability`/`withCommands` (E8) |
| panel labels hardcoded in `commands.ts` | `PanelDescriptor` + registry (E9) |
| `PanelTab` declared twice; 2 `Theme` vocabularies; `ArtifactKind⊄BlockKind` | derive from one source + compile-time assert (F1/F5/F6) |
| `Shape`/`Disclosure`/lens/panel/category unions hand-copied | `as const` tuple / catalog is the source (F1/F2) |
| lens-keyed maps + `COMMAND_SCHEMAS` typed `Record<string, …>` | `Partial<Record<Vocabulary, …>>` (F3) |
| `CommandArgs = Record<string, unknown>` + per-command casts | generic `Command<Args>` (F4) |
| e2e scenarios that gate nothing | `ui:verify` includes the scenario subset (G1) |
| dead `PerfMonitor.assertWithinBudget`; whole-`Map` clones | frame-budget spec + patch-in-place (G2) — ✅ patch-in-place done; spec wired (e2e) |
| hand-listed error-title map in the boundary | `error-taxonomy` title + recovery (G4) — ✅ folded |

---

## Notes for Implementation

### Config-change audit (A1) — key insight
The projection `projectWorkspace` is **pure** and creates a new graph every call. Any direct write to `$workspaceGraph` is inherently ephemeral. The fix **must not** write to the graph root set. A `$configChanges` store subscribed by a dedicated overlay/panel is the cleanest path — it sidesteps both traps (hydration burst + fit perturbation).

**Revised after implementation (see Progress Log A1).** A store alone is *not* enough to keep the four auto-fit cells stable: config hydrates in **5 separate `$config.set` calls at boot**, and those five writes were driving extra layout runs the cells were calibrated to. The landed fix keeps the store (durable trail + overlay) **and** mirrors the block into the graph so baselines stay put. The clean removal is blocked on (a) batching boot config hydration to one set and (b) making the four cells deterministic without incidental graph writes.

### Derivation-record provenance (A2) — key insight
The `provenanceRefs` array (line 479) already captures the evidence lineage as term strings. The cleanest fix: **render `provenanceRefs` in the derivation-record body** via `renderBlockBody` (which already handles `derivation-record` kind). No graph links needed — the tree viewer shows the step-by-step proof; the terms are displayed as evidence. This matches Move 2.7/2.9 intent.

### Overlay breadcrumbs (B1) — key insight
`OverlayManager.stack()` already returns `string[]` (ids bottom→top). The header (`overlay-header.ts`) receives the overlay entry; it can read `overlayManager.stack()` and render crumbs. Click handler: `stack.slice(index + 1).forEach(id => overlayManager.close(id))`.

### LoD transitions (B2) — key insight
The tier thresholds are pure (`graph-scaling.ts:112–117`). The visual change happens in:
- Cytoscape: node size/label opacity (in `adapter-2d.ts` style updates)
- `s-node-body`: `tier` attribute flip (CSS `max-height` change)
- `renderBlockBody`: `embedded` vs `cappedEmbed` branch
Add CSS `transition: all 150ms ease-out` on the changing properties; guard with `@media (prefers-reduced-motion: reduce)`.

### Per-layout states (B3) — key insight (delivered as `states`)

`ViewHost.surfaceState()` computes `empty`/`loading`/`error`/`ready`. The slots
now come from `ViewSpec.states` (a `ViewStates` of `ViewStateSpec`), and
`ViewHost.renderState` renders a named slot through `<s-empty-state>` while an
unnamed slot keeps the generic text — so adding states never moves an unrelated
baseline. `ViewSource.loading?()` is the loading seam
(`viewSource(readable, project, loading?)`). Conversation/reasoning layouts are
graph layouts, not view surfaces — see the Progress Log note.

### Block descriptors (D1) — key insight
`BLOCK_KIND_LABEL` is already exhaustive via `satisfies Record<BlockKind, string>` (`block-labels.ts:35`) — the pattern works. D1 is simply *widening that one record* to carry every facet and deleting the partial maps. The render if-chains (`render-block.ts:142`, `artifacts.ts:143`) become `descriptor.renderBody` / `descriptor.artifactSpec` fields, so `renderBlockBody` collapses to a lookup + fallback. **`satisfies` is the guard** — no test needed to prove exhaustiveness.

### Registry factory (D6) — key insight
All four registries (`surface`, `overlay`, `view-adapter`, renderer) are `Map<K, V>` + three closures. `createRegistry(keyOf)` is the metaprogramming seam: instantiate once, reuse everywhere, and the descriptor→registration helpers (`defineSurface`, `defineOverlay`) sit on top. This is composition over inheritance (AGENTS.md) — no base class, one factory.

### Sequencing — which refactor rides with which track
| Feature track | Lands with | Why |
|---|---|---|
| A2 (provenance) | D7 (`fragment()`), D2 (`linkMeta.symmetric`) | provenance links are built through the accumulator and resolve via the catalog |
| B1 (breadcrumbs) | D3 (`defineOverlay`), D6 (registry) | the breadcrumb is generated once in the overlay header |
| B2 (LoD transitions) | D5 (`numericToken`, `truthColor`) | transition colors must be theme-aware |
| B3 (per-layout states) | D4 (layout descriptor `states`), D1 (`descriptor.icon`) | states are descriptor data |
| C1 (content adapter) | D7 (`fragment()`) | the new adapter reuses the builder |

### Track D — the one-line test
Every D item must still pass: *does it make reasoning more visible/legible/enjoyable without a new control?* D1–D8 do not add controls — they remove drift and make the descriptor surface legible to **developers** (which is what keeps the paradigm's pixels honest). The one-line test applies to the **feature** each refactor enables; the refactor is the price of the feature, paid in the same commit.

### Track D ↔ Track E — consolidation vs. library
D and E overlap by design; E is the general form, D is the first consumer:
| Track D item | Is the first instance of |
|---|---|
| D3 `defineOverlay` | E3 `defineContribution` |
| D4 layout descriptor registry | E1 `Contribution` + E3 `defineContribution` applied to layouts |
| D6 `createRegistry` | E2 `createRegistry(keyOf)` |
| D5 `numericToken`/`truthColor` | E7 style factory + E5 `derived` (theme is a store) |

**Sequencing:** land E1+E2+E3 first (they are pure infrastructure, ~1 day), then D3/D4/D6 collapse to wrappers, then the remaining D items and E4–E9 proceed. If E proves too abstract for a domain, that domain keeps its hand-rolled form — the library grows by *absorption*, never by mandate.

### Track E — the ingredient checklist (is a domain "in" the library?)
A domain is fully an ingredient when it has: (1) a descriptor extending `Contribution`, (2) a `createRegistry` instance, (3) a `defineX` wrapper over `defineContribution`, (4) a `declare global` tag map, (5) a `surface-codegen` entry, (6) a bundle slot. Nine domains → nine rows; the checklist is the library's table of contents.

### Why this grows "versatile applicability"
The current substrate proves *one* UI (the cognitive HUD). The ingredient library
makes the *substrate itself* portable: because a UI is `applyBundle(...)` over
registries of `Contribution`s, a second product (a graph-only explorer, an
event-log-only console, a docs site) is a different bundle over the same
ingredients — no forking `app-layout`, no copy-pasted overlays. The paradigm
"one substrate, many projections" generalizes from *data* projections to *UI*
projections.

### Verification ↔ Tracks — the honest accounting
The verification section found the two goals are **not yet reached by v11 alone**:
- **Goal 1 (working/useful/robust)** — *working* and *useful* are already true
  (the product is built and 24 e2e scenarios pass); *robust* is partial because
  the behavioral tests don't gate (G1) and the perf harness is inert (G2).
- **Goal 2 (any-domain foundation)** — *plausible but unproven*: D/E/F build the
  seams, but no second bundle demonstrates them (G3/G5).

So the plan's own success criterion is: **A + B + G land the product goals; D + E
+ F land the foundation goal; C is evaluated honestly.** The one-line test still
holds — every track must make the system more visible, more legible, or more
trustworthy without a control the user must learn.

### Track F — key insight
The codebase already contains the **gold-standard pattern** in `lens-catalog.ts`
and `block-labels.ts`: `as const satisfies Record<Union, V>`. It simultaneously
(a) proves every key is present, (b) keeps each value's literal type, and
(c) lets the union be derived back with `keyof typeof`. Every Track F fix is
"apply this pattern where a union is still hand-written." The three drift bugs
(`PanelTab` double-declare, two `Theme` vocabularies, `ArtifactKind ⊄ BlockKind`)
are the *evidence* that hand-written duplication is not free — each is a latent
runtime bug the type system was told to ignore.

### Track F ↔ Track D/E — the third axis
The plan now has three orthogonal axes over the same substrate:
- **D** — data SSOT (one *value* per vocabulary)
- **E** — ingredient library (one *shape* per contribution)
- **F** — type SSOT (one *type* per vocabulary)

They converge: D1's `BLOCK_DESCRIPTORS` **is** F2's `keyof typeof` source; E1's
`Contribution` **is** F5's `Assert`-guarded base; E5's `derived` **is** F3's
mapped type made runtime. Land the shared source once, and D/E/F all read it.

---

## Fresh-Session Handoff

**Start here.** The critical path is ordered by *user value × risk*, not by track
number:

1. **B3 + G1** — make beat 0 good (empty/loading/error for every layout) and make
   the behavioral tests gate. Highest leverage: B3 is a visible product win; G1
   protects everything after it.
2. **A1–A3** — the three bugs (config audit, provenance links, demo bypass). **Done.**
3. **D5 + F1–F3** — standalone correctness/type fixes (theme bug, view unions,
   keyed maps); cheap, no feature coupling. **D5 done; F1 done, F2/F3 partly
   done (remainders gated on D1 catalogs / F4 `CommandId`).**
4. **E1–E3 → D1–D4, D6–D7** — land the ingredient library, then collapse the
   consolidation items onto it. **D1 done standalone** (`BLOCK_DESCRIPTORS`; did
   not need E — it is the data SSOT D/E/F all read); D2–D4, D6–D7 remain.
5. **B2** — LoD transitions (rides on D5's `numericToken`). **Done** (B1 and B2 both
   landed; the shared header meant B1 did not need D3).
6. **G3** — a11y from descriptor metadata + keyboard walkthrough in the gate.
   **Done** (descriptor `a11y` contract + `validateSurfaceA11y` gate; the keyboard
   walkthrough rides G1). **G4 done** (error taxonomy; folds D8's title map).
   **G2 done** (store patch-in-place + the `perfMonitor` fixture asserting in the
   dense spec; the e2e half rides the blocked G1 gate).
7. **G5 + G6** — prove the foundation (second bundle) and productize demos.
8. **C1–C4** — evaluate honestly; close what fails its gate.

**Commands** (from `ui/`):
```bash
pnpm typecheck && pnpm test:unit        # fast gate
pnpm test:design && pnpm test:craft     # qualitative + craft
pnpm test:visual                        # 59 baselines
pnpm verify                             # the whole contract
pnpm test:visual:update                 # regenerate baselines deliberately
```
Root: `pnpm ui:gate` (typecheck+unit) · `pnpm ui:verify` (full).

**File map — where each track lives:**

| Track | Primary files |
|---|---|
| A1 | `core/config-change-producer.ts`, `core/workspace-bindings.ts` |
| A2 | `core/workspace-projection.ts` (`projectDerivationRecords`) |
| A3 | `tests/visual/matrix.ts` (`manyBodiesDemo`) |
| B1 | `core/overlay-manager.ts`, `components/overlays/overlay-header.ts` |
| B2 | `utils/graph-scaling.ts`, `components/node-body.ts`, `utils/render-block.ts` |
| B3 | `core/view-host.ts`, `utils/layout-registry.ts`, `components/primitives/empty-state.ts` |
| D1 | `core/block-descriptors.ts` (new), `core/block-labels.ts`, `components/renderers/graph.ts` |
| D3/E3 | `core/surface.ts`, `core/overlay-registry.ts`, 16 × `components/overlays/*` |
| D5/E7 | `utils/theme.ts`, `utils/graph-scaling.ts`, `utils/adapter-2d.ts` |
| E1/E2 | `core/registry.ts` (new), `core/surface-registry.ts`, `core/view-adapter.ts` |
| E4/E8 | `core/base-component.ts`, `core/surface.ts` |
| E5/F3 | `core/store.ts` |
| E6 | `core/plugins.ts` → `defineBundle` |
| F1/F2 | `core/view-spec.ts`, `core/workspace-graph.ts`, `utils/link-catalog.ts` |
| F4 | `core/commands.ts`, `core/command-schemas.ts` |
| G1 | `ui/package.json`, `scripts/lib/gates.ts` |
| G2 | `tests/framework/utils/perf.ts`, `core/store.ts` |
| G4 | `components/error-boundary.ts`, `core/error-taxonomy.ts` |
| G5 | `core/plugins.ts`, a new `bundles/` |
| G6 | `tests/scenarios/*`, a new Run view |

**Two invariants to carry in:**
- *Derive, don't declare* (Track F) — one source per vocabulary.
- *A track is not done until its behavior gates* (Standing Rule) — a cell proves
  it renders; a gate proves it cannot regress.

**Open decision for the fresh session:** does v11 stay a *substrate* plan (with
Track G as the product bridge), or fold master-plan Phases 5–6 (observable
reasoning: inspector 2.0, provenance surface, pipeline, resources, event log) into
it? The experience table above shows beats 5–9 are the missing half of "useful."

---

*Generated from v10 completion. Track A fixes bugs in the current paradigm; Track B deepens legibility; Track C evaluates v11 gates honestly; Track D consolidates the descriptor surface as enablers of A/B/C; Track E abstracts the ingredients into a reusable OOP library; Track F derives the type model from those same sources; Track G closes the verification gaps so the plan reaches both the product and the foundation goals.*