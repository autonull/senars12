# SENARS12 Development Plan: Self-Improving System

## Vision
Enable SENARS to autonomously test, tune, and evolve its own codebase through neuro-symbolic reasoning cycles.

**Principle**: Ship working capabilities first. Polish code quality only when it blocks automation.

---

## ✅ Phase 0: Unblock Automation — COMPLETED

### Summary
All Phase 0 tasks implemented and verified:
- **0.1 Test Runner Fix**: Root `vitest.config.ts` created with tsconfig-paths, `tests/setup/vitest-setup.ts` cleaned (removed broken benchmark import), `package.json` scripts updated
- **0.2 ApprovalManager Tool**: Enhanced `ApprovalService` with `requestApproval()` method; added `request_approval` builtin tool with Zod schema validation
- **0.3 RLFP Knob Protocol**: Created `nar/src/rlfp/knobs.ts` with declarative schema-driven approach (6 tunable knobs); wired into `RLFPLearner` with `getTunableKnobs()`, `applyTuningUpdate()`, `calculateReward()`
- **0.4 Self-Tune Demo**: `scripts/self-tune-demo.ts` runs 5 iterations, prints before/after metrics, tracks best config

**Verification**:
- `npx tsx scripts/self-tune-demo.ts` ✅ Completes in ~2s, shows metric evolution
- `pnpm typecheck` ✅ Passes (RLFP/knob errors resolved)
- `pnpm test` — Unit tests pass (298 tests); E2E failures are pre-existing (UI/mcp issues, not Phase 0)

### Files Created/Modified
| File | Status |
|------|--------|
| `vitest.config.ts` | ✅ Created |
| `tests/setup/vitest-setup.ts` | ✅ Fixed |
| `package.json` | ✅ Scripts updated |
| `core/src/ApprovalService.ts` | ✅ Enhanced |
| `core/src/motor/builtin-tools.ts` | ✅ Added `request_approval` |
| `core/src/Agent.ts` | ✅ Registers approval tool |
| `nar/src/rlfp/knobs.ts` | ✅ Created (declarative schema) |
| `nar/src/rlfp/RLFPLearner.ts` | ✅ Wired knobs + reward |
| `nar/src/rlfp/index.ts` | ✅ Exports |
| `scripts/self-tune-demo.ts` | ✅ Created |

---
## ✅ Phase 2: Self-Tuning Loop — COMPLETED

### Summary
All Phase 2 tasks implemented and verified:
- **2.1 Expanded Knob Set**: Added `maxLoops` (modelRunner.maxLoops: 1-10) and `activationDecayRate` (memory.activationDecayRate: 0.001-0.1) to existing 6 knobs
- **2.2 Normalized Reward Function**: Updated `RLFPLearner.calculateReward()` with speed-aware scoring: `0.5 * passRate + 0.3 * clamp(baseline/current, 0, 2)/2 + 0.2 * coverageDelta - AIKR penalties`
- **2.3 Persist Best Config**: Created `nar tune` CLI command (`src/bin/tune.ts`) that runs N iterations, prints live dashboard, writes optimized `senars.config.json` on >5% improvement

**Verification**:
- `pnpm run self-tune-demo` ✅ Completes in ~2s, shows all 8 knobs with new reward function
- `pnpm run tune --iterations 10` ✅ Runs tuning, prints live dashboard, writes config
- `pnpm typecheck` ✅ Passes (no new errors)
- `pnpm test tests/nar/rlfp.test.ts` ✅ 17/17 tests pass

### Files Created/Modified
| File | Status |
|------|--------|
| `nar/src/config/cognitive-parameters.ts` | ✅ Added `modelRunner` & `memory` sections |
| `nar/src/rlfp/knobs.ts` | ✅ Added `maxLoops` & `activationDecayRate` to knobSchema |
| `nar/src/rlfp/RLFPLearner.ts` | ✅ Updated `getTunableKnobs()`, `calculateReward()` |
| `scripts/self-tune-demo.ts` | ✅ Updated with new knobs & normalized reward |
| `src/bin/tune.ts` | ✅ Created `nar tune` CLI command |
| `package.json` | ✅ Added `tune` script |

---
## Phase 0 Original Specs (archived)

### 0.1 Test Runner Fix
**Files**: `vitest.config.ts` (new), `tests/setup/vitest-setup.ts`, `package.json`

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/benchmark/**'],
    setupFiles: ['./tests/setup/vitest-setup.ts'],
    testTimeout: 15000,
    teardownTimeout: 5000,
    coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] }
  },
});
```

```typescript
// tests/setup/vitest-setup.ts — remove broken `benchmark` import
// Keep only: global test utilities, no external deps
```

```json
// package.json scripts
{
  "test": "vitest run",
  "test:unit": "vitest run --exclude tests/e2e/** --exclude tests/benchmark/**",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit",
  "self-tune-demo": "tsx scripts/self-tune-demo.ts"
}
```

### 0.2 ApprovalManager Tool (HITL Gate)
**File**: `core/src/motor/builtin-tools.ts` (add `request_approval` tool)

```typescript
import { z } from 'zod';
import { Tool, ToolContext, ToolResult } from '@senars/core';
import { ApprovalService } from '../approval/ApprovalService';

export const RequestApprovalTool: Tool = {
  name: 'request_approval',
  description: 'Requests human approval for critical actions (code write, config change, destructive command). Blocks until approved/rejected.',
  schema: z.object({
    actionDescription: z.string(),
    diffOrPayload: z.string(),
    riskLevel: z.enum(['low', 'medium', 'high']),
    timeoutMs: z.number().optional().default(60000)
  }),
  execute: async (args, ctx): Promise<ToolResult> => {
    const approvalService = ctx.agent.getSubsystem<ApprovalService>('ApprovalService');
    if (!approvalService) {
      if (process.env.CI === 'true' || process.env.SENARS_HEADLESS === '1') {
        return { success: false, error: 'Auto-rejected: headless mode', approved: false };
      }
      throw new Error('ApprovalService required but not registered');
    }
    ctx.agent.emit('cognitive.approval.requested', { action: args.actionDescription, risk: args.riskLevel });
    try {
      const pending = await approvalService.requestApproval({
        action: args.actionDescription,
        payload: args.diffOrPayload,
        risk: args.riskLevel,
        timeoutMs: args.timeoutMs
      });
      const result = await pending.waitForResolution();
      return { success: result.approved, approved: result.approved, feedback: result.feedback };
    } catch (err: any) {
      return { success: false, error: `Approval error: ${err.message}`, approved: false };
    }
  }
};
```

### 0.3 RLFP Knob Protocol (Single Knob First)
**File**: `nar/src/rlfp/knobs.ts` (new, ~20 lines)

```typescript
export interface TunableKnob {
  readonly name: string;
  readonly path: string;        // dot-path into config (e.g., "inference.maxDerivationsPerStep")
  readonly min: number;
  readonly max: number;
  readonly step: number;
  get(): number;
  set(value: number): void;
}
```

**Wire in `RLFPLearner`** (`nar/src/rlfp/RLFPLearner.ts`):

```typescript
public getTunableKnobs() {
  return {
    maxDerivationsPerStep: {
      current: this.currentParams.inference.maxDerivationsPerStep,
      min: 10, max: 500, step: 10
    }
  };
}

public applyTuningUpdate(knob: string, newValue: number) {
  if (knob === 'maxDerivationsPerStep') {
    this.currentParams.inference.maxDerivationsPerStep = Math.round(newValue);
    this.emit('config.updated', this.currentParams);
  }
}

public calculateReward(m: { 
  testPassRate: number; 
  avgTestDuration: number; 
  coverageDelta: number;
  memoryOverage: number;      // AIKR penalty
  cpuThrottleTime: number;    // AIKR penalty
}): number {
  const base = 0.5 * m.testPassRate + 0.3 * (1 / Math.max(m.avgTestDuration, 0.1)) + 0.2 * m.coverageDelta;
  const aikrPenalty = 0.5 * m.memoryOverage + 0.1 * m.cpuThrottleTime;
  return Math.max(0, base - aikrPenalty);
}
```

### 0.4 Self-Tune Demo Script
**File**: `scripts/self-tune-demo.ts` — runs 5 tuning iterations, prints before/after metrics

**Success Criteria**: `pnpm test` passes; `pnpm run self-tune-demo` shows metric improvement in < 5 min.

---

## Phase 1: Self-Testing Loop

### 1.1 Test Generation from Zod Schemas — ✅ COMPLETED
**Tool**: `generate-tests` in `nar/src/tools/adapters/external-tools.ts`
- ✅ Uses `fast-check` (native) for automatic arbitraries from Zod schemas (zod-fast-check requires Zod v3)
- ✅ Start with `z.object()` schemas: `ToolSpec`, `ConnectionConfig`, `AgentOptions` (defined in `nar/src/tools/schemas.ts`)
- ✅ Emits `// @generated` header + gitignore `tests/generated/`
- ✅ Generates property-based tests with valid samples + invalid mutations (wrong type for known fields)
- ✅ All 18 generated tests pass (6 per schema × 3 schemas)

**Files Created/Modified:**
| File | Status |
|------|--------|
| `nar/src/tools/schemas.ts` | ✅ Created (Zod schemas for ToolSpec, ConnectionConfig, AgentOptions) |
| `nar/src/tools/adapters/external-tools.ts` | ✅ Added `generate_tests` tool with fast-check arbitraries |
| `nar/src/tools/adapters/index.ts` | ✅ Exported new tool |
| `tests/generated/` | ✅ Created + gitignored |

**Verification:**
- `tsx scripts/test-generate-all.ts` ✅ Generates tests for all 3 schemas
- `vitest run tests/generated/` ✅ All 18 tests pass
- `pnpm typecheck` ✅ Passes (no new errors)

### 1.2 Background Test Runner + Episodic Injection — ✅ COMPLETED
**Tool**: `run_tests` in `nar/src/tools/adapters/external-tools.ts`
- ✅ Spawns `vitest run --reporter=json` in worker via `pnpm vitest`
- ✅ Parses JSON results from `.vitest/json/output.json`
- ✅ Injects episodes into EpisodicMemory:
  - `test_suite_result` with pass/fail counts, duration, coverage
  - `test_result` for each individual test with state, duration, errors
  - `fix_test_goal` for failed tests: `(^fixTest("testName"))!`
  - `coverage_report` when coverage enabled
- ✅ Calculates RLFP reward via `RLFPLearner.calculateReward()`
- ✅ Returns test metrics: success, passed, failed, total, duration, coverage, reward

**Files Created/Modified:**
| File | Status |
|------|--------|
| `nar/src/tools/adapters/external-tools.ts` | ✅ Added `createTestRunnerTools()` with `run_tests` tool |
| `nar/src/tools/adapters/index.ts` | ✅ Exported `createTestRunnerTools` and `TestRunnerDeps` |

**Verification:**
- `tsx -e "import { createTestRunnerTools } from './nar/src/tools/adapters/external-tools.ts'; ..."` ✅ Runs tests, returns metrics, calculates reward
- Generated tests still pass: `pnpm vitest run tests/generated/` ✅ 18/18 pass
- Self-tune demo still works: `pnpm run self-tune-demo` ✅ Completes in ~2s

### 1.3 Coverage → Concept Priority — ✅ COMPLETED
**Tool**: `coverage_concepts` in `nar/src/tools/adapters/external-tools.ts`
- ✅ Runs tests with coverage via `pnpm vitest run --coverage`
- ✅ Parses coverage map from `.vitest/json/output.json`
- ✅ For each file with coverage < threshold (default 80%):
  - Creates/updates concept with term `coverage_{filename}`
  - Sets priority = 1 - (coverage / 100) → 0% coverage = priority 1.0, 79% = priority 0.21
  - Adds belief with frequency = coverage percentage, confidence = 0.9
  - Adds goal to improve coverage
- ✅ Returns metrics: total files, low coverage files, concepts injected, injected concept details

**Files Created/Modified:**
| File | Status |
|------|--------|
| `nar/src/tools/adapters/external-tools.ts` | ✅ Added `createCoverageConceptTools()` with `coverage_concepts` tool |
| `nar/src/tools/adapters/index.ts` | ✅ Exported `createCoverageConceptTools` and `CoverageConceptDeps` |

**Verification:**
- `pnpm vitest run tests/generated/ --coverage` ✅ Generates coverage map
- Generated tests still pass: `pnpm vitest run tests/generated/` ✅ 18/18 pass
- Self-tune demo still works: `pnpm run self-tune-demo` ✅ Completes in ~2s

### 1.4 Cognitive Scenario Generation (Imaginary Situations) — ✅ COMPLETED
**Tool**: `generate_scenarios` in `nar/src/tools/adapters/external-tools.ts`
- ✅ Generates scenario specs from high-level seeds using template profiles
- ✅ Auto-infers scenario profile from seed text (contradictory_sensors, temporal_reasoning, resource_pressure, belief_revision, cross_engine_sync)
- ✅ Uses NL→Narsese pipeline (via `NLUnderstandingService`) for custom scenario generation when registry provided
- ✅ Executes scenarios against live NAR instance via `runScenario()` capturing `CognitiveEvent` stream
- ✅ Validates outcomes with 5 validators: no_crash, contradiction_detected, latency_p95, min_derivations, specific_belief
- ✅ Injects results into EpisodicMemory: `scenario_passed`/`scenario_failed` episodes with full metrics
- ✅ Calculates RLFP reward signal via `calculateScenarioReward()` based on validator scores
- ✅ Injects `fix_scenario_goal` for failed scenarios: `(^fixScenario("name"))!`
- ✅ Supports batch generation: `count` parameter runs multiple scenarios

**Files Created/Modified:**
| File | Status |
|------|--------|
| `nar/src/tools/adapters/external-tools.ts` | ✅ Added `createScenarioGenTools()` with `generate_scenarios` tool |
| `nar/src/tools/adapters/index.ts` | ✅ Exported `createScenarioGenTools`, `ScenarioGenDeps`, `ScenarioSpec`, `ScenarioResult`, `ScenarioInjectEvent`, `ScenarioSuccessCriteria` |

**Verification:**
- `tsx scripts/test-scenario-gen-standalone.ts` ✅ Generates and executes all 5 profile scenarios
- `pnpm typecheck` ✅ Passes (no new errors in external-tools.ts)
- `pnpm run self-tune-demo` ✅ Still works (no regression)
- Generated tests still pass: `pnpm vitest run tests/generated/` ✅ 18/18 pass

**Scenario Profiles Implemented:**
| Profile | Description | Duration | Inject Events | Success Criteria |
|---------|-------------|----------|---------------|------------------|
| `contradictory_sensors` | Contradictory sensor inputs | 500 steps | 4 (2 belief_streams, 1 question, 1 resource_pressure) | no_crash, contradiction≤10, latency≤100ms, min_derivations≥5 |
| `temporal_reasoning` | Event sequences with delayed evidence | 300 steps | 3 (belief_stream, question, resource_pressure) | no_crash, min_derivations≥3, specific_belief: A==>C |
| `resource_pressure` | AIKR graceful degradation under load | 400 steps | 3 (belief_stream, resource_pressure@20, question) | no_crash, latency≤50ms, min_derivations≥10 |
| `belief_revision` | Belief revision with incoming evidence | 350 steps | 3 (2 belief_streams with conflict, question) | no_crash, contradiction≤15, min_derivations≥5 |
| `cross_engine_sync` | NAR↔MeTTa coordination | 250 steps | 3 (belief_stream, goal, question) | no_crash, min_derivations≥3, specific_belief: nar<->metta |

**Next Steps (Phase 1.5+):**
- Add CLI command `nar scenario-gen` for direct access
- Implement `TestHarness` class for more sophisticated scenario execution
- Add MeTTa-based scenario spec generation (currently template-based)
- Implement hidden-model oracle for analytical pass/fail (Phase 2.5 Tier A)
- Add scenario persistence and replay capability

---

## Phase 2: Self-Tuning Loop — ✅ COMPLETED

### 2.1 Expanded Knob Set (3 knobs) — ✅ COMPLETED
| Knob | Path | Range | Step |
|------|------|-------|------|
| `maxDerivationsPerStep` | `inference.maxDerivationsPerStep` | 10–500 | 10 |
| `maxLoops` | `modelRunner.maxLoops` | 1–10 | 1 |
| `activationDecayRate` | `memory.activationDecayRate` | 0.001–0.1 | 0.001 |

**Implementation**: Added to `nar/src/rlfp/knobs.ts` knobSchema and `nar/src/config/cognitive-parameters.ts` CognitiveParameters interface.

### 2.2 Normalized Reward Function — ✅ COMPLETED
```typescript
const speedScore = baselineDuration / currentDuration;  // > 1 = faster
const reward = 0.5 * passRate + 0.3 * clamp(speedScore, 0, 2) / 2 + 0.2 * coverageDelta;
```

**Implementation**: Updated `RLFPLearner.calculateReward()` in `nar/src/rlfp/RLFPLearner.ts`.

### 2.3 Persist Best Config — ✅ COMPLETED
- On improvement > 5%: writes config to `senars.config.json`
- Human-reviewable diff before commit (via CLI output)

**Deliverable**: `pnpm run tune --iterations 20` shows live dashboard, writes optimized config.

### Files Created/Modified
| File | Status |
|------|--------|
| `nar/src/config/cognitive-parameters.ts` | ✅ Added `modelRunner` & `memory` config sections |
| `nar/src/rlfp/knobs.ts` | ✅ Added `maxLoops` & `activationDecayRate` to knobSchema |
| `nar/src/rlfp/RLFPLearner.ts` | ✅ Updated `getTunableKnobs()`, `calculateReward()` |
| `scripts/self-tune-demo.ts` | ✅ Updated with new knobs & normalized reward |
| `src/bin/tune.ts` | ✅ Created `nar tune` CLI command |
| `package.json` | ✅ Added `tune` script |

**Verification:**
- `pnpm run self-tune-demo` ✅ Completes in ~2s, shows all 8 knobs
- `pnpm run tune --iterations 5` ✅ Runs tuning iterations, prints live dashboard
- `pnpm typecheck` ✅ Passes (no new errors)
- `pnpm test tests/nar/rlfp.test.ts` ✅ 17/17 tests pass

---

## Phase 2.5: Imagination Engine (Cognitive Treadmill) — ✅ COMPLETED

### Summary
All Phase 2.5 Tier A tasks implemented and verified:
- **2.5.1 Template Generators + Hidden-Model Oracle**: Created `nar/src/imagination/types.ts`, `oracle.ts`, `generator.ts` with 6 scenario profiles
- **2.5.2 CognitiveTreadmill**: Created `nar/src/imagination/treadmill.ts` with rate control, burst events, stress metrics, and overload sweep
- **2.5.3 ArchitectureDriver**: Created `nar/src/self/architecture-driver.ts` that injects self-beliefs and writes proposals to `docs/proposals/`
- **2.5.4 CLI**: Created `src/bin/imagine.ts` with profiles: induction, transitive, contradiction_storm, overload, drift, narrative

**Verification**:
- `tsx src/bin/imagine.ts --profile induction --seed 42` ✅ Runs induction scenario, completes successfully
- `tsx src/bin/imagine.ts --profile overload --multiplier 2 --analyze` ✅ Prints degradation curve, detects capacity knee
- `tsx src/bin/imagine.ts --profile contradiction_storm --count 3` ✅ Runs multiple scenarios
- `tsx src/bin/imagine.ts --profile transitive --seed 42 --analyze` ✅ Detects architecture gaps, writes proposal
- `pnpm typecheck` ✅ Passes (no new errors in imagination modules)
- `pnpm test tests/nar/rlfp.test.ts` ✅ 17/17 tests pass
- `pnpm run self-tune-demo` ✅ Still works (no regression)

### Files Created/Modified
| File | Status |
|------|--------|
| `nar/src/imagination/types.ts` | ✅ Created |
| `nar/src/imagination/oracle.ts` | ✅ Created |
| `nar/src/imagination/generator.ts` | ✅ Created |
| `nar/src/imagination/treadmill.ts` | ✅ Created |
| `nar/src/imagination/index.ts` | ✅ Created |
| `nar/src/self/architecture-driver.ts` | ✅ Created |
| `nar/src/self/index.ts` | ✅ Updated exports |
| `nar/src/index.ts` | ✅ Exports imagination + self modules |
| `src/bin/imagine.ts` | ✅ Created CLI command |
| `vitest.config.ts` | ✅ Fixed vite-tsconfig-paths warning |

### Implemented Profiles (Tier A — formal oracle)
| Profile | Description | Duration | Key Metrics |
|---------|-------------|----------|-------------|
| `induction` | Induction under noise (bell ==> rain) | 500 steps | Recovers hidden rule ±0.1 frequency |
| `transitive` | Chained deduction (A --> B --> C) | 300 steps | Derives (A ==> C) within budget |
| `contradiction_storm` | Contradiction handling | 400 steps | Detects conflict, no priority oscillation |
| `overload` | AIKR graceful degradation | 400 steps | Quality-vs-load curve, capacity knee detection |
| `drift` | Forgetting & retention | 500 steps | Stale concepts evicted, salient retained |
| `narrative` | LM narrative (Tier B placeholder) | 500 steps | Template-based for now |

### Key Integration Points
- `ScenarioGenerator` creates deterministic scenarios from seed + profile
- `HiddenModelOracle` computes analytically expected truth values (never fed to NAR)
- `CognitiveTreadmill` runs scenarios with Poisson arrivals, burst events, captures `CognitiveEvent` stream
- `ArchitectureDriver` analyzes stress metrics → injects self-beliefs → writes proposals to `docs/proposals/`
- CLI `nar imagine` provides direct access to all profiles with `--analyze` flag for gap detection

### Next Phase: Phase 3 — Self-Building Loop
- Codemod tool (AST-Grep first)
- Refactoring pipeline (lint → belief → codemod → approve → test → commit)
- Feature synthesis (NL → code via MeTTa)

---

## Phase 3: Self-Building Loop

### 3.1 Codemod Tool (AST-Grep First)
**File**: `nar/src/tools/adapters/external-tools.ts` — add `codemod` tool

```typescript
// API
codemod(pattern, replacement, { dryRun: true, scope: ['src/cli/', 'src/tools/'] })
// Returns: { diff: string, files: string[], applied: boolean }
```

- Use `ast-grep` (Rust, fast) for structural rewrites
- Reserve `ts-morph` for multi-file refactors needing type-checker
- Start patterns: `any` → explicit type, non-null assertion → optional chaining, `forEach` returning value → `for...of`

### 3.2 Refactoring Pipeline
```
Lint error (biome JSON)
  → NAR belief: `(file:line --> fixPattern)`
  → ToolRegistry executes codemod (dryRun first)
  → Show diff → ApprovalManager gate (risk: low/medium)
  → Apply → Run tests
  → Pass? commit : revert + negative belief
```
- Track success rate per `fixPattern` in `ToolRegistry.feedback`
- Scope restriction: whitelist directories until success rate > threshold

### 3.3 Feature Synthesis (NL → Code)
**Pipeline**:
1. User: "add CLI command to export beliefs as JSON"
2. `NLTranslator` → Narsese goal: `(^exportBeliefs --> cliCommand).`
3. NAR derives plan (steps: create command, register, test)
4. `Metta` executes plan → generates TS in `src/cli/commands/`
5. `codemod` writes file, `test-loop` validates
6. Feedback to NAR (success/failure)

**Start with**: CLI commands (isolated, testable, high value)

**Sandbox**: Run generated code in isolated VM/Docker before host execution

---

## Phase 4: Observability

| Endpoint | Data | Consumer |
|----------|------|----------|
| `GET /metrics` | Prometheus: derivations/sec, contradiction rate, tool latency | Grafana |
| `WS /cognitive-stream` | Real-time `CognitiveEvent` | UI dashboard |
| `CLI .self-report` | Top 5 beliefs, contradictions, stalled goals | Human |

---

## Minimal File List per Capability

| Capability | Files (≤5 each) |
|------------|-----------------|
| Test runner | `vitest.config.ts`, `tests/setup/vitest-setup.ts`, `package.json` |
| Test gen | `nar/src/tools/adapters/external-tools.ts` (add `generateTests`), `nar/src/nl/` |
| Scenario gen | `nar/src/tools/adapters/external-tools.ts` (add `generateScenarios`), `nar/src/nl/`, `nar/src/testing/TestHarness.ts` (new) |
| Imagination | `nar/src/imagination/generator.ts`, `oracle.ts`, `treadmill.ts`, `nar/src/self/architecture-driver.ts`, `src/cli/commands/imagine.ts` |
| Tuning | `nar/src/nar.ts` (expose knobs), `nar/src/rlfp/RLFPLearner.ts`, `nar/src/rlfp/knobs.ts` |
| Approval | `core/src/approval/ApprovalService.ts`, `core/src/motor/builtin-tools.ts` |
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
| M1.5: Cognitive scenarios | `nar scenario-gen --seed "contradictory sensors" --count 5` → 5 rich scenarios pass |
| M2: Self-tune | `nar tune --iterations 10` → prints before/after metrics |
| M2.5: Imagination | `nar imagine --seed 42 --profile induction` → recovers `(bell ==> rain)` ±0.1; `--profile overload` → degradation curve + 1 filed proposal |
| M3: Self-build | `nar build "add /export command"` → working command + test |
| M4: Production loop | All three running in background for 1 hour unattended |

---

## Next Steps (Phase 3)

**Priority**: Continue Phase 3 — Self-Building Loop

### Phase 2.5 — Imagination Engine: ✅ COMPLETED
1. ✅ **2.5.1 Template Generators + Hidden-Model Oracle** — 6 profiles, deterministic seeds
2. ✅ **2.5.2 CognitiveTreadmill** — Rate control, burst events, stress metrics, overload sweep
3. ✅ **2.5.3 ArchitectureDriver** — Stress analysis → self-beliefs → proposals
4. ✅ **2.5.4 CLI** — `nar imagine` with all profiles + `--analyze` flag

**Key Integration Points**:
- `ScenarioGenerator` creates deterministic scenarios from seed + profile
- `HiddenModelOracle` computes analytically expected truth values (never fed to NAR)
- `CognitiveTreadmill` runs scenarios with Poisson arrivals, captures `CognitiveEvent` stream
- `ArchitectureDriver` analyzes stress metrics → injects self-beliefs → writes proposals
- CLI `nar imagine` provides direct access with `--analyze` for gap detection

**Next Phase**: Phase 3 — Self-Building Loop
- Codemod tool (AST-Grep first) in `nar/src/tools/adapters/external-tools.ts`
- Refactoring pipeline: lint error → NAR belief → codemod (dryRun) → diff → ApprovalManager → apply → test
- Feature synthesis: NL → Narsese goal → NAR derives plan → MeTTa executes → generates TS → codemod writes → test validates