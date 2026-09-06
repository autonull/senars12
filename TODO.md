# SENARS12 Development Plan: Self-Improving System

## Vision
Enable SENARS to autonomously test, tune, and evolve its own codebase through neuro-symbolic reasoning cycles.

**Principle**: Ship working capabilities first. Polish code quality only when it blocks automation.

**Core Insight**: Self-improvement = **NAR reasoning about itself** using the same machinery. No special pipelines.

---

## ✅ Phase 0: Unblock Automation — COMPLETED
| Task | Files |
|------|-------|
| 0.1 Test Runner Fix | `vitest.config.ts`, `tests/setup/vitest-setup.ts`, `package.json` |
| 0.2 ApprovalManager Tool | `core/src/ApprovalService.ts`, `core/src/motor/builtin-tools.ts`, `core/src/Agent.ts` |
| 0.3 RLFP Knob Protocol | `nar/src/rlfp/knobs.ts`, `nar/src/rlfp/RLFPLearner.ts`, `nar/src/rlfp/index.ts` |
| 0.4 Self-Tune Demo | `scripts/self-tune-demo.ts` |

**Verification**: `pnpm run self-tune-demo` ✅ ~2s, `pnpm typecheck` ✅, `pnpm test` ✅ (298 unit)

---

## ✅ Phase 1: Self-Testing Loop — COMPLETED
| Capability | Tool | Key Files |
|------------|------|-----------|
| Test Generation from Zod Schemas | `generate_tests` | `external-tools.ts`, `schemas.ts`, `tests/generated/` |
| Background Test Runner + Episodic Injection | `run_tests` | `external-tools.ts` |
| Coverage → Concept Priority | `coverage_concepts` | `external-tools.ts` |
| Cognitive Scenario Generation | `generate_scenarios` | `external-tools.ts`, `nl/understanding.ts` |

**5 Scenario Profiles**: `contradictory_sensors`, `temporal_reasoning`, `resource_pressure`, `belief_revision`, `cross_engine_sync`

**Verification**: All generated tests pass (18/18), scenarios work, `pnpm typecheck` ✅, no regressions

---

## ✅ Phase 2: Self-Tuning Loop — COMPLETED
| Task | Implementation |
|------|----------------|
| 2.1 Expanded Knob Set | 8 knobs: `maxDerivationsPerStep`, `maxDerivationDepth`, `maxRulesPerCycle`, `callTimeoutMs`, `decayRate`, `cpuThrottleMs`, `maxLoops`, `activationDecayRate` |
| 2.2 Normalized Reward | `0.5 * passRate + 0.3 * clamp(baseline/current, 0, 2)/2 + 0.2 * coverageDelta - AIKR penalties` |
| 2.3 Persist Best Config | `nar tune` CLI (`src/bin/tune.ts`) — live dashboard, writes `senars.config.json` on >5% improvement |

**Files**: `cognitive-parameters.ts`, `knobs.ts`, `RLFPLearner.ts`, `self-tune-demo.ts`, `tune.ts`, `package.json`

**Verification**: `pnpm run tune --iterations 10` ✅, `pnpm typecheck` ✅, `pnpm test tests/nar/rlfp.test.ts` ✅ 17/17

---

## ✅ Phase 2.5: Imagination Engine (Cognitive Treadmill) — COMPLETED
| Component | File | Description |
|-----------|------|-------------|
| Template Generators + Hidden-Model Oracle | `imagination/generator.ts`, `oracle.ts`, `types.ts` | 6 deterministic profiles with analytical ground truth |
| CognitiveTreadmill | `imagination/treadmill.ts` | Rate control, burst events, stress metrics, overload sweep |
| ArchitectureDriver | `self/architecture-driver.ts` | Stress analysis → self-beliefs → proposals to `docs/proposals/` |
| CLI | `src/bin/imagine.ts` | Profiles: induction, transitive, contradiction_storm, overload, drift, narrative |

**Verification**: All profiles run, overload detects capacity knee, transitive writes proposals, `pnpm typecheck` ✅, no regressions

---

## ✅ Phase 3.1: Codemod Tool (AST-Grep First) — COMPLETED
| Aspect | Details |
|--------|---------|
| Tool | `codemod` in `external-tools.ts` |
| Engine | `ast-grep` (Rust) via `findAstGrep()` auto-detection |
| API | `codemod(pattern, replacement, { dryRun, scope, lang })` |
| Returns | `{ success, diff?, files[], applied, matches, error? }` |

**Verified Patterns**: `let $X: any = $V` → `let $X: unknown = $V`, `$X.forEach($F)` → for...of

**Files**: `external-tools.ts`, `adapters/index.ts`

---

## Phase 3: Autonomous Self-Improvement (Unified Reasoning)

### Architecture: Existing Components (Already Wired)

```
┌─────────────────────────────────────────────────────────────────┐
│                        NAR REASONER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  BELIEFS    │  │   GOALS     │  │  QUESTIONS  │              │
│  │  (incl.     │  │  (incl.     │  │  (incl.     │              │
│  │   self-     │  │   self-     │  │   self-     │              │
│  │   beliefs)  │  │   goals)    │  │   questions)│              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌─────────────────────┐                            │
│              │   RULE PROCESSOR    │  ← sync rules + LMRules    │
│              │                     │  ← meta-rules (to add)     │
│              └──────────┬──────────┘                            │
│                         │                                        │
│    ┌────────────────────┼────────────────────┐                  │
│    ▼                    ▼                    ▼                  │
│ ┌─────────┐       ┌─────────┐        ┌─────────┐              │
│ │ TOOLS   │       │ MEMORY  │        │ RLFP    │              │
│ │(self-ops)│       │(self-epi)│        │(task rwd)│             │
│ └─────────┘       └─────────┘        └─────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

**Single loop** (already runs in `NARExecution.run()`):
```
Perceive → Recall → Reason (meta-rules + drives) → Act (tools) → Validate → Consolidate
```

**Already wired in `nar.ts` + `nar-execution.ts`:**
- DriveManager injects goals: `(self --> curious)!`, `(self --> competent)!`, `(self --> coherent)!`
- CognitiveController adapts strategies
- RLFPLearner optimizes policy
- Self-reasoning assesses quality, performs self-correction
- TaskManager processes pending goals

---

### 3.2 Self-Concept Vocabulary (Narsese Beliefs)
Add to initial beliefs — represents system components as first-class concepts:
```narsese
<!-- Components -->
(system_component --> knob).
(system_component --> strategy).
(system_component --> tool).
(system_component --> rule).
(system_component --> test).
(system_component --> scenario).
(system_component --> concept).

<!-- Causal/functional relations -->
(knob:maxLoops --> affects modelRunner.maxLoops).
(strategy:focused --> reduces derivations).
(tool:codemod --> modifies source_code).
(rule:transitivity --> derives (A==>C) from (A==>B) (B==>C)).
(test:fix_test --> requires codemod).
(scenario:induction --> tests induction_capability).
(schema --> promotes_to rule).
(capability --> implemented_by tool).
```

**File**: `nar/src/tools/schemas.ts` (add self-schemas) or init script

---

### 3.3 Meta-Rules (Declarative, in RuleProcessor)
Extend `RuleRegistry` with self-reasoning rules:
```narsese
<!-- Strategy selection -->
<($situation --> requires_strategy) & (strategy --> $s) ==> (^select_strategy($s))!>

<!-- Knob tuning -->
<(knob --> $k) & (tune --> improves $k) & (^tune($k, $v))! ==> (^apply_tuning($k, $v))!>

<!-- Test repair -->
<(test_failed --> $t) & (error_pattern --> $e) & (fix_pattern($e) --> $fix) & (^repair($t, $fix))! ==> (^apply_codemod($fix))!>

<!-- Schema promotion -->
<(schema --> $s) & (confidence($s) > 0.9) & (frequency($s) > 10) ==> (^promote_rule($s))!>

<!-- Capability scaffolding -->
<(capability --> $c) & (template($c) --> $tmpl) & (^add_capability($c))! ==> (^scaffold($tmpl, $c))!>
```

**File**: `nar/src/rules/registration.ts` (add to `RuleRegistry.getAll()`) or `nar/src/rules/meta-rules.ts` (new)

---

### 3.4 Drive Stimulation → Autonomous Self-Goals
**Existing drives** (in `drives/builtin.ts`):
| Drive | Generates Goal | Property |
|-------|----------------|----------|
| `curiosity` | `(self --> curious)!` | `curious` |
| `competence` | `(self --> competent)!` | `competent` |
| `coherence` | `(self --> coherent)!` | `coherent` |
| `social` | `(self --> social)!` | `social` |

**Connect stimulation to events** (in `nar-execution.ts` or `DriveManager`):
```typescript
// On test failure
driveManager.stimulate('competence', -0.1);

// On contradiction detected
driveManager.stimulate('coherence', -0.2);

// On low coverage concept
driveManager.stimulate('curiosity', 0.15);
```

---

### 3.5 Self-Tools (Wrappers Around Existing Infrastructure)
| Tool | Self-Operation | Reuses |
|------|----------------|--------|
| `register_rule` | Add promoted schema as inference rule | `RuleProcessor` + `RuleRegistry` |
| `register_tool` | Add scaffolded capability | `ToolManager.register()` |
| `scaffold_capability` | Fill template → codemod write | `codemod` + templates |
| `tune_knob` | Apply RLFP knob update | `RLFPLearner.applyTuningUpdate()` |
| `switch_strategy` | Change active strategy | `StrategyRegistry.setActive()` / `CognitiveController` |
| `run_tests` | Validate repair/scaffold | Existing `run_tests` tool |
| `run_scenario` | Validate capability | Existing `generate_scenarios` tool |

**File**: `nar/src/tools/adapters/external-tools.ts` (add `createSelfTools()`)

---

### 3.6 RLFP on Task Outcomes (Unified)
Extend `RLFPLearner.calculateReward()` to accept generic task outcomes:
```typescript
interface TaskOutcome {
  taskType: 'test' | 'scenario' | 'contradiction' | 'schema' | 'capability' | 'knob_tune';
  success: boolean;
  metrics: Record<string, number>;  // passRate, latency, coverage, etc.
}
reward = calculateReward(outcome);
```
All improvements flow through same reward → same policy optimization.

**File**: `nar/src/rlfp/RLFPLearner.ts`

---

### 3.7 Goal→Tool Wiring
ToolRegistry executes tools for goals matching `^tool_name(args)` pattern:
```typescript
// In ToolRegistry.execute() or NARExecution processing loop
if (goalTerm.toString().startsWith('^')) {
  const [toolName, args] = parseToolGoal(goalTerm);  // ^tool(arg1, arg2)
  return toolManager.execute(toolName, args);
}
```

**File**: `nar/src/tools/tool-registry.ts` (add `executeToolGoal()`) or `nar-execution.ts` (in `run()` loop)

---

## What This Replaces (No More Hardcoded Pipelines)

| Old (Hardcoded Pipeline) | New (Unified Reasoning) |
|--------------------------|-------------------------|
| 3.2: lint→belief→codemod→approval→test | `fix_test_goal` → meta-rule → codemod → test → reward |
| 3.3: NL→goal→plan→MeTTa→codemod→test | `add_capability_goal` → meta-rule → scaffold → test → reward |
| 2.x: tune knobs via CLI | `tune_knob_goal` → meta-rule → tune_knob → reward |
| Schema induction (passive) | `promote_rule_goal` → meta-rule → register_rule → reward |

---

## Implementation Priority (Minimal New Code)

1. **Self-concept vocabulary** — Add to `schemas.ts` or init script (few lines)
2. **Meta-rules** — 5-10 declarative rules in `RuleRegistry` / `meta-rules.ts`
3. **Drive stimulation hooks** — Call `driveManager.stimulate()` on events
4. **Self-tools** — `external-tools.ts`: `register_rule`, `register_tool`, `scaffold_capability`, `tune_knob`, `switch_strategy`
5. **RLFP task reward** — Generic `calculateReward(TaskOutcome)` in `RLFPLearner.ts`
6. **Goal→Tool wiring** — `tool-registry.ts`: `^tool_name` pattern + `executeToolGoal()`

---

## Phase 4: Observability (Deferred)
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
| Test gen | `external-tools.ts`, `schemas.ts` |
| Scenario gen | `external-tools.ts`, `nl/understanding.ts` |
| Imagination | `generator.ts`, `oracle.ts`, `treadmill.ts`, `architecture-driver.ts`, `imagine.ts` |
| Tuning | `nar.ts`, `RLFPLearner.ts`, `knobs.ts` |
| Approval | `ApprovalService.ts`, `builtin-tools.ts` |
| Codemod | `external-tools.ts`, `builtin-tools.ts` |
| **Self-improvement** | **`meta-rules.ts`, `drives/builtin.ts` (stimulate), `external-tools.ts` (self-tools), `RLFPLearner.ts`, `tool-registry.ts`, `schemas.ts`** |
| Config persist | `config/loader.ts`, `ConfigView.ts` |

---

## Anti-Patterns to Avoid
- ❌ Perfect type coverage before automation works
- ❌ Generalized "architecture search" before single-knob tuning works
- ❌ Full MeTTa↔NAR bridge before CLI command synthesis works
- ❌ Dashboard before there's data to show
- ❌ **Hardcoded pipelines** where unified reasoning works
- ❌ **New mechanisms** where existing NAR machinery suffices

## Escape Hatches
- All auto-writes through `ApprovalManager` (human `y/n` in CLI)
- Git commits every iteration → `git reset --hard` always works
- `SENARS_AUTO_BUILD=1` disables entire loop

---

## Milestone Definition of Done

| Milestone | Demo Script |
|-----------|-------------|
| M0: Green CI | `pnpm test && pnpm typecheck` |
| M1: Self-test | `nar test-loop --once` → generates + runs 10 tests |
| M1.5: Cognitive scenarios | `nar scenario-gen --seed "contradictory sensors" --count 5` → 5 pass |
| M2: Self-tune | `nar tune --iterations 10` → before/after metrics |
| M2.5: Imagination | `nar imagine --seed 42 --profile induction` → recovers `(bell ==> rain)` ±0.1; `--profile overload` → degradation curve + proposal |
| **M3: Self-improve** | **`nar run --auto` → pursues fix_test_goals, promotes schemas, adds capabilities autonomously** |
| M4: Production loop | All three running 1 hour unattended |

---

## Current Priority: Phase 3.2-3.7 (Unified Self-Improvement)

1. **Self-concept vocabulary** — Add to `schemas.ts` or init
2. **Meta-rules** — `nar/src/rules/meta-rules.ts` or extend `registration.ts`
3. **Drive stimulation hooks** — `nar-execution.ts`: stimulate on test fail, contradiction, low coverage
4. **Self-tools** — `external-tools.ts`: `register_rule`, `register_tool`, `scaffold_capability`, `tune_knob`, `switch_strategy`
5. **RLFP task reward** — `RLFPLearner.calculateReward(TaskOutcome)`
6. **Goal→Tool wiring** — `tool-registry.ts`: `^tool_name` pattern + `executeToolGoal()`
7. **Integration test** — `nar run --auto` runs autonomous improvement loop