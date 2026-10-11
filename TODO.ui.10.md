# TODO.ui.10.md — Finish the Paradigm, Don't Rebuild It

> **North Star:** *One substrate · many projections · recursively embeddable · LoD-scaled.*
>
> **One-line test for every decision:** *Does it make the system's reasoning more visible, more legible, or more enjoyable — without adding a control the user must learn?*

---

## Where We Actually Are (grounding — read first)

The paradigm is **~80% built**. Verify before extending:

| Capability | Lives in | State |
|---|---|---|
| One substrate (WorkspaceGraph + projections) | `core/workspace-graph.ts`, `core/*-projection.ts` | ✅ |
| Conversation as graph nodes with real HTML bodies | `components/node-body.ts`, `utils/render-block.ts` | ✅ |
| 4-tier LoD (glyph→label→card→full) | `utils/graph-scaling.ts` | ✅ |
| Density-aware layout | `utils/layout-registry.ts` | ✅ |
| Fractal: a block's `full` tier renders a nested `<s-view>` | `utils/render-block.ts:39` (`embedded`) | ✅ (no depth guard) |
| Overlay system (popovers, registry, host) | `core/overlay-*.ts` | ✅ (no drill-down breadcrumbs) |
| Conversation layouts (5) + reasoning layouts (4) | `core/conversation-layout.ts`, `core/reasoning-layout.ts` | ✅ |

**Missing = legibility + proof + one guard — not new subsystems.**

---

## Progress (v10 — Moves 1 & 2 landed)

Both moves are implemented, verified, and committed. `pnpm typecheck` + `test:unit`
(667) + `test:design` (11) + `test:craft` (202) + `test:visual` (57 cells) are green.

| Commit | Move | What landed |
|---|---|---|
| `a9b87b93` | 1 | Gallery IA (Journeys ≤6 / collapsed Coverage), 3 proving cells, `addConfigMetaNode` dropped, `generate:visual-cells` wired, `test:design` gate + checklist, token-driven fit padding/gutter, flake fix, baselines |
| `15a1b90b` | 2 | `MAX_EMBED_DEPTH` depth budget + capped card, `HTML_BODY_BUDGET` node budget, inert-until-engaged node bodies, `embedded-view-demo` cell, unit test |

**Move 1 status — all 7 items ✅.** 1.1–1.7 done. Notable: the flake fix was
*not* a threshold raise — the forced test layout raced the workspace projection's
late topology change; the harness now waits for the node count to stabilize first
(`tests/visual/visual.spec.ts`). The 3 proving cells are `chat-graph-context`,
`chat-streaming`, `chat-tool-approval`; the journey set is exactly 6
(`graph-conversation`, `selection-node-detail`, `overlay-explain` + the 3).

**Move 2 status — all 4 items ✅.** Depth is threaded explicitly
(`s-view.depth → graph-viewport.embedDepth → s-node-body.depth → renderBlockBody`),
so the guard is data-flow, not a global. The node budget lives in
`selectHtmlLabels` (pure, unit-tested). The demo cell (`embedded-view-demo`) shows
a node's `full` tier embedding a live tree projection at 200% zoom, with the
**Engage** affordance proving the inert-until-focused rule. New baselines:
`embedded-view-demo`, and `selection-node-detail` (the node body now shows Engage).

---

## Standing Rules
- **No formatting / line-length / craft polish.** D is closed.
- **No split, no renderer switch** — modeless is the paradigm. *(Delete every "Split" item.)*
- **Legibility before content.** Every capability ends with a cell/recording **and** a guard.
- **No new subsystem without a visible payoff.** A registry that changes no pixels fails the one-line test.
- Keep `typecheck` + `test:unit` green; **commit per Move**.

---

## Move 1 — Legibility & Proof (≈1–2 days, zero new architecture)

> Directly answers every item in the v9 "Visual Review Findings". No new subsystems.

> **Constraint (verified):** `tests/components/visual-coverage.test.ts` enforces **one cell per registered surface** — ~11 overlays + renderers + 8 layouts + 6 shapes + 3 panels ≈ **30+ cells**. Curation is therefore a *gallery information-architecture* problem, **not** a delete-cells problem: deleting contract cells turns `test:unit` red.

| # | Item | Files | Acceptance |
|---|------|-------|------------|
| 1.1 | **Split the gallery IA: Journeys vs Coverage** — keep every contract-required cell in a collapsed **Coverage** section; add a small hand-authored, led **Journeys** section (≤6 cells) that proves the paradigm. Do **not** delete contract cells. | `tests/visual/matrix.ts`, `tests/visual/gallery/*`, `tests/visual/reporter.ts` | reviewer sees ≤6 journey cells first; coverage stays exhaustive; `visual-coverage.test.ts` green |
| 1.2 | **Fix `addConfigMetaNode` dead path** — it still writes an `html` string on a `chat-message-node` after the X.2 refactor, so it no longer renders. Make it a workspace block or drop it. | `core/store-bindings.ts:257` | no `chat-message-node`/`html` writes remain |
| 1.3 | **Default-view composition** — tighten spacing/hierarchy from the tokens (padding around the fit, node gutters); the graph must read as organized at rest. | `components/graph-viewport.ts`, `design-tokens.json` | default cell is legible, centered, ordered |
| 1.4 | **3 proving cells** — the paradigm made visible: `chat-graph-context` (select a claim in chat → highlights in graph; `notebook.ts:424` already calls `setWorkspaceSelection`, so this is a *cell*, not new sync code), `chat-streaming`, `chat-tool-approval`. | `tests/visual/matrix.ts` | cells show the live loop, not a static graph |
| 1.5 | **`test:design` qualitative gate** — checklist: hierarchy · density · focus visibility · legibility at default zoom · paradigm visibility. | `tests/design/*` (new) | a human checklist runs pre-commit; quality regressions caught |
| 1.6 | **Fix the visual-test flake** — `graph-conflict-lens` (breadthfirst) drifts between runs. Find the layout non-determinism (initial positions / fit race) rather than raising thresholds. | `tests/visual/visual.spec.ts` | `verify` green across N runs |
| 1.7 | **Wire the missing `generate:visual-cells` script** — `ui/scripts/generate-visual-cells.ts` exists but is not registered in `package.json`, so `generated-cells.ts` can drift. | `package.json` | a regeneration command exists and is documented |

**Definition of done:** the gallery *leads* with ≤6 journey cells, every cell is legible, three cells prove chat⇄graph, coverage contract still green, `verify` stable.

---

## Move 2 — Harden the Fractal (≈1 day, one file)

> The recursive projection already renders. It just has no budget.

| # | Item | Files | Acceptance |
|---|------|-------|------------|
| 2.1 | **Depth budget on `embedded`** — a nested projection stops at depth 2 (a projection inside a projection); deeper shows a `card` + "expand" affordance. | `utils/render-block.ts`, `utils/html-labels.ts` | nesting is bounded; no runaway recursion; unit test |
| 2.2 | **Node budget for HTML bodies** — a global cap on simultaneously-mounted `<s-node-body>`; beyond it, nodes show `card`. | `components/graph-viewport.ts` | a dense graph cannot mount unbounded HTML; unit test |
| 2.3 | **Inert-until-focused** — mounted HTML bodies don't steal pan/zoom; an explicit "engage" affordance enters interaction. | `components/node-body.ts` | pan/zoom unaffected by embedded content; cell |
| 2.4 | **One demo block + recording** — an `embedded-view` block on a node, captured zooming glyph → full, revealing the nested projection. | `tests/visual/matrix.ts` | recording shows node → nested projection |

**Definition of done:** a node's `full` tier embeds a live projection, bounded to depth 2, without breaking pan/zoom.

---

## Move 3 — Deferred to v11 (explicit entry criteria, do not start)

These are **not** in v10. Each needs a visible payoff before it earns a slot.

| Item | Why deferred | Entry criterion |
|---|---|---|
| **Content adapters** (fs · AST · call-graph · series · doc → graph) | New substrate; weeks. Current substrate is under-demonstrated. | Move 1 done; a real user request for a non-conversation source |
| **Semantic-zoom morph** (Chat⇄Notebook⇄Graph interpolation) | Research-grade; no shared coordinate space proven. | A design spike proves the coordinate space |
| **Editor / undo-redo** | Unblocked only once structured input lands (forms already exist). | Move 2 done; form input used |
| **Node-renderer *registry*** | The 4-tier function already works; a registry is architecture for its own sake. | A 5th renderer (3D or chat) needs the shared descriptor |
| **`graph3d`** | Only worth it if 3D does something 2D cannot (fractal depth in the z-axis). | Move 2 done; a concrete 3D-only affordance |

---

## Move 2.5 — Make the guards legible & safe (landed)

Picked from the opportunities below — the ones with a *visible* payoff, per the
fresh-session rule. Committed separately after Moves 1 & 2.

- **Engage is now two-way.** `s-node-body` toggles **Engage ⇄ Release**, and a
  press anywhere outside the body (or `Escape`) releases it, so an embedded body
  can never trap the pointer.
- **The cap card carries the reason.** `.embed-capped` shows a `depth limit` note
  (and a title explaining `MAX_EMBED_DEPTH`).
- **The node budget is observable.** `computeHtmlLabels` now returns
  `{ labels, hidden }`; the viewport surfaces `▼ N node bodies over budget — zoom
  for detail`, so a dense graph never silently drops bodies.
- **The budget is covered against a real `Core`.** New
  `tests/components/html-labels.test.ts` mounts a headless cytoscape graph and
  asserts the cap, the held-back count and the rendered geometry.
- **New cell `html-body-budget`** seeds 30 workspace blocks at the `full` tier and
  captures the surfaced remainder. It seeds a stub engine node (`isolateGraph`) so
  the graph's empty state does not overlay the badge.

---

## Notes Facilitating Remaining Work

- **Where the depth guard lives.** The embed depth is *threaded through the DOM*,
  not held in a module global: `renderBlockBody(block, sources, depth)` renders
  `<s-view .depth=${depth}>`, the host forwards `.embedDepth` to the adapter, and
  `graph-viewport` passes `.depth=${embedDepth + 1}` to each `s-node-body`, which
  feeds it back into `renderBlockBody`. Only the **graph** adapter recurses (it is
  the only one that renders node bodies); the tree/table/code adapters render
  datasets and terminate on their own. If a second embedding adapter is ever added
  it must forward `.embedDepth` the same way or the budget is bypassed.
- **The cap is a `card`, not a mount.** `MAX_EMBED_DEPTH` renders `.embed-capped`
  (a dashed card with an **Expand** button that opens the artifact overlay), so a
  runaway fractal degrades to one clickable row instead of an unbounded tree.
- **Node budget is per viewport, ranked by importance then rendered area.** It is
  a policy constant (`HTML_BODY_BUDGET`), not a global counter across viewports —
  if a second live graph viewport is ever mounted, the budget is per-canvas.
- **`test:design` is now in `verify`.** It encodes hierarchy/density/focus/
  legibility/paradigm where measurable; `tests/design/CHECKLIST.md` is the human
  half. `generate:visual-cells` writes the file directly (no shell redirect), so
  regenerating is idempotent.
- **Baselines.** A Move that changes pixels changes baselines *deliberately*.
  `embedded-view-demo` is new; `selection-node-detail` moved because every mounted
  node body now carries the **Engage** affordance.

## New Improvement Opportunities

- [x] ~~Engage is one-way~~ — now toggles and releases on outside-press / `Escape` (Move 2.5).
- [x] ~~The cap card could carry the reason~~ — shows a `depth limit` note (Move 2.5).
- [x] ~~Node budget has no visible signal~~ — `hidden` is surfaced as a badge (Move 2.5).
- [x] ~~`selectHtmlLabels` untested against a real `Core`~~ — `html-labels.test.ts` (Move 2.5).
- **The graph empty state overlays workspace nodes.** With engine nodes empty but
  workspace blocks present, the "brain / Send a message" empty state still paints
  over the canvas (it is keyed on `$graphNodes`, not on any node). It hid the
  budget badge until the demo seeded a stub. Fix: show the empty state only when
  *both* layers are empty.
- **`embedded-view-demo` is a static seed.** It sets `$workspaceGraph` directly
  rather than through the projection, so it does not exercise the real path a
  substrate block takes to reach a node body; a server-side seed would.
- **`HTML_BODY_BUDGET` is per-viewport.** If a second live graph viewport is ever
  mounted, the budget is per-canvas rather than global.

---

## Delete List (capability kept, complexity removed)

| Remove | Keep capability via |
|---|---|
| "Split" / linked-workspace (B-6) | Modeless graph *is* the linked workspace |
| Flat 50-cell gallery wall | Led **Journeys** strip (≤6) + collapsed **Coverage** rows (contract-required cells kept) |
| Manual "Fit" as the only scaling | Auto-scale + zoom policy (done) |
| Per-kind bespoke renderers | One `renderBlockBody` + `embedded` |
| New registries with no visible payoff | Extend the existing functions |
| `addConfigMetaNode` phantom config node | The workspace substrate owns chrome; no dead `html` writes |

---

## Fresh-Session Checklist
- [x] Read "Where We Actually Are" — do not rebuild what exists
- [x] **Move 1**: split gallery IA (Journeys ≤6 / Coverage) · fix the dead `html` path · tighten default view · 3 proving cells · `test:design` · fix the flake · wire `generate:visual-cells`
- [x] **Move 2**: depth budget · node budget · inert-until-focused · demo cell
- [x] **Move 2.5**: two-way engage · cap reason · budget signal · real-`Core` budget test · budget cell
- [ ] Do **not** start Move 3 items (see entry criteria above)
- [x] Commit per Move; regenerate baselines deliberately; keep `typecheck` + `unit` green
- [ ] Next session: the graph empty state overlays workspace nodes (see opportunities) — a *visible* bug worth fixing before Move 3