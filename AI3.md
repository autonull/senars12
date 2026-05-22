# Phase 5: Autonomous Goal-Directed Reasoning

## Purpose

Evolve SeNARS from reactive chatbot to autonomous cognitive agent with goal-directed background reasoning, attention-priority scheduling, and contextual LM rule triggering.

The system already has all the primitives: goals as tasks, attention-based concept priorities, LM rule integration, configurable reasoning cycles. Phase 5 wires them into a self-directed loop.

## Design Principles

1. **Agent-layer architecture** — scheduler lives in `src/agent/`, not on `NAR`
2. **Existing types** — goals are plain `Task{type:'goal'}`, no separate `GoalTask`
3. **Leverage existing LM rule system** — no new `LMRuleTrigger`, integrate priority gating into existing `processLMRules` path
4. **Zero new TUI components** — goal display folds into existing `StatusBarData`/`buildStatusBar`
5. **Connection-agnostic** — all connections notify scheduler instance, not `nar.scheduler`
6. **Extend before creating** — reuse dead config (agenticLoop) and adjacent classes (CognitiveContextBuilder) rather than creating parallel structures

## Architecture

```
Connection → AIAgentConnectionManager.handleMessage()
                     ↓                     ↕
              AIAgent.chat()      AutonomousScheduler
              ↙              ↘    (agent layer, NEW)
   NAR + LM rules          Background cycles:
   (existing)              nar.run(N) at idle
                           Priority-gated LM rules via processLMRules
                           Goal satisfaction via CognitiveContextBuilder.checkGoalSatisfaction()
                           Effort scaling via extended agenticLoop config
```

### What Exists vs. What Gets Added

| Layer | Exists | Modified | New |
|---|---|---|---|
| NAR core | RuleProcessor, NARExecution, LMRule, circuit breaker | `processLMRules` gets priority context | — |
| Agent layer | AIAgent, CognitiveContextBuilder, AIAgentConnectionManager | `CognitiveContextBuilder.checkGoalSatisfaction()`, `BotConfig.agenticLoop` schema | `AutonomousScheduler.ts` |
| TUI | StatusBarComponent, StatusBarData, buildStatusBar | `StatusBarData.goals`, `buildStatusBar` renders goal count | — |
| Config | DEFAULT_BOT_CONFIG.agenticLoop (dead keys) | Activate + extend with effortLevel, idleThresholdMs | — |

## Core Components

### 1. AutonomousScheduler (only new file)

**File**: `src/agent/AutonomousScheduler.ts`

Manages background reasoning cycles. Config comes from the existing (currently dead) `agenticLoop` section of `BotConfig` — no separate `SchedulerConfig` interface.

```typescript
// Config already exists in src/config/defaults.ts (dead, needs activation):
// agenticLoop: {
//   reasoningStepsPerWake: 5,    → repurposed as maxReasoningCycles
//   wakeupIntervalMs: 60000,     → repurposed as wakeIntervalMs
//   sleepIntervalMs: 1000,       → repurposed as idleThresholdMs
//   maxWakeTurns: 3,             → purge (dead, never used)
//   maxInputTurns: 50,           → purge (dead, never used)
//   enableLMRules: true,         → keep
// }

// Add these keys:
//   effortLevel: 0.3,            // 0.0–1.0, scales cycles per wake
//   priorityThreshold: 0.5,      // minimum priority for LM rule firing

export class AutonomousScheduler {
  private nar: NAR
  private config: BotConfig['agenticLoop']
  private lastInputTime = Date.now()
  private wakeTimer?: NodeJS.Timeout
  private running = false

  constructor(nar: NAR, config: BotConfig['agenticLoop']) { /* ... */ }

  markUserInput(): void {
    this.lastInputTime = Date.now()
  }

  start(): void {
    this.wakeTimer = setInterval(() => this.checkAndRun(), this.config.wakeupIntervalMs)
  }

  stop(): void {
    if (this.wakeTimer) clearInterval(this.wakeTimer)
  }

  private async checkAndRun(): Promise<void> {
    if (this.running) return
    const idle = Date.now() - this.lastInputTime
    if (idle < this.config.sleepIntervalMs) return
    this.running = true
    try {
      const cycles = Math.ceil(this.config.effortLevel * this.config.reasoningStepsPerWake)
      if (cycles > 0) await this.nar.run(cycles)
    } finally {
      this.running = false
    }
  }
}
```

### 2. Priority-Gated LM Rule Firing

**File**: `src/nar/rules/processor.ts` (modify `processLMRules`)

Add concept priority to the context passed through `canApply()`, so LM rules with `activationCondition` functions can gate on attention weight. No new class.

```typescript
private async* processLMRules(p1: RuleInput, p2: RuleInput): AsyncGenerator<RuleResult> {
  if (this.lmRules.length === 0) return

  const p1Concept = this.memory?.getConcept(p1.term)
  const p2Concept = this.memory?.getConcept(p2.term)
  const maxPriority = Math.max(p1Concept?.priority ?? 0, p2Concept?.priority ?? 0)

  if (maxPriority < this.priorityThreshold) return

  const context = { priority: maxPriority, /* existing fields: truth, conflictCount, linkCount */ }

  const results = await Promise.all(this.lmRules.map(async lmRule => {
    if (!lmRule.canApply(p1.term, p2.term, context)) return []
    // ... existing apply logic
  }))
  yield* results.flat()
}
```

Requires:
- `RuleProcessor` gains optional `memory` + `priorityThreshold` references
- `priorityThreshold` added to `NARConfig` (default 0.5, matching existing `CoreConfig.priorityThreshold`)
- Existing `activationCondition` functions receive `context.priority`

### 3. Goal Satisfaction (folded into CognitiveContextBuilder)

**File**: `src/agent/CognitiveContext.ts` (modify — no new file)

Add a single method to the existing `CognitiveContextBuilder` instead of creating a separate `GoalTracker` class:

```typescript
export class CognitiveContextBuilder {
  constructor(private readonly nar: NAR) {}

  checkGoalSatisfaction(goalTerm: string): { satisfied: boolean; truthFreq: number; truthConf: number } {
    const beliefs = this.nar.getBeliefs()
    const belief = beliefs.find(b => b.term.toString() === goalTerm)
    return {
      satisfied: belief !== undefined && belief.truth.f > 0.8,
      truthFreq: belief?.truth.f ?? 0,
      truthConf: belief?.truth.c ?? 0,
    }
  }

  // Existing methods unchanged: buildContext, buildSnapshot, primeAttention, extractTerms
}
```

`CognitiveContextBuilder.buildSnapshot()` already calls `nar.getGoals()` at line 32. The satisfaction check is a single additional query per goal — no duplication.

### 4. Goal Display (folded into StatusBar)

**File**: `src/agent/tui/visual.ts` (modify — no new file)

Extend `StatusBarData` with a goal summary, rendered inline by the existing `buildStatusBar` function:

```typescript
export interface StatusBarData {
  lmModel?: string
  lmAvailable: boolean
  narConcepts: number
  narAvailable: boolean
  turn: number
  mode: string
  goals?: {                // NEW
    active: number
    satisfied: number
    items?: Array<{ term: string; satisfied: boolean; pct: number }>
  }
}

export function buildStatusBar(data: StatusBarData, config: TUIConfig): string {
  if (!config.statusBar) return ''
  const parts: string[] = []

  // existing: LM status
  // existing: NAR status
  // existing: mode indicator
  // existing: turn count

  if (data.goals && data.goals.active > 0) {   // NEW — single line
    const pct = data.goals.satisfied / data.goals.active
    parts.push(`goals:${data.goals.active} ✓${data.goals.satisfied} ${(pct * 100).toFixed(0)}%`)
  }

  return VISUAL.statusBar(parts, config.colors)
}
```

No `GoalView` class, no separate rendering pass, no additional timer. The status bar already auto-updates.

### 5. Connection Integration

**File**: `src/agent/connections/index.ts` (modify)

Scheduler is held by `AIAgentConnectionManager` (not on `NAR`), passed via constructor. One call in `handleMessage`:

```typescript
private async handleMessage(connection: Connection, message: IOMessage): Promise<void> {
  this.scheduler?.markUserInput()    // NEW — before anything else
  // ... existing dispatch to agent.chat()
}
```

## Config Integration

Activate the existing dead `agenticLoop` config in `src/config/defaults.ts`:

```typescript
// BEFORE (dead — defined but never read):
agenticLoop: {
  reasoningStepsPerWake: 5,
  wakeupIntervalMs: 60000,
  sleepIntervalMs: 1000,
  maxInputTurns: 50,
  maxWakeTurns: 3,
  enableLMRules: true,
}

// AFTER (activated — all keys wired to AutonomousScheduler):
agenticLoop: {
  reasoningStepsPerWake: 5,       // max cycles per wake
  wakeupIntervalMs: 60000,       // how often scheduler checks idle
  sleepIntervalMs: 1000,         // min idle before background run
  enableLMRules: true,           // keep
  effortLevel: 0.3,              // NEW — scales reasoningStepsPerWake
  priorityThreshold: 0.5,        // NEW — min concept priority for LM rules
}
```

## Code Removal

Phase 5 replaces the system's conceptual model from a fixed pipeline to a dynamic scheduler. The following code becomes irrelevant and should be removed.

### Mandatory: `BotConfig.pipeline`

The entire `pipeline` config section is never read by `AIAgent` or any other code. It configured a stage-based processing pipeline that never existed. Phase 5's `AutonomousScheduler` is the replacement.

```typescript
// BEFORE — never read, remove entirely:
interface BotConfig {
  pipeline: {
    maxLoops: number;
    stageTimeoutMs: number;
    enableLoopBack: boolean;
    loopBackOn: ('believe' | 'question' | 'tool_call')[];
    stages?: any[];
    preset?: 'default' | 'chat' | 'reasoning' | 'tool';
  };
  // ...
}
```

**Files to edit:**

| File | Change |
|---|---|
| `src/agent/BotContext.ts:105-112` | Remove `pipeline` field from `BotConfig` |
| `src/agent/types.ts:34-41` | Remove `pipeline` field from `BotConfig` |
| `src/agent/config.ts:35` | Remove `pipeline` from `BotFullConfig` |
| `src/agent/config.ts:82-87` | Remove `pipeline` default config |
| `src/agent/connections/index.ts:165` | Remove `pipeline` from inline config construction |
| `src/bin/bot-ai.ts:68-73` | Remove `pipeline` block |
| `src/bin/demo-phase3.ts:31` | Remove `pipeline` from config |
| `src/bin/phase3-test.ts:28` | Remove `pipeline` from config |
| `src/agent/benchmarks/BenchmarkRunner.ts:91` | Remove `pipeline` from config |
| `tests/agent/ai-agent.test.ts` (6 sites) | Remove `pipeline` from test configs |

### Mandatory: `agenticLoop` dead keys

| Key | File | Reason |
|---|---|---|
| `agenticLoop.maxInputTurns` | `src/config/defaults.ts` | Never read |
| `agenticLoop.maxWakeTurns` | `src/config/defaults.ts` | Never read |

### Optional (pre-existing dead code, cleanup opportunistically)

These predate Phase 5 and are not caused by it, but removing them aligns the codebase with the plan's architecture:

```typescript
// Never read by AIAgent or any consumer:
BotConfig.directives      // src/agent/BotContext.ts:113-116
BotConfig.nlParsers       // src/agent/BotContext.ts:117-120
BotConfig.classifier      // src/agent/BotContext.ts:121-124
BotConfig.lmRules          // src/agent/BotContext.ts:125-129
BotConfig.prompts          // src/agent/BotContext.ts:130-134

// Related types never read:
PipelineEvents            // src/agent/BotContext.ts:12-57
PipelineEventEmitter      // src/agent/BotContext.ts:62-82
TurnState                 // src/agent/BotContext.ts:230-250
InputClassification       // src/agent/BotContext.ts:340-346
ClassificationSignal      // src/agent/BotContext.ts:348-353
DirectiveDef              // src/agent/BotContext.ts:150-156
ClassificationSignalDef   // src/agent/BotContext.ts:158-163
NLParserDef               // src/agent/BotContext.ts:144-148
LMRuleConfigEntry         // src/agent/BotContext.ts:165-173
LMRuleDef                 // src/agent/BotContext.ts:175-180
```

## Future Consolidation (Noted, Not Implemented)

The codebase currently has three independent periodic timers:

| Timer | Interval | Drives |
|---|---|---|
| `ProactiveEnricher.start()` | 60s | LM enrichment cycles |
| `ReasoningAboutReasoning.startPeriodicSelfAnalysis()` | 30s | Meta-cognitive self-analysis |
| `AutonomousScheduler` (Phase 5) | `wakeupIntervalMs` | NAR inference cycles |

These run independently with no coordination. Future work should consolidate them into a single `CognitiveCoordinator` that schedules inference, enrichment, and self-analysis on a shared clock with priority ordering (user input > inference > enrichment > self-analysis). This is deferred because:
- The three loops serve different purposes and don't currently conflict
- Unification requires designing a shared priority/preemption model
- Phase 5's scheduler is the foundation that future consolidation builds on

## Implementation Plan (5 weeks — eliminated 1 week by folding 2 files)

### Week 0: Code Removal (prerequisite)
- [ ] Remove `BotConfig.pipeline` from `src/agent/BotContext.ts`, `types.ts`
- [ ] Remove `pipeline` field + defaults from `src/agent/config.ts`
- [ ] Remove `pipeline` config from `connections/index.ts`, `bot-ai.ts`, demos, benchmarks, tests
- [ ] Purge dead keys `maxInputTurns`, `maxWakeTurns` from `src/config/defaults.ts`
- [ ] (Optional) Purge pre-existing dead config: `directives`, `nlParsers`, `classifier`, `lmRules`, `prompts`
- [ ] (Optional) Remove unused types: `PipelineEvents`, `PipelineEventEmitter`, `TurnState`, etc.
- [ ] Verify: `git diff --stat` shows clean removals with no compilation errors

### Week 1: Extend CognitiveContextBuilder + StatusBar
- [ ] Add `checkGoalSatisfaction(term)` to `CognitiveContextBuilder`
- [ ] Add `goals` field to `StatusBarData`
- [ ] Render goal summary in `buildStatusBar()`
- [ ] Activate `agenticLoop` config (add `effortLevel`, `priorityThreshold` keys)
- [ ] Wire config into `AIAgentConnectionManager`
- [ ] Test: goal satisfaction detection with mock beliefs

### Week 2: Priority-Gated LM Rules
- [ ] Add `priorityThreshold` to `NARConfig`
- [ ] Pass `memory` reference to `RuleProcessor`
- [ ] Modify `processLMRules` to skip low-priority premise pairs
- [ ] Add `priority` to `canApply()` context
- [ ] Test: verify high-priority concepts trigger LM rules, low-priority don't

### Week 3: AutonomousScheduler
- [ ] Create `src/agent/AutonomousScheduler.ts` (only new file in this plan)
- [ ] Idle detection + background `nar.run(n)`
- [ ] Effort scaling (`cycles = ceil(effortLevel * reasoningStepsPerWake)`)
- [ ] Connection integration via `markUserInput()` in `AIAgentConnectionManager`
- [ ] Test: scheduler cycles correlate with effortLevel (R² > 0.8)

### Week 4: Integration & Edge Cases
- [ ] Wire scheduler lifecycle into `AIAgentConnectionManager.start()/stop()`
- [ ] Handle competition: user input interrupts background run (skip if `running`)
- [ ] Handle rapid input during background cycles (reset idle timer)
- [ ] Test: no crashes under rapid input + background contention

### Week 5: E2E Testing & Polish
- [ ] Unit tests (mocked time, mock NAR)
- [ ] Integration tests (real NAR + mock LM)
- [ ] E2E: multi-connection, concurrent input, goal satisfaction
- [ ] Performance tuning

## Success Metrics

1. **Scheduler stability**: 1hr+ no crashes under idle/active cycling
2. **Effort proportionality**: `effortLevel` correlates with cycle frequency (R² > 0.8)
3. **LM rule gating**: high-priority concepts (>0.7) trigger LM rules, low (<0.3) do not
4. **Goal satisfaction**: correctly detects `truth.f > 0.8` for goal terms
5. **No infinite loops**: background cycles bounded by `reasoningStepsPerWake`
6. **Timer independence**: scheduler does not interfere with ProactiveEnricher or ReasoningAboutReasoning intervals

## What Does NOT Change

- NAR class interface (no `scheduler` property, no `fireLMRule`)
- `LMRule` class (no duplicate circuit breaker — already in LMRule.ts:38)
- Task types (goals remain `Task{type:'goal'}`)
- Connection adapter base classes (CLI, IRC, WS, HTTP, MCP)
- Existing LM rules (13 built-in rules unchanged)
- TUI conventions (`StatusBar` pattern, `VISUAL` helpers in `visual.ts`)
- Build system, package.json, tsconfig
- ProactiveEnricher and ReasoningAboutReasoning (left alone until future consolidation)

## New Files vs. Modifications vs. Removals

| Action | File | Change |
|---|---|---|
| **CREATE** | `src/agent/AutonomousScheduler.ts` | +60 lines |
| MODIFY | `src/nar/rules/processor.ts` | +15 (priority check in `processLMRules`) |
| MODIFY | `src/agent/CognitiveContext.ts` | +10 (`checkGoalSatisfaction()`) |
| MODIFY | `src/agent/tui/visual.ts` | +10 (`goals` in `StatusBarData`, `buildStatusBar`) |
| MODIFY | `src/agent/connections/index.ts` | +3 (`scheduler.markUserInput()`) |
| MODIFY | `src/nar/types/core.ts` | +1 (`priorityThreshold` in `NARConfig`) |
| MODIFY | `src/config/defaults.ts` | -2 lines, +2 lines (purge dead keys, add new) |
| **REMOVE** | `src/agent/BotContext.ts` | -8 lines (delete `BotConfig.pipeline`, `BotConfig.directives` etc.) |
| **REMOVE** | `src/agent/types.ts` | -8 lines (delete `BotConfig.pipeline`) |
| **REMOVE** | `src/agent/config.ts` | -7 lines (remove `pipeline` from `BotFullConfig` + defaults) |
| **REMOVE** | `src/bin/bot-ai.ts` | -5 lines (`pipeline` block) |
| **REMOVE** | `src/bin/demo-phase3.ts` | -1 line |
| **REMOVE** | `src/bin/phase3-test.ts` | -1 line |
| **REMOVE** | `src/agent/benchmarks/BenchmarkRunner.ts` | -1 line |
| **REMOVE** | `tests/agent/ai-agent.test.ts` | -12 lines (6 sites) |

**Total: 1 new file, 6 modifications (~99 added), 9 deletions (~45 removed), net ~+54 lines.**

## Key Differences from Prior Drafts

| AI2.md Approach | AI3.md (Redundancy-Eliminated) |
|---|---|
| `nar.scheduler?.markUserInput()` | `scheduler.markUserInput()` on agent-layer instance |
| `nar.fireLMRule()` method | Existing `processLMRules` with priority context |
| `LMRuleTrigger` class (duplicate CB) | Priority check in `canApply()` context |
| `GoalTask` type with metadata | `Task{type:'goal'}` + `CognitiveContextBuilder.checkGoalSatisfaction()` |
| `GoalTracker.ts` (new file) | Folded into `CognitiveContextBuilder` as a method |
| `GoalView.ts` (new file) | Folded into `StatusBarData` + `buildStatusBar()` |
| `SchedulerConfig` (separate interface) | Extended existing `agenticLoop` config |
| `phase5` config block | Extended `agenticLoop` (already exists in defaults) |
| Full-screen GoalView (`\x1b[2J`) | Single-line goal count in existing StatusBar |
| `Budget.time` field (doesn't exist) | `occurrenceTime` from existing Task |
| "Deleted pipeline stages" framing | Additive agent-layer building on existing arch |
| **3 new files** (Scheduler + Tracker + View) | **1 new file** (Scheduler) |

**Target**: 5 weeks
**Status**: Ready for implementation — Week 1 (CognitiveContext + StatusBar + config activation)
