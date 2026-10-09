# TODO.ui.7.md — Working UI + Visual Contract (execution spine)

> **Relationship.** Supersedes `TODO.ui.6.md` for all open work; v5/v6 are the landed record. This
> file **refocuses on the outcome** — a UI a human can actually use end-to-end — and folds every
> open v6 item plus the missing **generated-screenshot contract** into one dependency-ordered spine.
> Stable ids (`0.x`, `2.x`, `3.x`, `5.x`, `7.x`) are kept as tags so old provenance resolves.

## Goal & Definition of Done

**Goal.** A standalone, human-usable Web UI over the cognitive kernel, whose correctness is
verifiable **at a glance** from a generated screenshot gallery — no manual click-through.

Done means a user can, in one session, without developer tooling:

1. **Open & connect** — load the UI, see connection state, recover from drop/reconnect.
2. **Converse** — type natural language; watch formalization → reasoning → answers stream live.
3. **See** — a live graph (growing incrementally), a notebook of blocks, provenance/derivation trees.
4. **Inspect** — focus/select nodes & edges; open inspector/explain/ToC/artifact; follow links.
5. **Steer** — retract/revise beliefs, add goals, adjust budget/provider; see reactions as new blocks.
6. **Navigate** — switch renderer/lens/layout/panel; deep-link state via URL; replay via timeline.
7. **Operate by keyboard** — palette, composer, overlays, navigation all reachable without a mouse.

Done means **every screen and scenario has a committed, generated screenshot** in the gallery, and a
**coverage test fails** when a registered surface (overlay, renderer, layout, view adapter, panel)
has no screenshot cell. The gallery is the primary "is it working?" artifact.

## Gates (commands that must stay green)

| Gate | Command | Guards |
|------|---------|--------|
| Types | `pnpm --dir ui typecheck` | compile-time invariants |
| Units | `pnpm --dir ui test:unit` | projection, registries, helpers |
| Behaviour | `pnpm --dir ui test:e2e` | real boot path scenarios |
| **Visual** | `pnpm --dir ui test:visual:ci` | baselines + `ui:gallery` contact sheet |
| Coverage | (part of units) `visual-coverage.test.ts` | every registered surface has a cell |

`ui:gate` currently runs typecheck + units. **CI/GitHub is disabled entirely** (O4): every gate runs
locally via one `ui:verify` entry point. The visual/e2e runs use a **real compact offline LM — no
mocks** (O5).

## Dependency spine

```
P0 ─▶ P1 ─┬─▶ P2 ─┐
          │       ├─▶ P3 ─▶ P4
          └───────┘
```
- **P0 Green base** — fixes today's red typecheck; finishes the in-flight `2.5 parity` WIP.
- **P1 Visual contract** — screenshot coverage + gallery; independent of P2/P3, do it early.
- **P2 WP6 quality** — live graph, composer, graph polish.
- **P3 WP7 control** — agent/human command execution, control mode, demonstrations.
- **P4 WP8 product** — bridge, standalone, Graph3D, performance/quality.

---

## P0 — Green base (S)

| # | Item | Files | Acceptance |
|---|------|-------|------------|
| 0.1 | **Fix typecheck errors** — `derivation-record` in `BLOCK_KIND_LABEL` map (`block-labels.ts`, `graph-projection.ts`, `toc.ts`); export `ConfigChangeData`; `CognitiveEvent`→`CognitiveMeta` import (`store.ts`); `BackendNode`/`BackendVocabulary` (`workspace-projection.ts`); `tool-registry` schema `properties`; `SemanticLinkKind` index sigs (`metta/nars-backend.ts`); `DerivationRecord` export from `@senars/core` used by `server/index.ts` | listed | `pnpm --dir ui typecheck` clean |
| 0.2 | **Finish `2.5 parity`** — correct the WIP `RendererParity` so `rendererKind` reflects the real surface kind (`s-view`/`spacegraph-viewport`/`notebook`), not derived from `parity`; route palette/shell gating through `rendererParity`; canonical-loop + per-pair round-trip tests | `core/workspace-renderer.ts`, `components/renderers/*`, `tests/components/renderer-parity.test.ts` | `rendererParity()` is the single source for gating; pair round-trips notebook↔graph↔graph3d |

---

## P1 — WP9 Visual coverage & gallery (M) *(new — the at-a-glance contract)*

Existing harness: `tests/visual/{visual.spec.ts,matrix.ts,reporter.ts,playwright.config.ts}`,
`scripts/build-gallery.ts`, `baselines/chromium/`. Work is **coverage + automation**, not a rebuild.

| # | Item | Files | Acceptance |
|---|------|-------|------------|
| 1.1 | **Registry-driven matrix** — derive cells from `overlay-registry`, `workspace-renderer`, layout registries, `view-adapter` shapes, panel ids; keep hand-curated cells as overrides | `tests/visual/matrix.ts` | every registered overlay/renderer/layout/view-shape appears as a cell |
| 1.2 | **Coverage test** — fail when a registered surface lacks a cell; keep a small explicit `KNOWN_GAPS` ledger that must be empty at P4 | `tests/components/visual-coverage.test.ts` | adding a renderer/overlay/layout without a cell turns the suite red |
| 1.3 | **Scenario matrix** — canonical scenarios per group: bootstrap, derivation, conflicting-evidence, metta, tool-approval, budget/gate-decision, error/empty, disconnected | `tests/visual/matrix.ts`, `server/scenarios.ts` | each scenario has ≥1 committed baseline |
| 1.4 | **State matrix** — empty, loading, disconnected, error-boundary, reduced-motion, narrow (640), wide (1920), dark (+ light if supported) | `matrix.ts` | states enumerated; each captured or explicitly N/A |
| 1.5 | **Gallery as artifact** — group, summary, baseline+actual+diff; add `docs/readme/ui-gallery.md` (generated) linking the sheet; decide publish vs local (O2) | `scripts/build-gallery.ts`, `docs/readme/*` | one page answers "is it working?" |
| 1.6 | **Local verification entry** — `ui:gate` += visual-coverage unit test; add `ui:verify` = typecheck + unit + visual:ci + gallery; **no CI/GitHub wiring** (O4) | `package.json` | one local command fails on baseline drift or uncovered surface |

---

## P2 — WP6 rendering quality (M×5)

| # | Item | Files | Acceptance |
|---|------|-------|------------|
| 2.1 | **`2.1 growth`** — incremental animated growth of the workspace layer (replace-by-diff today) | `core/workspace-projection.ts`, `components/renderers/graph.ts` | new blocks animate in; no full relayout; screenshot shows stable topology |
| 2.2 | **`2.1 clusters`** — compound clusters from chat `contains`/headings; set `children` on turns | `core/workspace-projection.ts` | a multi-turn chat collapses into a cluster cell |
| 2.3 | **`1.2/2.3 floating composer`** — anchored to block/node/subgraph, summoned not persistent; cy→DOM handoff | `components/input-hud.ts`, `core/commands.ts` | composer opens anchored; capability-gated modes; screenshot cell |
| 2.4 | **`1.2 composer sweep`** — mode bar ↔ palette share one action source; `composer.prefill`; per-segment preview; guard `decomposeInput` over-splitting; extract `ComposerFocus` | `components/input-hud.ts`, `core/commands.ts` | one action source; prefill from `tool-result`; decimal/abbrev safe |
| 2.5 | **`2.x graph polish`** — unify lens/capability styling in adapter; exclude hidden layer from `fit`; bind `graph.ask-selection` (`a`); HUD/palette layout group + `graph.layout.cycle`; register `chronological-flow`/`source-view` SpaceGraph surfaces when storyboard adapter exists | `components/renderers/graph.ts`, `core/workspace-renderer.ts`, `components/graph-toolbar.ts` | hidden layer not fitted; layout cycle reachable; suite green |

---

## P3 — WP7 human/agent control (M/L)

| # | Item | Files | Acceptance |
|---|------|-------|------------|
| 3.1 | **`5.1 execution`** — `ui.command` over the workspace (renderer, focus, explain, highlight, ToC/search, artifact, embed, compose, narrate, scrub); round-trip test through `applyServerMessage`; executed commands visible in timeline/telemetry | `core/commands.ts`, `core/ws-client.ts`, `core/workspace-bindings.ts` | engine-emitted `ui.command` drives UI; one round-trip test |
| 3.2 | **`5.1 args`** — parameterised commands with `params` descriptor; type-check args; `available()`-aware palette badge | `core/commands.ts`, `components/overlays/palette.ts` | palette prompts for args; invalid args rejected |
| 3.3 | **`5.2 control mode`** — default off → suggestions; on → execution + visible command log + HUD **stop**; budget/stop in HUD | `components/workspace-hud.ts`, `core/commands.ts` | toggle observable; stop halts an in-flight run |
| 3.4 | **`5.3 demonstrations`** — "show me how you got that" switches renderers, focuses refs, opens provenance, narrates | `core/commands.ts` | one narrative sequence scripted + screenshot |

---

## P4 — WP8 product (L)

| # | Item | Files | Acceptance |
|---|------|-------|------------|
| 4.1 | **`0.7 bridge`** — legacy nodes/events/chat as overlays/embedded views; ViewSpec adapters usable in overlays | `components/overlays/*`, `components/views/*` | legacy surfaces reachable; screenshot cells |
| 4.2 | **`7.2 standalone`** — engine-free build (LM provider + segmentation + semantic links + Notebook/Graph) | build config, `entry.ts` | UI runs with no NARS backend (O3) |
| 4.3 | ~~`6 Graph3D`~~ — **deferred** (O6); Graph is the priority and is partially complete | `components/renderers/graph3d.ts` | — |
| 4.4 | **`7.3 performance`** — op batching, virtualization, decimation, latency budgets; memoise ToC/explain/commands; shared adjacency index | `core/workspace-projection.ts`, `core/toc.ts` | budgets met under high-throughput scenario |
| 4.5 | **`7.3 quality`** — error taxonomy; plugin/descriptor API; docs-as-code; visual-regression net re-expanded (a11y deferred, O7) | `core/`, `tests/visual` | error states captured |

---

## Known Issues (carried from v6, being fixed in P0)

Type errors: `derivation-record` label map; `ConfigChangeData` export; `CognitiveEvent` name;
`BackendNode`/`BackendVocabulary`; `tool-registry` schema `properties`; `SemanticLinkKind` index;
`DerivationRecord` export for `server/index.ts`; `typecheck:bin` (`tests/nar/refactor4-budget.test.ts`);
RL parity non-stationary adaptation (`tests/nar/rl/parity/cognitive-advantage.test.ts:565`).

## Decisions & open questions

Resolved:
- **O1 Platform** — Linux-only (`chromium/linux`) baselines.
- **O2 Gallery** — commit baselines; gallery generated locally.
- **O3 Deployment** — `ENABLE_WEB_UI=true pnpm bot` (engine attached) is the usability bar; standalone
  (P4.2) follows.
- **O4 CI** — CI/GitHub disabled entirely; all gates local (`ui:verify`).
- **O5 LM** — E2E/visual scenarios use a real, compact **offline** LM (`Qwen3.5-0.8B-Q4_0.gguf`, via
  `llama.cpp`); unit tests stay pure/deterministic. No mocks in scenarios.
- **O6 Graph3D** — deferred; Graph is the priority.
- **O7 a11y** — deferred to post-usability.
- **O8 motion** — screenshots first; motion captures later.
- **O9 Typecheck** — `pnpm --dir ui typecheck` clean is a hard gate.
- **O10 Commits** — one commit per item.

---

## Landed (v6) — progress log (carried)

Overlay windows (drag/resize/min/max/cascade/tile/persist); `overlay-header` shared component;
`2.6 scope` fold-all debounce; `ops sequencing`; WP5 `3.1` projection graph+events; `3.2`
formalization; `3.3` provenance (`derivation-record` + `s-tree`); `3.4` layouts; `3.5` explanation;
`3.6` steer/author + `config-change`; `3.7` MeTTa; `2.3` node ops; `4.3` edge affordances; `1.4`
rich text; `4.4` controls; `0.5` tool approval + `prompt_user`; `4.5` pinning; `2.6` context.

## Progress (v7)

- `[x]` **P0.1 green typecheck** — fixed 24 pre-existing errors: `derivation-record` label;
  `ConfigChangeData`/new `DerivationData` payloads; `CognitiveEvent` import; `BackendNode`/
  `BackendVocabulary` import; recursive `ToolParamSchema`; `SemanticLinkKind` vocab typing (NARS +
  MeTTa `uses-tool`); `run(args)` required; `DerivationRecord` via `@senars/core/schemas`; plus
  overlay/related/provider/tool-approval wiring (`override`, `onPinChange`, `go`, `setApprovalHandler`).
  `pnpm --dir ui typecheck` clean; 422/422 units.
- `[x]` **P0.2 §10 parity** — `rendererParity`/`rendererParityFor`/`declareParity` are the data view;
  `rendererSupports`/`rendererHasControl` read the table (single gating source); `rendererKind` is the
  declared `surface` (`s-notebook`/`graph-surface`/`spacegraph-viewport`). Canonical loop + ordered-pair
  round-trips tested. 423/423 units.
- `[ ]` everything else.
