## UI Gallery

The Web UI is verified *at a glance*: every registered surface — overlay, renderer, layout, view
shape, panel — has a committed screenshot baseline, and the coverage test fails the moment one is
registered without a cell. The contract is data, not a hand-kept checklist:

- The cell matrix — [`ui/tests/visual/matrix.ts`](ui/tests/visual/matrix.ts)
- The coverage gate — [`ui/tests/components/visual-coverage.test.ts`](ui/tests/components/visual-coverage.test.ts)
- The sheet builder — [`ui/scripts/build-gallery.ts`](ui/scripts/build-gallery.ts)

Run the whole contract locally with `pnpm ui:verify` (typecheck + unit + committed baselines + the
contact sheet); the fast type+unit gate is `pnpm ui:gate`. Update baselines with
`pnpm --dir ui test:visual:update` and rebuild the sheet alone with `pnpm ui:gallery`.
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
