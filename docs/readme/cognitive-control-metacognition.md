## Cognitive Control & Metacognition

The kernel observes and regulates its own cognition: a System 1/System 2 division of labor, an executive controller that adapts strategies, eight specialized analyzers, schema induction, feedback learning, and reasoning about reasoning — all within AIKR bounds.

### Cognition (System 1/2 + Executive)

**System 1 — Intuitive/Associative (LM-Enhanced):**

```typescript
// LLM-driven memory enrichment
await nar.enrichMemoryWithLM();

// Bidirectional feedback on hypotheses
await nar.processHypothesisWithFeedback(task);

// Proactive knowledge generation
nar.config.enableProactiveEnrichment = true;
```

**System 2 — Analytical (Symbolic):**

```typescript
// Structured derivation with full trace
const trace = nar.traceTerm(term);
const explanation = nar.explain(conclusion);
const derivation = nar.getDerivationHistory(task);
```

**Executive Controller (Metacognition):**

```typescript
import { CognitiveController } from '@senars/nar/cognitive';
import { CognitiveParameters } from '@senars/nar/config/cognitive-parameters';

const controller = new CognitiveController(registry, memory, processor, metrics, rlfp, params);
controller.adapt();  // Auto-tune strategies based on performance

// Attention models
SimpleAttention | SpreadingActivation | GoalRelevanceAttention | CompositeAttention

// Drives (intrinsic motivation)
CuriosityDrive | CompetenceDrive | CoherenceDrive | SocialDrive
```

**Cognitive Analyzers (8 specialized monitors):**

| Analyzer | Purpose |
|----------|---------|
| `capabilities` | Tracks reasoning capability metrics |
| `corrections` | Detects and logs reasoning errors |
| `performance` | Monitors throughput, latency, resource usage |
| `policy` | Validates actions against guardrails |
| `quality` | Assesses coherence, relevance, completeness |
| `reasoning-patterns` | Identifies recurring derivation structures |
| `resources` | Tracks memory/CPU pressure, bag utilization |
| `term-patterns` | Analyzes term usage and concept relationships |

**Schema Induction — Learning Reusable Patterns:**

```typescript
import { SchemaInductor, createSchemaInductor } from '@senars/nar/learning';

// LM proposes schemas from successful derivation chains
// NARS validates and adopts as higher-order concepts
const inductor = createSchemaInductor(memory, lmService);
const schemas = await inductor.induceFromDerivations(derivations);
// e.g. "(?A --> ?B) & (?B --> ?C) ==> (?A --> ?C)" [transitivity]
```

**Reasoning About Reasoning (Metacognitive Self-Analysis):**

```typescript
import { ReasoningAboutReasoning } from '@senars/nar/self';

const self = nar.getSelfAnalyzer();
await self.performMetaCognitiveReasoning();  // Analyzes own reasoning quality
await self.performSelfCorrection();          // Applies optimizations
const gaps = await self.analyzeReasoningGaps();  // Missing rules, low-confidence beliefs
const quality = await self.assessQuality();  // { coherence, relevance, completeness }
const state = self.querySystemState();       // Full system snapshot
```
