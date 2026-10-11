# TODO.ui.10.md — SeNARS UI Remaining Work (v10 Focus)

> **North Star:** *SeNARS UI is not a chat app with a graph tab. It is a **living, zoomable, reasoning canvas** — one substrate, many projections, recursively embeddable, LoD-scaled. Any cell can reveal its content, its provenance, or another projection, to a depth the user controls.*

> **One-line test for every decision:** *Does it make the system's reasoning more visible, more legible, or more enjoyable — without adding a control the user must learn?*

---

## Standing Rules
- **No formatting / line-length / craft polish.** D is closed.
- **No split, no renderer switch** — modeless is the paradigm.
- **Legibility (G) before content (X/R).** Every capability ends with a cell/recording **and** a guard.
- **Regenerate baselines on purpose**; never let a stale/illegible baseline count as "green".
- Keep `pnpm --dir ui typecheck` + `test:unit` green; **commit per Move**.
- Prefer **one registry** per concern (renderers, adapters, overlays, tokens).

---

## Revised Priority Spine
```
F (floor) → X (experience architecture) → G (scaling/legibility) → V (encoding) → C (chrome)
          → D (craft) → H/R/B/P/I (envelope) → T (visual-testing restructure)
```

---

## Move 1 — See the Truth (G + T) — ~Half Day

### G — Viewport, Auto-Scaling & Legibility (Complete)
| # | Item | Status | Notes |
|---|------|--------|-------|
| G.1 | Auto-scaling node size | ✅ | `utils/graph-scaling.ts` |
| G.2 | Zoom policy (floor/ceiling/center) | ✅ | `components/graph-viewport.ts` |
| G.3 | Label LOD by importance × zoom | ✅ | `utils/html-labels.ts` |
| G.4 | Density-aware layout | ✅ | `utils/layout-registry.ts` |

### T — Visual Testing Restructure
| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| T.1 | Curate matrix to ~12–15 baseline cells | ⬜ | `tests/visual/matrix.ts` | ≤15 baselines; each cell unique; gallery reviewable at a glance |
| T.2 | Journey recordings (video/GIF) | ⬜ | `tests/visual/*` | Recording shows live chat⇄graph loop; linked from gallery |
| T.3 | `test:design` qualitative gate | ⬜ | `tests/design/*` (new) | Human checklist runs pre-commit; catches quality regressions |
| T.4 | Legibility assertion cell | ✅ | `tests/visual/legibility.spec.ts` | Illegible default view fails CI |

**Visual Review Gaps to Address in T.1:**
- Graph legibility at default zoom — ensure labels visible, nodes not tiny
- Layout disorganization — more whitespace, clearer grouping
- Missing Chat–Graph blend — add `chat-graph-split`, `chat-with-graph-context`, `anchored-inquiry`
- Redundant cells — collapse duplicate layout/view cells
- No LM interaction visible — add `chat-streaming`, `chat-tool-approval`, `chat-belief-revision`

---

## Move 2 — Build the Paradigm (X) — ~2–3 Days

### X — Experience Architecture
| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| X.1 | Journeys as first-class artifacts | ⬜ | `docs/ux/journeys.md` (new) | 5 core use cases (Q&A/research · knowledge-building · goal-planning · teaching · audit) with flow diagrams + visual cells |
| X.2 | Modeless conversation-as-graph | ◐ **In progress** | `components/app-layout.ts`, `components/graph-viewport.ts`, `components/node-body.ts` | Conversation blocks as legible nodes with bodies; composer feeds same surface; selection continuous |
| X.3 | View presets + Display popover | ⬜ | `components/graph-toolbar.ts`, `core/store.ts` | ≤3 primary controls (Ask/Explore/Read/Plan/Split); presets set renderer+layout+lens+encoding |
| X.4 | Progressive-disclosure ladder | ⬜ | `components/app-layout.ts`, `core/hints.ts` | L0: composer+canvas; L1: view+search+zoom; L2: Display popover; L3: palette |
| X.5 | First-run / empty-state design | ⬜ | `components/app-layout.ts`, `components/primitives/empty-state.ts` | Empty state is legible, actionable invitation |
| X.6 | Delight / moments of insight | ⬜ | `styles/*`, `components/renderers/*` | Purposeful motion for derivation forming, contradiction surfacing, graph responding to turn, truth revising |

**Definition of Done for Move 2:** A cell shows chat *and* graph reacting to one another; ≤3 primary controls.

---

## Move 3 — Make It Fractal (R) — ~3–5 Days

### R — Rich Content & Fractal HTML
| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| R.1 | Node-renderer registry + LoD tiers | ⬜ | `core/node-renderers.ts` (new), `utils/adapter-2d.ts`, `spacegraph/*` | Every kind has 4 tiers (glyph→label→card→full); zoom changes tier; cells |
| R.2 | Fractal HTML runtime | ⬜ | `utils/html-labels.ts`, `components/graph-viewport.ts` | Nested projection renders to bounded depth; pan/zoom unaffected; cell |
| R.3 | Content adapters | ⬜ | `core/adapters/*` (new), view-adapter registry | Filesystem/AST/control-flow/series/docs → navigable LoD-aware graph |
| R.4 | Rich chat frames | ⬜ | `components/renderers/*`, `components/*-frame.ts` (new) | Turn embeds live graph/chart/form/artifact viewer at `full` tier; cells |
| R.5 | Conversation-as-graph | ⬜ | `components/renderers/graph.ts`, `utils/graph-layout.ts` | Dialogue structure (turns·responds-to·threads) as first-class graph with LoD |
| R.6 | Overlay-as-IA | ⬜ | `core/overlay-manager.ts`, `components/overlays/*` | Anchored popovers, drill-down panels w/ breadcrumbs, inline expanders, wizards |

**Fractal Guards (must implement):**
- Max depth (projection inside projection stops at N=2)
- Max rendered HTML nodes (global cap; fallback to `card` + "expand")
- Interaction mode: HTML nodes inert until focused; explicit "engage" affordance
- Reduced-motion + reduced-detail honored from tokens

**Definition of Done for Move 3:** Recording shows node zooming from glyph → full, embedding a live projection.

---

## Move 4 — Expand the Substrate (R.3) — ~3–5 Days

| Item | Status | Files | Acceptance |
|------|--------|-------|------------|
| Filesystem → graph adapter | ⬜ | `core/adapters/fs.ts` | Directory tree as navigable graph |
| Source AST / call-graph → graph | ⬜ | `core/adapters/ast.ts` | Source file becomes call graph |
| Dataset/chart → graph | ⬜ | `core/adapters/series.ts` | Data series as series-graph |
| Document structure → graph | ⬜ | `core/adapters/doc.ts` | Document outline as graph |

**Definition of Done for Move 4:** A source file becomes a navigable, LoD-aware graph with cell.

---

## Move 5 — Envelope & Polish (V/C/D/H/R/B/P/I + T) — Ongoing

| Phase | Items | Status |
|-------|-------|--------|
| **F.2** | Baseline hygiene (regenerate baselines, error-modal guard) | ⬜ |
| **B.1** | Cross-view identity & sync (selection sync chat⇄graph) | 🟡 Partial |
| **H.1–H.5** | Dynamic help, contextual help, empty-state teaching, hints, docs-from-data | ⬜ All |
| **R.1–R.4** | Toast system, auto-retry, error recovery actions, inline validation | ⬜ All |
| **V/C/D** | Return to existing items with new legible/fractal foundation | ⬜ |
| **T (restructured)** | Journey cells + recordings; `test:design` gate | ⬜ |

---

## Bold Commitments (v10.x — Explore AND Implement)

| # | Capability | Why Bold | First Proof |
|---|------------|----------|-------------|
| **B-1** | Fractal HTML nodes with real budgets | Turns nodes into living cells; no competitor does recursive projections | Graph node containing mini-graph, bounded to depth 2 |
| **B-2** | LoD node rendering as first-class system | Makes fractal detail survive scale; "overview first, detail on demand" literal | One block kind with four tiers, zoom-driven |
| **B-3** | Content adapters (files · AST · call/control-flow · datasets · documents) | Expands substrate beyond conversation; SeNARS reasons over *any* structure | Source file rendered as navigable call graph |
| **B-4** | Rich chat frames (Markdown · forms · charts · embedded live graphs) | Chat becomes workspace, not transcript | Turn embedding live graph neighborhood |
| **B-5** | Conversation-as-graph | Proves chat and graph are one substrate, visibly | Seeded conversation laid out as discourse graph |
| **B-6** | Linked workspace (Split) — chat + graph simultaneous | Resolves core contradiction; paradigm is *built*, not asserted | Select claim in chat → highlights in graph beside it |
| **B-7** | Overlay-as-IA (anchored popovers · drill-down · inline expanders · wizards) | Detail appears *at its anchor*; no context-switching | Provenance walk as breadcrumbed drill-down |
| **B-8** | Semantic-zoom morph (spike then build) | Endgame of "one substance" | Design spike proving shared coordinate space |

**Guardrails, not brakes:** node/depth budgets (fractal), inert-until-focused (interaction), one registry per concern (coherence), reduced-motion + reduced-detail (accessibility), legibility assertion (G.4/T.4).

---

## Fresh-Session Kickoff Checklist
- [ ] Read: North Star · Move 1 (G+T) · Move 2 (X) · Move 3–4 (R) · Bold commitments
- [ ] Confirm revised spine: `F → X → G → R → V → C → D → H/R/B/P/I → T`
- [ ] Start with **Move 1 (T.1/T.2/T.3)**: curate matrix, add journey recordings, design gate
- [ ] Then **Move 2 (X)**: linked workspace + view presets + disclosure ladder + first-run
- [ ] Then **Move 3–4 (R)**: fractal HTML + LoD registry + chat frames + content adapters
- [ ] Every new capability ends with a **cell or recording** and a **budget/guard**
- [ ] Commit after each Move; keep `typecheck` + `unit` green; regenerate baselines deliberately