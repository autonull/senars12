# SENARS12 Development Plan: Self-Improving System

## Vision
Enable SENARS to autonomously test, tune, and evolve its own codebase through neuro-symbolic reasoning cycles.

**Principle**: Ship working capabilities first. Polish code quality only when it blocks automation.

---

## Phase 0: Unblock Automation (Do This Week)

| Task | Why | Files |
|------|-----|-------|
| Fix test runner (`vitest.config.ts` + remove broken `benchmark` import) | All downstream automation needs green tests | `tests/setup/vitest-setup.ts`, new `vitest.config.ts` |
| Add `test:unit` script that actually runs | CI gate for self-test loop | `package.json` |
| Wire `RLFPLearner` to at least one knob (e.g., `Reasoner.maxDerivationsPerStep`) | Proves self-tuning works end-to-end | `nar/src/nar.ts`, `nar/src/rlfp/` |
| Add `ApprovalManager` tool to `ToolRegistry` | Human gate for all auto-writes | `core/src/motor/builtin-tools.ts` |

**Success**: `pnpm test` passes; `pnpm run self-tune-demo` shows parameter optimization in < 5 min.

---

## Phase 1: Self-Testing Loop (Core Capability)

### 1.1 Test Generation from Types
- **Tool**: `generate-tests` — reads Zod schemas from `@senars/util/types`, emits `fast-check` property tests
- **Input**: `ToolSpec`, `AgentOptions`, `ConnectionConfig` schemas
- **Output**: `tests/generated/*.test.ts` (gitignored, regenerated on demand)
- **Trigger**: CLI `nar generate-tests` or file watch on `src/**/*.ts`

### 1.2 Background Test Runner
- Spawn `vitest run --reporter=json` in background worker
- Parse results → write episodes to `EpisodicMemory`:
  ```narsese
  (<testResult> --> <passed|failed>). :|:
  (<testFile> --> <duration>). :|:
  ```
- NAR rule: `failedTest --> needsFix` (truth = failure frequency)

### 1.3 Coverage → Concept Priority
- `c8` coverage JSON → for each file `< 80%`: inject `Concept` with `priority = 1 - coverage`
- NAR naturally focuses reasoning on untested code

**Deliverable**: `nar test-loop --watch` runs continuously, prints "discovered 3 new failing tests" etc.

---

## Phase 2: Self-Tuning Loop (Visible Improvement)

### 2.1 Parameter Knobs (start with 3)
| Knob | Range | Metric |
|------|-------|--------|
| `Reasoner.maxDerivationsPerStep` | 10–500 | derivations/sec |
| `ModelRunner.maxLoops` | 1–10 | tool-call success rate |
| `Memory.activationDecayRate` | 0.001–0.1 | belief retention vs noise |

### 2.2 Reward Function
```
reward = 0.5 * testPassRate + 0.3 * (1/avgTestDuration) + 0.2 * coverageDelta
```
- Episode logged each tuning iteration
- `RLFPLearner.optimize()` called every N episodes (configurable)

### 2.3 Persist Best Config
- On improvement > 5%: `ConfigViewImpl.set('agent.reasoning.maxDerivationsPerStep', newVal)`
- Write to `senars.config.json` (human-reviewable)

**Deliverable**: `nar tune --iterations 20` shows live dashboard, writes optimized config.

---

## Phase 3: Self-Building Loop (Highest Leverage)

### 3.1 Codemod Tool (Safe AST Transforms)
- Add `ast-grep` + `ts-morph` wrapper in `external-tools.ts`
- **API**: `codemod(pattern, replacement, { dryRun: true })` → shows diff
- **Patterns to start**:
  - `any` → explicit type (from inference)
  - Non-null assertion → optional chaining
  - `forEach` callback returning value → `for...of`

### 3.2 Refactoring Pipeline
```
Lint error (biome JSON) 
  → NAR belief: `(file:line --> fixPattern)` 
  → ToolRegistry executes codemod 
  → Run tests 
  → Pass? commit : revert + negative belief
```
- Track success rate per `fixPattern` in `ToolRegistry.feedback`

### 3.3 Feature Synthesis (NL → Code)
**Pipeline**:
1. User: "add CLI command to export beliefs as JSON"
2. `NLTranslator` → Narsese goal: `(^exportBeliefs --> ^cliCommand).`
3. NAR derives plan (steps: create command, register, test)
4. `Metta` executes plan → generates TS in `src/cli/commands/`
5. `codemod` writes file, `test-loop` validates
6. Feedback to NAR

**Start with**: CLI commands (isolated, testable, high value)

---

## Phase 4: Observability (Debug the Brain)

| Endpoint | Data | Consumer |
|----------|------|----------|
| `GET /metrics` | Prometheus: derivations/sec, contradiction rate, tool latency | Grafana |
| `WS /cognitive-stream` | Real-time `CognitiveEvent` | UI dashboard |
| `CLI .self-report` | Top 5 beliefs, contradictions, stalled goals | Human |

---

## Minimal File List to Touch

| Capability | Files (max 5 each) |
|------------|-------------------|
| Test runner | `vitest.config.ts`, `tests/setup/vitest-setup.ts`, `package.json` |
| Test gen | `nar/src/tools/adapters/external-tools.ts` (add `generateTests`), `nar/src/nl/` |
| Tuning | `nar/src/nar.ts` (expose knobs), `nar/src/rlfp/RLFPLearner.ts` |
| Codemod | `nar/src/tools/adapters/external-tools.ts` (add `codemod`), `core/src/motor/builtin-tools.ts` |
| Feature synth | `src/cli/commands.ts`, `nar/src/nl/schemas.ts`, `nar/src/tools/tool-registry.ts` |
| Config persist | `src/config/loader.ts`, `core/src/config/ConfigView.ts` |

---

## Anti-Patterns to Avoid

- ❌ Perfect type coverage before automation works
- ❌ Generalized "architecture search" before single-knob tuning works
- ❌ Full MeTTa↔NAR bridge before CLI command synthesis works
- ❌ Dashboard before there's data to show

## Escape Hatches

- All auto-writes go through `ApprovalManager` (human `y/n` in CLI)
- Git commits every successful iteration → `git reset --hard` always works
- Feature flag `SENARS_AUTO_BUILD=1` disables entire loop

---

## Milestone Definition of Done

| Milestone | Demo Script |
|-----------|-------------|
| M0: Green CI | `pnpm test && pnpm typecheck` |
| M1: Self-test | `nar test-loop --once` → generates + runs 10 tests |
| M2: Self-tune | `nar tune --iterations 10` → prints before/after metrics |
| M3: Self-build | `nar build "add /export command"` → working command + test |
| M4: Production loop | All three running in background for 1 hour unattended |