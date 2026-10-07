# UI dead artifacts — archived for resurrection

Frozen copies of UI files removed during **Phase 0 (TODO.ui.md)** so they can be
restored deliberately instead of reconstructed from memory. Nothing here is
compiled, linted, bundled, or typechecked (see the `biome.json` ignore and the
`ui/tsconfig.json` include set); the tree mirrors the original paths under `ui/`.

- **Removed in:** `e60bc53a` — *feat(ui): finish phase 0 bridge, config reset, dead artifacts*
- **Last live version:** `cdfc4dfa` (parent of the removal commit)
- **Why:** TODO.ui.md §0.6 — integrational/reliability debt; each had no live
  consumer or was scaffold superseded by a real component.

## Restore a single artifact

Copy it back to its original path, or pull the exact revision straight from git:

```sh
cp docs/archive/ui-dead-artifacts/ui/src/client/components/lens-selector.ts ui/src/client/components/lens-selector.ts
# or, without this archive:
git show cdfc4dfa:ui/src/client/components/lens-selector.ts > ui/src/client/components/lens-selector.ts
```

Restoring a file usually also means re-adding its import site (noted per file
below); the removal commit `e60bc53a` shows exactly which lines were dropped.

## Contents

| Archived path (relative to `ui/`) | Removed because | Resurrection notes |
|---|---|---|
| `src/client/components/lens-selector.ts` | Superseded by `lens-controller`/`lens-designer`; no `<lens-selector>` tag in any markup. | Re-add side-effect imports in `src/client/entry.ts` and `src/client/spacegraph/main.ts`, and a tag where the selector should render. |
| `src/client/core/theme.css` | Legacy `:root` alias block; superseded by generated `styles/tokens.css`. | No importers existed. Prefer extending `design-tokens.json` (Phase 3.1). |
| `src/client/styles/tokens.ts` | Unused generated TS facade of `design-tokens.json`; `utils/token-colors.ts` is the live color mirror. | `ui/scripts/build-tokens.ts` no longer emits this file — re-add the TS emitter there if the runtime `theme` facade (Phase 3.1) wants it. |
| `src/client/components/index.ts` | Unused re-export barrel; every consumer imports components directly. | No importers existed. |
| `src/client/spacegraph/spacegraph-app.ts` | Duplicate shell; the standalone entry now mounts `<spacegraph-viewport>`. | `src/client/spacegraph/index.html` was updated to `<spacegraph-viewport>`; revert that tag if the shell is restored. |
| `src/stories/**` | Unused Storybook scaffold (`Configure.mdx`, CSS, default assets); the Storybook glob targets `src/client/**/*.stories.*`. | Phase 2.5 rebuilds stories deterministically; reuse assets only if re-adopting the default scaffold. Binary assets are included here only for convenience — they also live in `cdfc4dfa`. |

## Later removals

### Phase 1.6 (TODO.ui.md) — dead test/script artifacts

- **Why:** `impressive-screenshot.spec.ts` lived outside Playwright's `testDir`
  (`tests/scenarios`), so it never ran, and it hard-coded `http://localhost:3000`
  while the webServer uses port 3456. `ready-check.ts` was unreferenced and also
  hard-coded port 3000. Neither had a live consumer.

| Archived path (relative to `ui/`) | Removed because | Resurrection notes |
|---|---|---|
| `tests/impressive-screenshot.spec.ts` | Outside `testDir`; duplicate of `tests/scenarios/impressive-demo/impressive-demo.spec.ts`; port 3000 drift. | Fold any unique assertion into `impressive-demo.spec.ts` (already tagged `@visual`). |
| `scripts/ready-check.ts` | Unreferenced; port 3000 drift. | The webServer readiness is owned by `tests/playwright.config.ts`; recreate only if a standalone poller is needed, reading the port from config. |

## Notes

- This archive is intentionally excluded from formatting/linting so the frozen
  code is not churned. If an artifact is revived, move it back into `ui/src`
  rather than importing across the archive boundary.
- Git history remains the authoritative source; this directory exists so the
  removed work is discoverable without knowing the exact commit.
