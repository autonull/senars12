# SENARS12 Development Plan: Self-Improving System

## Vision
Enable SENARS to autonomously test, tune, and evolve its own codebase through neuro-symbolic reasoning cycles.

**Principle**: Ship working capabilities first. Polish code quality only when it blocks automation.

---

## Phase 0: Unblock Automation (This Week)

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

### 1.1 Test Generation from Zod Schemas
**Tool**: `generate-tests` in `nar/src/tools/adapters/external-tools.ts`
- Use `@fast-check/zod` for automatic arbitraries from Zod schemas
- Start with `z.object()` schemas: `ToolSpec`, `ConnectionConfig`, `AgentOptions`
- Emit `// @generated` header + gitignore `tests/generated/`
- Schema mapping failures → NAR episode: `(<schema:Foo> --> <unmappable>)`

### 1.2 Background Test Runner + Episodic Injection
- Spawn `vitest run --reporter=json` in worker
- Parse results → inject episodes:
  ```narsese
  (<testResult> --> <passed|failed>). :|:
  (<testFile> --> <duration>). :|:
  ```
- Failed test → inject Goal: `(^fixTest --> <testFile>)!`

### 1.3 Coverage → Concept Priority
- `c8` JSON → for each file `< 80%`: inject `Concept` with `priority = 1 - coverage`
- NAR naturally focuses on untested code

**Deliverable**: `nar test-loop --watch` prints "discovered 3 new failing tests" etc.

---

## Phase 2: Self-Tuning Loop

### 2.1 Expanded Knob Set (3 knobs)
| Knob | Path | Range | Step |
|------|------|-------|------|
| `maxDerivationsPerStep` | `inference.maxDerivationsPerStep` | 10–500 | 10 |
| `maxLoops` | `modelRunner.maxLoops` | 1–10 | 1 |
| `activationDecayRate` | `memory.activationDecayRate` | 0.001–0.1 | 0.001 |

### 2.2 Normalized Reward Function
```typescript
const speedScore = baselineDuration / currentDuration;  // > 1 = faster
const reward = 0.5 * passRate + 0.3 * clamp(speedScore, 0, 2) / 2 + 0.2 * coverageDelta;
```

### 2.3 Persist Best Config
- On improvement > 5%: `ConfigViewImpl.set(path, newVal)` → writes `senars.config.json`
- Human-reviewable diff before commit

**Deliverable**: `nar tune --iterations 20` shows live dashboard, writes optimized config.

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
2. `NLTranslator` → Narsese goal: `(^exportBeliefs --> ^cliCommand).`
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
| M2: Self-tune | `nar tune --iterations 10` → prints before/after metrics |
| M3: Self-build | `nar build "add /export command"` → working command + test |
| M4: Production loop | All three running in background for 1 hour unattended |