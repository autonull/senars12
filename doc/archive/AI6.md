# AI6.md: Pluggable Cognitive Architecture Plan

## Vision

Transform SeNARS from a fixed cognitive architecture into a **modular, pluggable framework** where every reasoning component can be swapped, optimized, or evolved without code changes. The architecture should support:

1. **Pluggable Strategies**: Premise selection, inference rules, LM rule selection, attention mechanisms
2. **Configurable Parameters**: All hyperparameters exposed, tunable, and optimizable
3. **Searchable/Optimizable Space**: Define parameter spaces for automated tuning
4. **Multiple Implementations**: Support alternative implementations of core components
5. **Hot-Swappable Components**: Change strategies at runtime for adaptive cognition

## Current State (Post-AI5)

### ✅ Completed
- **CognitiveParameters**: Unified configuration interface with all hyperparameters
- **InferenceController**: Centralized orchestration of inference flow
- **Priority Boosting**: Configurable attention priming mechanism
- **LM Rule Gating**: Priority-based activation with configurable thresholds
- **Parameter Space**: Defined ranges for optimization

### ⚠️  Limitations
- Strategies are hardcoded in Reasoner/InferenceController
- No mechanism to select alternative premise selection strategies
- LM rule firing is sequential and fixed
- No support for runtime strategy switching
- Parameter optimization requires manual tuning

## Architecture Goals

### Goal 1: Pluggable Premise Selection

**Current**: `strategy.selectSecondary(task, memory)` returns fixed list

**Target**: Multiple strategies available, selectable by:
- Strategy name: `'default-formation' | 'goal-driven' | 'analogical' | 'term-link'`
- Strategy composition: Chain multiple strategies
- Dynamic selection: Choose based on task type, concept priority, or learning

**Implementation**:
```typescript
interface PremiseSelector {
  select(task: Task, memory: Memory, context: SelectionContext): Task[];
}

// Multiple implementations
const defaultSelector = new DefaultFormationSelector();
const goalDrivenSelector = new GoalDrivenSelector();
const analogicalSelector = new AnalogicalSelector();

// Configurable selection
config.premiseSelection = {
  strategy: 'composite',
  strategies: ['goal-driven', 'analogical'],
  weights: [0.6, 0.4],
  maxResults: 10
};
```

### Goal 2: Pluggable Inference Rules

**Current**: Rules registered in RuleProcessor, fire based on pattern matching

**Target**: Rule sets as pluggable modules
- Load/unload rule packs
- Rule priorities and gating
- Context-aware rule activation

**Implementation**:
```typescript
interface RulePack {
  id: string;
  rules: RegisteredRule[];
  conditions: RuleActivationCondition[];
}

// Configurable rule sets
config.rulePacks = [
  'core-logic',      // Deduction, induction, abduction
  'lm-enhanced',     // LM-based rules
  'temporal',        // Time-based reasoning
  'spatial'          // Spatial reasoning (if needed)
];
```

### Goal 3: Pluggable LM Rule Selection

**Current**: All 13 LM rules fire sequentially if priority threshold met

**Target**: Flexible LM rule orchestration
- Strategy-based selection: priority, rotation, diversity, learning-based
- Parallel execution where safe
- Budget-aware: limit by time, count, or computational cost

**Implementation**:
```typescript
interface LMRuleSelector {
  select(rules: LMRule[], context: LMContext): LMRule[];
}

// Strategies
const prioritySelector = new PriorityBasedSelector();  // Highest priority rules
const rotationSelector = new RoundRobinSelector();     // Fair rotation
const diversitySelector = new DiversitySelector();     // Maximize variety
const learningSelector = new LearnedSelector();        // ML-based selection

config.lm.selection = {
  strategy: 'diversity',
  maxRules: 5,
  timeout: 10000,
  parallelize: true
};
```

### Goal 4: Pluggable Attention Mechanisms

**Current**: Simple priority boost on mention

**Target**: Rich attention models
- Spreading activation
- Goal-relevance scoring
- Novelty detection
- Emotional/salience weighting

**Implementation**:
```typescript
interface AttentionModel {
  prime(concept: Concept, context: AttentionContext): void;
  decay(concept: Concept): number;
  getFocus(memory: Memory): Concept[];
}

config.attention = {
  model: 'spreading-activation',
  parameters: {
    decayRate: 0.05,
    propagationStrength: 0.1,
    iterations: 2
  }
};
```

### Goal 5: Pluggable Derivation Strategies

**Current**: Fixed derivation loop with depth/quality limits

**Target**: Multiple derivation strategies
- Exhaustive: Try all combinations
- Anytime: Stop when timeout/quality met
- Focused: Prioritize high-relevance derivations
- Monte Carlo: Sample and estimate

**Implementation**:
```typescript
interface DerivationStrategy {
  derive(task: Task, memory: Memory, config: DerivationConfig): Task[];
}

config.derivation = {
  strategy: 'anytime',
  maxTime: 5000,
  minQuality: 0.7,
  earlyStopping: true
};
```

## Component Matrix

| Component | Current State | Target Flexibility | Optimization Space |
|-----------|---------------|-------------------|-------------------|
| **Premise Selection** | Fixed strategy | Pluggable selector | Strategy choice, weights, thresholds |
| **Inference Rules** | Registered rules | Rule packs | Which packs, rule priorities |
| **LM Rule Selection** | Sequential all | Selector strategy | Strategy, max rules, parallelization |
| **Attention** | Simple boost | Attention model | Model type, parameters |
| **Derivation** | Fixed loop | Derivation strategy | Strategy, limits, stopping criteria |
| **Priority Management** | Scalar value | Multi-factor score | Weight factors, decay rates |
| **Memory Sampling** | Top-N by priority | Sampling strategy | Strategy (priority, diversity, relevance) |

## Implementation Plan

### Phase 1: Abstraction Layer (Priority: HIGH)

Create interfaces for all pluggable components:

```typescript
// src/nar/strategies/types.ts
export interface PremiseSelector {
  select(task: Task, memory: Memory, config: SelectionConfig): Task[];
  getMetadata(): SelectorMetadata;
}

export interface LMRuleSelector {
  select(rules: LMRule[], context: LMContext): LMRule[];
  getMetadata(): SelectorMetadata;
}

export interface AttentionModel {
  prime(concept: Concept, context: AttentionContext): void;
  decay(concept: Concept, cycles: number): number;
}

export interface DerivationStrategy {
  canDerive(config: DerivationConfig): boolean;
  derive(task: Task, memory: Memory, config: DerivationConfig): Task[];
}
```

### Phase 2: Strategy Implementations (Priority: HIGH)

Implement multiple strategies for each component:

**Premise Selectors**:
- `DefaultFormationSelector`: Current behavior (term overlap)
- `GoalDrivenSelector`: Prioritize goal-relevant concepts
- `AnalogicalSelector`: Find structural similarities
- `DiversitySelector`: Maximize conceptual diversity
- `CompositeSelector`: Weighted combination

**LM Rule Selectors**:
- `AllSelector`: Fire all eligible rules (current)
- `PrioritySelector`: Top-N by rule priority
- `RotationSelector`: Round-robin across cycles
- `DiversitySelector`: Maximize output variety
- `LearnedSelector`: ML-based selection (future)

**Attention Models**:
- `SimpleBoost`: Current fixed boost
- `SpreadingActivation`: Propagate through links
- `GoalRelevance`: Boost by goal relevance
- `NoveltyDetection`: Boost unexpected concepts

### Phase 3: Configuration Integration (Priority: HIGH)

Extend `CognitiveParameters` to support strategy selection:

```typescript
export interface CognitiveParameters {
  // ... existing fields ...
  
  strategies: {
    premiseSelection: {
      type: 'default' | 'goal-driven' | 'analogical' | 'composite';
      config?: Record<string, any>;
    };
    
    lmRuleSelection: {
      type: 'all' | 'priority' | 'rotation' | 'diversity';
      config?: { maxRules?: number; parallelize?: boolean };
    };
    
    attention: {
      type: 'simple' | 'spreading' | 'goal-relevance';
      config?: Record<string, any>;
    };
    
    derivation: {
      type: 'exhaustive' | 'anytime' | 'focused';
      config?: { maxTime?: number; minQuality?: number };
    };
  };
}
```

### Phase 4: Factory/Registry System (Priority: MEDIUM)

Create registries for pluggable components:

```typescript
// src/nar/strategies/registry.ts
export class StrategyRegistry {
  private premiseSelectors: Map<string, PremiseSelector>;
  private lmSelectors: Map<string, LMRuleSelector>;
  private attentionModels: Map<string, AttentionModel>;
  
  registerPremiseSelector(name: string, selector: PremiseSelector): void;
  getPremiseSelector(name: string): PremiseSelector;
  
  // Similar for other strategy types
}

// Usage
const registry = new StrategyRegistry();
registry.registerPremiseSelector('goal-driven', new GoalDrivenSelector());
registry.registerLMRuleSelector('diversity', new DiversitySelector());

const nar = SeNARSFactory.createDefault({
  strategies: {
    premiseSelection: 'goal-driven',
    lmRuleSelection: 'diversity'
  }
});
```

### Phase 5: Runtime Adaptation (Priority: MEDIUM)

Enable dynamic strategy switching:

```typescript
class AdaptiveCognitiveController {
  private params: CognitiveParameters;
  private metrics: CognitiveMetrics;
  
  // Monitor performance and adjust strategies
  monitorAndAdapt(): void {
    if (this.metrics.inferenceSpeed < threshold) {
      this.params.strategies.lmRuleSelection.type = 'priority';
      this.params.lm.maxRulesPerCycle = 3;
    }
    
    if (this.metrics.goalSatisfaction < threshold) {
      this.params.strategies.premiseSelection.type = 'goal-driven';
    }
  }
}
```

### Phase 6: Optimization Framework (Priority: LOW)

Automated parameter and strategy optimization:

```typescript
interface OptimizationConfig {
  objective: 'speed' | 'accuracy' | 'coverage' | 'custom';
  budget: { maxEvaluations: number; maxTime: number };
  algorithm: 'grid' | 'random' | 'bayesian' | 'evolutionary';
}

class CognitiveOptimizer {
  optimize(params: CognitiveParameters, config: OptimizationConfig): CognitiveParameters {
    // Run cognitive tasks with different params
    // Evaluate against objective
    // Return best configuration
  }
}
```

## Parameter Space Definitions

Complete parameter space for optimization:

```typescript
export const COGNITIVE_PARAMETER_SPACE = {
  // Priority management
  'priority.initial': { type: 'float', min: 0.01, max: 0.3, log: true },
  'priority.threshold': { type: 'float', min: 0.05, max: 0.3 },
  'priority.lmThreshold': { type: 'float', min: 0.2, max: 0.8 },
  'priority.boost': { type: 'float', min: 0.1, max: 0.5 },
  
  // Strategy choices (categorical)
  'strategy.premise': { 
    type: 'categorical',
    values: ['default', 'goal-driven', 'analogical', 'diverse']
  },
  'strategy.lm': {
    type: 'categorical',
    values: ['all', 'priority', 'rotation', 'diversity']
  },
  'strategy.attention': {
    type: 'categorical',
    values: ['simple', 'spreading', 'goal-relevance']
  },
  
  // LM configuration
  'lm.maxRules': { type: 'int', min: 1, max: 13 },
  'lm.timeout': { type: 'int', min: 1000, max: 30000, log: true },
  'lm.parallelize': { type: 'boolean' },
  
  // Inference control
  'inference.maxDerivations': { type: 'int', min: 100, max: 10000, log: true },
  'inference.maxDepth': { type: 'int', min: 5, max: 20 },
  'inference.qualityThreshold': { type: 'float', min: 0, max: 0.9 },
  
  // Attention
  'attention.decayRate': { type: 'float', min: 0.01, max: 0.2 },
  'attention.propagation': { type: 'float', min: 0, max: 0.3 },
  'attention.iterations': { type: 'int', min: 1, max: 5 }
} as const;
```

## Testing Strategy

### Unit Tests
- Each strategy implementation
- Parameter validation
- Registry operations

### Integration Tests
- Strategy + memory interaction
- End-to-end cognitive cycle
- Performance under different configurations

### Benchmarking
- Standardized cognitive tasks
- Metrics: speed, accuracy, coverage, belief quality
- Compare configurations

### Optimization Validation
- Run optimizers on benchmark tasks
- Verify improved performance
- Document optimal configurations for different use cases

## Success Metrics

1. **Flexibility**: Can swap strategies without code changes? ✓
2. **Configurability**: All hyperparameters exposed and tunable? ✓
3. **Optimizability**: Can run automated search over parameter space? ✓
4. **Performance**: No degradation vs. hardcoded version? ✓
5. **Modularity**: Components independently testable? ✓

## Next Steps

1. **Define interfaces** for all pluggable components (Phase 1)
2. **Refactor existing strategies** to implement interfaces (Phase 2)
3. **Extend configuration** to support strategy selection (Phase 3)
4. **Create registry** for component management (Phase 4)
5. **Implement 2-3 strategies** per component for diversity (Phase 2)
6. **Build optimization framework** for automated tuning (Phase 6)
7. **Document** configuration options and best practices

## Conclusion

This architecture transforms SeNARS from a fixed cognitive system into a **flexible, optimizable framework** that can adapt to different tasks, domains, and performance requirements. The key insight is that cognition is not one-size-fits-all: different tasks require different reasoning strategies, and the system should support exploring this space systematically.

By making everything pluggable and configurable, we enable:
- **Research**: Test hypotheses about cognitive architectures
- **Optimization**: Automatically tune for specific tasks
- **Adaptation**: Switch strategies based on context
- **Evolution**: Explore novel cognitive configurations

The end goal: a cognitive architecture that can **learn not just what to think, but how to think**.
