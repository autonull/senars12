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

<!-- Fix patterns (semantic, not syntactic) -->
(fix_pattern:null_check --> applies_to null_pointer_error).
(fix_pattern:type_annotation --> applies_to type_mismatch_error).
(fix_pattern:boundary_check --> applies_to out_of_bounds_error).
```

**File**: `nar/src/tools/schemas.ts` (add self-schemas) or init script

**Key Design**: Fix patterns are **semantic concepts**, not AST-grep strings. The NAR reasons about `fix_pattern:null_check`; the tool layer maps to actual codemod strings.

---

### 3.3 Meta-Rules with AIKR Bounds (Strict Limits)
Extend `RuleRegistry` with self-reasoning rules **with hard bounds**:

```narsese
<!-- Strategy selection (only when competence drive low) -->
<(drive:competence --> low) & (situation --> requires_strategy) & (strategy --> $s) ==> (^select_strategy($s))!>

<!-- Knob tuning (only when reward < threshold) -->
<(rlfp:reward --> below_threshold) & (knob --> $k) & (tune --> improves $k) & (^tune($k, $v))! ==> (^apply_tuning($k, $v))!>

<!-- Test repair (semantic fix pattern) -->
<(test_failed --> $t) & (error_pattern --> $e) & (fix_pattern($e) --> $fix) & (^repair($t, $fix))! ==> (^apply_fix($fix))!>

<!-- Schema promotion (high confidence + frequency) -->
<(schema --> $s) & (confidence($s) > 0.9) & (frequency($s) > 10) ==> (^promote_rule($s))!>

<!-- Capability scaffolding -->
<(capability --> $c) & (template($c) --> $tmpl) & (^add_capability($c))! ==> (^scaffold($tmpl, $c))!>
```

**AIKR Bounds (enforced in RuleProcessor for meta-rules):**
| Bound | Value | Rationale |
|-------|-------|-----------|
| `maxMetaDerivationDepth` | 2 | Prevent infinite regress |
| `maxMetaDerivationsPerStep` | 5 | Limit compute on self-reasoning |
| `metaRulePriority` | 0.1 (base) | Lower than world beliefs |
| `metaRuleActivationThreshold` | drive_intensity > 0.6 | Only fire when drives demand it |

**File**: `nar/src/rules/meta-rules.ts` (new) + `RuleProcessor` config for meta-bounds

---

### 3.4 Homeostatic Drives (Decay + Replenishment)
**Existing drives** (in `drives/builtin.ts`):
| Drive | Generates Goal | Property | Decay Rate | Replenished By |
|-------|----------------|----------|------------|----------------|
| `curiosity` | `(self --> curious)!` | `curious` | 0.02/cycle | `generate_scenarios`, `coverage_concepts` on low-coverage areas |
| `competence` | `(self --> competent)!` | `competent` | 0.015/cycle | `run_tests` (green), `tune_knob` (reward ↑) |
| `coherence` | `(self --> coherent)!` | `coherent` | 0.01/cycle | `resolve_contradiction`, schema promotion |
| `social` | `(self --> social)!` | `social` | 0.05/cycle | Human interaction (CLI/IRC) |

**Connect stimulation to events** (in `nar-execution.ts`):
```typescript
// On test failure → competence decays, triggers repair
driveManager.stimulate('competence', -0.15);

// On contradiction detected → coherence decays
driveManager.stimulate('coherence', -0.2);

// On low coverage concept → curiosity stimulated
driveManager.stimulate('curiosity', 0.15);

// On successful test run → competence replenished
driveManager.stimulate('competence', 0.1);

// On scenario pass → curiosity replenished
driveManager.stimulate('curiosity', 0.05);
```

**Natural loop**: Drives decay → goals injected → tools execute → drives replenished → repeat.

---

### 3.5 Self-Tools (Semantic Interface, Syntax in Tool Layer)
| Tool | Self-Operation (NAR Goal) | Tool-Layer Implementation |
|------|---------------------------|---------------------------|
| `register_rule` | `(^promote_rule($schema_id))!` | Add schema to `RuleRegistry`, register in `RuleProcessor` |
| `register_tool` | `(^add_capability($cap_id))!` | `ToolManager.register()` with descriptor |
| `scaffold_capability` | `(^scaffold($template_id, $cap_id))!` | Fill template → `codemod` write in **shadow worktree** |
| `apply_fix` | `(^apply_fix($fix_pattern_id))!` | Lookup fix pattern → `codemod` in **shadow worktree** |
| `tune_knob` | `(^apply_tuning($knob_id, $value))!` | `RLFPLearner.applyTuningUpdate()` |
| `switch_strategy` | `(^select_strategy($strategy_id))!` | `CognitiveController` / `StrategyRegistry` |
| `run_tests` | Validation step | Existing `run_tests` tool (in shadow) |
| `run_scenario` | Validation step | Existing `generate_scenarios` tool (in shadow) |

**Shadow Execution (Safety)**:
```typescript
// In self-tools execution:
1. Create git worktree: `git worktree add .shadow/fix-42`
2. Apply codemod in `.shadow/fix-42`
3. Run `run_tests` in `.shadow/fix-42`
4. If green: present diff to ApprovalManager
5. If approved: merge worktree → main
6. Cleanup: `git worktree remove .shadow/fix-42`
```

**File**: `nar/src/tools/adapters/external-tools.ts` (add `createSelfTools()`)

---

### 3.6 RLFP on Task Outcomes (Unified + Intrinsic Rewards)
Extend `RLFPLearner.calculateReward()` to accept generic task outcomes:

```typescript
interface TaskOutcome {
  taskType: 'test' | 'scenario' | 'contradiction' | 'schema' | 'capability' | 'knob_tune' | 'meta_reasoning';
  success: boolean;
  metrics: Record<string, number>;  // passRate, latency, coverage, derivationDepth, selfModelAccuracy
}

// Extrinsic rewards (existing)
reward_extrinsic = 0.5 * passRate + 0.3 * speedScore + 0.2 * coverageDelta - aikrPenalty;

// Intrinsic rewards (new)
reward_intrinsic = 
  0.4 * derivationDepthReduction +    // schema promotion → fewer steps
  0.3 * selfModelAccuracy +           // predicted vs actual capability
  0.3 * contradictionReduction;       // coherence improvement

reward = clamp(reward_extrinsic + 0.3 * reward_intrinsic, -1, 1);
```

All improvements flow through same reward → same policy optimization.

**File**: `nar/src/rlfp/RLFPLearner.ts`

---

### 3.7 Goal→Tool Wiring (Semantic Dispatch)
ToolRegistry executes tools for goals matching `^tool_name(semantic_args)` pattern:

```typescript
// In ToolRegistry or NARExecution loop
async executeToolGoal(goalTerm: Term): Promise<ToolResult> {
  const str = goalTerm.toString();
  if (!str.startsWith('^')) return errorResult('Not a tool goal');
  
  // Parse: ^tool_name(arg1, arg2) where args are Narsese terms/concepts
  const match = str.match(/^\^(\w+)\((.*)\)$/);
  if (!match) return errorResult('Invalid tool goal syntax');
  
  const [, toolName, argsStr] = match;
  const args = parseNarseseArgs(argsStr);  // Convert Narsese terms to tool params
  
  // Semantic resolution: fix_pattern_id → actual codemod strings
  const resolvedArgs = await this.resolveSemanticArgs(toolName, args);
  
  return this.execute(toolName, resolvedArgs);
}
```

**File**: `nar/src/tools/tool-registry.ts` (add `executeToolGoal()`, `resolveSemanticArgs()`)

---

## What This Replaces (No More Hardcoded Pipelines)

| Old (Hardcoded Pipeline) | New (Unified Reasoning) |
|--------------------------|-------------------------|
| 3.2: lint→belief→codemod→approval→test | `fix_test_goal` → meta-rule → `apply_fix` → shadow test → reward |
| 3.3: NL→goal→plan→MeTTa→codemod→test | `add_capability_goal` → meta-rule → `scaffold` → shadow test → reward |
| 2.x: tune knobs via CLI | `tune_knob_goal` → meta-rule → `tune_knob` → reward |
| Schema induction (passive) | `promote_rule_goal` → meta-rule → `register_rule` → reward |

---

## Implementation Priority (Minimal New Code)

1. **Self-concept vocabulary** — Add to `schemas.ts` or init script (few lines)
2. **Meta-rules + AIKR bounds** — `meta-rules.ts` + `RuleProcessor` meta-config
3. **Homeostatic drive hooks** — `nar-execution.ts`: stimulate on events, natural decay handles rest
4. **Self-tools (shadow execution)** — `external-tools.ts`: `register_rule`, `register_tool`, `scaffold_capability`, `apply_fix`, `tune_knob`, `switch_strategy`
5. **RLFP task reward + intrinsic** — `RLFPLearner.calculateReward(TaskOutcome)`
6. **Goal→Tool wiring** — `tool-registry.ts`: `^tool_name` pattern + semantic arg resolution
7. **Integration test** — `nar run --auto` runs autonomous improvement loop

---

## Phase 3.8: Observability (Moved from Phase 4 — Required for M3)
The system **must** emit structured cognitive state for human oversight during `nar run --auto`:

```json
{
  "timestamp": "2026-09-06T...",
  "active_drives": { "competence": 0.8, "curiosity": 0.2, "coherence": 0.9, "social": 0.1 },
  "active_meta_goals": ["^apply_fix(fix_pattern:null_check)", "^promote_rule(schema_42)"],
  "pending_tool_executions": ["apply_fix (shadow worktree .shadow/fix-42)"],
  "aikr_pressure": "low",
  "rlfp_reward_avg": 0.34,
  "meta_derivation_budget_used": "2/5"
}
```

**Emitted**: Every N cycles in `NARExecution.run()` via `systemEventBus.emit('cognitive:state:summary', ...)`

**Files**: `nar-execution.ts` (emit), CLI command `/self-report` to pretty-print

---

## Phase 4: Full Observability (Deferred)
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
| **Self-improvement** | **`meta-rules.ts`, `drives/builtin.ts` (stimulate), `external-tools.ts` (self-tools + shadow), `RLFPLearner.ts`, `tool-registry.ts`, `schemas.ts`, `nar-execution.ts` (drive hooks + observability)** |
| Config persist | `config/loader.ts`, `ConfigView.ts` |

---

## Anti-Patterns to Avoid
- ❌ Perfect type coverage before automation works
- ❌ Generalized "architecture search" before single-knob tuning works
- ❌ Full MeTTa↔NAR bridge before CLI command synthesis works
- ❌ Dashboard before there's data to show
- ❌ **Hardcoded pipelines** where unified reasoning works
- ❌ **New mechanisms** where existing NAR machinery suffices
- ❌ **Unbounded meta-reasoning** (strict AIKR bounds required)
- ❌ **Syntactic goals** in NAR space (semantic only, syntax in tool layer)
- ❌ **Live code modification** without shadow validation
- ❌ **Only extrinsic rewards** (intrinsic needed for structural improvements)

## Escape Hatches
- All auto-writes through `ApprovalManager` (human `y/n` in CLI)
- Git commits every iteration → `git reset --hard` always works
- Shadow worktrees isolate experiments from main
- `SENARS_AUTO_BUILD=1` disables entire loop
- Meta-reasoning budget hard-coded (not configurable at runtime)

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

## ✅ Phase 3.2-3.8: Unified Self-Improvement + Observability — COMPLETED
| Task | Implementation |
|------|----------------|
| 3.2 Self-concept vocabulary | `nar/src/tools/self-concept.ts` — 30 semantic Narsese beliefs + fix pattern mappings |
| 3.3 Meta-rules + AIKR bounds | `nar/src/rules/meta-rules.ts` — 5 meta-rules with depth=2, budget=5, priority=0.1, threshold=0.6 |
| 3.4 Homeostatic drive hooks | `nar/src/nar-execution.ts` — `stimulateDrives()` on test_failed, test_passed, contradiction_detected, low_coverage, scenario_passed, schema_promoted, capability_added, knob_tuned |
| 3.5 Self-tools (shadow execution) | `nar/src/tools/adapters/external-tools.ts` — `createSelfTools()` with 8 tools: `register_rule`, `register_tool`, `scaffold_capability`, `apply_fix`, `tune_knob`, `switch_strategy`, `run_tests_shadow`, `run_scenario_shadow` using git worktrees |
| 3.6 RLFP task reward + intrinsic | `nar/src/rlfp/RLFPLearner.ts` — `calculateRewardFromTask(TaskOutcome)` with intrinsic rewards (derivationDepthReduction, selfModelAccuracy, contradictionReduction) |
| 3.7 Goal→Tool wiring | `nar/src/tools/tool-registry.ts` — `executeToolGoal()` parses `^tool_name(args)`, `resolveSemanticArgs()` maps concepts to implementations |
| 3.8 Observability | `nar/src/nar-execution.ts` — emits `cognitive:state:summary` every 10 cycles with drives, meta-goals, AIKR pressure, RLFP reward, meta-budget |
| Integration test | `scripts/self-improve-demo.ts` — runs autonomous loop for N cycles, verifies all components |

**Files created/modified:**
- `nar/src/tools/self-concept.ts` (new)
- `nar/src/rules/meta-rules.ts` (new)
- `nar/src/rules/index.ts` (exports)
- `nar/src/tools/index.ts` (exports self-concept)
- `nar/src/tools/adapters/external-tools.ts` (added createSelfTools)
- `nar/src/tools/adapters/index.ts` (exports self-tools)
- `nar/src/rlfp/RLFPLearner.ts` (added TaskOutcome, calculateRewardFromTask)
- `nar/src/rlfp/index.ts` (exports TaskOutcome)
- `nar/src/tools/tool-registry.ts` (added executeToolGoal, parseNarseseArgs, resolveSemanticArgs)
- `nar/src/nar-execution.ts` (added stimulateDrives, emitCognitiveStateSummary, recordRLFPReward, trackMetaDerivation)
- `scripts/self-improve-demo.ts` (new integration test)

**Verification:** `pnpm exec tsx scripts/self-improve-demo.ts` ✅ runs 10 cycles, loads self-concept, registers meta-rules, updates drives, emits observability

---

## Current Priority: Phase 3.8+ (Production Hardening)