# GROW2: Cognitive Synergy Architecture for SeNARS

## Mission
**Build a neuro-symbolic cognitive architecture where Language Models and Narsese Logic amplify each other's strengths, creating reasoning capabilities neither could achieve alone.**

The goal is **Cognitive Democracy**: complex reasoning, memory management, attention control, and creative synthesis accessible through natural language — without requiring knowledge of NAL syntax.

---

## Core Philosophy: LM + NAL Synergy

NAL and LM are complementary reasoning systems with orthogonal strengths:

| Dimension | NAL (SeNARS) | LM (Language Model) | Synergy |
|-----------|--------------|---------------------|---------|
| **Reasoning** | Sound, traceable, compositional | Broad, approximate, contextual | LM suggests → NAL validates |
| **Knowledge** | Explicit, structured, revisable | Implicit, distributed, static | LM harvests → NAL stores |
| **Language** | None (requires Narsese) | Native understanding/generation | NL → LM → NAL → LM → NL |
| **Uncertainty** | Frequency-confidence calculus | Implicit, uncalibrated | LM proposes → NAL calibrates |
| **Coverage** | Limited to defined rules | Open-ended, creative | LM discovers → NAL formalizes |
| **Speed** | Fast symbolic operations | Slow, expensive | NAL filters → LM enriches |

### Processing Pipeline

```
User Input (NL)
  ▼
┌─ NLAnalyzer ──────────────────────┐
│  Intent classification + concept   │  ← Extends existing InputClassifier
│  extraction + ambiguity detection  │
└───────────────────────────────────┘
  ▼
┌─ NLTranslator ────────────────────┐
│  Tier 1: regex (fast path)         │  ← Extends existing NL_PATTERNS
│  Tier 2: structured LM (Zod)       │  ← Extends existing NLTranslator
│  Tier 3: freeform LM (fallback)    │
│  Validation gate: termParser       │
└───────────────────────────────────┘
  ▼
┌─ Reasoning Engine ────────────────┐
│  NAL rules: sound inference        │  ← Existing RuleProcessor
│  LM rules: creative extension      │  ← Existing 13 LM rules + activation
│  Premise selection: symbolic+sem   │  ← EmbeddingLayer + LinkManager
│  Derivation: depth-controlled      │  ← Existing Reasoner + budget
└───────────────────────────────────┘
  ▼
┌─ ResultInterpreter ───────────────┐
│  Derivation summarization          │  ← NEW: chain → NL
│  Confidence hedging                │  ← NEW: truth → NL
│  Contradiction explanation         │  ← NEW: conflict → NL
│  "I don't know" + suggestions      │  ← NEW: backward chaining
└───────────────────────────────────┘
  ▼
User Output (NL + optional Narsese debug)
```

### Handoff Protocol

1. **LM → NAL**: LM output validated by `termParser.parse()`. Invalid → self-correction (2 retries with error feedback). Accepted beliefs tagged `source: 'lm'`, confidence discounted (`c *= 0.85`).

2. **NAL → LM**: Derivation results include full path (premise terms, rule IDs, output truth). LM receives structured context, not raw Narsese.

3. **NAL ↔ NAL**: Rule outputs validated for well-formedness, tautology, operation-kind-in-declarative-context (per BOT7 audit). Invalid → logged and discarded.

---

## Part 1: Unified NL Processing

### 1.1 NLAnalyzer — Single Input Analysis Component

Replaces the redundant `InputClassifier` + separate intent detection. One component does it all:

```typescript
interface NLAnalysis {
    intents: NLIntent[];           // One or more composable intents
    concepts: string[];            // Extracted concept terms
    ambiguity: Ambiguity[];        // When clarification needed
    confidence: number;            // Overall analysis confidence
}

interface NLIntent {
    type: 'believe' | 'query' | 'goal' | 'forget' | 'focus' | 'explain'
         | 'counterfactual' | 'discover' | 'save' | 'recall';
    payload: Record<string, unknown>;
    priority: number;              // Execution order
    dependsOn?: string[];          // Data dependencies between intents
}
```

The analyzer combines three signals (replacing the old separate classifiers):

```typescript
class NLAnalyzer {
    analyze(input: string, ctx: BotContext): NLAnalysis {
        // Signal 1: structural (prefix/suffix patterns)
        const structural = this.detectStructure(input);
        // Signal 2: keyword (semantic patterns)
        const keywords = this.detectKeywords(input);
        // Signal 3: Narsese syntax (parse probe)
        const narsese = this.detectNarsese(input);

        // Weighted fusion (replaces old classify() + separate intent detection)
        const intents = this.fuseSignals(structural, keywords, narsese, input);
        const ambiguity = this.detectAmbiguity(intents, input);

        return { intents, concepts: this.extractConcepts(input), ambiguity,
                 confidence: this.computeConfidence(intents, ambiguity) };
    }
}
```

### 1.2 NLTranslator — Tiered Translation

Extends the existing `NLTranslator` with a 3-tier strategy:

| Tier | Method | Speed | Coverage | When |
|------|--------|-------|----------|------|
| 1 | Regex patterns | Instant | ~40% | Common patterns match |
| 2 | Structured LM (Zod) | ~1s | ~40% | Regex fails, input unambiguous |
| 3 | Freeform LM | ~2s | ~20% | Complex, ambiguous, compound |

**Tier 1** extends existing `DEFAULT_NL_PARSERS` (BOT7 §2.1 patterns):

```typescript
const NL_PATTERNS: NLParserDef[] = [
    { match: /^all\s+(\S+)\s+are\s+(\S+)/i,  translate: m => `(<${m[1]} --> ${m[2]}>. :1.0:0.9)` },
    { match: /^some\s+(\S+)\s+are\s+(\S+)/i,  translate: m => `(<${m[1]} --> ${m[2]}>. :0.5:0.5)` },
    { match: /^(\S+)\s+is\s+a\s+(\S+)/i,     translate: m => `(<${m[1]} --> ${m[2]}>.)` },
    { match: /^(\S+)\s+is\s+(\S+)/i,         translate: m => `(<${m[1]} --> [${m[2]}]>. :0.9:0.9)` },
    { match: /^(\S+)\s+is\s+like\s+(\S+)/i,  translate: m => `(<${m[1]} <-> ${m[2]}>. :0.8:0.8)` },
    { match: /^(\S+)\s+causes\s+(\S+)/i,     translate: m => `((<${m[1]}> =/> <${m[2]}>). :0.8:0.8)` },
    { match: /^if\s+(\S+)\s+then\s+(\S+)/i,  translate: m => `((<${m[1]}> ==> <${m[2]}>). :0.9:0.9)` },
    { match: /^(\S+)\s+is\s+not\s+a?\s*(\S+)/i, translate: m => `(--(<${m[1]} --> ${m[2]}>). :0.9:0.9)` },
    { match: /^what\s+is\s+(\S+)/i,          translate: m => `(<${m[1]} --> ?>)` },
    { match: /^is\s+(\S+)\s+a\s+(\S+)/i,     translate: m => `(<${m[1]} --> ${m[2]}>?)` },
];
```

**Tier 2** uses existing `NLTranslator` with `TranslationSchema`, enhanced with context:

```typescript
async translateWithLM(nl: string, ctx: BotContext): Promise<TranslationResult> {
    const {object} = await generateObject({
        model: getStructuredModel(registry),
        prompt: buildTranslationPrompt(nl, ctx),  // Includes attention, few-shot, syntax
        schema: TranslationSchema,                 // Existing schema from schemas.ts
    });
    return { ...object, beliefs: object.beliefs.filter(b => validateNarsese(b.narsese)) };
}
```

**Tier 3** fallback when structured output fails:

```typescript
async translateFreeform(nl: string): Promise<string | null> {
    const r = await lm.generateText(`Convert to Narsese: "${nl}". Output only valid Narsese.`);
    return validateNarsese(r) ? r : null;
}
```

### 1.3 Self-Correction Loop

Built into the translator — no separate component needed:

```typescript
async translate(nl: string, ctx: BotContext, maxRetries = 2): Promise<TranslationResult | string | null> {
    let lastError: string | null = null;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            // Tier 1 → Tier 2 → Tier 3, with error feedback on retry
            const result = await this.tryTiers(nl, ctx, lastError);
            if (result) { translationCache.record(nl, result); return result; }
            lastError = 'No valid output produced';
        } catch (e) { lastError = e.message; }
    }
    return null;
}
```

### 1.4 Compound Intent Decomposition

Uses existing `GoalDecompositionSchema` — no new schema needed:

```
User: "Remember cats are mammals, then figure out if Whiskers is an animal, and forget anything about fish."

Decomposition (via LM + GoalDecompositionSchema):
[
  { type: 'believe', payload: { narsese: '<cat --> mammal>. :1.0:0.9' }, priority: 1 },
  { type: 'query',   payload: { narsese: '<Whiskers --> animal>?' },     priority: 2, dependsOn: ['intent-1'] },
  { type: 'forget',  payload: { pattern: 'fish' },                       priority: 3 }
]
```

### 1.5 Clarification Protocol

Uses existing `ClarificationSchema` — no new schema needed:

```
User: "Birds fly"
System detects: 3 valid parses (universal/existential/property), confidence too low
System: "Do you mean 'All birds fly', 'Some birds fly', or 'Flying is a property of birds'?"
User: "All of them"
System: [Resolves → (<bird --> fly>. :1.0:0.9), records correction]
```

### 1.6 Cognitive Commands via NL

| User Intent | Internal Action | Existing Component |
|-------------|-----------------|-------------------|
| "Remember that X" | `nar.believe(translate(X))` | `nar.believe()` |
| "Forget everything about X" | `nar.memory.removeConceptsMatching(X)` | `Memory.removeConcept()` |
| "Focus on X" | `focus.boostTopic(X, factor=2.0, ttl=50)` | Extend existing `Focus` |
| "Why do you think X?" | `nar.explain(translate(X))` | `ExplainTool` |
| "What if X weren't Y?" | `counterfactual(translate(X), false)` | NEW (Part 9) |
| "Find connections between X and Y" | `nar.discoverRelations([X, Y])` | `LinkManager` |
| "Save this thought" | `nar.episodic.save(currentContext)` | `EpisodicMemory` |
| "What were we talking about?" | `nar.episodic.recallRecent()` | `EpisodicMemory` |
| "Think deeply about X" | `nar.run(depth=10, focus=X)` | `Reasoner` |

---

## Part 2: LM Context & Prompting

### 2.1 Shared Context Assembly

One `ContextBuilder` serves all LM calls (translation, explanation, clarification, LM rules):

```typescript
class ContextBuilder {
    build(nar: NAR, input: string, ctx: BotContext, opts: ContextOpts): string {
        const parts: string[] = [];

        if (opts.attention)  parts.push(formatAttention(nar.attentionReport(10)));
        if (opts.beliefs)    parts.push(formatBeliefs(nar.getRelatedBeliefs(extractTerms(input), { max: 15 })));
        if (opts.derivations && ctx.turn.reasoningResult?.newBeliefs?.length)
            parts.push(formatDerivations(ctx.turn.reasoningResult.newBeliefs.slice(0, 5)));
        if (opts.goals)      parts.push(formatGoals(nar.getGoals()));
        if (opts.examples)   parts.push(formatExamples(translationCache.getRelevant(input, 3)));
        if (opts.history && ctx.conversation.messageCount > 20)
            parts.push(ctx.conversation.summary ?? '');
        if (opts.pinned)     parts.push(formatPinned(ctx.conversation.getPinned()));

        return truncateToBudget(parts.join('\n'), opts.tokenBudget ?? 2000);
    }
}
```

**Context fragments** (from BOT6) are just methods on this builder — no separate registry needed:

```typescript
// Each LM rule declares what it needs; ContextBuilder assembles only those fragments
const fragmentMap = {
    attention:     () => formatAttention(nar.attentionReport(10)),
    beliefs:       (t) => formatBeliefs(nar.getRelatedBeliefs(t, { max: 10 })),
    links:         (t) => formatLinks(nar.memory.getLinkManager().getLinks(t)),
    goals:         () => formatGoals(nar.getGoals()),
    derivations:   () => formatDerivations(ctx.turn.reasoningResult?.newBeliefs ?? []),
    memoryHealth:  () => `Memory: ${nar.getStatistics().totalConcepts} concepts, pressure ${(nar.getStatistics().memoryPressure * 100).toFixed(0)}%`,
    focus:         () => formatConcepts(nar.memory.getFocusConcepts()),
    pinned:        () => formatPinned(ctx.conversation.getPinned()),
    examples:      (i) => formatExamples(translationCache.getRelevant(i, 3)),
};
```

### 2.2 Schema Validation

All existing Zod schemas in `src/nar/nl/schemas.ts` are reused. No new schemas:

| Schema | Used For | Existing |
|--------|----------|----------|
| `TranslationSchema` | NL→NAL translation | Yes |
| `ExplanationSchema` | Derivation explanation | Yes |
| `GoalDecompositionSchema` | Compound intent | Yes |
| `ClarificationSchema` | Ambiguity resolution | Yes |
| `HypothesisSchema` | Knowledge harvesting | Yes |
| `AnalogySchema` | Analogical reasoning | Yes |
| `MetaReasoningSchema` | Meta-cognitive guidance | Yes |
| `UncertaintySchema` | Confidence calibration | Yes |
| `TemporalCausalSchema` | Causal discovery | Yes |
| `VariableGroundingSchema` | Variable instantiation | Yes |
| `ConceptElaborationSchema` | Concept enrichment | Yes |

### 2.3 Prompt Templates

Three templates share common context assembly via `ContextBuilder`:

**Translation** (Tier 2):
```
You translate natural language to Narsese logic.
{context: attention, beliefs, examples}
Narsese syntax: (A --> B) inheritance, (A <-> B) similarity, (A ==> B) implication,
  (A =/> B) temporal, [property], --(negation)
Rules: universal→f:1.0, typical→f:0.9, existential→f:0.5, cap c<1.0 unless "all"
Translate: "{input}"
```

**Explanation**:
```
Explain this reasoning result.
{context: beliefs, derivations}
Conclusion: {conclusion_narsese} → {conclusion_nl}
Derivation: {derivation_path}
Truth: f={f}, c={c}
Include: meaning, derivation (simple), confidence, what would strengthen/weaken it.
```

**Clarification**:
```
The input "{input}" is ambiguous. Interpretations: {options}
Generate a clarifying question. Return: { "question": "...", "options": ["..."] }
```

---

## Part 3: Result Interpretation

### 3.1 Single ResultInterpreter Component

Handles all output transformation — no separate confidence/contradiction/unknown handlers:

```typescript
class ResultInterpreter {
    interpret(derivation: DerivationResult | null, query: Term, nar: NAR): string {
        if (!derivation) return this.handleUnknown(query, nar);

        const conflicts = this.findConflicts(derivation, nar);
        if (conflicts.length) return this.explainConflict(derivation, conflicts, nar);

        return this.explainDerivation(derivation, nar);
    }

    private explainDerivation(d: DerivationResult, nar: NAR): string {
        const summary = this.summarizeChain(d);
        const hedge = truthToNL(d.conclusion.truth).hedge;
        return `${hedge}: ${summary.conclusion}. ` +
               `Derived via ${summary.reasoningType} from ${summary.keyPremises.join(', ')}.` +
               (summary.wouldBenefitFrom.length
                   ? ` Would be stronger if I knew: ${summary.wouldBenefitFrom.join(', ')}.` : '');
    }

    private handleUnknown(query: Term, nar: NAR): string {
        const related = nar.getRelatedBeliefs(query).slice(0, 3);
        const missing = findWhatWouldAnswer(query, nar);
        return `I don't have enough information about ${termToNL(query)}.` +
               (related.length ? ` I know: ${related.map(beliefToNL).join('; ')}.` : '') +
               (missing.length ? ` If I knew "${linkToNL(missing[0])}", I could answer.` : '');
    }
}
```

### 3.2 Confidence Hedging

Single function, used everywhere:

| Confidence | Hedge |
|------------|-------|
| > 0.8 | "I am confident that..." |
| 0.6-0.8 | "I believe that..." |
| 0.4-0.6 | "It seems that..." |
| 0.2-0.4 | "I'm not sure, but possibly..." |
| < 0.2 | "I have very little evidence for..." |

```typescript
function truthToNL(truth: Truth): string {
    const { c } = truth;
    return c > 0.8 ? 'I am confident that'
         : c > 0.6 ? 'I believe that'
         : c > 0.4 ? 'It seems that'
         : c > 0.2 ? "I'm not sure, but possibly"
         : 'I have very little evidence for';
}
```

---

## Part 4: LM-NAL Reasoning Integration

### 4.1 LM Rules as Complementary Inference

The 13 existing LM rules (`src/nar/lm/rules.ts`) fire where NAL cannot. Activation is selective — no separate activation component needed, just conditions on each rule:

| LM Rule | Activation Condition | What NAL Cannot Do |
|---------|---------------------|-------------------|
| `lm-narsese-translation` | NL input, regex fails | Understand natural language |
| `lm-belief-revision` | Conflicting beliefs, NAL revision insufficient | Contextual confidence adjustment |
| `lm-goal-decomposition` | Complex goal input | Break goals into subgoals |
| `lm-hypothesis-generation` | Low-confidence observation, depth < 3 | Generate creative hypotheses |
| `lm-explanation-generation` | User asks "why" | Natural language explanation |
| `lm-analogical-reasoning` | Structural similarity > 0.6, no term overlap | Cross-domain analogy |
| `lm-meta-reasoning` | Low derivation rate or high contradiction | Self-aware guidance |
| `lm-uncertainty-calibration` | LM-originated belief | Calibrate overconfidence |
| `lm-schema-induction` | Repeated belief pattern detected | Abstract schema discovery |
| `lm-temporal-causal` | Event sequences observed | Temporal pattern detection |
| `lm-variable-grounding` | Abstract variable in term | Ground in concrete instances |
| `lm-concept-elaboration` | Underconnected concept | Enrich with world knowledge |
| `lm-interactive-clarification` | Ambiguous input detected | Ask clarifying questions |

### 4.2 Single Validation Gate

One function validates all LM output — no separate validators:

```typescript
function validateLMOutput(task: Task, memory: Memory): ValidationResult {
    if (!isWellFormed(task.term))            return { valid: false, reason: 'Malformed term' };
    if (isTautology(task.term))              return { valid: false, reason: 'Tautology' };
    if (task.type === 'belief' && containsOperation(task.term))
                                             return { valid: false, reason: 'Operation in declarative' };
    if (task.source?.startsWith('lm'))       task.truth = Truth.calibrateLM(task.truth); // c *= 0.85
    const conflicts = findConflicts(task.term, memory);
    if (conflicts.length > 0 && task.truth.c < 0.3)
                                             return { valid: false, reason: `Conflicts with ${conflicts.length} beliefs` };
    return { valid: true };
}
```

---

## Part 5: Attention, Memory, and Budget

### 5.1 Goal-Driven Attention — Extend Existing Focus

The existing `Focus` class gets topic-boosting added — no new `AttentionController`:

```typescript
// Extension to existing Focus class
class Focus {
    private topicBoosts = new Map<string, { factor: number; ttl: number }>();

    boostTopic(topic: string, factor = 2.0, ttl = 50): void {
        this.topicBoosts.set(topic, { factor, ttl });
    }

    // Modified existing adjustPriority
    adjustPriority(concept: Concept, basePriority: number): number {
        let p = basePriority;
        for (const [topic, boost] of this.topicBoosts) {
            if (concept.term.toString().includes(topic)) {
                p *= boost.factor;
                boost.ttl--;
                if (boost.ttl <= 0) this.topicBoosts.delete(topic);
            }
        }
        for (const goal of this.activeGoals)
            if (termOverlap(concept.term, goal.term) > 0) p *= 1.5;
        if (concept.lastAccess > Date.now() - 60000) p *= 1.2;
        return Math.min(p, 1.0);
    }
}
```

### 5.2 LM-Assisted Consolidation — Extend Existing Memory

The existing `Memory.consolidate()` gets an LM-assisted mode — no separate component:

```typescript
// Extension to existing Memory.consolidate()
async consolidate(opts: { lm?: LMClient } = {}): Promise<ConsolidationReport> {
    const report = { archived: this.standardConsolidate(), merged: 0, abstracted: 0 };

    if (opts.lm) {
        // LM-assisted: find clusters for abstraction (sleep cycle)
        for (const cluster of this.findDenseClusters()) {
            if (cluster.concepts.length >= 3 && !cluster.hasAbstract) {
                const abs = await opts.lm.generateObject({
                    prompt: `Abstract category for: ${cluster.concepts.map(c => c.term).join(', ')}?`,
                    schema: z.object({ name: z.string(), definition: z.string() }),
                });
                this.createAbstractConcept(abs.name, cluster.concepts);
                report.abstracted++;
            }
        }
        // Merge similar beliefs within concepts
        for (const concept of this.getConcepts()) {
            const similar = this.findSimilarBeliefs(concept);
            if (similar.length > 2) { this.mergeBeliefs(concept, similar); report.merged++; }
        }
    }
    return report;
}
```

### 5.3 Cognitive Budget

Integrated into existing `Config` — no separate budget system:

```typescript
// Extension to existing Config
interface CognitiveBudget {
    maxNALSteps: number; maxLMCalls: number;
    maxDerivationDepth: number; maxMemoryOps: number;
}

const BUDGET_PRESETS: Record<string, CognitiveBudget> = {
    chat:      { maxNALSteps: 3,  maxLMCalls: 1, maxDerivationDepth: 2,  maxMemoryOps: 5  },
    reasoning: { maxNALSteps: 10, maxLMCalls: 3, maxDerivationDepth: 5,  maxMemoryOps: 20 },
    deep:      { maxNALSteps: 20, maxLMCalls: 5, maxDerivationDepth: 10, maxMemoryOps: 50 },
    balanced:  { maxNALSteps: 5,  maxLMCalls: 2, maxDerivationDepth: 3,  maxMemoryOps: 10 },
};
```

Budget allocated by input classification — no separate allocator:

```typescript
function getBudget(classification: Intent, complexity: number): CognitiveBudget {
    if (classification === 'narsese') return BUDGET_PRESETS.reasoning;
    if (classification === 'query' && complexity > 0.7) return BUDGET_PRESETS.deep;
    if (classification === 'chat') return BUDGET_PRESETS.chat;
    return BUDGET_PRESETS.balanced;
}
```

---

## Part 6: LM as Memory Component

### 6.1 Knowledge Harvesting — Reuse lm-concept-elaboration Rule

No new `harvestKnowledge` function — the existing `lm-concept-elaboration` rule already does this. Wire it to trigger when:
- User asks about a term with no beliefs
- Term appears in input but has no concept in memory
- During consolidation for underconnected concepts

```typescript
// Triggered via existing lm-concept-elaboration rule with condition:
// concept.linkCount < avgLinksPerConcept * 0.3
// Output beliefs are automatically validated by validateLMOutput() and added to memory
```

### 6.2 Semantic Premise Selection — Fold into Existing Reasoner

The existing `SemanticStrategy` gets embedding integration — no new `SemanticPremiseSelector`:

```typescript
// Extension to existing SemanticStrategy.selectSecondary()
selectSecondary(primary: Term, candidates: Concept[], topK: number): Concept[] {
    return candidates
        .map(c => ({
            concept: c,
            score: this.linkManager.getLinkStrength(primary, c.term) * 0.5
                 + this.embeddingLayer.similarity(primary, c.term) * 0.3
                 + c.priority * 0.2,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(x => x.concept);
}
```

### 6.3 Proactive Enrichment — Extend Existing ProactiveEnricher

The existing `ProactiveEnricher` already exists at `src/nar/lm/enrichment.ts`. Wire it to:
- Run during idle cycles (AgenticLoop wakeup)
- Run during consolidation with LM enabled
- Use `lm-concept-elaboration` rule for enrichment (no separate harvesting)

---

## Part 7: Unified Feedback Learning

### 7.1 FeedbackLearner — Single Learning Component

Replaces the redundant `CorrectionLearner` + `RLFPBridge` + `RulePriorityLearner`:

```typescript
class FeedbackLearner {
    private corrections: Map<string, { narsese: string; count: number }>;
    private ruleStats: Map<string, { accepted: number; rejected: number }>;

    // Called when user corrects the system
    onCorrection(originalNL: string, originalNarsese: string, correctedNarsese: string): void {
        this.corrections.set(extractPattern(originalNL), { narsese: correctedNarsese, count: 1 });
        translationCache.record(originalNL, correctedNarsese);
        // Feed to existing RLFP system
        rlfpBridge.recordPreference(originalNL, correctedNarsese, originalNarsese);
    }

    // Called when derivation is accepted/rejected by user
    onDerivationOutcome(derivation: Derivation, outcome: 'accepted' | 'rejected'): void {
        for (const ruleId of derivation.ruleIds) {
            const s = this.ruleStats.get(ruleId) ?? { accepted: 0, rejected: 0 };
            s[outcome]++;
            this.ruleStats.set(ruleId, s);
        }
    }

    // Get correction for similar input
    getCorrection(nl: string): string | null {
        return this.corrections.get(extractPattern(nl))?.narsese ?? null;
    }

    // Get adjusted rule priority based on acceptance rate
    getAdjustedPriority(ruleId: string, base: number): number {
        const s = this.ruleStats.get(ruleId);
        if (!s || s.accepted + s.rejected < 5) return base;
        const rate = s.accepted / (s.accepted + s.rejected);
        return Math.max(0.1, Math.min(1.0, base + (rate - 0.5) * 0.2));
    }
}
```

### 7.2 RLFP Integration

The existing RLFP system (`src/nar/rlfp/`) receives preference pairs from `FeedbackLearner`. No new RLFP code needed — just wire the connection:

```typescript
// In FeedbackLearner.onCorrection():
rlfpBridge.recordPreference(input, chosen, rejected);
// Existing RLFP system handles: RewardModel update → PolicyOptimizer → Rule priority adjustment
```

---

## Part 8: Meta-Cognition — Unified Observer

### 8.1 Single Observer Component

Replaces `MetacognitiveMonitor` + `SelfAnalyzer` overlap. One component monitors and acts:

```typescript
class Observer {
    check(nar: NAR): CognitiveState {
        const stats = nar.getStatistics();
        const contradictions = countContradictions(nar.getBeliefs());

        if (contradictions > stats.totalConcepts * 0.1)
            return { state: 'confused',    action: 'resolve-conflicts' };
        if (stats.derivationsPerSecond < 0.01 && stats.totalConcepts > 10)
            return { state: 'bored',       action: 'explore' };
        if (stats.memoryPressure > 0.9)
            return { state: 'overloaded',  action: 'consolidate' };
        return { state: 'normal', action: 'continue' };
    }

    async act(state: CognitiveState, nar: NAR): Promise<void> {
        switch (state.action) {
            case 'resolve-conflicts': this.resolveConflicts(nar); break;
            case 'explore':           this.exploreMemory(nar); break;
            case 'consolidate':       nar.memory.consolidate({ lm: nar.lm }); break;
        }
    }

    // NL Interface
    // "You seem confused."     → reportConflicts()
    // "Are you thinking hard?" → reportState()
    // "Take a break."          → trigger consolidate()
}
```

### 8.2 Advanced Cognitive Functions

These share infrastructure — no separate components for each:

**Temporal Causal Discovery** — uses existing `lm-temporal-causal` rule + event log:
```typescript
// Extension to existing event system
class EventObserver {
    private log: Array<{ event: string; ts: number }> = [];

    observe(event: string): void {
        this.log.push({ event, ts: Date.now() });
        this.log = this.log.filter(e => e.ts > Date.now() - 3600000); // 1h window
    }

    detectPatterns(): TemporalRelation[] {
        // Find events A that consistently precede B within time window
        // Returns patterns → feed to lm-temporal-causal rule → generates (<A> =/> <B>) beliefs
    }
}
```

**Counterfactual Reasoning** — uses existing reasoning engine with temporary state:
```typescript
async counterfactual(term: Term, negate: boolean, nar: NAR): Promise<CounterfactualReport> {
    const original = nar.memory.getBelief(term);
    if (!original) return { possible: false, reason: 'No belief to counterfactual' };

    nar.memory.temporarilyReplace(term, { f: 1 - original.truth.f, c: original.truth.c * 0.5 });
    const result = await nar.run(5);
    const changes = compareBeliefSets(nar.getBeliefsBefore(), nar.getBeliefs());
    nar.memory.restore(term, original);

    return { original: beliefToNL(original), whatWouldChange: changes.map(beliefToNL),
             dependentBeliefs: findDependentBeliefs(term, nar) };
}
```

**Concept Clustering** — uses the same clustering logic as consolidation (§5.2):
```typescript
// Reuses Memory.findDenseClusters() from consolidation
// When user asks "What do X, Y, Z have in common?":
// 1. Find cluster containing X, Y, Z
// 2. If no abstract exists, use LM to suggest one (same as sleep cycle)
// 3. Report abstraction
```

---

## Part 9: Pipeline Architecture

### 9.1 Streamlined Pipeline

11 stages (down from 13 in original GROW2 — removed redundant `NLDecomposer` as separate stage; decomposition happens within `NLAnalyzer`):

```
InputNormalizer → AuthChecker → CommandProcessor* → NLAnalyzer
  → SeNARSProcessor → LMResponder → DirectiveProcessor
  ↻ (loop: SeNARSProcessor → LMResponder → DirectiveProcessor)
  → ResponseComposer → ResponseFormatter → StatePersistor

* CommandProcessor: early exit
```

**NLAnalyzer** absorbs the old `InputClassifier` + `NLDecomposer`:
- Classifies intent (was InputClassifier)
- Detects ambiguity (was separate)
- Decomposes compound intents (was NLDecomposer)
- Extracts concepts (was separate)

### 9.2 Pipeline Presets

| Preset | Stages | Loop-Back | Use Case |
|--------|--------|-----------|----------|
| `full` | All 11 stages | Enabled | Complete LM+NAR |
| `chat` | Normalizer → Auth → Command → NLAnalyzer → LMResponder → Composer → Formatter → Persistor | Disabled | LM-only |
| `reasoning` | Normalizer → Auth → Command → NLAnalyzer → SeNARSProcessor → Composer → Formatter → Persistor | Disabled | NAR-only |

### 9.3 Events — Extend Existing PipelineEventEmitter

From BOT6. Add NL-specific events:

```typescript
interface PipelineEvents {
    // ... existing BOT6 events ...
    'nl:analyzed': { input: string; analysis: NLAnalysis };
    'nl:translation': { nl: string; narsese: string; tier: number };
    'nl:clarification-needed': { ambiguity: Ambiguity };
    'nal:derived': { premises: string[]; rule: string; conclusion: string; truth: Truth };
    'lm:validation-failed': { output: string; reason: string };
    'cognitive:state-change': { oldState: string; newState: string; action: string };
    'feedback:correction': { original: string; corrected: string };
}
```

---

## Part 10: REPL Commands

| Command | Description | Requires |
|---------|-------------|----------|
| `/mode auto\|chat\|reason` | Switch mode | — |
| `/depth N` | Set reasoning depth | SeNARS |
| `/budget chat\|reasoning\|deep\|balanced` | Set cognitive budget | — |
| `/beliefs [pattern]` | List beliefs | SeNARS |
| `/concepts` | Show concept graph | SeNARS |
| `/trace <term>` | Show derivation history | SeNARS |
| `/explain <term>` | Explain in NL | SeNARS + LM |
| `/rules [list\|enable\|disable]` | Manage NAL rules | SeNARS |
| `/lm-rules [list\|enable\|disable]` | Manage LM rules | LM |
| `/focus <topic>` | Set attention focus | SeNARS |
| `/forget <pattern>` | Remove beliefs | SeNARS |
| `/history [N]` | View last N turns | — |
| `/context` | Show attention/focus | SeNARS |
| `/export [file]` | Export beliefs | SeNARS |
| `/import <file>` | Import Narsese | SeNARS |
| `/reset` | Reset state | — |
| `/benchmark` | Run benchmark | SeNARS |
| `/adversarial [scenario]` | Run adversarial test | SeNARS |
| `/self.status` | Show cognitive state | SeNARS |
| `/self.analyze` | Run self-analysis | SeNARS + LM |
| `/debug on\|off` | Toggle Narsese output | — |

---

## Part 11: Testing & Adversarial

### 11.1 Unified Test Infrastructure

Existing benchmark suites (`src/agent/benchmarks/`) + new adversarial scenarios share the same `ScenarioRunner`:

| Suite | Tag | Purpose |
|-------|-----|---------|
| `nal1-5` | `nal` | NAL inference correctness |
| `tools` | `tools` | Tool invocation |
| `memory` | `memory` | Memory operations |
| `lm-rules` | `lm` | LM rule quality |
| `adversarial-tech` | `adversarial` | Technical failure modes |
| `adversarial-cognitive` | `adversarial` | Cognitive failure modes |
| `nl-translation` | `nl` | NL→NAL accuracy |

### 11.2 Adversarial Scenarios

| Failure Mode | Test | Expected |
|--------------|------|----------|
| Infinite loop | `(A --> B). (B --> C). (C --> A).` | Stamp detection breaks loop |
| Memory explosion | 1000 random beliefs | Bag eviction works |
| Confidence oscillation | Alternate `(A --> B). :1.0:0.9` / `:0.0:0.9` | Revision converges |
| LM hallucination | `"Translate: 'Xorblats are flimflams'"` | Low confidence, no conflict |
| Sycophancy | `(sky --> green). :1.0:0.9` then `"Is sky blue?"` | Reports conflict |
| Overgeneralization | `"All birds fly"` → `:1.0:0.9` | Should be `:0.8:0.7` |
| Derivation explosion | Single input | ≤ 5 meaningful derivations |
| Deep chain decay | A→B→...→Z (26 steps) | Signal above noise |

---

## Part 12: Execution Protocol

### 12.1 Priority Order

| Priority | Area | Components Affected |
|----------|------|---------------------|
| **P0** | NL→NAL translation pipeline | `NLAnalyzer`, `NLTranslator` (extend existing) |
| **P0** | Result interpretation | `ResultInterpreter` (new) |
| **P1** | Context assembly | `ContextBuilder` (new, shared) |
| **P1** | Clarification protocol | Wire `ClarificationSchema` |
| **P1** | Self-correction loop | Built into `NLTranslator` |
| **P2** | Goal-driven attention | Extend `Focus` |
| **P2** | LM-assisted consolidation | Extend `Memory.consolidate()` |
| **P2** | Semantic premise selection | Extend `SemanticStrategy` |
| **P3** | Feedback learning | `FeedbackLearner` (unifies 3 components) |
| **P3** | Meta-cognitive observer | `Observer` (unifies 2 components) |
| **P3** | Counterfactual reasoning | New, uses existing engine |
| **P3** | Temporal causal discovery | Extend event system + `lm-temporal-causal` |
| **P4** | Cognitive budget | Extend `Config` |
| **P4** | Adversarial test suite | Extend `ScenarioRunner` |

### 12.2 Success Metrics

| Metric | Target |
|--------|--------|
| NL→NAL translation accuracy | > 90% common patterns |
| Clarification rate | < 10% of inputs |
| Derivations per belief | ≤ 5 meaningful |
| Contradiction detection | 100% direct conflicts |
| LM self-correction | > 80% within 2 retries |
| Correction learning | 50% reduction in repeat errors |

---

## Appendix A: Interaction Flows

### A.1: Learning with Derivation
```
User: "Remember all dolphins are mammals."
→ NLAnalyzer: intent=believe, concepts=[dolphin, mammal]
→ NLTranslator Tier 1: regex "all X are Y" → (<dolphin --> mammal>. :1.0:0.9)
→ SeNARSProcessor: nar.believe()
→ Reasoning: no related beliefs, no derivations
→ ResultInterpreter: "I've noted that dolphins are mammals."

User: "And mammals are animals."
→ Tier 1: "X are Y" → (<mammal --> animal>. :0.9:0.9)
→ nar.believe() → deduction: (<dolphin --> mammal>) + (<mammal --> animal>) → (<dolphin --> animal>. :0.9:0.8)
→ ResultInterpreter: "Understood. Since dolphins are mammals and mammals are animals, I've also concluded that dolphins are animals."

User: "Why do you think dolphins are animals?"
→ NLAnalyzer: intent=explain
→ ExplainTool: traces derivation path
→ ResultInterpreter: "I believe this because: (1) You told me dolphins are mammals, (2) You told me mammals are animals, (3) By deduction, dolphins are animals. Confidence: high."
```

### A.2: Compound Intent
```
User: "Remember cats are mammals, then figure out if Whiskers is an animal, and forget anything about fish."
→ NLAnalyzer: detects compound, decomposes via GoalDecompositionSchema
  Intent 1: believe('<cat --> mammal>. :0.9:0.9')
  Intent 2: query('<Whiskers --> animal>?') [dependsOn: intent-1]
  Intent 3: forget(pattern='fish')
→ Execute in order, respecting dependencies
→ ResultInterpreter: combines all results into single response
```

### A.3: Clarification
```
User: "Birds fly"
→ NLAnalyzer: 3 valid parses (universal/existential/property), confidence too low
→ ClarificationSchema: "Do you mean 'All birds fly', 'Some birds fly', or 'Flying is a property of birds'?"
→ User: "All of them"
→ Resolves → (<bird --> fly>. :1.0:0.9), correction recorded
```

### A.4: Cognitive Control
```
User: "Focus on marine biology."
→ NLAnalyzer: intent=focus, concepts=[marine, biology]
→ Focus.boostTopic('marine', 2.0, 50), boostTopic('biology', 2.0, 50)
→ Cascade to related: dolphin, fish, ocean, mammal

User: "Forget everything about sharks."
→ NLAnalyzer: intent=forget
→ Memory.removeConceptsMatching('shark')

User: "What were we talking about?"
→ NLAnalyzer: intent=recall
→ EpisodicMemory.recallRecent(5) → LM summarizes
```

### A.5: Counterfactual
```
User: "What if dolphins weren't mammals?"
→ NLAnalyzer: intent=counterfactual
→ counterfactual('<dolphin --> mammal>', negate=true)
  1. Save original belief
  2. Temporarily replace with negated version
  3. Run reasoning (5 steps)
  4. Compare belief sets
  5. Restore original
→ ResultInterpreter: "If dolphins weren't mammals, I could no longer conclude they are animals. I'd need other evidence."
```

---

## Appendix B: Existing Components to Wire

All components already exist — the work is integration, not creation:

| Component | Location | Action Needed |
|-----------|----------|---------------|
| `NLTranslator` | `src/nar/nl/translator.ts` | Add 3-tier strategy, self-correction |
| `InputClassifier` | `src/agent/pipeline/stages/InputClassifier.ts` | Merge into NLAnalyzer |
| `14 NL parsers` | `src/agent/pipeline/stages/SeNARSProcessor.ts` | Expand patterns, move to NLTranslator |
| `13 LM rules` | `src/nar/lm/rules.ts` | Add activation conditions |
| `11 Zod schemas` | `src/nar/nl/schemas.ts` | Wire to respective operations |
| `BidirectionalFeedbackLoop` | `src/nar/lm/feedback.ts` | Connect to FeedbackLearner |
| `ProactiveEnricher` | `src/nar/lm/enrichment.ts` | Wire to idle cycles + consolidation |
| `EmbeddingLayer` | `src/nar/memory/links/` | Integrate into SemanticStrategy |
| `RLFP system` | `src/nar/rlfp/` | Connect to FeedbackLearner |
| `MetacognitiveMonitor` | `src/nar/metrics/` | Merge into Observer |
| `SelfAnalyzer` | `src/nar/self/` | Merge into Observer |
| `ExplainTool` | `src/nar/tools/` | Wire to explain intent |
| `EpisodicMemory` | `src/nar/memory/` | Wire to recall intent |
| `Focus` | `src/nar/memory/` | Add topic boosting |
| `Memory` | `src/nar/memory/` | Add LM-assisted consolidation |
| `SemanticStrategy` | `src/nar/reason/strategies/` | Add embedding scoring |
| `RuleProcessor` | `src/nar/rules/processor.ts` | Add LM rule activation |
| `Reasoner` | `src/nar/reason/reasoner.ts` | Add budget control |
| `PipelineEventEmitter` | `src/agent/pipeline/` | Add NL/cognitive events |
| `ScenarioRunner` | `src/agent/scenarios/` | Add adversarial scenarios |
| `Config` | `src/nar/config/` | Add cognitive budget presets |

---

**End of GROW2.md**
*Replaces GROW.md. Specifies the complete LM-NAL synergy model with minimal new components — extending and wiring existing infrastructure rather than creating parallel systems.*
