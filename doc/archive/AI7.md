# AI7.md: Unified Pluggable Cognitive Architecture

## Vision

SeNARS becomes a **fully modular cognitive architecture** where every component of the reasoning pipeline is independently swappable, composable, optimizable, and observable — without altering the inference engine. The system ships with production-ready defaults but exposes every decision point for research, tuning, and evolution.

## Current State

### Control/Data Flow (as implemented)

```
Input → NAR.input() → NARIO → TaskManager → Memory

NARExecution.run() — per cycle:
  1. taskManager.processPending()
  2. reasoner.step():
     a. memory.sample(100)                          ← hardcoded
     b. for each concept:
        - createBeliefTask
        - strategy.selectSecondary(task, memory)    ← pluggable (Strategy)
        - if secondaries:
            fireSyncRules(p1,p2)
            fireLMRules(p1,p2)                      ← all 13, no selection
        - if none && singlePremiseEnabled:
            fireLMRules(p1)                         ← all 13, no selection
     c. collect derived tasks
  3. memory.addTask() for each derived
  4. memory.consolidate()
```

### What Exists

| Component | Status | Location |
|---|---|---|
| **Strategy** (premise selection) | 11+ implementations, injected into InferenceController | `src/nar/reason/strategy.ts`, `strategies/` |
| **PremiseSelector** | Dead code, parallel to Strategy | `src/nar/reason/premise/formation.ts` |
| **InferenceController** | Takes Strategy injection, outer loop hardcoded | `src/nar/reason/inference-controller.ts` |
| **RuleProcessor** | LM rules iterate all 13 every time | `src/nar/rules/processor.ts` |
| **CognitiveParameters** | 4 sub-configs, PARAMETER_SPACE partial | `src/nar/config/cognitive-parameters.ts` |
| **Focus class** | Priority boosts, topic relevance, goal tracking | `src/nar/memory/focus.ts` |
| **MetricsCollector** | Rule/LM/memory/throughput stats | `src/nar/metrics/` |
| **SeNARSFactory + Container** | Factory methods + DI/lifecycle | `src/nar/factory.ts`, `lifecycle/` |
| **RLFPLearner** | Reinforcement learning for preference optimization | `src/nar/rlfp/` |
| **NARExecution** | Cycle orchestration | `src/nar/nar-execution.ts` |
| **NAR class** | System entry point, extends BaseComponent | `src/nar/nar.ts` |

### Gaps

| # | Gap | Impact |
|---|---|---|
| G1 | `memory.sample(100)` hardcoded | Cannot bias sampling by goal, novelty, diversity |
| G2 | `LMConfig.selectionStrategy` set but never read | All 13 LM rules fire every cycle, unbounded cost |
| G3 | Strategy / PremiseSelector duality | Dead code, confusion |
| G4 | Derivation loop hardcoded in InferenceController | Cannot vary pair processing |
| G5 | No LMRuleSelector interface | LM selection not extensible |
| G6 | Attention spread across Focus + Memory + CognitiveParameters | Cannot swap attention models |
| G7 | No strategy registry | No discovery, no runtime swap |
| G8 | No runtime adaptation | System cannot self-tune |
| G9 | No optimization harness | Manual tuning only |
| G10 | RLFPLearner unused for strategy selection | Missed learning opportunity |

---

## Rearchitected Architecture

### 5 Pluggable Components

```
Layer 1: Memory + Focus
  - AttentionModel     ← priority priming, decay, spreading activation

Layer 2: Inference Pipeline
  - SamplingStrategy   ← which concepts enter the inference loop
  - Strategy           ← premise/secondary selection (existing, 11+ impls)
  - DerivationStrategy ← how premise pairs are iterated and derived
  - LMRuleSelector     ← which LM rules fire per pair
```

### Revised Control Flow (after all phases)

```
NARExecution.run() — per cycle:
  1. taskManager.processPending()
  2. inferenceController.step():
     a. concepts = samplingStrategy.sample(memory, 100)
     b. for each concept:
        - boost = memory.attentionModel.prime(concept, ctx)
        - concept.priority = min(1, concept.priority + boost)
        - task = createBeliefTask(concept)
        - secondaries = strategy.selectSecondary(task, memory)
        - derivationStrategy.derive(task, secondaries, processor, ctx)
            ├─ if secondaries.length > 0:
            │     for each secondary:
            │       processor.processSync(p1, p2)
            │       lmRules = processor.lmSelector.select(allRules, ctx)
            │       processor.fireLMRules(lmRules, p1, p2)
            └─ else if ctx.singlePremiseEnabled:
                  lmRules = processor.lmSelector.select(allRules, ctx)
                  processor.fireLMRules(lmRules, p1)
     c. collect derived tasks
  3. memory.addTask() for each derived
  4. memory.consolidate(cycleCount)  ← attentionModel.tick called
```

**Key changes**:
- SamplingStrategy replaces `memory.sample(100)` — concept draw is pluggable
- AttentionModel lives on Memory, called by Memory operations + InferenceController
- DerivationStrategy owns both dual-premise and single-premise paths
- LMRuleSelector is an injected interface
- `prime()` and `decay()` return **deltas** — caller applies them

---

## Interface Definitions

All in `src/nar/cognitive/types.ts`.

```typescript
// ── Shared ───────────────────────────────────
export interface ComponentMetadata {
  readonly name: string;
  readonly description: string;
  readonly version?: string;
}

export type StrategyType = 'sampling' | 'premise' | 'derivation' | 'lm-rule' | 'attention';

// ── 1. SamplingStrategy ──────────────────────
export interface SamplingStrategy {
  readonly metadata: ComponentMetadata;
  sample(memory: Memory, count: number): Concept[];
}

// ── 2. Strategy (Premise Selection) ───────────
// metadata is OPTIONAL for backward compat with existing implementations.
// New code should always provide it.
export interface Strategy {
  readonly metadata?: ComponentMetadata;
  readonly name: string;
  readonly sampleSize?: number;
  readonly limit?: number;
  selectSecondary(task: Task, memory: Memory): Task[];
}

// ── 3. DerivationStrategy ─────────────────────
// Controls derivation for a single primary task.
// Receives pre-selected secondaries from Strategy.
// MUST handle both dual-premise and single-premise paths.
export interface DerivationContext {
  maxDerivations: number;
  maxDepth: number;
  qualityThreshold: number;
  cpuThrottleMs: number;
  singlePremiseEnabled: boolean;
  signal?: AbortSignal;
}

export interface DerivationStrategy {
  readonly metadata: ComponentMetadata;
  derive(
    primary: Task,
    secondaries: Task[],
    processor: RuleProcessor,
    context: DerivationContext
  ): AsyncGenerator<Task>;
}

// ── 4. LMRuleSelector ─────────────────────────
export interface LMRuleSelectionContext {
  maxRules: number;
  rotationIndex?: number;
  priorityThreshold?: number;
  conceptPriority: number;
  premiseCount: 1 | 2;
}

export interface LMRuleSelector {
  readonly metadata: ComponentMetadata;
  select(rules: LMRule[], context: LMRuleSelectionContext): LMRule[];
}

// ── 5. AttentionModel ─────────────────────────
// prime() and decay() return DELTAs — caller applies them.
export interface AttentionContext {
  concept: Concept;
  task?: Task;
  cycleCount: number;
  memory: Memory;
}

export interface AttentionModel {
  readonly metadata: ComponentMetadata;
  prime(concept: Concept, context: AttentionContext): number;
  decay(concept: Concept, cyclesElapsed: number, baseDecayRate: number): number;
  tick(memory: Memory, cycleCount: number): void;
}

// ── MetricsSummary ────────────────────────────
export interface MetricsSummary {
  rules: Array<{ id: string; executions: number; successes: number; failures: number; averageDuration: number }>;
  memory: { conceptCount: number; utilization: number } | null;
  lm: { totalCalls: number; averageLatency: number; failedCalls: number } | null;
  throughput: { derivationsPerSecond: number; averageStepDuration: number } | null;
  system: { totalDerivations: number; totalSteps: number; uptime: number };
}

// ── Search Space ──────────────────────────────
export interface SearchSpaceParam {
  type: 'float' | 'int' | 'categorical' | 'boolean';
  min?: number;
  max?: number;
  values?: unknown[];
  log?: boolean;
}

export interface SearchSpace {
  parameters: Record<string, SearchSpaceParam>;
}

// ── StrategyRegistry ──────────────────────────
export interface StrategyRegistry {
  register(type: StrategyType, name: string, impl: SamplingStrategy | Strategy | DerivationStrategy | LMRuleSelector | AttentionModel): void;
  get<T>(type: StrategyType, name: string): T;
  list(type: StrategyType): ComponentMetadata[];
  has(type: StrategyType, name: string): boolean;
  unregister(type: StrategyType, name: string): boolean;
  clear(type?: StrategyType): void;
  composePremise(strategies: Array<{ name: string; weight: number }>): Strategy;
  createAdaptive(strategies: string[]): Strategy;
}
```

### Type safety for `register()`

`register()` uses 5 overloads — one per StrategyType:

```typescript
register(type: 'sampling', name: string, impl: SamplingStrategy): void;
register(type: 'premise', name: string, impl: Strategy): void;
register(type: 'derivation', name: string, impl: DerivationStrategy): void;
register(type: 'lm-rule', name: string, impl: LMRuleSelector): void;
register(type: 'attention', name: string, impl: AttentionModel): void;
```

Internal storage uses `Map<string, unknown>` with casts. The public API is fully typed; the implementation uses `any` internally. This is an accepted tradeoff.

---

## Extended CognitiveParameters

```typescript
export interface CognitiveParameters {
  priority: PriorityConfig;
  lm: LMConfig;               // @deprecated LMConfig.selectionStrategy — use strategies.lmRule
  attention: AttentionConfig;
  inference: InferenceConfig;

  strategies: {
    sampling:   { type: string; config?: Record<string, unknown> };
    premise:    { type: string; config?: Record<string, unknown> };
    derivation: { type: string; config?: Record<string, unknown> };
    lmRule:     { type: string; maxRules: number; config?: Record<string, unknown> };
    attention:  { type: string; config?: Record<string, unknown> };
  };
}

// LMConfig updated:
export interface LMConfig {
  // ... existing fields ...
  // @deprecated Use strategies.lmRule.type instead. Removed in next major.
  selectionStrategy?: 'all' | 'priority' | 'rotation' | 'diverse';
}
```

### Default Configuration

```typescript
export const DEFAULT_COGNITIVE_PARAMETERS: CognitiveParameters = {
  priority: { /* existing defaults */ },
  lm: { /* existing defaults, selectionStrategy: undefined */ },
  attention: { /* existing defaults */ },
  inference: { /* existing defaults */ },
  strategies: {
    sampling:   { type: 'priority' },
    premise:    { type: 'default-formation' },
    derivation: { type: 'default' },
    lmRule:     { type: 'priority', maxRules: 5 },
    attention:  { type: 'simple' }
  }
};
```

**`lmRule: 'priority'` is intentional.** Firing all 13 LM rules per premise pair is expensive. Priority selector picks the top-5 highest-priority rules. Revert with `{ type: 'all', maxRules: 13 }`.

### Deprecation Mechanism

During `validateParameters()`, if `LMConfig.selectionStrategy` is set:
```
selectionStrategy in LMConfig is deprecated. Use strategies.lmRule.type instead.
```
If both are explicitly set to conflicting values, `strategies.lmRule.type` wins.

---

## Implementation Phases

### Phase 0: Baseline Corrections (immediate, no new abstractions)

#### 0.1 Wire LM Selection in Processor (minimal fix)

Add an inline selection filter to `RuleProcessor`. This is a **temporary fix** — Phase 1.6 replaces it with the full `LMRuleSelector` interface.

```typescript
// processor.ts
type LMRuleSelectorStrategy = 'all' | 'priority' | 'rotation' | 'diverse';

private lmSelectionStrategy: LMRuleSelectorStrategy = 'all';
private maxLMRulesPerStep = 13;
private rotationIndex = 0;

setLMSelection(config: { strategy: LMRuleSelectorStrategy; maxRules: number }): void {
  this.lmSelectionStrategy = config.strategy;
  this.maxLMRulesPerStep = config.maxRules;
}

private getSelectedLMRules(ctx: { conceptPriority: number; premiseCount: 1 | 2 }): LMRule[] {
  const { strategy, maxRules, rotationIndex } = this;
  switch (strategy) {
    case 'all':
      return [...this.lmRules];
    case 'priority':
      return [...this.lmRules].sort((a, b) => b.priority - a.priority).slice(0, maxRules);
    case 'rotation': {
      const r: LMRule[] = [];
      for (let i = 0; i < maxRules && r.length < this.lmRules.length; i++)
        r.push(this.lmRules[(rotationIndex + i) % this.lmRules.length]);
      this.rotationIndex = (this.rotationIndex + 1) % this.lmRules.length;
      return r;
    }
    case 'diverse': {
      const byCat = new Map<string, LMRule[]>();
      for (const r of this.lmRules) {
        const cat = (r as any).category ?? 'general';
        if (!byCat.has(cat)) byCat.set(cat, []);
        byCat.get(cat)!.push(r);
      }
      const perCat = Math.max(1, Math.floor(maxRules / byCat.size));
      return [...byCat.values()]
        .flatMap(cat => cat.sort((a, b) => b.priority - a.priority).slice(0, perCat))
        .slice(0, maxRules);
    }
  }
}
```

Replace `for (const lmRule of this.lmRules)` in both `processLMRules()` and `processLMRulesSinglePremise()` with:

```typescript
const selectedRules = this.getSelectedLMRules({
  conceptPriority: maxPriority,
  premiseCount: p2 ? 2 : 1
});
for (const lmRule of selectedRules) { ... }
```

~40 lines. Immediate LM cost control. Will be refactored in Phase 1.6.

#### 0.2 Deprecate Strategy / PremiseSelector Duality

Add `@deprecated` tags to `PremiseSelector`, `PremiseConfig`, `TermMatchingSelector`, `DecompositionSelector`, `AnalogySelector` in `formation.ts`. Preserve `samplePremises()` — it powers `createStrategy()`.

#### 0.3 Add optional metadata to Strategy interface + implementations

Add `metadata?: ComponentMetadata` to the existing `Strategy` interface in `strategy.ts`:

```typescript
export interface Strategy {
  readonly metadata?: ComponentMetadata;  // OPTIONAL — backward compatible
  readonly name: string;
  readonly sampleSize?: number;
  readonly limit?: number;
  selectSecondary(task: Task, memory: Memory): Task[];
}
```

Then add metadata to each implementation (object-literal and class-based):

```typescript
// Object-literal strategies
export const BagStrategy: Strategy = {
  metadata: { name: 'bag', description: 'Sample 10 concepts, filter by shared atoms and derivation history' },
  name: 'bag',
  selectSecondary: (task, memory) => { ... }
};

// Class-based strategies
class CompositeStrategy implements Strategy {
  readonly metadata = { name: 'composite', description: 'Combine multiple strategies with weights' };
  ...
}
```

Because `metadata` is optional, existing tests that construct Strategy objects without it continue to compile.

#### 0.4 Update Focus to delegate to AttentionModel

`Focus.adjustPriority()` (`focus.ts:73-94`) has hardcoded attention logic (topic boosts, goal relevance, recency). Update Focus to accept an optional `AttentionModel` and delegate priority adjustments:

```typescript
export class Focus {
  constructor(
    config: FocusConfig,
    private readonly attentionModel?: AttentionModel  // optional
  ) {}

  adjustPriority(concept: Concept, basePriority: number): number {
    let p = basePriority;

    // Delegate to attention model if available
    if (this.attentionModel) {
      const decay = this.attentionModel.decay(concept, 1, 0.01);
      p -= decay;
    }

    // Existing topic boost logic (unchanged)
    for (const [topic, boost] of this.topicBoosts) {
      if (concept.term.toString().toLowerCase().includes(topic)) {
        p *= boost.factor;
        boost.ttl--;
      }
    }
    // ... goal relevance, recency ...
    return Math.min(p, 1.0);
  }
}
```

This preserves existing behavior while enabling the pluggable model. Focus continues to work without an AttentionModel — it just uses its existing hardcoded logic.

---

### Phase 1: Interfaces + Built-in Implementations

#### 1.1 Create `src/nar/cognitive/` directory

Files:
- `types.ts` — All 5 interfaces + ComponentMetadata + StrategyRegistry + all context types + MetricsSummary + SearchSpace types
- `lm-selectors.ts` — AllSelector, PrioritySelector, RotationSelector, DiverseSelector
- `sampling-strategies.ts` — PrioritySampling, TopNSampling, AboveThresholdSampling, NoveltySampling, GoalBiasedSampling, DiverseSampling
- `derivation-strategies.ts` — DefaultDerivation, AnytimeDerivation, FocusedDerivation, SampledDerivation
- `attention-models.ts` — SimpleAttention, SpreadingActivation, GoalRelevanceAttention, CompositeAttention
- `registry.ts` — CognitiveRegistry (depends on classes above)
- `controller.ts` — CognitiveController
- `optimizer.ts` — Optimization framework (Phase 4)
- `index.ts` — Re-exports

#### 1.2 SamplingStrategy implementations

```typescript
// sampling-strategies.ts

// 'priority' — current default: memory.sample(count)
export class PrioritySampling implements SamplingStrategy {
  readonly metadata = { name: 'priority', description: 'Priority-weighted sampling (current default)' };
  sample(memory: Memory, count: number): Concept[] {
    return memory.sample(count);  // delegates to existing method
  }
}

// 'top-n' — sort all concepts by priority, take top N
export class TopNSampling implements SamplingStrategy {
  readonly metadata = { name: 'top-n', description: 'Take the N highest-priority concepts' };
  sample(memory: Memory, count: number): Concept[] {
    return memory.listConcepts()
      .sort((a, b) => b.priority - a.priority)
      .slice(0, count);
  }
}

// 'above-threshold' — all concepts above priority threshold
export class AboveThresholdSampling implements SamplingStrategy {
  readonly metadata = { name: 'above-threshold', description: 'All concepts above dynamic threshold' };
  private threshold = 0.3;
  sample(memory: Memory, count: number): Concept[] {
    return memory.listConcepts()
      .filter(c => c.priority >= this.threshold)
      .slice(0, count);
  }
}

// 'novelty' — least-recently-accessed first
export class NoveltySampling implements SamplingStrategy {
  readonly metadata = { name: 'novelty', description: 'Bias toward least-recently-accessed concepts' };
  sample(memory: Memory, count: number): Concept[] {
    return memory.listConcepts()
      .sort((a, b) => (a.lastAccessedAt ?? 0) - (b.lastAccessedAt ?? 0))
      .slice(0, count);
  }
}

// 'goal-biased' — prioritizes concepts matching active goals
export class GoalBiasedSampling implements SamplingStrategy {
  readonly metadata = { name: 'goal-biased', description: 'Boost concepts related to active goals' };
  sample(memory: Memory, count: number): Concept[] {
    const goals = memory.getGoals?.() ?? [];
    const goalsStr = goals.map(g => g.term.toString().toLowerCase());
    return memory.listConcepts()
      .map(c => ({
        concept: c,
        score: c.priority * (goalsStr.some(g => c.term.toString().toLowerCase().includes(g)) ? 1.5 : 1.0)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(e => e.concept);
  }
}

// 'diverse' — stratified across priority bands
export class DiverseSampling implements SamplingStrategy {
  readonly metadata = { name: 'diverse', description: 'Stratified sample across priority bands' };
  sample(memory: Memory, count: number): Concept[] {
    const concepts = memory.listConcepts();
    const bands = 4;
    const perBand = Math.max(1, Math.ceil(count / bands));
    const sorted = concepts.sort((a, b) => a.priority - b.priority);
    const bandSize = Math.max(1, Math.floor(sorted.length / bands));
    const result: Concept[] = [];
    for (let b = 0; b < bands; b++) {
      const start = b * bandSize;
      const band = sorted.slice(start, start + bandSize);
      result.push(...band.slice(0, perBand));
    }
    return result.slice(0, count);
  }
}
```

#### 1.3 DerivationStrategy implementations

```typescript
// derivation-strategies.ts

// 'default' — current behavior: iterate all secondaries, fire sync+LM per pair.
// If none && singlePremiseEnabled: fire LM on primary with selection.
export class DefaultDerivation implements DerivationStrategy {
  readonly metadata = { name: 'default', description: 'Iterate all secondaries, fire sync+LM per pair' };

  async *derive(primary: Task, secondaries: Task[], processor: RuleProcessor, ctx: DerivationContext): AsyncGenerator<Task> {
    if (secondaries.length > 0) {
      for (const secondary of secondaries) {
        if (ctx.signal?.aborted) return;
        const p1: RuleInput = { term: primary.term, truth: primary.truth, stamp: primary.stamp };
        const p2: RuleInput = { term: secondary.term, truth: secondary.truth ?? Truth.NEUTRAL, stamp: secondary.stamp };

        for (const result of processor.processSync(p1, p2)) yield this.toTask(result);
        for await (const result of processor.processLMRulesExternal(p1, p2, ctx.signal)) yield this.toTask(result);
      }
    } else if (ctx.singlePremiseEnabled) {
      const p1: RuleInput = { term: primary.term, truth: primary.truth, stamp: primary.stamp };
      for await (const result of processor.processLMRulesSingle(p1, ctx.signal)) yield this.toTask(result);
    }
  }

  private toTask(r: RuleResult): Task {
    return { term: r.term, type: 'belief', truth: r.truth, budget: createBudget(r.priority), stamp: r.stamp, occurrenceTime: Date.now(), derived: true };
  }
}

// 'anytime' — same as default but stop when average derived quality >= threshold
export class AnytimeDerivation extends DefaultDerivation {
  readonly metadata = { name: 'anytime', description: 'Stop early when derived task quality >= threshold' };
  // Override derive to check quality after each secondary
}

// 'focused' — sort secondaries by priority+shared-atoms, process highest first
export class FocusedDerivation extends DefaultDerivation {
  readonly metadata = { name: 'focused', description: 'Prioritize high-relevance secondaries' };
  // Override to sort secondaries before iterating
}

// 'sampled' — random subset of secondaries
export class SampledDerivation extends DefaultDerivation {
  readonly metadata = { name: 'sampled', description: 'Random subset of secondaries' };
  // Override to random-sample secondaries before iterating
}
```

#### 1.4 LMRuleSelector implementations

```typescript
// lm-selectors.ts

export class AllSelector implements LMRuleSelector {
  readonly metadata = { name: 'all', description: 'Fire all eligible LM rules' };
  select(rules: LMRule[], _ctx: LMRuleSelectionContext): LMRule[] { return [...rules]; }
}

export class PrioritySelector implements LMRuleSelector {
  readonly metadata = { name: 'priority', description: 'Top-N by rule priority' };
  select(rules: LMRule[], ctx: LMRuleSelectionContext): LMRule[] {
    return [...rules].sort((a, b) => b.priority - a.priority).slice(0, ctx.maxRules);
  }
}

export class RotationSelector implements LMRuleSelector {
  readonly metadata = { name: 'rotation', description: 'Round-robin across cycles' };
  select(rules: LMRule[], ctx: LMRuleSelectionContext): LMRule[] {
    const start = ctx.rotationIndex ?? 0;
    const result: LMRule[] = [];
    for (let i = 0; i < ctx.maxRules && result.length < rules.length; i++)
      result.push(rules[(start + i) % rules.length]);
    return result;
  }
}

export class DiverseSelector implements LMRuleSelector {
  readonly metadata = { name: 'diverse', description: 'One per category, then round-robin' };
  select(rules: LMRule[], ctx: LMRuleSelectionContext): LMRule[] {
    const byCat = new Map<string, LMRule[]>();
    for (const r of rules) {
      const cat = (r as any).category ?? 'general';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(r);
    }
    const perCat = Math.max(1, Math.floor(ctx.maxRules / byCat.size));
    return [...byCat.values()]
      .flatMap(cat => cat.sort((a, b) => b.priority - a.priority).slice(0, perCat))
      .slice(0, ctx.maxRules);
  }
}
```

#### 1.5 AttentionModel implementations

```typescript
// attention-models.ts

// 'simple' — fixed boost on prime, exponential decay, no-op tick
export class SimpleAttention implements AttentionModel {
  readonly metadata = { name: 'simple', description: 'Fixed boost on prime, exponential decay' };

  prime(_concept: Concept, ctx: AttentionContext): number {
    return ctx.memory.config.primeBoost ?? 0.3;
  }

  decay(concept: Concept, _cycles: number, baseDecayRate: number): number {
    return concept.priority * baseDecayRate;
  }

  tick(_memory: Memory, _cycleCount: number): void {}
}

// 'spreading' — prime propagates to linked concepts, tick runs iterations
export class SpreadingActivation extends SimpleAttention {
  readonly metadata = { name: 'spreading', description: 'Prime propagates through term links' };

  prime(concept: Concept, ctx: AttentionContext): number {
    const boost = super.prime(concept, ctx);
    // Propagate to linked concepts
    const links = concept.links ?? [];
    for (const link of links) {
      const target = ctx.memory.getConcept(link.target);
      if (target && target !== concept) {
        target.priority = Math.min(1, target.priority + boost * (link.weight ?? 0.3));
      }
    }
    return boost;
  }

  tick(memory: Memory, _cycleCount: number): void {
    // Iterative propagation across all concepts
    // (full implementation would do N rounds of activation spread)
  }
}

// 'goal-relevance' — boost proportional to goal overlap
export class GoalRelevanceAttention extends SimpleAttention {
  readonly metadata = { name: 'goal-relevance', description: 'Boost proportional to goal term overlap' };

  prime(concept: Concept, ctx: AttentionContext): number {
    const boost = super.prime(concept, ctx);
    const goalOverlap = this.goalOverlap(concept, ctx.memory);
    return boost * (1 + goalOverlap * 0.5);
  }

  private goalOverlap(_concept: Concept, _memory: Memory): number {
    // Calculate overlap ratio between concept term and active goal terms
    return 0;  // placeholder
  }
}

// 'composite' — weighted combination of multiple attention models
export class CompositeAttention implements AttentionModel {
  readonly metadata = { name: 'composite', description: 'Weighted combination of attention models' };

  constructor(
    private readonly models: Array<{ model: AttentionModel; weight: number }>
  ) {}

  prime(concept: Concept, ctx: AttentionContext): number {
    return this.models.reduce((sum, m) => sum + m.model.prime(concept, ctx) * m.weight, 0);
  }

  decay(concept: Concept, cycles: number, rate: number): number {
    return this.models.reduce((sum, m) => sum + m.model.decay(concept, cycles, rate) * m.weight, 0);
  }

  tick(memory: Memory, cycleCount: number): void {
    for (const m of this.models) m.model.tick(memory, cycleCount);
  }
}
```

---

### Phase 2: Registry + Wiring

Now that all strategy classes exist (Phase 1.2–1.5), the registry can be built without forward references.

#### 2.1 CognitiveRegistry

```typescript
// registry.ts
export class CognitiveRegistry implements StrategyRegistry {
  private stores = {
    sampling:   new Map<string, SamplingStrategy>(),
    premise:    new Map<string, Strategy>(),
    derivation: new Map<string, DerivationStrategy>(),
    'lm-rule':  new Map<string, LMRuleSelector>(),
    attention:  new Map<string, AttentionModel>(),
  };

  register(type: StrategyType, name: string, impl: any): void {
    if (this.stores[type].has(name)) throw new Error(`'${name}' already registered for ${type}`);
    this.stores[type].set(name, impl);
  }

  get<T>(type: StrategyType, name: string): T {
    const impl = this.stores[type].get(name);
    if (!impl) throw new Error(`No ${type} strategy named '${name}'`);
    return impl as T;
  }

  list(type: StrategyType): ComponentMetadata[] {
    return [...this.stores[type].values()].map(s => (s as any).metadata).filter(Boolean);
  }

  has(type: StrategyType, name: string): boolean { return this.stores[type].has(name); }
  unregister(type: StrategyType, name: string): boolean { return this.stores[type].delete(name); }

  clear(type?: StrategyType): void {
    if (type) this.stores[type].clear();
    else for (const s of Object.values(this.stores)) (s as Map<string, unknown>).clear();
  }

  /** Register all built-in strategies. Called once at startup. */
  initializeDefaults(): void {
    // All classes below are defined in Phase 1.2–1.5 — they exist.
    // Sampling
    this.register('sampling', 'priority', new PrioritySampling());
    this.register('sampling', 'top-n', new TopNSampling());
    this.register('sampling', 'above-threshold', new AboveThresholdSampling());
    this.register('sampling', 'novelty', new NoveltySampling());
    this.register('sampling', 'goal-biased', new GoalBiasedSampling());
    this.register('sampling', 'diverse', new DiverseSampling());

    // Premise (existing classes already compiled)
    this.register('premise', 'default-formation', DefaultFormationStrategy);
    this.register('premise', 'bag', BagStrategy);
    this.register('premise', 'prolog', PrologStrategy);
    this.register('premise', 'resolution', ResolutionStrategy);
    this.register('premise', 'goal-driven', GoalDrivenStrategy);
    this.register('premise', 'analogical', AnalogicalStrategy);
    this.register('premise', 'term-link', TermLinkStrategy);
    this.register('premise', 'task-match', TaskMatchStrategy);
    this.register('premise', 'decomposition', DecompositionStrategy);
    this.register('premise', 'exhaustive', ExhaustiveStrategy);

    // Derivation
    this.register('derivation', 'default', new DefaultDerivation());
    this.register('derivation', 'anytime', new AnytimeDerivation());
    this.register('derivation', 'focused', new FocusedDerivation());
    this.register('derivation', 'sampled', new SampledDerivation());

    // LM rule
    this.register('lm-rule', 'all', new AllSelector());
    this.register('lm-rule', 'priority', new PrioritySelector());
    this.register('lm-rule', 'rotation', new RotationSelector());
    this.register('lm-rule', 'diverse', new DiverseSelector());

    // Attention
    this.register('attention', 'simple', new SimpleAttention());
    this.register('attention', 'spreading', new SpreadingActivation());
    this.register('attention', 'goal-relevance', new GoalRelevanceAttention());
    this.register('attention', 'composite', new CompositeAttention([]));
  }

  composePremise(names: Array<{ name: string; weight: number }>): Strategy {
    const strategies = names.map(n => this.get<Strategy>('premise', n.name));
    return new CompositeStrategy(strategies, 'weighted', names.map(n => n.weight));
  }

  createAdaptive(names: string[]): Strategy {
    return new AdaptiveStrategy(names.map(n => this.get<Strategy>('premise', n)));
  }
}
```

#### 2.2 AttentionModel on Memory

```typescript
// memory.ts
export class Memory {
  readonly attentionModel: AttentionModel;

  constructor(config: MemoryConfig, attentionModel?: AttentionModel) {
    this.attentionModel = attentionModel ?? new SimpleAttention();
    // ... existing construction ...
  }

  sample(count: number): Concept[] {
    for (const concept of this.concepts.values()) {
      const decay = this.attentionModel.decay(concept, 1, this.config.activationDecayRate);
      if (decay !== 0) concept.priority = Math.max(0, concept.priority - decay);
    }
    // ... existing priority sampling logic ...
  }

  consolidate(cycleCount: number): void {
    // ... existing consolidation ...
    this.attentionModel.tick(this, cycleCount);
  }
}
```

**Caller update sites for Memory constructor change:**

| File | Line | Change |
|---|---|---|
| `src/nar/nar.ts:112` | `new Memory(config)` | `new Memory(config, attentionModel)` |
| `src/nar/factory.ts` | factory methods | Pass attentionModel from CognitiveParameters |
| `tests/nar/unit/memory.test.ts` | `new Memory(...)` | Add optional arg or use default |

#### 2.3 Refactored InferenceController

```typescript
// inference-controller.ts
export class InferenceController {
  constructor(
    private readonly memory: Memory,
    private readonly processor: RuleProcessor,
    private readonly samplingStrategy: SamplingStrategy,
    private readonly strategy: Strategy,
    private readonly derivationStrategy: DerivationStrategy,
    private readonly config: InferenceConfig
  ) {}

  reconfigure(updates: {
    samplingStrategy?: SamplingStrategy;
    strategy?: Strategy;
    derivationStrategy?: DerivationStrategy;
    config?: Partial<InferenceConfig>;
  }): void {
    if (updates.samplingStrategy) this.samplingStrategy = updates.samplingStrategy;
    if (updates.strategy) this.strategy = updates.strategy;
    if (updates.derivationStrategy) this.derivationStrategy = updates.derivationStrategy;
    if (updates.config) Object.assign(this.config, updates.config);
  }

  async step(timeoutMs = 5000, maxResults = 100, signal?: AbortSignal): Promise<Task[]> {
    const results: Task[] = [];
    this.derivationCount = 0;
    this.lmRulesFiredCount = 0;
    this.syncRulesFiredCount = 0;

    const concepts = this.samplingStrategy.sample(this.memory, 100);
    const endTime = Date.now() + timeoutMs;

    for (const concept of concepts) {
      if (signal?.aborted || Date.now() > endTime || results.length >= maxResults) break;

      // Attention boost (delta applied by caller)
      const boost = this.memory.attentionModel.prime(concept, {
        concept, cycleCount: Date.now(), memory: this.memory
      });
      if (boost !== 0) concept.priority = Math.min(1, concept.priority + boost);

      const task = this.createBeliefTask(concept);
      const secondaries = this.strategy.selectSecondary(task, this.memory);

      // DerivationStrategy handles both dual-premise and single-premise
      for await (const derived of this.derivationStrategy.derive(
        task, secondaries, this.processor, {
          maxDerivations: this.config.maxDerivationsPerStep,
          maxDepth: this.config.maxDerivationDepth,
          qualityThreshold: this.config.premiseQualityThreshold,
          cpuThrottleMs: this.config.cpuThrottleMs,
          singlePremiseEnabled: this.config.singlePremiseLMRules ?? true,
          signal
        }
      )) {
        results.push(derived);
        this.derivationCount++;
      }
    }
    return results;
  }
}
```

#### 2.4 LMRuleSelector — Replace Phase 0.1's inline selection

The `RuleProcessor` gains `setLMSelector()`. The Phase 0.1 `getSelectedLMRules()` switch is **removed** and replaced with:

```typescript
// processor.ts
export class RuleProcessor {
  private lmSelector: LMRuleSelector = new AllSelector();
  private maxLMRulesPerStep = 13;
  private lmRotationIndex = 0;

  setLMSelector(selector: LMRuleSelector, maxRules: number): void {
    this.lmSelector = selector;
    this.maxLMRulesPerStep = maxRules;
  }

  private async* processLMRules(p1: RuleInput, p2: RuleInput, signal?: AbortSignal): AsyncGenerator<RuleResult> {
    if (this.lmRules.length === 0 || signal?.aborted) return;

    const maxPriority = Math.max(
      this.memory?.getConcept(p1.term)?.priority ?? 0,
      this.memory?.getConcept(p2.term)?.priority ?? 0
    );

    const selected = this.lmSelector.select(this.lmRules, {
      maxRules: this.maxLMRulesPerStep,
      conceptPriority: maxPriority,
      rotationIndex: this.lmRotationIndex,
      priorityThreshold: this.lmActivationThreshold,
      premiseCount: 2
    });

    for (const lmRule of selected) {
      if (signal?.aborted) return;
      // ... existing canApply + apply + error handling + logging unchanged ...
    }
    this.lmRotationIndex = (this.lmRotationIndex + 1) % this.lmRules.length;
  }
}
```

**This replaces Phase 0.1's inline switch.** The Phase 0.1 `getSelectedLMRules()` method and `lmSelectionStrategy`/`rotationIndex` fields are deleted when this code is introduced.

---

### Phase 3: CognitiveController + NAR Wiring

#### 3.1 CognitiveController

```typescript
// controller.ts
export class CognitiveController {
  private currentParams: CognitiveParameters;
  private inferenceController: InferenceController;
  private cycleCount = 0;
  private readonly adaptInterval: number;

  constructor(
    private readonly registry: CognitiveRegistry,
    private readonly memory: Memory,
    private readonly processor: RuleProcessor,
    private readonly metrics: MetricsCollector,
    private readonly rlfp: RLFPLearner | undefined,
    params: CognitiveParameters,
    adaptInterval = 50
  ) {
    this.currentParams = params;
    this.adaptInterval = adaptInterval;
    this.inferenceController = this.buildInferenceController(params);
  }

  getInferenceController(): InferenceController { return this.inferenceController; }

  private buildInferenceController(params: CognitiveParameters): InferenceController {
    const samplingStrategy = this.registry.get<SamplingStrategy>('sampling', params.strategies.sampling.type);
    const strategy = this.registry.get<Strategy>('premise', params.strategies.premise.type);
    const derivationStrategy = this.registry.get<DerivationStrategy>('derivation', params.strategies.derivation.type);
    const lmSelector = this.registry.get<LMRuleSelector>('lm-rule', params.strategies.lmRule.type);

    this.processor.setLMSelector(lmSelector, params.strategies.lmRule.maxRules);

    const inferenceConfig: InferenceConfig = {
      ...params.inference,
      maxLMRulesPerStep: params.strategies.lmRule.maxRules
    };

    if (this.inferenceController) {
      this.inferenceController.reconfigure({ samplingStrategy, strategy, derivationStrategy, config: inferenceConfig });
      return this.inferenceController;
    }

    return new InferenceController(this.memory, this.processor, samplingStrategy, strategy, derivationStrategy, inferenceConfig);
  }

  /** Per-cycle adaptation hook. Call from NARExecution. */
  adapt(): void {
    this.cycleCount++;
    if (this.cycleCount % this.adaptInterval !== 0) return;

    const newParams = this.rlfp
      ? this.adaptWithRLFP()
      : this.adaptWithThresholds();

    if (JSON.stringify(newParams.strategies) !== JSON.stringify(this.currentParams.strategies)) {
      this.currentParams = newParams;
      this.buildInferenceController(newParams);
    }
  }

  private adaptWithThresholds(): CognitiveParameters {
    const summary = this.metrics.getSummary();
    const adapted = structuredClone(this.currentParams);
    const lmLatency = summary.lm?.averageLatency ?? 0;
    const derivPerSec = summary.throughput?.derivationsPerSecond ?? Infinity;

    if (lmLatency > 2000) {
      adapted.strategies.lmRule.type = 'priority';
      adapted.strategies.lmRule.maxRules = Math.max(1, adapted.strategies.lmRule.maxRules - 1);
    }
    if (derivPerSec < 10) adapted.strategies.derivation.type = 'focused';
    return adapted;
  }

  private adaptWithRLFP(): CognitiveParameters {
    const preferences = this.rlfp!.getPolicy();
    const adapted = structuredClone(this.currentParams);
    const recommended = preferences.recommendStrategies(this.metrics.getSummary());
    if (recommended.premise) adapted.strategies.premise.type = recommended.premise;
    if (recommended.lmRule) adapted.strategies.lmRule.type = recommended.lmRule;
    if (recommended.derivation) adapted.strategies.derivation.type = recommended.derivation;
    return adapted;
  }

  /** Manual runtime override */
  setStrategy(type: StrategyType, name: string): void {
    const key = type === 'lm-rule' ? 'lmRule' : type;
    (this.currentParams.strategies as any)[key].type = name;
    this.buildInferenceController(this.currentParams);
  }
}
```

#### 3.2 Updated NARExecution

```typescript
// nar-execution.ts
export class NARExecution {
  private _cycleCount = 0;

  constructor(
    private readonly memory: Memory,
    private readonly taskManager: TaskManager,
    private readonly reasoner: Reasoner,
    private readonly config: NARConfig,
    private readonly rlfp?: RLFPLearner,
    private readonly cognitiveController?: CognitiveController   // NEW
  ) {}

  async run(steps = 1, signal?: AbortSignal): Promise<number> {
    let derived = 0;
    for (let i = 0; i < steps; i++) {
      if (signal?.aborted) break;
      this._cycleCount++;

      const processed = await this.taskManager.processPending();
      derived += processed.length;

      // Adaptation hook
      this.cognitiveController?.adapt();

      // Inference via CognitiveController (not Reasoner directly)
      const results = this.cognitiveController
        ? await this.cognitiveController.getInferenceController().step(5000, 100, signal)
        : await this.reasoner.step(5000, 100, signal);  // fallback for backward compat

      results.forEach(task =>
        this.memory.addTask(task.term, task.type, task.truth, task.budget)
      );
      derived += results.length;
    }
    this.memory.consolidate(this._cycleCount);
    return derived;
  }
}
```

#### 3.3 Updated NAR Constructor (central wiring)

```typescript
// nar.ts — key changes in the constructor

export class NAR extends BaseComponent {
  readonly cognitiveController?: CognitiveController;  // NEW

  constructor(config: NARConfig = DEFAULT_CONFIG) {
    const eventBus = new EventBus();
    const logger = createLogger({scope: 'NAR'});
    const metrics = new MetricsCollector();

    super({logger, metrics, eventBus});

    this.config = this.validateConfig(config);
    this.memory = new Memory(this.config, this.createAttentionModel(config));
    this.processor = new RuleProcessor();
    this.processor.setConfig({memory: this.memory, priorityThreshold: this.config.priorityThreshold});

    // If cognitive params + registry provided, use the new architecture
    if (config.cognitiveParams && config.strategyRegistry) {
      this.cognitiveController = new CognitiveController(
        config.strategyRegistry,
        this.memory,
        this.processor,
        metrics,
        this.rlfp,
        config.cognitiveParams,
        config.adaptationInterval
      );

      // Reasoner wraps the inference controller for backward compat
      this.reasoner = new Reasoner(
        this.memory,
        this.processor,
        BagStrategy,  // fallback — cognitiveController.ic has the real strategy
        config
      );
    } else {
      // Legacy path — no CognitiveController
      this.reasoner = new Reasoner(this.memory, this.processor, BagStrategy, config);
    }

    // NARExecution now receives cognitiveController
    this.execution = new NARExecution(
      this.memory, this.taskManager, this.reasoner, config,
      this.rlfp, this.cognitiveController
    );

    // ... rest of constructor unchanged ...
  }

  private createAttentionModel(config: NARConfig): AttentionModel {
    const type = config.cognitiveParams?.strategies.attention.type;
    if (!type) return new SimpleAttention();
    return config.strategyRegistry?.get<AttentionModel>('attention', type) ?? new SimpleAttention();
  }

  /** Runtime access to controller for manual strategy switching */
  getController(): CognitiveController | undefined {
    return this.cognitiveController;
  }
}
```

Key wiring decisions:
- `CognitiveController` is created in the NAR constructor when `config.cognitiveParams` and `config.strategyRegistry` are provided
- The `Reasoner` is kept for backward compat but its `InferenceController` is overridden by the CognitiveController's version
- `NARExecution` receives the CognitiveController, uses it for adaptation + inference in each cycle
- `Memory` receives an `AttentionModel` at construction, either from the registry or the default `SimpleAttention`
- `getController()` exposes runtime strategy switching

#### 3.4 Backward Compat: Legacy Path

When `createDefault()` or `createMinimal()` is called (without cognitive params), the NAR constructor uses the legacy path:
- No `CognitiveController`
- `Memory` gets `new SimpleAttention()` as default
- `NARExecution` works as before
- All existing code paths and tests continue to work unchanged

---

### Phase 4: Factory + Presets

```typescript
// factory.ts
export interface NARConfig extends CoreConfig {
  cognitiveParams?: CognitiveParameters;
  strategyRegistry?: CognitiveRegistry;
  adaptationInterval?: number;
}

export class SeNARSFactory {
  static createWithStrategies(
    params?: Partial<CognitiveParameters>,
    options?: {
      registry?: CognitiveRegistry;
      core?: Partial<CoreConfig>;
      adaptationInterval?: number;
      rlfp?: RLFPLearner;
    }
  ): NAR {
    const registry = options?.registry ?? new CognitiveRegistry();
    registry.initializeDefaults();  // All classes exist — safe

    const merged = mergeParameters({
      ...DEFAULT_COGNITIVE_PARAMETERS,
      ...params,
      strategies: {
        ...DEFAULT_COGNITIVE_PARAMETERS.strategies,
        ...params?.strategies
      }
    });

    const nar = new NAR({
      ...DEFAULT_CONFIG,
      ...options?.core,
      cognitiveParams: merged,
      strategyRegistry: registry,
      adaptationInterval: options?.adaptationInterval ?? 50
    });

    (nar as any).rlfp = options?.rlfp;
    return nar;
  }

  static createDefault(): NAR {
    return SeNARSFactory.createWithStrategies();
  }

  static createFast(): NAR {
    return SeNARSFactory.createWithStrategies({
      strategies: {
        premise: { type: 'bag' },
        lmRule: { type: 'priority', maxRules: 3 },
        derivation: { type: 'focused' },
        attention: { type: 'simple' },
        sampling: { type: 'top-n' }
      }
    });
  }

  static createResearch(): NAR {
    const registry = new CognitiveRegistry();
    registry.initializeDefaults();
    registry.register('sampling', 'novelty', new NoveltySampling());
    registry.register('sampling', 'goal-biased', new GoalBiasedSampling());
    return SeNARSFactory.createWithStrategies(RESEARCH_COGNITIVE_CONFIG, { registry });
  }
}
```

---

### Phase 5: Optimization + Persistence

#### Parameter Mapping

```typescript
const PARAMETER_MAP: Record<string, (p: CognitiveParameters, v: unknown) => void> = {
  'priority.initial':               (p, v) => { p.priority.initialPriority = v as number; },
  'priority.threshold':             (p, v) => { p.priority.threshold = v as number; },
  'priority.lmActivationThreshold': (p, v) => { p.priority.lmActivationThreshold = v as number; },
  'priority.directMentionBoost':    (p, v) => { p.priority.directMentionBoost = v as number; },
  'priority.decayRate':             (p, v) => { p.priority.decayRate = v as number; },
  'strategy.sampling':              (p, v) => { p.strategies.sampling.type = v as string; },
  'strategy.premise':               (p, v) => { p.strategies.premise.type = v as string; },
  'strategy.lmRule':                (p, v) => { p.strategies.lmRule.type = v as string; },
  'strategy.derivation':            (p, v) => { p.strategies.derivation.type = v as string; },
  'strategy.attention':             (p, v) => { p.strategies.attention.type = v as string; },
  'lm.maxRules':                    (p, v) => { p.strategies.lmRule.maxRules = v as number; },
  'lm.timeout':                     (p, v) => { p.lm.callTimeoutMs = v as number; },
  'inference.maxDerivations':       (p, v) => { p.inference.maxDerivationsPerStep = v as number; },
  'inference.maxDepth':             (p, v) => { p.inference.maxDerivationDepth = v as number; },
  'inference.qualityThreshold':     (p, v) => { p.inference.premiseQualityThreshold = v as number; },
};

function applyParamValues(params: CognitiveParameters, values: Record<string, unknown>): CognitiveParameters {
  const clone = structuredClone(params);
  for (const [key, value] of Object.entries(values)) PARAMETER_MAP[key]?.(clone, value);
  return clone;
}
```

#### Full Parameter Space

```typescript
export const COGNITIVE_PARAMETER_SPACE: SearchSpace = {
  parameters: {
    'priority.initial':               { type: 'float', min: 0.01, max: 0.3, log: true },
    'priority.threshold':             { type: 'float', min: 0.05, max: 0.3 },
    'priority.lmActivationThreshold': { type: 'float', min: 0.2, max: 0.8 },
    'priority.directMentionBoost':    { type: 'float', min: 0.1, max: 0.5 },
    'priority.decayRate':             { type: 'float', min: 0.01, max: 0.2 },
    'strategy.sampling':              { type: 'categorical', values: ['priority', 'top-n', 'above-threshold', 'novelty', 'goal-biased', 'diverse'] },
    'strategy.premise':               { type: 'categorical', values: ['default-formation', 'bag', 'prolog', 'resolution', 'goal-driven', 'analogical', 'term-link', 'task-match', 'decomposition', 'exhaustive'] },
    'strategy.lmRule':                { type: 'categorical', values: ['all', 'priority', 'rotation', 'diverse'] },
    'strategy.attention':             { type: 'categorical', values: ['simple', 'spreading', 'goal-relevance', 'composite'] },
    'strategy.derivation':            { type: 'categorical', values: ['default', 'anytime', 'focused', 'sampled'] },
    'lm.maxRules':                    { type: 'int', min: 1, max: 13 },
    'lm.timeout':                     { type: 'int', min: 1000, max: 30000, log: true },
    'inference.maxDerivations':       { type: 'int', min: 100, max: 10000, log: true },
    'inference.maxDepth':             { type: 'int', min: 5, max: 20 },
    'inference.qualityThreshold':     { type: 'float', min: 0, max: 0.9 },
  }
};
```

#### Samplers

```typescript
export abstract class ParamSampler {
  abstract readonly space: SearchSpace;
  abstract sample(): Record<string, unknown>;
  abstract reset(): void;
}

export class GridSampler extends ParamSampler {
  private enumerator: Generator<Record<string, unknown>>;
  constructor(public readonly space: SearchSpace) {
    super();
    this.enumerator = this.enumerate(space);
  }
  sample(): Record<string, unknown> { return this.enumerator.next().value ?? (this.reset(), this.sample()); }
  reset(): void { this.enumerator = this.enumerate(this.space); }
  private *enumerate(space: SearchSpace): Generator<Record<string, unknown>> {
    // Enumerate all combinations of categoricals + grid over numeric ranges
  }
}

export class RandomSampler extends ParamSampler {
  constructor(public readonly space: SearchSpace) { super(); }
  sample(): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const [key, param] of Object.entries(this.space.parameters)) {
      switch (param.type) {
        case 'float':
          values[key] = Math.random() * ((param.max ?? 1) - (param.min ?? 0)) + (param.min ?? 0);
          if (param.log) values[key] = Math.exp(values[key] as number);
          break;
        case 'int':
          values[key] = Math.floor(Math.random() * ((param.max ?? 10) - (param.min ?? 0) + 1)) + (param.min ?? 0);
          break;
        case 'categorical':
          values[key] = (param.values ?? [])[Math.floor(Math.random() * (param.values?.length ?? 1))];
          break;
        case 'boolean':
          values[key] = Math.random() > 0.5;
          break;
      }
    }
    return values;
  }
  reset(): void {}
}
```

#### Optimizer with persistence + public API

```typescript
export interface OptimizationResult {
  params: CognitiveParameters;
  score: number;
  algorithm: string;
  timestamp: number;
  evaluations: number;
  duration: number;
}

export class CognitiveOptimizer {
  private bestScore = -Infinity;
  private bestParams: CognitiveParameters | null = null;
  private results: OptimizationResult[] = [];

  constructor(
    private readonly objective: { name: string; evaluate: (m: MetricsSummary) => number },
    private readonly searchSpace: SearchSpace,
    private readonly nar: NAR,
    private readonly benchmarkTasks: Task[]
  ) {}

  async optimize(algorithm: 'grid' | 'random', budget: { maxEvaluations: number; maxTime: number }): Promise<OptimizationResult> {
    const sampler = algorithm === 'grid' ? new GridSampler(this.searchSpace) : new RandomSampler(this.searchSpace);
    const startTime = Date.now();

    for (let i = 0; i < budget.maxEvaluations; i++) {
      if (Date.now() - startTime > budget.maxTime) break;
      const values = sampler.sample();
      const trialParams = applyParamValues(structuredClone(DEFAULT_COGNITIVE_PARAMETERS), values);
      this.applyConfig(trialParams);
      this.runBenchmark();
      const score = this.objective.evaluate(this.nar.getMetrics() as MetricsSummary);

      if (score > this.bestScore) {
        this.bestScore = score;
        this.bestParams = trialParams;
      }
    }
    return this.saveResult(algorithm, budget.maxEvaluations, Date.now() - startTime);
  }

  private applyConfig(params: CognitiveParameters): void {
    // Use public API instead of (nar as any)
    const controller = new CognitiveController(
      (this.nar as any).strategyRegistry, this.nar['memory'],
      this.nar.getProcessor(), this.nar.getMetrics(),
      this.nar.getRLFP(), params
    );
    (this.nar as any).cognitiveController = controller;
    (this.nar as any).execution = new NARExecution(
      this.nar['memory'], (this.nar as any).taskManager,
      (this.nar as any).reasoner, this.nar.getConfig(),
      this.nar.getRLFP(), controller
    );
  }

  private runBenchmark(): void {
    for (const task of this.benchmarkTasks) this.nar.input(task);
    this.nar.run(10);
  }

  /** Persist best result to file */
  saveResults(path: string): void {
    const data = JSON.stringify({
      best: this.results[this.results.length - 1],
      history: this.results,
      space: this.searchSpace,
      objective: this.objective.name
    }, null, 2);
    require('fs').writeFileSync(path, data, 'utf-8');
  }

  static loadResults(path: string): { best: OptimizationResult; history: OptimizationResult[] } {
    return JSON.parse(require('fs').readFileSync(path, 'utf-8'));
  }

  getBestParams(): CognitiveParameters | null {
    return this.bestParams ? structuredClone(this.bestParams) : null;
  }

  private saveResult(algorithm: string, evaluations: number, duration: number): OptimizationResult {
    const result: OptimizationResult = {
      params: this.bestParams!, score: this.bestScore, algorithm,
      timestamp: Date.now(), evaluations, duration
    };
    this.results.push(result);
    return result;
  }
}
```

#### CognitiveParameters serialization

```typescript
export function serializeParams(params: CognitiveParameters): string {
  return JSON.stringify(params, null, 2);
}

export function deserializeParams(json: string): CognitiveParameters {
  return mergeParameters(JSON.parse(json));
}
```

---

## Implementation Order (corrected — no forward references)

| Step | What | Depends On | Effort | Verification |
|---|---|---|---|---|
| **0.1** | Inline LM selection in processor (40 lines, temporary) | Nothing | 1d | `lm-rule-priority.test.ts` passes; verify 3 rules fire when maxRules=3 |
| **0.2** | Deprecate PremiseSelector (annotations only) | Nothing | <1d | Compiles without warnings |
| **0.3** | Add optional metadata to Strategy interface + all implementations | Nothing | 1d | All strategy tests pass |
| **0.4** | Focus delegates to optional AttentionModel | Nothing | <1d | Focus tests pass unchanged |

| **1.1** | Create `src/nar/cognitive/` with types (all interfaces + context types) | 0.3 | 1d | TypeScript compiles |
| **1.2** | SamplingStrategy implementations (6 classes) | 1.1 | 1d | Unit tests for each strategy |
| **1.3** | DerivationStrategy implementations (4 classes) | 1.1 | 1d | Derivation tests |
| **1.4** | LMRuleSelector implementations (4 classes) | 1.1 | <1d | Selector unit tests |
| **1.5** | AttentionModel implementations (4 classes) | 1.1 | 1d | Attention model tests |

| **2.1** | CognitiveRegistry (all 1.x classes exist — safe to reference) | 1.2–1.5 | 1d | Registry tests |
| **2.2** | AttentionModel on Memory (constructor + sample/consolidate hooks) | 1.5, 2.1 | 1d | Memory tests pass |
| **2.3** | InferenceController refactored (all 5 deps in constructor) | 2.1, 2.2 | 2d | Inference tests pass |
| **2.4** | LMRuleSelector replaces Phase 0.1 inline code in Processor | 1.4, 2.1 | 1d | LM rule tests pass |

| **3** | CognitiveController + NARExecution + NAR constructor wiring | 2.2, 2.3, 2.4 | 2d | Integration tests pass |

| **4** | Factory + presets | 3 | 1d | `createDefault()` works |
| **5** | Optimizer, samplers, persistence | 4 | 3d | Optimizer produces results |

**Total**: ~16 days. **Key change**: Phase 1 (implementations) fully precedes Phase 2 (registry + wiring). No forward references.

---

## Design Verification

### No functional overlap

| Component | Responsibility | Does NOT do |
|---|---|---|
| **SamplingStrategy** | What concepts enter the loop | Premise selection, derivation |
| **Strategy** | Which secondaries to pair | How concepts are sampled |
| **DerivationStrategy** | How to iterate pairs + derive | Which pairs (that's Strategy) |
| **LMRuleSelector** | Which LM rules fire per pair | Pair iteration (that's Derivation) |
| **AttentionModel** | Priority dynamics in Memory | Inference logic |

### No dead paths

- `metadata` is optional on `Strategy` — existing tests compile without changes
- Phase 0.1 inline code explicitly replaced by Phase 1.4 (delete old code)
- `CognitiveController` is optional — when not provided, `NARExecution` falls back to `reasoner.step()` directly
- Legacy `SeNARSFactory.createDefault()` without cognitive params still works — uses `BagStrategy`, `SimpleAttention`, no controller

### All implementation classes exist before registration

`CognitiveRegistry.initializeDefaults()` in Phase 2.1 references classes from Phase 1.2–1.5, which compile first. No `new AllSelector()` call before the class is defined.

`Memory.attentionModel` exists (Phase 2.2) before `InferenceController` (Phase 2.3) needs it.

NAR constructor (Phase 3) is the last integration step — all components exist.

---

## Testing Strategy Per Phase

| Phase | What to test | How |
|---|---|---|
| 0.1 | LM selection respects maxRules | Processor unit test: mock 10 rules, set maxRules=3, verify only 3 fire |
| 0.3 | Optional metadata doesn't break Strategy tests | Run existing `strategies.test.ts` unchanged |
| 1.2 | Each SamplingStrategy returns correct count/distribution | Unit tests with mock Memory containing known concepts |
| 1.3 | DerivationStrategy handles dual + single premise | Unit test with mock processor, verify both paths |
| 1.4 | LMRuleSelector returns expected rules per strategy | Unit tests with known rule set |
| 1.5 | AttentionModel prime/decay/tick produce correct deltas | Unit tests with mock concepts |
| 2.1 | Registry register/get/list/has/unregister/clear | Straightforward registry tests |
| 2.2 | Memory applies decay in sample(), tick in consolidate() | Memory tests with mock AttentionModel |
| 2.3 | InferenceController uses all 5 components | Integration test with mock components |
| 2.4 | LMSelector integration | Compare rule count before/after with same input |
| 3 | End-to-end cognitive cycle with all new components | Run existing NAR tests in "new" mode |
| 4 | Factory produces working NAR | `createWithStrategies()` then `nar.run(3)` |
| 5 | Optimizer finds params that improve over default | Benchmark task + grid search |

---

## Success Metrics

| Metric | Target | How |
|---|---|---|
| Strategy selection change | Zero engine code changes | Config/registry change only |
| LM cost | Deterministic upper bound per cycle | `maxRules` caps LM calls |
| Adaptation overhead | < 1ms per cycle | Runs every N=50 cycles |
| Optimization search | Automated grid/random | GridSampler/RandomSampler |
| Backward compat | All existing tests pass | New code wraps existing behavior |
| New strategy addition | Single `register()` call | Registry pattern |
| Runtime strategy switch | Sub-cycle latency | `setStrategy()` + `reconfigure()` |

---

## Conclusion

The architecture achieves 5 independent plug points with corrected phasing:

1. **SamplingStrategy** — what enters the loop
2. **Strategy** — what pairs with what
3. **DerivationStrategy** — how derivation proceeds
4. **LMRuleSelector** — which LM rules fire
5. **AttentionModel** — how priority evolves

**Phasing corrected**: All implementations (Phase 1) compile before the registry (Phase 2) references them. The NAR constructor (Phase 3) wires everything together only after all components exist. Backward compat is explicit — legacy paths continue to work without CognitiveController.

Every interface ships with built-in implementations matching current behavior. Adding a new strategy is `registry.register()`. Runtime switching is `controller.setStrategy()`. The highest-ROI step remains Phase 0.1 (~40 lines, immediate LM cost control).
