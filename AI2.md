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

### 1. Goal Task Metadata Extension

**File**: `src/nar/task/GoalTask.ts` (new)

```typescript
import type {Task} from '../types';
import type {Truth} from '../terms';

export interface GoalSatisfactionCondition {
  type: 'belief-exists';
  term: string; // Narsese term to check
  threshold: number; // truth.f must exceed this
}

export interface GoalMetadata {
  conversationId?: string;
  userIntent?: string;
  satisfactionCondition?: GoalSatisfactionCondition;
  parentGoalId?: string;
  subGoals?: string[]; // Goal task IDs
  createdAt: number;
  source: 'user' | 'autonomous' | 'lm-generated';
  priority?: number; // Override default priority
}

/**
 * Extend NARS goal task with metadata
 * Goal: (statement)! with attached GoalMetadata
 */
export interface GoalTask extends Task {
  metadata?: GoalMetadata;
}

/**
 * Check if goal is satisfied based on belief truth
 */
export function isGoalSatisfied(
  goal: GoalTask,
  getBelief: (term: string) => {truth: Truth} | undefined
): boolean {
  const condition = goal.metadata?.satisfactionCondition;
  if (!condition) {
    // Default: check if goal statement has belief with high truth.f
    const belief = getBelief(goal.term.toString());
    return belief ? belief.truth.f > 0.8 : false;
  }
  
  if (condition.type === 'belief-exists') {
    const belief = getBelief(condition.term);
    return belief ? belief.truth.f > condition.threshold : false;
  }
  
  return false;
}

/**
 * Add feedback belief when goal satisfied
 */
export function addGoalFeedback(
  goal: GoalTask,
  nar: NAR
): void {
  const feedbackTruth = {f: 1.0, c: 0.9};
  nar.input(`${goal.term.toString()}. :${feedbackTruth.f}:${feedbackTruth.c}`);
}
```

---

### 2. Autonomous Scheduler

**File**: `src/nar/orchestration/AutonomousScheduler.ts` (new)

```typescript
import type {NAR} from '../nar';
import type {Task} from '../types';
import type {LMClient} from '../lm';

export interface SchedulerConfig {
  effortLevel: number; // 0.0 to 1.0 (idle to 100% CPU)
  idleThresholdMs: number; // No input for X ms → start autonomous
  maxReasoningCycles: number;
  cpuThrottleMs: number; // Yield every X ms
  priorityThreshold: number; // Only process tasks above this priority
}

const DEFAULT_CONFIG: SchedulerConfig = {
  effortLevel: 0.3, // Start conservative
  idleThresholdMs: 5000,
  maxReasoningCycles: 10,
  cpuThrottleMs: 10,
  priorityThreshold: 0.5
};

export class AutonomousScheduler {
  private nar: NAR;
  private lmClient?: LMClient;
  private config: SchedulerConfig;
  private lastInputTime: number = Date.now();
  private isRunning: boolean = false;
  private stopSignal?: AbortController;

  constructor(nar: NAR, config: Partial<SchedulerConfig> = {}) {
    this.nar = nar;
    this.config = {...DEFAULT_CONFIG, ...config};
  }

  /**
   * Record user input timestamp (resets idle timer)
   */
  markUserInput(): void {
    this.lastInputTime = Date.now();
  }

  /**
   * Start autonomous reasoning loop
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.stopSignal = new AbortController();

    while (this.isRunning && !this.stopSignal.signal.aborted) {
      const idleTime = Date.now() - this.lastInputTime;
      
      if (idleTime >= this.config.idleThresholdMs) {
        await this.runReasoningCycle();
      }
      
      // Sleep based on effort level (inverse: high effort = short sleep)
      const sleepMs = (1 - this.config.effortLevel) * 1000;
      await new Promise(r => setTimeout(r, sleepMs));
    }
  }

  /**
   * Stop autonomous reasoning
   */
  stop(): void {
    this.isRunning = false;
    this.stopSignal?.abort();
  }

  /**
   * Run one reasoning cycle
   * Priority order:
   * 1. High-priority questions (priority > 0.8)
   * 2. Active goals (priority > 0.7)
   * 3. LM rule triggers (priority > 0.6)
   * 4. Proactive enrichment (priority < 0.5)
   */
  private async runReasoningCycle(): Promise<void> {
    const cycleStart = Date.now();
    let cyclesRun = 0;

    // Get tasks by priority
    const tasks = this.nar.getTasksByPriority(this.config.priorityThreshold);

    for (const task of tasks) {
      if (Date.now() - cycleStart > this.config.cpuThrottleMs) {
        await new Promise(r => setTimeout(r, 0)); // Yield
      }

      if (++cyclesRun >= this.config.maxReasoningCycles) break;

      // Process task based on type
      if (task.type === 'question') {
        await this.processQuestion(task);
      } else if (task.type === 'goal') {
        await this.processGoal(task);
      } else if (task.type === 'belief') {
        await this.processBelief(task);
      }
    }

    // Run LM rules for high-priority concepts
    await this.triggerLMRules();

    // Run proactive enrichment (low priority background task)
    await this.runProactiveEnrichment();
  }

  private async processQuestion(task: Task): Promise<void> {
    // Questions handled by attention priority
    // High-priority questions may trigger LM clarification
    if (task.budget.priority > 0.8) {
      // Fire lm-interactive-clarification rule
      await this.nar.fireLMRule('lm-interactive-clarification', {
        question: task.term.toString()
      });
    }
  }

  private async processGoal(task: Task): Promise<void> {
    // Check goal satisfaction
    const satisfied = this.isGoalSatisfied(task);
    if (satisfied) {
      // Add feedback belief
      this.addGoalFeedback(task);
    } else {
      // Fire lm-goal-decomposition if sub-goals needed
      await this.nar.fireLMRule('lm-goal-decomposition', {
        goal: task.term.toString()
      });
    }
  }

  private async processBelief(task: Task): Promise<void> {
    // Check for contradictions, low confidence, etc.
    await this.nar.fireLMRule('lm-belief-revision', {
      belief: task.term.toString()
    });
  }

  private async triggerLMRules(): Promise<void> {
    // Get high-priority concepts
    const concepts = this.nar.listConcepts()
      .filter(c => c.priority > this.config.priorityThreshold);

    for (const concept of concepts) {
      // Fire relevant LM rules based on concept state
      if (concept.links.length < 2) {
        await this.nar.fireLMRule('lm-concept-elaboration', {
          concept: concept.term.toString()
        });
      }

      if (concept.beliefBag.size() > 0) {
        const topBelief = concept.beliefBag.peek();
        if (topBelief.truth.c < 0.5) {
          await this.nar.fireLMRule('lm-uncertainty-calibration', {
            belief: concept.term.toString()
          });
        }
      }
    }
  }

  private async runProactiveEnrichment(): Promise<void> {
    // Existing ProactiveEnricher logic
    // Run as low-priority background task
    const enricher = this.nar.getEnricher();
    if (enricher) {
      await enricher.runEnrichmentCycle();
    }
  }

  private isGoalSatisfied(task: Task): boolean {
    // Check if belief exists with high truth.f
    const beliefs = this.nar.getBeliefs(task.term);
    return beliefs.some(b => b.truth.f > 0.8);
  }

  private addGoalFeedback(task: Task): void {
    // Add feedback belief
    this.nar.input(`${task.term.toString()}. :1.0:0.9`);
  }
}
```

---

### 3. LM Rule Trigger System

**File**: `src/nar/lm/LMRuleTrigger.ts` (new)

```typescript
import type {NAR} from '../nar';
import type {LMRule} from './LMRule';
import type {Concept} from '../memory';

export interface LMRuleTriggerConfig {
  priorityThreshold: number;
  contradictionThreshold: number;
  underconnectedThreshold: number;
  lowConfidenceThreshold: number;
}

const DEFAULT_TRIGGER_CONFIG: LMRuleTriggerConfig = {
  priorityThreshold: 0.7,
  contradictionThreshold: 0.3,
  underconnectedThreshold: 2,
  lowConfidenceThreshold: 0.5
};

export class LMRuleTrigger {
  private nar: NAR;
  private config: LMRuleTriggerConfig;

  constructor(nar: NAR, config: Partial<LMRuleTriggerConfig> = {}) {
    this.nar = nar;
    this.config = {...DEFAULT_TRIGGER_CONFIG, ...config};
  }

  /**
   * Check all concepts for LM rule triggers
   * Called by AutonomousScheduler during reasoning cycle
   */
  async checkTriggers(): Promise<void> {
    const concepts = this.nar.listConcepts();

    for (const concept of concepts) {
      await this.triggerRulesForConcept(concept);
    }
  }

  /**
   * Trigger LM rules for a single concept
   */
  private async triggerRulesForConcept(concept: Concept): Promise<void> {
    const rules: string[] = [];

    // High priority concept → fire relevant rules
    if (concept.priority > this.config.priorityThreshold) {
      rules.push('lm-concept-elaboration');
    }

    // Low confidence belief → fire uncertainty calibration
    const topBelief = concept.beliefBag.peek();
    if (topBelief && topBelief.truth.c < this.config.lowConfidenceThreshold) {
      rules.push('lm-uncertainty-calibration');
    }

    // Underconnected concept → fire elaboration
    if (concept.links.length < this.config.underconnectedThreshold) {
      rules.push('lm-concept-elaboration');
    }

    // Contradiction detected → fire belief revision
    if (this.hasContradiction(concept)) {
      rules.push('lm-belief-revision');
    }

    // Execute triggered rules
    for (const ruleId of rules) {
      await this.nar.fireLMRule(ruleId, {
        concept: concept.term.toString(),
        belief: concept.term.toString()
      });
    }
  }

  /**
   * Check if concept has contradictory beliefs
   */
  private hasContradiction(concept: Concept): boolean {
    const beliefs = Array.from(concept.beliefBag);
    if (beliefs.length < 2) return false;

    // Check for conflicting truth values
    const highTruth = beliefs.some(b => b.truth.f > 0.7);
    const lowTruth = beliefs.some(b => b.truth.f < 0.3);

    return highTruth && lowTruth;
  }
}
```

---

### 4. Goal Satisfaction Monitor

**File**: `src/nar/task/GoalMonitor.ts` (new)

```typescript
import type {NAR} from '../nar';
import type {GoalTask} from './GoalTask';
import {EventEmitter} from 'events';

export interface GoalMonitorEvents {
  'goal:satisfied': (goal: GoalTask) => void;
  'goal:blocked': (goal: GoalTask, reason: string) => void;
  'goal:abandoned': (goal: GoalTask, reason: string) => void;
  'goal:progress': (goal: GoalTask, progress: number) => void;
}

export class GoalMonitor extends EventEmitter {
  private nar: NAR;
  private activeGoals: Map<string, GoalTask> = new Map();
  private progressTrackers: Map<string, number> = new Map();

  constructor(nar: NAR) {
    super();
    this.nar = nar;
  }

  /**
   * Track a goal task
   */
  track(goal: GoalTask): void {
    this.activeGoals.set(goal.term.toString(), goal);
    this.progressTrackers.set(goal.term.toString(), 0);
  }

  /**
   * Check satisfaction for all active goals
   */
  checkAllGoals(): void {
    for (const [term, goal] of this.activeGoals) {
      const satisfied = this.isSatisfied(goal);
      
      if (satisfied) {
        this.emit('goal:satisfied', goal);
        this.activeGoals.delete(term);
      } else {
        // Check if blocked
        if (this.isBlocked(goal)) {
          this.emit('goal:blocked', goal, 'no progress after multiple cycles');
        }
      }
    }
  }

  /**
   * Check if single goal is satisfied
   */
  private isSatisfied(goal: GoalTask): boolean {
    const beliefs = this.nar.getBeliefs(goal.term);
    return beliefs.some(b => b.truth.f > 0.8);
  }

  /**
   * Check if goal is blocked (no progress)
   */
  private isBlocked(goal: GoalTask): boolean {
    const progress = this.progressTrackers.get(goal.term.toString()) ?? 0;
    return progress > 10; // Blocked after 10 cycles without progress
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
}

export class GoalView {
  private activeGoals: GoalTask[] = [];
  private pendingQuestions: string[] = [];
  private config: GoalViewConfig;

  constructor(config: Partial<GoalViewConfig> = {}) {
    this.config = {
      showProgress: true,
      showSubGoals: true,
      updateIntervalMs: 1000, // Batch updates
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
    // Render to TUI status bar
    const lines: string[] = [];

    // Active goals section
    if (this.activeGoals.length > 0) {
      lines.push(`Active Goals (${this.activeGoals.length}):`);
      for (const goal of this.activeGoals.slice(0, 5)) {
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

    // Pending questions section
    if (this.pendingQuestions.length > 0) {
      lines.push(`Pending Questions (${this.pendingQuestions.length}):`);
      for (const q of this.pendingQuestions.slice(0, 5)) {
        lines.push(`  ? ${q}`);
      }
    }

    // Output to TUI
    console.log(lines.join('\n'));
  }

  private calculateProgress(goal: GoalTask): number {
    // TODO: Implement progress calculation
    return 0;
  }
}
```

---

## Configuration Space

### Searchable/Optimizable Parameters

```typescript
interface Phase5Config {
  // Autonomous Scheduler
  scheduler: {
    effortLevel: number; // 0.0 to 1.0
    idleThresholdMs: number; // 1000 to 60000
    maxReasoningCycles: number; // 1 to 100
    cpuThrottleMs: number; // 1 to 100
    priorityThreshold: number; // 0.0 to 1.0
  };

  // LM Rule Triggers
  lmTriggers: {
    priorityThreshold: number; // 0.0 to 1.0
    contradictionThreshold: number; // 0.0 to 1.0
    underconnectedThreshold: number; // 1 to 10
    lowConfidenceThreshold: number; // 0.0 to 1.0
  };

  // Goal Satisfaction
  goals: {
    satisfactionThreshold: number; // 0.0 to 1.0 (truth.f)
    maxBlockedCycles: number; // 1 to 50
    feedbackTruthF: number; // 0.0 to 1.0
    feedbackTruthC: number; // 0.0 to 1.0
  };

  // TUI Updates
  ui: {
    updateIntervalMs: number; // 100 to 10000
    maxVisibleGoals: number; // 1 to 20
    maxVisibleQuestions: number; // 1 to 20
  };
}
```

### RLFP Optimization Targets (Future)

The following parameters are designed for RLFP training:

1. **Scheduler effort level** → Optimize for task completion rate
2. **Priority thresholds** → Optimize for user satisfaction
3. **LM rule firing frequency** → Optimize for reasoning quality
4. **Goal satisfaction threshold** → Optimize for accuracy vs speed tradeoff

---

## Implementation Plan

### Week 1-2: Goal Task Foundation

**Tasks**:
- [ ] Create `src/nar/task/GoalTask.ts` with metadata extension
- [ ] Implement goal satisfaction checking logic
- [ ] Add goal creation tools to `src/agent/tools/nars-tools.ts`
- [ ] Wire goal tracking to `AIAgent.chat()`
- [ ] Test: User sets goal → tracked → satisfied → feedback added

**Files to Create**:
- `src/nar/task/GoalTask.ts`
- `src/nar/task/GoalMonitor.ts`

**Files to Modify**:
- `src/agent/tools/nars-tools.ts` (add goal tools)
- `src/agent/AIAgent.ts` (wire goal tracking)

---

### Week 3-4: Autonomous Scheduler

**Tasks**:
- [ ] Create `src/nar/orchestration/AutonomousScheduler.ts`
- [ ] Implement proportional effort control (idle → 100% CPU)
- [ ] Wire to attention system (get tasks by priority)
- [ ] Integrate with existing `ProactiveEnricher`
- [ ] Test: Scheduler runs at configured effort level

**Files to Create**:
- `src/nar/orchestration/AutonomousScheduler.ts`

**Files to Modify**:
- `src/nar/nar.ts` (add scheduler integration)
- `src/agent/config.ts` (add scheduler config)

---

### Week 5-6: LM Rule Triggering

**Tasks**:
- [ ] Create `src/nar/lm/LMRuleTrigger.ts`
- [ ] Implement triggers for all 13 existing LM rules
- [ ] Wire to attention priority system
- [ ] Test: LM rules fire based on concept state, not just user input

**Files to Create**:
- `src/nar/lm/LMRuleTrigger.ts`
- `src/nar/lm/rules/lm-intent-classification.ts` (new rule)
- `src/nar/lm/rules/lm-reasoning-trigger.ts` (new rule)
- `src/nar/lm/rules/lm-contextual-clarification.ts` (new rule)

**Files to Modify**:
- `src/nar/lm/rules.ts` (add new rules)

---

### Week 7-8: Visibility & Polish

**Tasks**:
- [ ] Create `src/agent/tui/GoalView.ts`
- [ ] Implement goal progress display
- [ ] Add non-spammy update batching
- [ ] Test: Goals visible in TUI, updates batched
- [ ] Run end-to-end scenarios

**Files to Create**:
- `src/agent/tui/GoalView.ts`

**Files to Modify**:
- `src/agent/tui/StatusBar.ts` (add goal view)
- `src/bin/bot-ai.ts` (wire goal view)

---

## Success Metrics

1. **Goal Achievement Rate**: % of goals satisfied vs abandoned (>70% target)
2. **Autonomous Progress**: Reasoning cycles completed without user input
3. **LM Rule Coverage**: % of deleted pipeline functionality replaced by LM rules (>80% target)
4. **Cognitive Depth**: Average goal tree depth achieved (target: 3-5 levels)
5. **User Satisfaction**: Qualitative assessment of reasoning quality
6. **Effort Control**: Scheduler effort level correlates with CPU usage (R² > 0.8)

---

## Migration from Pipeline

### Old Pattern (Deleted):
```typescript
// Pipeline stage: InputClassifier
const classification = classify(input);
if (classification.primary === 'reason') {
  // Pipeline stage: ReasoningTrigger
  const trigger = reasoningTrigger.shouldTrigger(ctx);
  if (trigger.activate) {
    await nar.run(trigger.suggestedSteps);
  }
}
```

### New Pattern (Phase 5):
```typescript
// AIAgent.chat() with autonomous scheduling
const agent = new AIAgent({...});
const context = {sender: 'user', connectionType: 'cli'};

// User input processed with cognitive context
const response = await agent.chat(input, context);

// Autonomous scheduler runs in background
scheduler.start(); // Runs reasoning cycles based on effort level
```

---

## Testing Strategy

### Unit Tests
- Goal satisfaction checking
- LM rule triggering conditions
- Scheduler effort control
- Goal monitor events

### Integration Tests
- End-to-end goal setting → reasoning → satisfaction
- LM rule firing during autonomous cycles
- TUI goal display updates
- Scheduler proportional effort (idle → 100% CPU)

### Scenario Tests
1. **Syllogism Chain**: Set goal → derive conclusion → satisfy
2. **Knowledge Gap**: Unknown term → LM clarification → belief added
3. **Multi-turn Goal**: Complex goal → sub-goals → synthesis
4. **Contradiction**: Inject conflict → detect → resolve
5. **Background Reasoning**: Set goal → wait 30s → verify progress

---

## References

- **AI.md**: Phases 1-4 completion status
- **PHASE4_COMPLETE.md**: Deprecation of legacy pipeline
- **src/nar/lm/rules.ts**: Existing LM rules (13 total)
- **src/nar/lm/feedback.ts**: Bidirectional feedback loop
- **src/nar/lm/enrichment.ts**: Proactive enrichment
- **src/nar/orchestration.ts**: Existing orchestration patterns

---

**Status**: ⏳ Ready to Implement
**Target Completion**: Phase 5 (8 weeks)
**Next Phase**: Production Readiness & Optimization (Phase 6)
