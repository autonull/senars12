## UI Gallery

The Web UI is verified *at a glance*: every registered surface — overlay, renderer, layout, view
shape, panel — has a committed screenshot baseline, and the coverage test fails the moment one is
registered without a cell. The contract is data, not a hand-kept checklist:

- The cell matrix — [`ui/tests/visual/matrix.ts`](ui/tests/visual/matrix.ts)
- The coverage gate — [`ui/tests/components/visual-coverage.test.ts`](ui/tests/components/visual-coverage.test.ts)
- The sheet builder — [`ui/scripts/build-gallery.ts`](ui/scripts/build-gallery.ts)

The sheet **leads with Journeys** — a small, hand-picked set (≤6) that proves the paradigm
end-to-end (the live chat⇄graph loop, streaming, tool approval, the explain model, the fractal node
body) — and keeps every contract-required cell in a collapsed **Coverage** section, so nothing the
coverage gate demands is deleted to make the gallery prettier.

Run the whole contract locally with `pnpm ui:verify` (typecheck + unit + design + committed
baselines + the contact sheet); the fast type+unit gate is `pnpm ui:gate`. Update baselines with
`pnpm --dir ui test:visual:update`, rebuild the sheet alone with `pnpm ui:gallery`, and regenerate
the base cells from the surface registry with `pnpm --dir ui generate:visual-cells`. The
qualitative gate is `pnpm --dir ui test:design` — it encodes hierarchy, density, focus visibility,
legibility at default zoom and paradigm visibility where measurable, and pairs with the human
checklist in [`ui/tests/design/CHECKLIST.md`](ui/tests/design/CHECKLIST.md).
`README.md` is likewise generated; edit a section under `docs/readme/` and run `pnpm readme`.

---

## Registered Surfaces

Auto-generated from surface descriptors. Do not edit manually.

### Views

| Surface | Tag | Bindings |
|---------|-----|----------|
| View | `s-view` | — |

### Renderers

| Surface | Tag | Bindings |
|---------|-----|----------|
| Notebook | `s-notebook` | graph |

### Overlays

| Surface | Tag | Bindings |
|---------|-----|----------|
| Artifact | `s-artifact` | — |
| Block actions | `s-block-menu` | — |
| Command palette | `s-palette` | — |
| Concepts | `s-nodes` | — |
| Configuration | `s-settings` | — |
| Conversation | `s-chat` | — |
| Event Log | `s-events` | — |
| Explanation | `s-explain` | — |
| Inspector | `s-inspector` | — |
| Provider | `s-provider` | — |
| Related | `s-related` | — |
| Table of contents | `s-toc` | — |
| Telemetry | `s-telemetry` | — |
| Timeline | `s-timeline` | — |
| Tool approval | `s-tool-approval` | — |
