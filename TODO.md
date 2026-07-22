# TODO

## Completed
- Created `@senars/util` package with shared types (lifecycle, LMService, NAR, tools, etc.)
- Moved shared utilities (makeId, isNil, ensureArray, errMsg, toError, sleep, compact, clamp, etc.) to `@senars/util`
- Fixed nar/src/lm/lm-service.ts: resolved LanguageModelV3 type usage for generate results
- Updated biome.json to ignore `.turbo`, `.cache`, dist, node_modules, pnpm-lock.yaml
- Created re-export loggers in nar/src/logger.ts and io/src/logger.ts
- Renamed nar/src/lifecycle/BaseComponent.ts -> NarBaseComponent to avoid naming collision
- Consolidated Logger, Metrics, LogLevel, LogEntry, LoggerConfig, BaseComponent into util/src/types/lifecycle.ts
- Fixed NAREngine to use getState() instead of non-existent isRunning()
- Added isRunning() to NAR interface in util/src/types/nar.ts
- Fixed Metrics interface to match MetricsCollector signature (value + tags params)
- Added 'started' to ComponentState union type
- Exported LogLevel, LogEntry, LoggerConfig from util/src/index.ts

## Remaining Issues

### 1. UI Storybook type errors (pre-existing, not caused by our changes)
- Meta and StoryObj not exported from `@storybook/web-components-vite` (6 story files)
- These are storybook version compatibility issues, orthogonal to refactor

### 2. Circular dependency warning
- `pnpm typecheck` shows: "Circular package dependency detected: @senars/nar, @senars/metta, @senars/core, @senars/io"
- This is a warning only, not a blocking error
- To fix would require splitting cross-dependencies into separate sub-packages

### 3. Test failures (down from 10 to still some)
- Last run: 8 failed, 1085 passed, 18 skipped
- Likely NarBaseComponent constructor changes and lifecycle test expectations
- Need to verify with `pnpm test` after typecheck passes

### 4. Verify all nar package imports/exports are correct
- nar/src/nar.ts extends NarBaseComponent - verify super() calls work
- Container.ts references to BaseComponent renamed to NarBaseComponent

## Next Steps
1. Run `pnpm typecheck` to confirm UI storybook errors are the only remaining TS issues
2. Run `pnpm test` to check if test failures decreased
3. Fix any NarBaseComponent constructor call sites in tests
4. Exclude `*.stories.ts` from UI tsconfig or install correct storybook types
