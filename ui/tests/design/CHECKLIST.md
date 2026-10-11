# Design checklist (§Move 1.5)

`pnpm test:design` encodes what can be measured — hierarchy, density, focus
visibility, legibility at default zoom, paradigm visibility. This is the part a
human checks before committing anything that changes pixels. Review against the
gallery (`pnpm ui:gallery` → `tests/visual/gallery/index.html`).

## Hierarchy
- [ ] The default view reads top-down: one clear primary region, secondary chrome recedes.
- [ ] Headings rank by scale and weight, not colour alone.

## Density
- [ ] The graph at rest is ordered and centred — no cluster pinned to a corner.
- [ ] Gutters and padding come from the spacing scale, not ad-hoc numbers.

## Focus visibility
- [ ] Every interactive element shows a visible focus ring against its own surface.
- [ ] The ring survives on panels, overlays and the graph canvas alike.

## Legibility at default zoom
- [ ] No node renders below the legible pixel floor (`colors.legibility.node-px`).
- [ ] Labels that survive are the ones that matter; collisions do not occur.

## Paradigm visibility
- [ ] The gallery leads with ≤6 journey cells that prove the paradigm.
- [ ] At least one journey shows the live chat⇄graph selection loop.
- [ ] The fractal node body (a projection inside a projection) is visible.
