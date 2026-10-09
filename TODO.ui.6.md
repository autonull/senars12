# TODO.ui.6.md — Work-Package Backlog (consolidated)

> Supersedes `TODO.ui.5.md` for all open work. v5 is the landed record. This file is the execution spine: one home per open item, consolidated, with cleared blockers removed and critical path updated.

## Dependency spine (updated)

```
WP1 ─┬─▶ WP2 ─┐
     │        ├─▶ WP6 ─▶ WP7 ─▶ WP8
WP3 ─┴────────┘
WP3 ─▶ WP5 ─▶ WP6
WP3 ─▶ WP4
```

**Critical path: WP3 → WP5 → WP6 → WP7**. WP5 (Reasoning) is now the active critical-path work package.

Status: `[ ]` todo · `[~]` partial · `[x]` done · `!` blocked  
Size: **S** ≈ half day · **M** ≈ day · **L** ≈ multi-day

---

## Ready now — unblocked, ordered by leverage

| # | Item | Size | Files | Notes |
|---|------|------|-------|-------|
| 1 | **`2.6 scope`** — debounce `folded` writes for bulk fold-all | M | `core/store.ts`, `utils/layout-registry.ts`, `core/layout-ids.ts`, `components/graph-toolbar.ts`, `components/graph-viewport.ts` | Layout switching + URL round-trip landed; only fold-all debounce remains |
| 2 | **`2.6 context`** — `WorkspaceContext` fields (`renderer`, `setRenderer`, `overlays`) | M | `components/workspace-host.ts` | Deferred (no consumer); add with first renderer that switches modes |
| 3 | **`ops sequencing`** — carry engine `seq`/`eventRefs` on `WorkspaceOp` | M | `core/workspace-graph.ts`, `core/workspace-projection.ts` | Needs first `WorkspaceOp` producer (likely `3.6` steer/author) |
| 4 | **`3.2 formalization`** — claim → candidate → gate → belief/goal/question | L | `core/segmentation.ts`, `core/workspace-projection.ts`, `components/input-hud.ts` | Core reasoning UX loop; routes composer through formalization |
| 5 | **`3.7 MeTTa`** — second `ReasoningBackend` adapter | M | `core/metta-backend.ts` | Seam ready; implement `vocab`/`kind` and pass to `projectWorkspace` |
| 6 | **`3.1 projection` (event-stream half)** — `budget.exhausted` → `budget` blocks, `policy.violation`/`egress.gate.rejected`/`shadow.validation.dropped`/`judgment.resolved` → `gate-decision` blocks | M | `core/workspace-projection.ts`, `core/graph-projection.ts` | Graph half done (vocab from `VERIFIER_TRUTH_TABLE`); needs event-stream projection |
| 7 | **`2.3 node ops`** — "Ask as question" / "Assert as claim" → `WorkspaceOp.block.add` | M | `core/workspace-projection.ts`, `components/renderers/graph.ts` | Cross-fragment context refs in `projectWorkspace` |
| 8 | **`4.3 affordances` (edge half)** — edge popover Open-in-Notebook / Open View | M | `components/overlays/inspector.ts`, `components/node-detail-drawer.ts`, `core/workspace-projection.ts` | Node half landed; edge half needs `linkRefFor` |
| 9 | **`1.4 rich text`** — inline full tables, view-barrel ownership | S | `core/inline-text.ts`, `components/renderers/notebook.ts` | Tokenizer + rendering landed; only tables + barrel remain |
| 10 | **`4.4 controls`** — explicit prospective control, announce in overlay header | S | `components/timeline-scrubber.ts` | Live/past done; prospective + header announce remain |
| 11 | **`0.5 tool approval`** — dialog overlay (needs producer: `tool.approval.request`) | S | `overlays/tool-approval.ts` (new) | Modal scrim landed; wire needs producer |
| 12 | **`4.5 pinning`** — per-overlay pin button + `[data-pinned]` CSS | S | `core/overlay-manager.ts`, `core/events.ts`, `core/commands.ts`, `components/app-layout.ts` | Manager seam + session-only pinning landed |

---

## Gated — blocked on prerequisites

| Item | Blocker | Unblocks |
|------|---------|----------|
| **`4.3 derivation-record`** (`s-tree` view) | WP5 `3.3` `DerivationRecord` payload | — |
| **`1.5 page`** (turn/page boundary policy) | Section model `pageOf` exists; needs auto-page producer | — |
| **`1.4 block-level streaming`** | Backend partial assistant text in `$chatMessages` | — |

---

## Work Packages — remaining by WP

### WP3 — View & artifact completion (partial)

| Item | Status | Notes |
|------|--------|-------|
| `3.3 provenance` | `[~]` | `derivation-record` blocks + `s-tree` view; needs `DerivationRecord` payload (`3.3`); absorbs `4.3 derivation-record` |
| `1.5/1.1 section model` | `[~]` | Heading-level boundaries (turn/page policy); "jump to related block" (`2.4` work) |

### WP4 — Timeline present-anchoring (partial)

| Item | Status | Notes |
|------|--------|-------|
| `4.4 anchor` | `[x]` | Cursor + admission landed; graph/ToC admission not yet |
| `4.4 gating` | `[x]` | HUD `⏱` gated on `occurrenceTime` |

### WP5 — Reasoning vertical slice (active critical path)

| Item | Status | Notes |
|------|--------|-------|
| `3.1 projection` (graph) | `[x]` | NAR vocab from `VERIFIER_TRUTH_TABLE`; punctuation → block kinds |
| `3.1 projection` (events) | `[~]` | Budget/gate blocks from cognitive event log |
| `3.2 formalization` | `[ ]` | Claim → candidate → gate admission |
| `3.3 provenance` | `[~]` | `derivation-record` + `s-tree`; needs evidence lineage (engine derivation recorder) |
| `3.4 layouts` | `[x]` | `reasoning-provenance`, `gate-pipeline`, `contradiction-neighborhood`, `budget-resource` |
| `3.5 explanation` | `[x]` | Block/link/event → summary/card/detail/raw via `renderBlockBody` |
| `3.6 steer/author` | `[x]` | All control methods + palette commands + `config-change` producer |
| `3.7 MeTTa` | `[ ]` | Second adapter over same substrate |

### WP6 — Parity & rendering quality

| Item | Size | Notes |
|------|------|-------|
| `2.5 parity suite` | M | Canonical loop per renderer; `rendererParity`/`rendererSupports` data for gating |
| `2.1 growth` | M | Incremental animated growth (replace-by-diff today) |
| `2.1 clusters` | M | Compound clusters from chat `contains`/headings |
| `1.2/2.3 floating composer` | L | Anchored to block/node/subgraph; cy→DOM handoff |
| `1.2 composer sweep` | M | Mode bar ↔ palette shared action source; `composer.prefill` |
| `2.x graph polish` | M | Lens/capability styling; hidden layer `fit`; `graph.ask-selection`; layout cycle |

### WP7 — Agent-operable

| Item | Size | Notes |
|------|------|-------|
| `5.1 execution` | L | `ui.command` over workspace (renderer, focus, explain, scrub, etc.) |
| `5.1 args` | M | Parameterised commands with `params` descriptor + palette prompt |
| `5.2 control mode` | L | Suggestions → execution + visible command log + HUD stop |
| `5.3 demonstrations` | L | "Show me how you got that" |
| `5.4 screen-record mode` | L | Minimal HUD, focus highlight, captions |

### WP8 — Bridge, hardening, standalone, 3D

| Item | Size | Notes |
|------|------|-------|
| `0.7 bridge` | L | Legacy nodes/events/chat as overlays/embedded views |
| `7.1 boundary` | L | Package split (`semantic-graph` vs SpaceGraphJS) |
| `7.2 standalone` | L | Engine-free build |
| `7.3 performance` | L | Op batching, virtualization, decimation, latency budgets |
| `7.3 quality` | L | Error taxonomy, a11y, plugin API, docs-as-code, visual regression |
| `tests & parity harness` | L | Unit tests + Graph renderer test + visual baselines |
| `6 Graph3D` | L | `WorkspaceRenderer` over SpaceGraph, `parity: 'partial'` |

---

## Cleared blockers (no longer listed)

- ✅ **Modal scrim** — landed (`core/overlay-manager.ts`)
- ✅ **`LmProvider` façade** — landed (`core/lm-provider.ts`, `core/lm-transport.ts`, `provider` overlay)
- ✅ **Section model** — landed (`core/sections.ts`)
- ✅ **Node→workspace-block mapping** (node half) — landed (`blockRefFor` in `workspace-projection.ts`)
- ✅ **`config-change` producer** — landed (`core/config-change-producer.ts`)

---

## Seams to build on (unchanged)

Overlays, Views, Inline text, Block payloads, Block bodies, Reaching a block, Embedded views, Artifacts, Citations, Commands, Capabilities, LM provider, Section model, Node→block mapping, Reasoning backend, Renderers, State/URL, Projection, Explain/links/ToC, Layouts, Block affordances — see `TODO.ui.5.md` §Seams for file paths.

---

## Landed (v5) — progress log

- **WP1 `0.6` backend seam (control half) + WP5 `3.6` steer/author** — `ReasoningBackend` extended with `BackendCaps` and optional `control` surface; NARS adapter implements all control methods; protocol schemas (`reasoning-control.ts`); 8 palette commands gated on `reasoning` capability + backend caps; `config-change` producer emits diff blocks on settings change
- **WP5 `3.1` projection (graph half)** — `nars-backend.ts` VOCAB derives all NAR rule names from single-source-of-truth `VERIFIER_TRUTH_TABLE` (binary 16, unary 4) + structural (7) + provenance (3) → semantic link kinds; `projectReasoning` detects belief/goal/question/command from punctuation
- **WP5 `3.4` layouts** — `reasoning-provenance`, `gate-pipeline`, `contradiction-neighborhood`, `budget-resource` registered in `layout-registry`
- **WP5 `3.5` explanation** — unified `explain()` for block/link/event
- **WP5 `3.6` steer/author + `config-change`** — complete
- **WP2 `2.6 validation`** — cycle-free layout ids via `core/layout-ids.ts`
- **WP2 `2.5` selection/focus/defaults** — all landed
- **WP3 `4.3 typing`** — discriminated `Artifact` union, `block-payload.ts`
- **WP3 `2.4` inspection & embedded views** — node/edge popovers, ToC reach, neighborhood depth
- **WP3 `1.5/1.1` section model** — recursive containment, fold-aware `j/k`, `view.fold-all`
- **WP3 `citations model`** — `Source`/bibliography, `[n]` resolution
- **WP4 `4.4` anchor/gating** — present-anchored cursor + temporal HUD gating

All 422 UI tests pass. Core layout-registry tests pass (8).