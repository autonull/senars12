| **5.T** Temporal Gate scenario | ✅ Implemented | `ui/tests/scenarios/cognitive/timeline.spec.ts` — verifies timeline scrubber renders and history tab functions. Uses `__testApi.timeline.getTime()`, `__testApi.getStoreState('view')`. |
| **6.1** 3D Adapter Integration | ✅ Done | `adapter-3d.ts` has `applyDelta`, `clearNodeStyles`, `checkUnsupportedChannels`, `SUPPORT_3D` sets. Both viewports apply same ΔDisplay patches. |
| **6.2** Viewport Mode Toggle | ✅ Done | `$viewportMode` atom in store.ts toggles between '2d'/'3d'. "3D" button in graph-toolbar.ts with active state styling. `app-layout.ts` conditionally renders viewport. |
| **6.3** Parity E2E Tests | ✅ Done | `spatial/parity.spec.ts` has 4 passing tests: 2D renders initially, 3D renders when toggled, node count via spacegraph API, edge editing works. |
| **6.4** Z-Axis Temporal Lens | ✅ Done | `compile.ts` has `temporalLens()` mapping `Field('occurrenceTime') ⇒ Channel('z')`. `adapter-3d.ts` applies z-position via `updatePosition`. |
| **6.5** UnsupportedChannel Warning | ✅ Done | `checkUnsupportedChannels()` in `adapter-3d.ts` detects unsupported channels. Warning displays in spacegraph-viewport when channels not in SUPPORT_3D/SUPPORT_3D_EDGES. |
| **6.6** Property-Based 2D/3D Equivalence | ✅ Done | `ui/tests/modulation/properties.test.ts` has 3 new tests verifying channel support, z-axis mapping, and unsupported channel detection. |

**Immediate remaining work per phase:**

| Phase | Remaining work |
| :--- | :--- |
| **Phase 1** | None — Cognitive Gate verified. |
| **Phase 2** | Allocation-aware bench with `--expose-gc`. Engine Gate E2E scenario: `pnpm --dir ui test:integration -- dashboard` — verify 2D still renders after all refactors. |
| **Phase 3** | None — multi-clause ingestion, edge modulation, Relational Gate scenarios all implemented. |
| **Phase 4** | None — Config Gate scenario and field discovery both implemented. |
| **Phase 5** | Time-gated opacity requires verification with real occurrenceTime values from NAR. Consider time-bucket memoization for 60+ Hz scrubbing. |
| **Phase 6** | None — all tasks completed. |