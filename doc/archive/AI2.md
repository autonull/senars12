# Phase 5: Active Cognitive Reasoning

## Purpose & Philosophical Foundation

### The Neurosymbolic Imperative

**Why does this architecture exist?** To realize the untapped potential of neurosymbolic AI by combining the complementary strengths of neural and symbolic reasoning:

**NARS (Symbolic)** provides:
- Formal logical inference (deduction, induction, abduction)
- Explicit belief revision with truth tracking
- Attention-based resource allocation
- Goal-directed operational reasoning
- Transparent, auditable reasoning chains

**LM (Neural)** provides:
- Semantic understanding and contextual interpretation
- Pattern recognition across diverse inputs
- Natural language fluency and generation
- Knowledge bridging when symbolic gaps appear
- Flexible prompt-based reasoning strategies

**The Synergy**: Neither approach alone achieves general intelligence. Pure neural systems lack explicit reasoning and truth tracking. Pure symbolic systems lack semantic flexibility and contextual understanding. **Phase 5 creates the architecture where they enhance each other continuously.**

---

### Why This Complexity? The Case for Flexible Architecture

#### The Problem with Fixed Pipelines

Previous architectures (Phases 1-4) used fixed pipeline stages:
```
Input → Classifier → ReasoningTrigger → NARS → LM → Response
```

**Limitations**:
- **Rigid decision boundaries**: A concept is either "reasoning-worthy" or not, based on fixed thresholds
- **No learning from outcomes**: Cannot adapt triggering based on whether reasoning helped
- **Wasted computation**: Running full pipeline on simple queries
- **Missed opportunities**: Not triggering reasoning when it would have helped but heuristic failed

#### The Phase 5 Solution: Attention-Based Cognitive Scheduling

Instead of fixed pipelines, Phase 5 uses **dynamic, attention-driven scheduling**:
```
User Input → NARS Task Added → Attention Priority Rises → LM Rules Fire Conditionally → Reasoning Cycles Run Proportionally
```

**Benefits**:
- **Contextual sensitivity**: Reasoning triggers when concepts become salient, not just on keyword matches
- **Gradual engagement**: Low effort → high effort scaling based on task complexity
- **Continuous feedback**: LM rules fire based on belief state changes, not one-time classification
- **Optimizable**: Every parameter (thresholds, priorities, effort levels) can be tuned via RLFP

---

### The Flexibility Imperative: Why Hard-Coding Fails

#### 1. Prompt Composition Flexibility

**Problem**: Fixed prompts like "Classify this input" fail across diverse contexts:
- Technical query: "Is (cat --> animal) true?" → needs formal classification
- Casual chat: "what do you think about cats?" → needs conversational response
- Goal-setting: "understand why cats land on their feet" → needs reasoning activation

**Phase 5 Solution**: LM rules with **contextual prompts**:
```typescript
// Prompt adapts based on conversation history, user intent, attention state
const prompt = `
Context: {{attentionReport}}
Recent turns: {{conversationSummary}}
User intent: {{inferredIntent}}

Classify: {{input}}
Options: chat, reason, query, goal
Confidence: [0-1]
`;
```

**Why it matters**: The same input "is water wet?" could be:
- Casual chat (low-stakes opinion)
- Philosophical reasoning (requires formal analysis)
- Knowledge gap (user genuinely uncertain)

Only **contextual prompt composition** can distinguish these cases.

---

#### 2. LM Rule Triggering Flexibility

**Problem**: Fixed triggering rules fail in edge cases:
- `if input contains "why" → trigger reasoning` misses implicit reasoning needs
- `if confidence < 0.5 → ask clarification` interrupts flow unnecessarily
- `if contradiction detected → fire revision rule` may over-correct on noise

**Phase 5 Solution**: **Multi-factor triggering** with adjustable weights:
```typescript
const triggerScore = 
  (concept.priority * config.priorityWeight) +
  (contradiction.severity * config.contradictionWeight) +
  (userIntent.urgency * config.urgencyWeight) +
  (recentReasoning.success * config.recencyWeight);

if (triggerScore > adaptiveThreshold) {
  fireLMRule(rule);
}
```

**Why it matters**: 
- High-priority concepts automatically get more LM attention
- Contradictions in important domains trigger resolution, minor ones ignored
- User urgency (e.g., repeated questions) boosts triggering
- Recent success/failure adjusts future triggering sensitivity

---

#### 3. Parameter & Heuristic Flexibility

**Problem**: Fixed parameters optimize for average case, fail on edge cases:
- `satisfactionThreshold: 0.8` too high for exploratory reasoning
- `effortLevel: 0.3` wastes CPU on simple tasks, under-serves complex ones
- `priorityThreshold: 0.5` misses low-priority-but-important connections

**Phase 5 Solution**: **Configurable parameter spaces** with RLFP optimization targets:
```typescript
interface Phase5Config {
  scheduler: {
    effortLevel: number; // 0.0 to 1.0 - optimizable for task completion rate
    idleThresholdMs: number; // 1000 to 60000 - optimizable for user satisfaction
    maxReasoningCycles: number; // 1 to 100 - optimizable for CPU budget
  };
  goals: {
    satisfactionThreshold: number; // 0.0 to 1.0 - optimizable for accuracy vs speed
    maxBlockedCycles: number; // 1 to 50 - optimizable for persistence
  };
}
```

**Why it matters**:
- Different tasks need different parameters (exploration vs exploitation)
- RLFP can learn optimal parameters from outcomes
- Users can tune for their priorities (speed vs accuracy)
- System adapts to domain (math needs high precision, brainstorming needs low)

---

### The Architectural Justification: Why Not Simpler?

#### Tempting Simplifications (And Why They Fail)

**Simplification 1**: "Just run reasoning on every input"
- **Problem**: Wastes computation on trivial queries
- **Phase 5**: Attention-based triggering scales effort with need

**Simplification 2**: "Use fixed thresholds for everything"
- **Problem**: No adaptation to context or user needs
- **Phase 5**: All thresholds configurable and optimizable

**Simplification 3**: "Let LM decide when to use NARS"
- **Problem**: LM has no visibility into NARS attention state
- **Phase 5**: Bidirectional awareness: LM sees NARS state, NARS queries LM for gaps

**Simplification 4**: "Run autonomous reasoning continuously"
- **Problem**: Wastes CPU, may reason about irrelevant topics
- **Phase 5**: Proportional effort control, idle-triggered, priority-based scheduling

---

### The Ultimate Goal: Self-Improving Cognitive Architecture

Phase 5 is designed not as a fixed system, but as a **learning architecture**:

1. **Collect trajectories**: Every reasoning cycle, LM rule firing, goal satisfaction is logged
2. **Evaluate outcomes**: Did reasoning help? Was the LM rule useful? Was the goal achieved?
3. **Adjust parameters**: RLFP optimizes thresholds, weights, effort levels
4. **Refine prompts**: Successful prompt patterns reinforced, failures repaired
5. **Emergent behavior**: System learns when to reason, when to chat, when to ask

**The Vision**: A system that starts with human-tuned parameters and gradually learns optimal cognitive behavior through interaction.

---

## Executive Summary

**Goal**: Evolve SeNARS from reactive chatbot to autonomous cognitive agent with goal-directed reasoning, attention-priority scheduling, and contextual LM rule triggering.

**Core Innovation**: Replace fixed pipeline stages with flexible, optimizable LM rules and attention-based scheduling while preserving NARS-native task processing.

**Key Design Principles**:
1. **NARS-native goals**: Goals are `(statement)!` tasks with optional metadata extension
2. **Truth-based satisfaction**: Goal `(G)!` satisfied when belief `(G).` has `truth.f > threshold`
3. **Proportional effort control**: Controllable reasoning effort from idle to 100% CPU
4. **Attention-priority scheduling**: All tasks (goals, questions, beliefs) compete by priority
5. **Contextual LM triggering**: LM rules fire based on concept priority, not just user input
6. **Transparent visibility**: Active goals visible in TUI with non-spammy progress updates
7. **Connection-agnostic**: Works seamlessly across TUI (REPL), IRC, WebSocket, HTTP, and MCP modes
8. **Optimizable architecture**: All parameters tunable via RLFP for continuous improvement

---

## Architecture Overview
# Phase 5: Active Cognitive Reasoning

## Executive Summary

**Goal**: Evolve SeNARS from reactive chatbot to autonomous cognitive agent with goal-directed reasoning, attention-priority scheduling, and contextual LM rule triggering.

**Core Innovation**: Replace fixed pipeline stages with flexible, optimizable LM rules and attention-based scheduling while preserving NARS-native task processing.

**Key Design Principles**:
1. **NARS-native goals**: Goals are `(statement)!` tasks with optional metadata extension
2. **Truth-based satisfaction**: Goal `(G)!` satisfied when belief `(G).` has `truth.f > threshold`
3. **Proportional effort control**: Controllable reasoning effort from idle to 100% CPU
4. **Attention-priority scheduling**: All tasks (goals, questions, beliefs) compete by priority
5. **Contextual LM triggering**: LM rules fire based on concept priority, not just user input
6. **Transparent visibility**: Active goals visible in TUI with non-spammy progress updates
7. **Connection-agnostic**: Works seamlessly across TUI (REPL), IRC, WebSocket, HTTP, and MCP modes

---

## Architecture Overview

### From Pipeline to Cognitive Scheduling

#### Deleted Pipeline Stages → LM Rules + Attention

| Deleted Stage | Old Behavior | Phase 5 Replacement |
|--------------|--------------|---------------------|
| `InputClassifier` | Keyword/regex classification | **LM Rule**: `lm-intent-classification` fires on low-confidence input |
| `ReasoningTrigger` | Heuristic + LM signal scoring | **LM Rule**: `lm-reasoning-trigger` + attention priority |
| `NLAnalyzerStage` | Narsese parsing, intent detection | **Keep as pre-processor**, LM rules for ambiguous cases |
| `SeNARSProcessor` | Direct NARS integration | **AutonomousScheduler** with proportional effort |
| `CommandProcessor` | Slash command handling | Keep as direct command routing |
| `LMResponder` | Generate LM response | **AIAgent.chat()** with cognitive context |
| `ResponseComposer` | Format response | **ResponseFormatter** component |
| `StatePersistor` | Save conversation state | **ConversationState** (already migrated) |

#### Promoted LM Rules (Phase 5)

From deleted pipeline logic, these become **new LM rules**:

1. **`lm-intent-classification`** (from `InputClassifier`)
   - Fires when input classification confidence < 0.6
   - Prompt: "Classify intent: {{input}}. Options: chat, reason, query, goal, command"
   - Output: Intent type with confidence

2. **`lm-reasoning-trigger`** (from `ReasoningTrigger`)
   - Fires when concept priority > 0.7 OR contradiction detected
   - Prompt: "Should this input trigger formal reasoning? {{input}}. Context: {{attentionReport}}"
   - Output: Boolean + suggested reasoning steps

3. **`lm-contextual-clarification`** (from `NLAnalyzerStage.ambiguity`)
   - Fires when input ambiguity > threshold
   - Prompt: "What clarification is needed for: {{ambiguousInput}}?"
   - Output: Clarification question or interpretation

4. **`lm-knowledge-gap-detection`** (from `ReasoningTrigger.detectKnowledgeGap`)
   - Fires when input terms not in memory
   - Prompt: "What knowledge is missing to understand: {{input}}?"
   - Output: Missing belief statements

5. **`lm-contradiction-detection`** (from `ReasoningTrigger.detectContradiction`)
   - Fires when input contradicts existing beliefs
   - Prompt: "Does '{{input}}' contradict existing beliefs? {{beliefContext}}"
   - Output: Contradiction analysis + resolution suggestion

---

## Core Components

### 1. Goal Tasks (NARS-Native, No Metadata)

**Phase 5A Approach**: Use NARS-native goal tasks without metadata extension.

- Goals are `(statement)!` tasks with type `'goal'`
- Satisfaction: Check if belief `(G).` exists with `truth.f > 0.8`
- No sub-goals, no parent tracking, no progress bars (deferred to 5B)

```typescript
// Simplified goal handling for 5A
export function isGoalSatisfied(nar: NAR, goalTerm: string): boolean {
  const beliefs = nar.getBeliefs(goalTerm);
  return beliefs.some(b => b.truth.f > 0.8);
}

export function addGoalFeedback(nar: NAR, goalTerm: string): void {
  nar.input(`${goalTerm}. :1.0:0.9`);
}
```

---

### 2. Autonomous Scheduler (Agent Layer)

**File**: `src/agent/AutonomousScheduler.ts` (agent layer, not NAR core)

**Key Design Decisions**:
- Located in agent layer (opt-in for interactive modes)
- Activity-aware: tracks processing state, pending responses
- Priority-based LM rule triggering (no time cooldowns)
- Configurable via `senars.config.json`

```typescript
interface ActivityState {
  lastInputTime: number;
  isProcessing: boolean;
  pendingResponses: number;
}

export interface SchedulerConfig {
  effortLevel: number; // 0.0 to 1.0
  idleThresholdMs: number; // 1000 to 60000
  maxReasoningCycles: number; // 1 to 100
  priorityThreshold: number; // 0.0 to 1.0
}

export class AutonomousScheduler {
  private nar: NAR;
  private config: SchedulerConfig;
  private activity: ActivityState;

  constructor(nar: NAR, config: Partial<SchedulerConfig> = {}) {
    this.nar = nar;
    this.config = config;
    this.activity = {
      lastInputTime: Date.now(),
      isProcessing: false,
      pendingResponses: 0
    };
  }

  markUserInput(): void {
    this.activity.lastInputTime = Date.now();
  }

  private shouldRunCycle(): boolean {
    const idleTime = Date.now() - this.activity.lastInputTime;
    if (this.activity.isProcessing) return false;
    if (this.activity.pendingResponses > 0) return false;
    if (idleTime < this.config.idleThresholdMs!) return false;
    return true;
  }

  // ... rest of implementation with priority-based LM triggering
}
```

---

### 3. LM Rule Trigger System (Priority-Based)

**File**: `src/nar/lm/LMRuleTrigger.ts`

**Key Features**:
- Priority-based gating (replaces time cooldowns)
- Recursion depth limits (3 default, 5 for high priority)
- Circuit breaker after 5 consecutive failures
- Max fires per cycle based on priority

```typescript
interface TriggerState {
  lastFired: number;
  fireCount: number;
  failureCount: number;
}

export class LMRuleTrigger {
  private nar: NAR;
  private currentDepth = 0;
  private triggerState: Map<string, TriggerState> = new Map();

  private shouldFire(ruleId: string, concept: Concept): boolean {
    const state = this.getTriggerState(ruleId, concept);
    const now = Date.now();

    // Circuit breaker
    if (state.failureCount > 5) return false;

    // Priority gating (no arbitrary timers)
    if (concept.priority > 0.9) return true; // Always
    if (concept.priority > 0.8 && state.fireCount < 3) return true;
    if (concept.priority > 0.7 && state.fireCount === 0) return true;

    return false;
  }

  private async fireWithTracking(ruleId: string, concept: Concept): Promise<void> {
    try {
      this.currentDepth++;
      const maxDepth = concept.priority > 0.95 ? 5 : 3;
      if (this.currentDepth > maxDepth) return;

      await this.nar.fireLMRule(ruleId, { concept: concept.term.toString() });
    } finally {
      this.currentDepth--;
    }
  }
}
```

---

### 4. TUI Goal Display (Simplified for 5A)

**File**: `src/agent/tui/GoalView.ts`

**Phase 5A Features** (no metadata):
- Display goal term
- Show priority
- Show satisfaction status (✓/○)
- Show time active

```typescript
export class GoalView {
  private render(): void {
    const goals = this.nar.getGoals();
    const lines: string[] = [];

    if (goals.length > 0) {
      lines.push(`Active Goals (${goals.length}):`);
      for (const goal of goals.slice(0, 5)) {
        const satisfied = isGoalSatisfied(this.nar, goal.term.toString());
        const priority = goal.budget.priority;
        const activeTime = Date.now() - goal.budget.time;

        let line = ` ${goal.term.toString()}`;
        line += ` [${satisfied ? '✓' : '○'}]`;
        line += ` pri:${priority.toFixed(2)}`;
        line += ` ${this.formatTime(activeTime)}`;
        lines.push(line);
      }
    }

    const questions = this.nar.getQuestions();
    if (questions.length > 0) {
      lines.push(`Pending Questions (${questions.length}):`);
      for (const q of questions.slice(0, 5)) {
        lines.push(` ? ${q.term.toString()}`);
      }
    }

    process.stderr.write('\x1b[2J\x1b[H' + lines.join('\n') + '\n');
  }
}
```

---

### 5. TUI Goal Display

**File**: `src/agent/tui/GoalView.ts` (new)

```typescript
import type {GoalTask} from '../../nar/task/GoalTask';

export interface GoalViewConfig {
  showProgress: boolean;
  showSubGoals: boolean;
  updateIntervalMs: number;
  maxVisibleGoals: number;
  maxVisibleQuestions: number;
}

/**
 * Displays active goals and pending questions in TUI
 * Updates batched to avoid spam
 */
export class GoalView {
  private activeGoals: GoalTask[] = [];
  private pendingQuestions: string[] = [];
  private config: GoalViewConfig;
  private lastUpdate: number = 0;

  constructor(config: Partial<GoalViewConfig> = {}) {
    this.config = {
      showProgress: true,
      showSubGoals: true,
      updateIntervalMs: 1000,
      maxVisibleGoals: 5,
      maxVisibleQuestions: 5,
      ...config
    };
  }

  updateGoals(goals: GoalTask[]): void {
    this.activeGoals = goals;
    this.render();
  }

  updateQuestions(questions: string[]): void {
    this.pendingQuestions = questions;
    this.render();
  }

  private render(): void {
    // Rate limit updates
    const now = Date.now();
    if (now - this.lastUpdate < this.config.updateIntervalMs) return;
    this.lastUpdate = now;

    const lines: string[] = [];

    if (this.activeGoals.length > 0) {
      lines.push(`Active Goals (${this.activeGoals.length}):`);
      for (const goal of this.activeGoals.slice(0, this.config.maxVisibleGoals)) {
        const progress = this.calculateProgress(goal);
        const subGoals = goal.metadata?.subGoals?.length ?? 0;
        
        let line = `  ${goal.term.toString()}`;
        if (this.config.showProgress) {
          line += ` [${progress}%]`;
        }
        if (this.config.showSubGoals && subGoals > 0) {
          line += ` ← ${subGoals} sub-goals`;
        }
        lines.push(line);
      }
    }

    if (this.pendingQuestions.length > 0) {
      lines.push(`Pending Questions (${this.pendingQuestions.length}):`);
      for (const q of this.pendingQuestions.slice(0, this.config.maxVisibleQuestions)) {
        lines.push(`  ? ${q}`);
      }
    }

    // Output to TUI status bar
    process.stderr.write('\x1b[2J\x1b[H'); // Clear
    process.stderr.write(lines.join('\n') + '\n');
  }

  private calculateProgress(goal: GoalTask): number {
    // TODO: Implement based on sub-goal completion
    return 0;
  }
}
```

---

## Configuration (Phase 5A)

Configured in `senars.config.json`:

```json
{
  "phase5": {
    "scheduler": {
      "effortLevel": 0.3,
      "idleThresholdMs": 5000,
      "maxReasoningCycles": 10,
      "priorityThreshold": 0.7
    },
    "lmTriggers": {
      "priorityThreshold": 0.7,
      "highPriorityThreshold": 0.9,
      "maxDepth": 3,
      "maxDepthHighPriority": 5,
      "circuitBreakerFailures": 5
    }
  }
}
```

---

## Connection Integration (Phase 5A)

All connection adapters call `nar.scheduler?.markUserInput()` on user input:

```typescript
// CLI, IRC, WS, MCP - all use same pattern
export class CLIConnection {
  constructor(private nar: NAR) {}

  async handleMessage(input: string) {
    this.nar.scheduler?.markUserInput();
    await this.nar.input(input);
  }
}
```

**TUI**: GoalView displays active goals  
**IRC/WS/MCP**: Basic goal status (defer advanced commands to 5B)

---

## Implementation Plan (Phase 5A - Minimal)

### Week 1: Autonomous Scheduler
- [ ] Create `src/agent/AutonomousScheduler.ts` (agent layer, not NAR core)
- [ ] Implement activity-aware scheduling (tracks processing state, pending responses)
- [ ] Implement priority-based gating (no time cooldowns)
- [ ] Test idle detection and cycle execution

### Week 2: LM Rule Trigger System
- [ ] Create `src/nar/lm/LMRuleTrigger.ts`
- [ ] Implement priority-based concept filtering
- [ ] Implement recursion depth limits (3 default, 5 for high priority)
- [ ] Implement circuit breaker (5 consecutive failures)
- [ ] Test priority gating with mock concepts

### Week 3: LM Rules Implementation
- [ ] Implement `lm-reasoning-trigger` rule (priority-based triggering)
- [ ] Implement `lm-goal-decomposition` rule (basic decomposition)
- [ ] Test rules with priority gating
- [ ] Verify no infinite loops or explosions

### Week 4: TUI Goal Display
- [ ] Create `src/agent/tui/GoalView.ts` (simplified for 5A)
- [ ] Display: goal term, priority, satisfaction status, time active
- [ ] Integrate with TUI status bar
- [ ] Test rendering performance

### Week 5: Connection Adapter Integration
- [ ] Add `scheduler.markUserInput()` to CLI connection
- [ ] Add scheduler to AIAgent with config flag
- [ ] Wire activity tracking across all connections
- [ ] Test multi-connection scenarios

### Week 6: End-to-End Testing & Polish
- [ ] Unit tests (mocked time)
- [ ] Integration tests (real NAR + mock LM)
- [ ] E2E scenarios (real idle time)
- [ ] Performance tuning and bug fixes

---

## Success Metrics (Phase 5A)

1. **Scheduler Stability**: Runs 1hr+ without crashes
2. **Priority Gating**: High-priority concepts (>0.9) trigger LM rules, low-priority (<0.7) do not
3. **CPU Control**: `effortLevel` parameter correlates with reasoning cycle frequency (R² > 0.8)
4. **Goal Satisfaction Detection**: Correctly identifies when belief `(G).` with `truth.f > 0.8` exists for goal `(G)!`
5. **No Infinite Loops**: Recursion depth limits prevent runaway LM rule chains

---

**Status**: ⏳ Ready to Implement (Phase 5A - Minimal)
**Target**: 6 weeks
**Next**: Implement Week 1 (AutonomousScheduler)
