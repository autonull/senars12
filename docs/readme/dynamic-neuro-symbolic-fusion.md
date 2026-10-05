### Dynamic Neuro-Symbolic Fusion

Key features:
- Belief/goal/question **candidate generation** from LLM (multi-hypothesis, not single parse)
- Semantic similarity rules using embeddings
- Meta-reasoning about reasoning quality
- Structured output via JSON schemas (function calling)
- Bidirectional feedback: NAR ↔ LM correction loops
- Proactive enrichment: LM generates background knowledge
- Tool dispatching: LM rules can call NAR tools
- Per-rule timeout & circuit breaker
- Activation conditions (confidence, connectivity, curiosity, complexity)
- Constitution-aware rules respect system invariants
- **GBNF constrained decoding** (`LMRuleDefinition.grammar` — `narsese-term` / `single-word`)
- **Universal failure escalation**: attempt → retry at temp+0.2 → `null` → symbolic fallback
- **Shadow validation**: LLM-generated Narsese conflicting with current beliefs is silently dropped

> **Universal prompts, symbolic fallbacks.** Constrained micro-prompts run on 1.5B
> edge models; larger models execute the same prompts with higher fidelity. On LM
> failure — timeout, malformed output, refusal — the kernel falls back to pure NAL
> symbolic logic (`symbolicFallbacks` in `nar/src/lm/rule-templates/fallbacks.ts`).
> Every cognitive function has a symbolic path; none depends on LM availability.

<details>
<summary><b>Complete LLM Rule Matrix (Belief, Goal, Question, Meta V2)</b></summary>

| Category | Rule ID | Name | Description |
|----------|---------|------|-------------|
| **Belief** | `lm-narsese-translation` | LMNarseseTranslationRule | Translates natural language to Narsese candidates |
| | `lm-belief-revision` | LMBeliefRevisionRule | Revises belief confidence based on context |
| | `lm-hypothesis-generation` | LMHypothesisGenerationRule | Generates hypotheses from observations |
| | `lm-explanation-generation` | LMExplanationGenerationRule | Generates explanations for beliefs |
| | `lm-analogical-reasoning` | LMAnalogicalReasoningRule | Performs analogical reasoning between concepts |
| | `lm-meta-reasoning` | LMMetaReasoningGuidanceRule | Provides meta-level reasoning guidance |
| | `lm-uncertainty-calibration` | LMUncertaintyCalibrationRule | Calibrates uncertainty in beliefs |
| | `lm-schema-induction` | LMSchemaInductionRule | Induces schemas from examples |
| | `lm-temporal-causal` | LMTemporalCausalModelingRule | Models temporal and causal relationships |
| | `lm-variable-grounding` | LMVariableGroundingRule | Grounds variables in concrete instances |
| | `lm-concept-elaboration` | LMConceptElaborationRule | Elaborates on concept properties |
| **Goal** | `lm-goal-decomposition` | LMGoalDecompositionRule | Decomposes complex goals into subgoals |
| **Question** | `lm-curiosity-question` | LMCuriosityQuestionRule | Generates questions driven by curiosity |
| | `lm-interactive-clarification` | LMInteractiveClarificationRule | Seeks clarification for ambiguous inputs |
| **Meta (V2)** | `lm-v2-hypothesis` | LMV2HypothesisRule | Generates typed hypotheses with truth values |
| | `lm-v2-explanation` | LMV2ExplanationRule | Generates typed explanations with key premises |
| | `lm-v2-analogy` | LMV2AnalogyRule | Finds structural analogies between concepts |
| | `lm-v2-causal` | LMV2CausalRule | Models causal relationships |
| | `lm-v2-schema` | LMV2SchemaRule | Induces reusable schemas from patterns |

</details>

```typescript
import { LMRules, LMRule } from '@senars/nar/lm';
import { createLMService } from '@senars/nar/lm/lm-service';

const lmService = createLMService(config);
const rules = LMRules.createAll(lmService);

// Dynamic rule selection strategies
AllSelector | PrioritySelector | RotationSelector | DiverseSelector
```
