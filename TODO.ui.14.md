# TODO.ui.14.md — Finish the UI: land the migrations, green the gate

> **Supersedes** `TODO.ui.13.md` §4 "Phase 2 — Completion backlog". `TODO.ui.13.md` remains
> the record of the P0–P12 refactor (the diagnosis and the normalized substrate); **this file
> is the single execution plan for completing the UI.** Do not run both.

> **North star:** *the normalized substrate exists — now make it a usable, gate-green UI.*
> Every remaining task is a **migration finish or a guard**, never a new subsystem.

> **One-line test:** *Can a fresh session resume from this file alone, land one slice, watch
> `pnpm ui:gate` get greener, and see a screenshot proving the real app still works?*

---

## ▶ START HERE (fresh session)

**Context.** `TODO.ui.13.md`'s critical path (P0–P12) is **done**: the substrate is normalized
(`ui/src/client/framework/`), apps are built on it (`apps/{ask,explore,notebook,goals,console,hud}`),
and the client is served **dynamically** by the dev/test server (no `dist` build — commit
`5ca8fc8e`). **But the plan is not done by its own definition:** `pnpm ui:gate` is **red**.

**Current state — the resume point:**

| Check | State |
|---|---|
| `pnpm --dir ui typecheck` | ✅ clean |
| Ask prototype e2e (`@prototype`) | ✅ green (dynamic server, no build) |
| Golden-path e2e (`@golden`, real HUD) | ✅ green (dynamic server, no build) |
| `pnpm --dir ui build:client:test` | ✅ writes in-repo to `ui/dist/client` |
| `pnpm --dir ui test:unit` | ❌ **769/790 — 21 failures in 7 files** (the intent/bundle half-migration; the gate blocker) |
| Per-app e2e (Notebook/Goals/Console) | ❌ none exist |

**Already fixed (do not redo):** out-of-repo build output; no-build dynamic serving; the
client→server protocol import leak (`@senars/nar`/`node-llama-cpp` into the browser); dead server
dispatch (`entry.handle` → `entry.handleServer`); the `derived()` array-vs-value and unbound-`get`
bugs; `node:*` browser shims; the `COMPOSER_MODE_CATALOG`/`view-adapter` type errors.

**First slice: P13 — Land the intent/command migration** (§2). It is half of the unit-gate
blocker. Then P14 (the other half) → P15 → … → P21, one at a time.

**Commands** (repo root unless noted):
- typecheck: `pnpm --dir ui typecheck`
- unit: `pnpm --dir ui test:unit`
- golden e2e: `cd ui && pnpm exec playwright test --config tests/playwright.config.ts tests/scenarios/golden-path/operate-reasoner.spec.ts --project=chromium --workers=1`
- Ask prototype e2e: `cd ui && pnpm exec playwright test --config tests/playwright.config.ts tests/scenarios/prototypes/ask.spec.ts --project=chromium --workers=1`
- full contract: `pnpm ui:gate` (= typecheck + unit + golden e2e)
- production build: `pnpm --dir ui build:client:test` → `ui/dist/client`
- **progress screenshot** (after e2e proof; dev server on `:3456`):
  `mkdir -p screenshots && pnpm exec playwright screenshot --project=chromium --output=screenshots/pXX-slug.png <url>`

**Record progress** in §6 — append one entry per slice (what changed, guard, proof, screenshot
path, remaining, new opportunities).

---

## ▶ How to execute this plan (self-contained)

**The only trigger needed is: "implement TODO.ui.14.md".**

1. **Read this file top to bottom.** §2 is the plan; §3 is the pre-mortem you must keep in mind.
2. **Resume at the first unchecked slice in §2.** If all are checked, the plan is complete.
3. **For each slice:** implement → guard (unit, no mocks) → prove on a real app → **capture a
   progress screenshot** → `pnpm --dir ui typecheck && pnpm --dir ui test:unit` → confirm the
   golden e2e → commit (Conventional Commits) → append a §6 entry.
4. **Then take the next slice.** Do not batch. Do not invent new subsystems — every task is a
   migration finish or a guard.
5. **Stop and report only when:** a **tripwire** fires (§4); a required tool is missing; or a test
   fails **>3 times**. Never loop.

**Focus after each slice — the "% green" ledger:** `typecheck`, `unit pass count`, golden e2e,
per-app e2e. The plan is winning only if `unit` climbs toward 790/790 and stays there.

---

## 1. The remaining work, in one table

Every row traces to a `TODO.ui.13.md` §8 "Remaining" bullet. Nothing here is a new feature.

| # | Remaining item | From | Slice |
|---|---|---|---|
| 1 | `registerCommand` is a no-op; `dispatch`/`palette` tests fail | P8 | P13 |
| 2 | Bundle reset helpers (`resetSurfaces`/`resetViewAdapters`/`resetProjectors`) missing | P11 | P14 |
| 3 | `applyPlugins()` doesn't register commands; bundle tests fail | P11 | P14 |
| 4 | `$viewSelection`, `$runTerminations` still side-effect synced | P10 | P15 |
| 5 | Apps not on `defineBundle`/`defineApp`; `plugins.ts` not migrated | P11 | P16 |
| 6 | Settings UI not from `config-catalog`; `lm-provider.ts` not from `lm-provider-catalog`; styles not from `design-catalog` | P12 | P17 |
| 7 | `reasoning-layout.ts` not on `defineCatalog`; `capabilities.ts` bespoke | P1 | P18 |
| 8 | `registerOverlay` merge loses `a11y`; overlays not consolidated | P2 | P18 |
| 9 | No §3.3 kernel-boundary check | P0 | P19 |
| 10 | No e2e for Notebook/Goals/Console | P7 | P19 |
| 11 | Static `/` has no built `index.html` | infra | P20 |
| 12 | `core/dist/*` committed artifacts | infra | P20 |
| 13 | Golden-path flakiness (pre-existing) | P9 | P21 |
| 14 | Protocol/derived/shim drift has no guard | pre-mortem | P21 |

---

## 2. Execution plan (slices)

> Each slice: implement → guard (unit) → prove (real app + golden e2e) → **progress screenshot**
> → typecheck + unit → commit + §6 entry.

### Phase A — Green the unit gate (blocking)

- [ ] **P13 — Land the intent/command migration.**
Switch the command path fully onto the `Intent` catalog: `registerCommand` must register a
`kind: 'command'` intent (or every caller/tests migrate to `registerIntent`), and
`dispatchCommand`/`activeCommands`/`paletteCommands` must read it. Delete the deprecated no-op.
**Files:** `core/{commands,intent-registry}.ts`; `tests/components/{dispatch,palette}.test.ts`.
**Guard:** `dispatch`/`palette`/`facade-honesty` tests pass; no test calls a no-op API.
**Prove:** `pnpm --dir ui test:unit` gains these files; Ask + golden e2e still green.
**Screenshot:** `http://localhost:3456/apps/ask/` (palette open if practical).

- [ ] **P14 — Land the bundle/plugin migration.**
Export the catalog reset helpers the bundle tests expect (`resetSurfaces`, `resetViewAdapters`,
`resetProjectors`, …) or migrate the tests to the registry's real reset API; make
`applyBundle`/`applyPlugins` register **commands** (via P13's intent registry) as well as
surfaces/adapters/facets/projectors.
**Files:** `framework/{bundle,surface}.ts`, `core/plugins.ts`; `tests/components/{bundle-composition,plugins}.test.ts`.
**Guard:** `bundle-composition` + `plugins` pass.
**Prove:** `pnpm --dir ui test:unit` → **790/790**, so `pnpm ui:gate` is fully green.
**Screenshot:** `http://localhost:3456/apps/ask/`.

### Phase B — Finish the substrate migrations

- [ ] **P15 — Finish the `derived` migration.**
`$viewSelection` and `$runTerminations` become `derived(...)`; remove their side-effect `subscribe`
syncs. Confirm `setEqual`/`mapEqual` are used where the value is a Set/Map so no churn fires.
**Files:** `core/store.ts`, `core/workspace-bindings.ts`.
**Guard:** a churn test (subscriber not called when the derived value is equal).
**Prove:** graph multi-select + run-termination rendering unchanged on the HUD.
**Screenshot:** `http://localhost:3456/apps/ask/` (graph viewport).

- [ ] **P16 — Migrate apps + plugins to bundles.**
Each `apps/*` becomes `defineBundle(...)` + `defineApp(...)`; move `plugins.ts` contributions into
bundles; delete the `applyPlugins()` fan-out once callers move.
**Files:** `framework/{app,bundle}.ts`, `core/plugins.ts`, `apps/*`, `vite.config.ts`.
**Guard:** app-composition test (surfaces mount by placement); bundle-registry test.
**Prove:** each app runs at `/apps/<name>/` with the shell providing overlay/palette/connection.
**Screenshot:** all of `/apps/ask|explore|notebook|goals|console/`.

- [ ] **P17 — Adopt the domain catalogs.**
Settings UI reads `config-catalog`; `lm-provider.ts` uses `lm-provider-catalog`; styles consume
`design-catalog` CSS custom properties.
**Files:** `core/{config-catalog,lm-provider,lm-provider-catalog,design-catalog}.ts`, settings
components, `styles/*`.
**Guard:** config-catalog client/server agree; a new provider/field needs no edit.
**Prove:** settings UI + change log render from the catalog; theming uses generated tokens.
**Screenshot:** `http://localhost:3456/apps/ask/` (settings panel open).

- [ ] **P18 — Unify the last catalogs + overlays.**
Put `reasoning-layout.ts` and `capabilities.ts` on `defineCatalog`; fold `registerOverlay` into
`defineSurface` so the tool-approval overlay keeps its `a11y`.
**Files:** `core/{reasoning-layout,capabilities,overlay-*.ts}`, `framework/surface.ts`.
**Guard:** catalog get/ids/where/size; overlay `a11y` preserved (the test P2 weakened).
**Prove:** reasoning layout + capability gating + tool-approval overlay unchanged on the HUD.
**Screenshot:** golden-path HUD `/`.

### Phase C — Guardrails, hygiene, hardening

- [ ] **P19 — Guardrails & app coverage.**
Add the §3.3 kernel-boundary check (`kernel/**` must not import lens/layout/panel/HUD); add an e2e
per app (Notebook, Goals, Console).
**Files:** boundary test/lint, `tests/scenarios/apps/*`.
**Guard:** the boundary fails on a chrome import (prove with a temporary one, then revert);
each new app e2e is deterministic (no mocks; drives the real server).
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

---

## 3. Pre-mortem — how this could still go wrong

> Read this before each slice. Each risk names its **detecting test** — if we can't detect it,
> the mitigations below (**P13–P21**) are what add that detection.

### Confirmed risks (we have seen the failure shape)

| # | Risk | Why it bites | Detector / mitigation |
|---|---|---|---|
| R1 | **Command path stays a no-op** | `registerCommand` currently discards; the deprecation wasn't finished. | P13 tests (`dispatch`, `palette`). |
| R2 | **Bundle reset helpers never exported** | Tests call `resetSurfaces()` etc.; the API doesn't exist. | P14 tests (`bundle-composition`). |
| R3 | **Plugins don't register commands** | `applyPlugins` fans out surfaces but not intents; `plugins.test` asserts `false === true`. | P14 tests (`plugins`). |
| R4 | **`derived` equality churn** | New Set/Map identity each compute ⇒ subscribers fire every tick (jank, loops). | P15 churn test; use `setEqual`/`mapEqual`. |
| R5 | **Dynamic vs static serving conflict** | Both want `/`; the middleware/fallback ordering can regress. | P20 guard tests both modes. |
| R6 | **Kernel boundary lint too loose/strict** | Transitive chrome imports; false positives. | P19 boundary test with a known-bad import. |

### Speculative risks (not yet observed — assume they can happen)

| # | Risk | Why it might bite | Detector |
|---|---|---|---|
| R7 | **`derived([single], fn)` mis-typed** | A one-element array is treated as multi-source. | P21 derived edge test. |
| R8 | **`node:*` shim gap** | A new client import of `node:os`/`node:buffer` throws only at runtime in dev. | P21 shim allow-list check. |
| R9 | **Protocol spec drift** | A new message type added without a `PROTOCOL_SPECS` row is silently unrouted. | P21 protocol-drift test. |
| R10 | **Per-app e2e flakiness** | Notebook/Goals/Console were scaffolded, not proven. | P19: deterministic e2e, real server. |
| R11 | **`core/dist` untracking breaks a script** | Something imports `core/dist` instead of `core/src`. | P20 guard (`git ls-files`), CI on the PR. |
| R12 | **`@senars/util` split breaks nar/core** | Other packages import the util root. | P20 optional — only if it lands, run full repo typecheck + their unit suites. |

### Blind spots (deliberately **out of scope** for UI.14 — park, don't forget)

- **No full kernel→projection→UI→kernel loop test** (e2e covers apps; not round-trip invariants).
- **No load/stress test** (atom/listener leaks at scale are unmeasured).
- **No systematic a11y audit** (only the tool-approval overlay is covered, in P18).
- **No responsive/mobile pass**; viewport e2e is desktop-only.
- **No i18n** (English literals throughout).
- **No visual-regression baseline** — intentional: we want *progress* screenshots (§2), not a
  baseline to diff against. Screenshots are a log, not a gate.

**Rule:** a blind spot becomes a slice only when it becomes a *blocker* or a *user complaint*.
Until then it stays parked here.

---

## 4. Tripwires (stop if any fires)

| Mistake | Tripwire |
|---|---|
| **New subsystem during completion** | a slice adds a registry/catalog/descriptor that isn't a migration finish → stop |
| **Weakening tests to pass** | a test's assertion is changed rather than the behavior fixed → stop |
| **Chrome in the kernel** | `kernel/**` imports a lens/layout/panel/HUD module → stop |
| **Reintroducing a build step** | `pnpm build:client:test` appears before an e2e command → stop |
| **Client imports server** | client code imports `server/**` (drags `@senars/nar` into the browser) → stop |
| **Green gates as progress** | no real-app walkthrough + screenshot for the slice → not done |
| **Screenshot spam** | more than a handful of shots per slice, or illegible/duplicate states → curate |
| **Deleting by hope** | a file is removed before its callers migrate → archive first |
| **Going in circles** | a slice is retried >3 times → stop and report (the pre-mortem likely missed a risk) |

---

## 5. Definition of done

- **`pnpm ui:gate` green**, including **an e2e per app**.
- **Unit suite 790/790**, and no test leans on a deprecated no-op API.
- **One definition per fact:** no bespoke `*_IDS`/`*Where`/`d()`; `reasoning-layout` and
  `capabilities` are on `defineCatalog`; overlays are surfaces.
- **Every app is `defineBundle` + `defineApp`**; `plugins.ts` no longer fans out.
- **Settings, LM providers and styles derive from their catalogs.**
- **The §3.3 kernel boundary is enforced** by a check that fails on a chrome import.
- **Static and dynamic serving both work**; no tracked build artifacts.
- **A curated `screenshots/` log** shows the GUI state at each slice (progress, not baseline).
- **The §3 pre-mortem detectors exist and pass** (P21).

---

## 6. Progress Log

> Append one entry per slice: what changed, guard, proof, screenshot path, remaining, opportunities.
> Keep it terse and factual. (Empty at hand-off.)

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
  server handlers from client code.**
- **`derived`.** `derived(source, fn)` passes the single value; `derived([a, b], fn)` passes the
  array; `get` is bound. A single-source selector that indexes the array is the bug fixed in `5ca8fc8e`.
- **Layout.** `framework/` (micro-framework), `kernel/` (facade + atoms), `core/` (substrate + HUD
  chrome), `apps/*` (products), `server/` (dynamic host + protocol-server), `shared/`, and
  `core/src/protocol/` (the zod protocol).
- **Guards that must stay green:** `tests/scenarios/golden-path/operate-reasoner.spec.ts` (`@golden`),
  `tests/scenarios/prototypes/ask.spec.ts` (`@prototype`), `tests/components/*`, `tests/visual/*`.
- **Conventions (AGENTS.md):** terse self-documenting code; `pnpm`/`pnpx`; no `pkill`; don't edit
  generated `README.md`; unit tests without mocks; Conventional Commits.
