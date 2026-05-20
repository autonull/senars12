# GROW2: Cognitive Synergy Architecture for SeNARS

## Mission
**Build a neuro-symbolic cognitive architecture where Language Models and Narsese Logic amplify each other's strengths, creating reasoning capabilities neither could achieve alone.**

The goal is **Cognitive Democracy**: complex reasoning, memory management, attention control, and creative synthesis accessible through natural language — without requiring knowledge of NAL syntax.

---

## Core Philosophy: LM + NAL Synergy

NAL and LM are not competitors or simple translators of each other. They are **complementary reasoning systems** with orthogonal strengths:

| Dimension | NAL (SeNARS) | LM (Language Model) | Synergy |
|-----------|--------------|---------------------|---------|
| **Reasoning** | Sound, traceable, compositional | Broad, approximate, contextual | LM suggests → NAL validates |
| **Knowledge** | Explicit, structured, revisable | Implicit, distributed, static | LM harvests → NAL stores |
| **Language** | None (requires Narsese) | Native understanding/generation | NL → LM → NAL → LM → NL |
| **Uncertainty** | Frequency-confidence calculus | Implicit, uncalibrated | LM proposes → NAL calibrates |
| **Coverage** | Limited to defined rules | Open-ended, creative | LM discovers → NAL formalizes |
| **Speed** | Fast symbolic operations | Slow, expensive | NAL filters → LM enriches |

### Division of Labor

```
User Input (NL)
  │
  ▼
┌─────────────────────────────────────┐
│  NL Understanding Layer (LM)        │
│  - Intent classification            │
│  - Concept extraction               │
│  - Ambiguity detection              │
│  - Goal decomposition               │
└─────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────┐
│  Symbolic Translation (LM + NAL)    │
│  - Regex parsers (fast path)        │
│  - LM translation (complex path)    │
│  - NAL validation (gate)            │
│  - Cache hit/miss optimization      │
└─────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────┐
│  Reasoning Engine (NAL + LM Rules)  │
│  - NAL rules: sound inference       │
│  - LM rules: creative extension     │
│  - Premise selection: term overlap  │
│  - Derivation: depth-controlled     │
└─────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────┐
│  Result Interpretation (LM)         │
│  - Derivation path summarization    │
│  - Confidence communication         │
│  - Contradiction explanation        │
│  - Natural language generation      │
└─────────────────────────────────────┘
  │
  ▼
User Output (NL + optional Narsese debug)
```

### Handoff Protocol

Every transition between LM and NAL follows a strict protocol:

1. **LM → NAL**: LM output is validated by `termParser.parse()`. Invalid output triggers self-correction (up to 2 retries with error feedback). Accepted beliefs are tagged with `source: 'lm'` and receive a confidence discount (`c *= 0.85`).

2. **NAL → LM**: Derivation results include the full derivation path (premise terms, rule IDs, output truth). The LM receives this structured context, not raw Narsese strings.

3. **NAL ↔ NAL**: Rule outputs are validated for term well-formedness, tautology, and operation-kind-in-declarative-context (per BOT7 audit). Invalid outputs are logged and discarded.

---

## Part 1: Natural Language Interface

### 1.1 Intent Model

Natural language input is classified into a **composable intent model**, not a flat category. Each input produces one or more intents with ordering and data dependencies.

```typescript
interface NLIntent {
    type: 'believe' | 'query' | 'goal' | 'command' | 'forget' | 'focus' | 'explain' | 'counterfactual' | 'discover' | 'save' | 'recall';
    payload: Record<string, unknown>;
    priority: number;          // Execution order
    dependsOn?: string[];      // Intent IDs this depends on
}

interface NLAnalysis {
    intents: NLIntent[];
    concepts: string[];        // Extracted concept terms
    ambiguity: Ambiguity[];    // When clarification is needed
    confidence: number;        // Overall analysis confidence
}

interface Ambiguity {
    aspect: string;            // What is ambiguous
    options: string[];         // Possible interpretations
    clarification: string;     // Question to ask user
}
```

### 1.2 NL Command Map

Every cognitive operation maps to a natural language pattern. The system uses a **tiered parsing strategy**:

| Tier | Method | Speed | Coverage | Examples |
|------|--------|-------|----------|----------|
| 1 | Regex patterns | Instant | ~40% | "X is a Y", "All X are Y" |
| 2 | Structured LM (Zod) | Fast | ~40% | Complex statements, questions |
| 3 | Free-form LM | Slow | ~20% | Ambiguous, creative, compound |

#### Tier 1: Regex Patterns (Fast Path)

The existing `DEFAULT_NL_PARSERS` are expanded to cover the patterns from BOT7 §2.1:

```typescript
const NL_PATTERNS: NLParserDef[] = [
    // Universal inheritance
    { match: /^all\s+(\S+)\s+are\s+(\S+)/i,
      translate: (m) => `(<${m[1]} --> ${m[2]}>. :1.0:0.9)` },
    // Existential
    { match: /^some\s+(\S+)\s+are\s+(\S+)/i,
      translate: (m) => `(<${m[1]} --> ${m[2]}>. :0.5:0.5)` },
    // Instance
    { match: /^(\S+)\s+is\s+a\s+(\S+)/i,
      translate: (m) => `(<${m[1]} --> ${m[2]}>.)` },
    // Property
    { match: /^(\S+)\s+is\s+(\S+)/i,
      translate: (m) => `(<${m[1]} --> [${m[2]}]>. :0.9:0.9)` },
    // Similarity
    { match: /^(\S+)\s+is\s+like\s+(\S+)/i,
      translate: (m) => `(<${m[1]} <-> ${m[2]}>. :0.8:0.8)` },
    // Causal
    { match: /^(\S+)\s+causes\s+(\S+)/i,
      translate: (m) => `((<${m[1]}> =/> <${m[2]}>). :0.8:0.8)` },
    // Implication
    { match: /^if\s+(\S+)\s+then\s+(\S+)/i,
      translate: (m) => `((<${m[1]}> ==> <${m[2]}>). :0.9:0.9)` },
    // Negation
    { match: /^(\S+)\s+is\s+not\s+a?\s*(\S+)/i,
      translate: (m) => `(--(<${m[1]} --> ${m[2]}>). :0.9:0.9)` },
    // Query-what
    { match: /^what\s+is\s+(\S+)/i,
      translate: (m) => `(<${m[1]} --> ?>)` },
    // Query-whether
    { match: /^is\s+(\S+)\s+a\s+(\S+)/i,
      translate: (m) => `(<${m[1]} --> ${m[2]}>?)` },
];
```

#### Tier 2: Structured LM Translation

When regex patterns fail, the `NLTranslator` uses `generateObject` with the `TranslationSchema`:

```typescript
async translateWithLM(nl: string): Promise<TranslationResult> {
    const {object} = await generateObject({
        model: getStructuredModel(registry),
        prompt: buildTranslationPrompt(nl, memoryContext),
        schema: TranslationSchema,
    });
    // Validate each belief through termParser
    return { ...object, beliefs: object.beliefs.filter(b => validateNarsese(b.narsese)) };
}
```

**Translation prompt includes**:
- Current attention report (active concepts)
- Recent successful translations (few-shot examples from cache)
- Narsese syntax guide (compact)
- The input text

#### Tier 3: Free-form LM (Fallback)

When structured output fails or input is too ambiguous:

```typescript
async translateFreeform(nl: string): Promise<string | null> {
    const response = await lm.generateText(
        `Convert to Narsese: "${nl}". Output only valid Narsese.`
    );
    return validateNarsese(response) ? response : null;
}
```

### 1.3 Compound Intent Decomposition

Users provide compound instructions. The system decomposes them:

```
User: "Remember cats are mammals, then figure out if Whiskers is an animal, and forget anything about fish."

Decomposition:
[
  { type: 'believe', payload: { narsese: '<cat --> mammal>. :1.0:0.9' }, priority: 1 },
  { type: 'query', payload: { narsese: '<Whiskers --> animal>?' }, priority: 2, dependsOn: ['intent-1'] },
  { type: 'forget', payload: { pattern: 'fish' }, priority: 3 }
]
```

The decomposition uses an LM call with `GoalDecompositionSchema`:

```typescript
interface DecompositionPrompt {
    input: string;              // User's compound instruction
    memoryState: string;        // Current beliefs summary
    availableOperations: string; // What the system can do
}
```

### 1.4 Cognitive Commands via NL

| User Intent | Internal Action | Cognitive Domain |
|-------------|-----------------|------------------|
| "Remember that X" | `nar.believe(translate(X))` | Memory Injection |
| "Forget everything about X" | `nar.memory.removeConceptsMatching(X)` | Memory Pruning |
| "Focus on X" | `nar.attention.boostTopic(X, factor=2.0, ttl=50)` | Attention Control |
| "Why do you think X?" | `nar.explain(translate(X))` | Explanation |
| "What if X weren't Y?" | `nar.counterfactual(translate(X), false)` | Creative Reasoning |
| "Find connections between X and Y" | `nar.discoverRelations([X, Y])` | Analogy/Discovery |
| "Save this thought" | `nar.episodic.save(currentContext)` | Episodic Memory |
| "What were we talking about?" | `nar.episodic.recallRecent()` | Context Retrieval |
| "You seem confused" | `nar.metaCognitive.reportConflicts()` | Meta-Cognition |
| "Think deeply about X" | `nar.run(depth=10, focus=X)` | Deep Reasoning |

### 1.5 Clarification Protocol

When input is ambiguous, the system asks clarifying questions instead of guessing:

```
User: "Birds fly"

System detects ambiguity: universal vs. existential
System: "Do you mean 'All birds fly' or 'Some birds fly'?"

User: "All of them"
System: [Translates to: (<bird --> fly>. :1.0:0.9)]
System: "I've noted that all birds fly."
```

The clarification flow:
1. `NLAnalyzer` detects ambiguity (multiple valid parses, low confidence)
2. System generates clarification question using `ClarificationSchema`
3. User responds
4. System resolves ambiguity, updates translation cache
5. Correction is logged for future learning (RLFP feedback)

---

## Part 2: LM Prompting Strategy

### 2.1 Context Window Management

The LM's context window is a **scarce resource**. It must be allocated intentionally:

```
┌─────────────────────────────────────────────────┐
│  System Prompt (fixed)                          │
│  - Identity, capabilities, response guidelines  │
│  - Directive instructions                       │
│  - Narsese syntax reference                     │
├─────────────────────────────────────────────────┤
│  Knowledge Context (dynamic, relevance-sorted)  │
│  - Attention report (top-10 concepts)           │
│  - Related beliefs (term-overlap filtered)      │
│  - Recent derivations (last turn)               │
│  - Active goals                                 │
├─────────────────────────────────────────────────┤
│  Episodic Context (conversation)                │
│  - Summary (if history > threshold)             │
│  - Recent messages (last N)                     │
│  - Pinned beliefs                               │
├─────────────────────────────────────────────────┤
│  Few-Shot Examples (cached translations)        │
│  - 3-5 most relevant past NL→NAL translations   │
├─────────────────────────────────────────────────┤
│  Current Input                                  │
└─────────────────────────────────────────────────┘
```

**Context assembly algorithm**:

```typescript
function buildContext(nar: NAR, input: string, ctx: BotContext): string {
    const budget = estimateTokenBudget();
    const parts: string[] = [];

    // 1. Attention report (always included, compact)
    parts.push(formatAttention(nar.attentionReport(10)));

    // 2. Related beliefs (term-overlap with input)
    const terms = extractTerms(input);
    const related = nar.memory.getRelatedBeliefs(terms, { maxBeliefs: 15, minOverlap: 1 });
    parts.push(formatBeliefs(related));

    // 3. Recent derivations (from last turn)
    if (ctx.turn.reasoningResult?.newBeliefs?.length) {
        parts.push(formatDerivations(ctx.turn.reasoningResult.newBeliefs.slice(0, 5)));
    }

    // 4. Active goals
    const goals = nar.getGoals();
    if (goals.length) parts.push(formatGoals(goals));

    // 5. Few-shot examples (from translation cache)
    const examples = translationCache.getRelevant(input, 3);
    if (examples.length) parts.push(formatExamples(examples));

    // 6. Episodic summary (if history is long)
    if (ctx.conversation.messageCount > 20) {
        parts.push(ctx.conversation.summary ?? '');
    }

    return truncateToBudget(parts.join('\n'), budget);
}
```

### 2.2 Structured Output Enforcement

Every LM call that produces Narsese uses **Zod schema validation**:

```typescript
// For translation
const TranslationSchema = z.object({
    beliefs: z.array(z.object({
        narsese: z.string(),
        truth: z.object({ f: z.number().min(0).max(1), c: z.number().min(0).max(1) }).optional(),
    })),
    isQuestion: z.boolean(),
    summary: z.string(),
});

// For explanation
const ExplanationSchema = z.object({
    explanation: z.string(),
    derivationPath: z.array(z.object({
        step: z.number(),
        rule: z.string(),
        premises: z.array(z.string()),
        conclusion: z.string(),
    })).optional(),
    confidence: z.number().min(0).max(1),
    relatedConcepts: z.array(z.string()).optional(),
});

// For goal decomposition
const GoalDecompositionSchema = z.object({
    subgoals: z.array(z.object({
        narsese: z.string(),
        description: z.string(),
        dependsOn: z.array(z.number()).optional(),
    })),
    clarificationNeeded: z.boolean().optional(),
    clarificationQuestion: z.string().optional(),
});
```

### 2.3 Self-Correction Loop

When LM output fails validation, feed the error back:

```typescript
async translateWithCorrection(nl: string, maxRetries = 2): Promise<TranslationResult> {
    let lastError: string | null = null;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            const prompt = lastError
                ? `Previous attempt failed: ${lastError}. Try again. Input: "${nl}"`
                : `Translate to Narsese: "${nl}"`;

            const result = await generateObject({ model, prompt, schema: TranslationSchema });

            // Validate each belief
            const validBeliefs = result.object.beliefs.filter(b => {
                try { termParser.parse(b.narsese); return true; }
                catch (e) { lastError = `Invalid Narsese: ${b.narsese} - ${e.message}`; return false; }
            });

            if (validBeliefs.length > 0) return { ...result.object, beliefs: validBeliefs };
            lastError = 'No valid beliefs produced';
        } catch (e) {
            lastError = e.message;
        }
    }
    return null; // All retries exhausted
}
```

### 2.4 Few-Shot Example Retrieval

The system maintains a **translation cache** of successful NL→NAL pairs:

```typescript
class TranslationCache {
    private entries: Array<{ nl: string; narsese: string; terms: Set<string>; count: number }>;

    getRelevant(input: string, n: number): Array<{ nl: string; narsese: string }> {
        const inputTerms = extractTerms(input);
        return this.entries
            .map(e => ({ ...e, overlap: intersection(e.terms, inputTerms).size }))
            .filter(e => e.overlap > 0)
            .sort((a, b) => b.overlap - a.overlap || b.count - a.count)
            .slice(0, n)
            .map(e => ({ nl: e.nl, narsese: e.narsese }));
    }

    record(nl: string, narsese: string): void {
        const terms = extractTerms(nl);
        const existing = this.entries.find(e => e.narsese === narsese);
        if (existing) { existing.count++; existing.terms = union(existing.terms, terms); }
        else { this.entries.push({ nl, narsese, terms, count: 1 }); }
    }
}
```

---

## Part 3: Result Interpretation

### 3.1 Confidence Communication

Truth values must be communicated in natural language with appropriate hedging:

| Frequency | Confidence | Natural Language |
|-----------|------------|------------------|
| 0.9-1.0 | 0.8-1.0 | "I am confident that..." |
| 0.7-0.9 | 0.6-0.8 | "I believe that..." |
| 0.5-0.7 | 0.4-0.6 | "It seems that..." |
| 0.3-0.5 | 0.2-0.4 | "I'm not sure, but possibly..." |
| 0.0-0.3 | 0.0-0.2 | "I have very little evidence for..." |
| Any | < 0.1 | "I don't have enough information about..." |

```typescript
function truthToNL(truth: Truth): { statement: string; hedge: string } {
    const { f, c } = truth;
    const hedge = c > 0.8 ? 'confident'
        : c > 0.6 ? 'believe'
        : c > 0.4 ? 'seems'
        : c > 0.2 ? 'possible'
        : 'uncertain';
    return { hedge, statement: formatBelief(f, c) };
}
```

### 3.2 Derivation Chain Summarization

Deep derivations produce long chains. The LM summarizes, not regurgitates:

```typescript
interface DerivationSummary {
    conclusion: string;           // Natural language of the conclusion
    chainLength: number;          // Number of inference steps
    keyPremises: string[];        // 2-3 most important premises (NL)
    reasoningType: string;        // "deductive", "inductive", "analogical", etc.
    confidence: string;           // Hedged confidence
    wouldBenefitFrom: string[];   // What additional beliefs would strengthen this
}

function summarizeDerivation(chain: DerivationChain, nar: NAR): DerivationSummary {
    // Extract key premises (highest confidence, most central)
    const keyPremises = chain.premises
        .sort((a, b) => b.truth.c - a.truth.c)
        .slice(0, 3)
        .map(p => termToNL(p.term));

    // Determine reasoning type from rule sequence
    const reasoningType = classifyReasoningType(chain.rules);

    // What would help (backward chaining)
    const wouldBenefit = findMissingLinks(chain, nar);

    return {
        conclusion: termToNL(chain.conclusion.term),
        chainLength: chain.rules.length,
        keyPremises,
        reasoningType,
        confidence: truthToNL(chain.conclusion.truth).hedge,
        wouldBenefitFrom: wouldBenefit,
    };
}
```

### 3.3 Contradiction Handling

When memory contains conflicting beliefs, the system explains the conflict:

```
User: "Is a penguin a bird?"

System detects:
  - (<penguin --> bird>. :1.0:0.9)    [from user]
  - (<penguin --> "not fly>. :0.9:0.8) [from user]
  - (<bird --> fly>. :1.0:0.9)         [from user]

System: "I believe penguins are birds. However, I also believe that birds fly
         and penguins don't fly. This creates a conflict. You could resolve it
         by telling me that 'not all birds fly' or 'penguins are an exception.'"
```

```typescript
function explainContradiction(term: Term, nar: NAR): ContradictionReport {
    const beliefs = nar.getBeliefsForTerm(term);
    const conflicts = findConflictingPairs(beliefs);

    return {
        term: termToNL(term),
        conflicts: conflicts.map(c => ({
            belief1: beliefToNL(c.a),
            belief2: beliefToNL(c.b),
            conflictType: classifyConflict(c.a, c.b),
        })),
        resolutionSuggestions: conflicts.map(c => suggestResolution(c)),
    };
}
```

### 3.4 "I Don't Know" with Suggestions

When no answer exists, the system provides actionable guidance:

```
User: "Are penguins mammals?"

System: "I don't have information about whether penguins are mammals.
         I do know that penguins are birds and birds are animals.
         If you tell me whether birds are mammals, I can answer."
```

```typescript
function handleUnknown(query: Term, nar: NAR): UnknownResponse {
    const relatedBeliefs = nar.getRelatedBeliefs(query);
    const missingLinks = findWhatWouldAnswer(query, nar);

    return {
        statement: `I don't have enough information about ${termToNL(query)}.`,
        whatIKnow: relatedBeliefs.slice(0, 3).map(b => beliefToNL(b)),
        whatINeed: missingLinks.map(l => `If I knew "${linkToNL(l)}", I could answer.`),
    };
}
```

---

## Part 4: LM-NAL Reasoning Integration

### 4.1 LM Rules as Complementary Inference

The 13 existing LM rules (`src/nar/lm/rules.ts`) are not just translation tools — they are **complementary inference rules** that operate where NAL rules cannot:

| LM Rule | When It Fires | What NAL Cannot Do |
|---------|---------------|-------------------|
| `lm-narsese-translation` | NL input, regex fails | Understand natural language |
| `lm-belief-revision` | Conflicting beliefs, NAL revision insufficient | Contextual confidence adjustment |
| `lm-goal-decomposition` | Complex goal input | Break goals into achievable subgoals |
| `lm-hypothesis-generation` | Observation without explanation | Generate creative hypotheses |
| `lm-explanation-generation` | User asks "why" | Natural language explanation |
| `lm-analogical-reasoning` | Structurally similar concepts | Cross-domain analogy detection |
| `lm-meta-reasoning` | Low derivation rate, high contradiction | Self-aware reasoning guidance |
| `lm-uncertainty-calibration` | LM-originated beliefs | Calibrate overconfident LM output |
| `lm-schema-induction` | Repeated belief patterns | Abstract schema discovery |
| `lm-temporal-causal` | Event sequences observed | Temporal pattern detection |
| `lm-variable-grounding` | Abstract variables | Ground in concrete instances |
| `lm-concept-elaboration` | Underconnected concepts | Enrich with world knowledge |
| `lm-interactive-clarification` | Ambiguous input | Ask clarifying questions |

### 4.2 Rule Activation Strategy

LM rules are expensive. They should fire selectively:

```typescript
interface LMRuleActivation {
    ruleId: string;
    condition: (primary: Term, secondary: Term | null, ctx: RuleContext) => boolean;
    priority: number;
    maxCallsPerTurn: number;
}

const LM_ACTIVATION_RULES: LMRuleActivation[] = [
    {
        ruleId: 'lm-narsese-translation',
        condition: (_, __, ctx) => ctx.inputType === 'nl' && !regexParsed(ctx.input),
        priority: 0.9,
        maxCallsPerTurn: 1,
    },
    {
        ruleId: 'lm-analogical-reasoning',
        condition: (p, s) => structuralSimilarity(p, s) > 0.6 && !termOverlap(p, s),
        priority: 0.8,
        maxCallsPerTurn: 2,
    },
    {
        ruleId: 'lm-hypothesis-generation',
        condition: (p, _, ctx) => p.truth.c < 0.5 && ctx.derivationDepth < 3,
        priority: 0.75,
        maxCallsPerTurn: 3,
    },
    // ... etc
];
```

### 4.3 LM Rule Context Assembly

Each LM rule declares which **context fragments** it needs (from BOT6):

```typescript
const contextFragments = {
    attention: (nar) => formatAttentionReport(nar.attentionReport(10)),
    relatedBeliefs: (term) => (nar) => formatBeliefs(nar.getRelatedBeliefs(term, { max: 10 })),
    links: (term) => (nar) => formatLinks(nar.memory.getLinkManager().getLinks(term)),
    goals: (nar) => formatGoals(nar.getGoals()),
    questions: (nar) => formatQuestions(nar.getQuestions()),
    recentDerivations: (_, ctx) => formatDerivations(ctx.turn.reasoningResult?.newBeliefs ?? []),
    memoryHealth: (nar) => `Memory: ${nar.getStatistics().totalConcepts} concepts, pressure ${(nar.getStatistics().memoryPressure * 100).toFixed(0)}%`,
    focus: (nar) => formatConcepts(nar.memory.getFocusConcepts()),
    workingMemory: (_, ctx) => formatPinned(ctx.conversation.getPinned()),
    translationCache: (_, ctx, input) => formatExamples(translationCache.getRelevant(input, 3)),
};
```

### 4.4 NAL Validation of LM Output

Every LM-generated belief passes through a **validation gate**:

```typescript
function validateLMOutput(task: Task): ValidationResult {
    // 1. Term well-formedness
    if (!isWellFormed(task.term)) return { valid: false, reason: 'Malformed term' };

    // 2. No tautologies
    if (isTautology(task.term)) return { valid: false, reason: 'Tautology' };

    // 3. No operation terms in declarative context
    if (task.type === 'belief' && containsOperation(task.term))
        return { valid: false, reason: 'Operation in declarative belief' };

    // 4. Confidence calibration for LM-originated
    if (task.source?.startsWith('lm')) {
        task.truth = Truth.calibrateLM(task.truth); // c *= 0.85
    }

    // 5. Check against existing beliefs for conflicts
    const conflicts = findConflicts(task.term, memory);
    if (conflicts.length > 0 && task.truth.c < 0.3)
        return { valid: false, reason: `Low confidence conflicts with ${conflicts.length} existing beliefs` };

    return { valid: true };
}
```

---

## Part 5: Attention and Memory Integration

### 5.1 Goal-Driven Attention Control

Current attention is priority-driven (decay-based). Add **goal-driven boosting**:

```typescript
class AttentionController {
    private topicBoosts = new Map<string, { factor: number; ttl: number; source: string }>();

    boostTopic(topic: string, factor = 2.0, ttl = 50, source = 'user'): void {
        this.topicBoosts.set(topic, { factor, ttl, source });
    }

    adjustPriority(concept: Concept, basePriority: number): number {
        let adjusted = basePriority;

        // Topic boost
        for (const [topic, boost] of this.topicBoosts) {
            if (concept.term.toString().includes(topic)) {
                adjusted *= boost.factor;
                boost.ttl--;
                if (boost.ttl <= 0) this.topicBoosts.delete(topic);
            }
        }

        // Goal relevance boost
        for (const goal of this.activeGoals) {
            if (termOverlap(concept.term, goal.term) > 0) {
                adjusted *= 1.5;
            }
        }

        // Recency bonus
        if (concept.lastAccess > Date.now() - 60000) {
            adjusted *= 1.2;
        }

        return Math.min(adjusted, 1.0);
    }
}
```

### 5.2 LM-Assisted Memory Consolidation

During consolidation cycles, the LM can:

1. **Identify conceptual clusters** for abstraction ("sleep cycle")
2. **Suggest belief mergers** when similar beliefs exist
3. **Flag orphaned concepts** for pruning

```typescript
async consolidateWithLM(memory: Memory, lm: LMClient): Promise<ConsolidationReport> {
    const report: ConsolidationReport = { archived: 0, merged: 0, abstracted: 0 };

    // Standard consolidation (decay, archive)
    report.archived = memory.consolidate();

    // LM-assisted: find clusters for abstraction
    const clusters = findDenseClusters(memory.getConcepts());
    for (const cluster of clusters) {
        if (cluster.concepts.length >= 3 && !cluster.hasAbstract) {
            const abstract = await lm.generateObject({
                prompt: `What abstract concept groups these: ${cluster.concepts.map(c => c.term).join(', ')}?`,
                schema: z.object({ name: z.string(), definition: z.string() }),
            });
            memory.createAbstractConcept(abstract.name, cluster.concepts);
            report.abstracted++;
        }
    }

    // LM-assisted: merge similar beliefs
    for (const concept of memory.getConcepts()) {
        const similarBeliefs = findSimilarBeliefs(concept);
        if (similarBeliefs.length > 2) {
            memory.mergeBeliefs(concept, similarBeliefs);
            report.merged++;
        }
    }

    return report;
}
```

### 5.3 Cognitive Budget

Reasoning is expensive. The system allocates a **cognitive budget** per turn:

```typescript
interface CognitiveBudget {
    maxNALSteps: number;         // NAL inference steps (fast)
    maxLMCalls: number;          // LM API calls (expensive)
    maxDerivationDepth: number;  // Chain depth limit
    maxMemoryOps: number;        // Memory operations per turn
    priority: 'efficiency' | 'thoroughness' | 'balanced';
}

const BUDGET_PRESETS: Record<string, CognitiveBudget> = {
    chat:       { maxNALSteps: 3,  maxLMCalls: 1, maxDerivationDepth: 2, maxMemoryOps: 5,  priority: 'efficiency' },
    reasoning:  { maxNALSteps: 10, maxLMCalls: 3, maxDerivationDepth: 5, maxMemoryOps: 20, priority: 'thoroughness' },
    deep:       { maxNALSteps: 20, maxLMCalls: 5, maxDerivationDepth: 10, maxMemoryOps: 50, priority: 'thoroughness' },
    balanced:   { maxNALSteps: 5,  maxLMCalls: 2, maxDerivationDepth: 3, maxMemoryOps: 10, priority: 'balanced' },
};
```

Budget allocation decision:

```typescript
function allocateBudget(input: string, ctx: BotContext): CognitiveBudget {
    const classification = classify(input);
    const complexity = estimateComplexity(input);

    if (classification === 'narsese') return BUDGET_PRESETS.reasoning;
    if (classification === 'query' && complexity > 0.7) return BUDGET_PRESETS.deep;
    if (classification === 'chat') return BUDGET_PRESETS.chat;
    return BUDGET_PRESETS.balanced;
}
```

---

## Part 6: LM as Memory Component

### 6.1 Knowledge Harvesting

When encountering novel terms, the LM generates **candidate hypotheses** (low-confidence beliefs):

```typescript
async harvestKnowledge(term: Term, nar: NAR, lm: LMClient): Promise<Belief[]> {
    const { object } = await generateObject({
        model: lm.model,
        prompt: `What are known properties and relationships of "${termToNL(term)}"?
                 Return as Narsese beliefs with appropriate confidence.`,
        schema: z.object({
            properties: z.array(z.object({
                narsese: z.string(),
                confidence: z.number().min(0).max(0.7), // Cap at 0.7 for LM-originated
            })),
        }),
    });

    return object.properties
        .filter(p => validateNarsese(p.narsese))
        .map(p => createBelief(p.narsese, { f: 0.5, c: p.confidence * 0.85 })) // LM discount
        .filter(b => !nar.memory.hasConflictingBelief(b.term, b.truth));
}
```

**Harvesting trigger conditions**:
- User asks about a term with no beliefs
- Term appears in input but has no concept in memory
- During "sleep cycle" for underconnected concepts

### 6.2 Semantic Embedding Integration

The existing `EmbeddingLayer` provides semantic similarity that complements NAL's symbolic links:

```typescript
class SemanticPremiseSelector {
    constructor(private embeddingLayer: EmbeddingLayer, private linkManager: LinkManager) {}

    selectSecondary(primary: Term, candidates: Concept[], topK: number): Concept[] {
        return candidates
            .map(c => ({
                concept: c,
                score: this.combinedScore(primary, c),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(x => x.concept);
    }

    private combinedScore(primary: Term, candidate: Concept): number {
        const symbolic = this.linkManager.getLinkStrength(primary, candidate.term);
        const semantic = this.embeddingLayer.similarity(primary, candidate.term);
        const priority = candidate.priority;

        return symbolic * 0.5 + semantic * 0.3 + priority * 0.2;
    }
}
```

### 6.3 Proactive Enrichment

The existing `ProactiveEnricher` runs in the background, enriching underconnected concepts:

```typescript
class ProactiveEnricher {
    async enrichUnderconnected(nar: NAR, threshold = 0.3): Promise<number> {
        let enriched = 0;
        for (const concept of nar.memory.getConcepts()) {
            if (concept.linkCount < threshold * nar.memory.avgLinksPerConcept) {
                const newBeliefs = await harvestKnowledge(concept.term, nar, nar.lm);
                for (const belief of newBeliefs) {
                    nar.memory.addBelief(concept.term, belief);
                }
                enriched += newBeliefs.length;
            }
        }
        return enriched;
    }
}
```

---

## Part 7: Adversarial Testing & Cognitive Stress

### 7.1 Technical Failure Modes

| Failure Mode | Test Input | Expected Behavior |
|--------------|------------|-------------------|
| Infinite loop | `(A --> B). (B --> C). (C --> A).` | Stamp-based cycle detection breaks loop |
| Memory explosion | Generate 1000 beliefs with all combinations | Bag overflow evicts low-priority concepts |
| Confidence oscillation | `(A --> B). :1.0:0.9` then `(A --> B). :0.0:0.9` repeatedly | Revision converges to stable truth |
| Malformed Narsese | `((A --> B).` | Parser rejects, returns error |
| Operation in declarative | `(cat --> (allocate ^ dog)).` | Rule output validation rejects |
| Tautology | `(A --> A).` | Tautology detection rejects |
| Deep chain decay | A→B→C→...→Z (26 steps) | Truth values degrade gracefully, not to noise |

### 7.2 Cognitive Failure Modes

| Failure Mode | Test Input | Expected Behavior |
|--------------|------------|-------------------|
| LM hallucination | "Translate: 'Xorblats are flimflams'" | LM generates Narsese, but low confidence; NAL has no conflicting beliefs |
| Sycophancy | User: "The sky is green." | System accepts as user belief but doesn't override existing `(sky --> blue)` |
| Context poisoning | Malicious NL designed to corrupt attention | Input validation, rate limiting, attention caps |
| Overgeneralization | "All birds fly" → `:1.0:0.9` | System should use `:0.8:0.7` for universal claims from NL |
| Belief contamination | LM-injected belief conflicts with high-confidence NAL belief | NAL belief wins; LM belief is stored as alternative with lower priority |
| Derivation explosion | Single input triggers 100+ derivations | Derivation quality threshold discards low-priority results |

### 7.3 Adversarial Generator

```typescript
class AdversarialGenerator {
    *generateScenarios(): Generator<AdversarialScenario> {
        // Cyclic derivations
        yield { name: 'cycle-3', inputs: ['(A --> B).', '(B --> C).', '(C --> A).'], expected: 'No infinite loop' };
        yield { name: 'cycle-5', inputs: [...generateCycle(5)], expected: 'No infinite loop' };

        // Contradiction injection
        yield { name: 'direct-contradiction', inputs: ['(A --> B). :1.0:0.9', '(A --> B). :0.0:0.9'], expected: 'Revision converges' };
        yield { name: 'oscillation', inputs: repeat(['(A --> B). :1.0:0.9', '(A --> B). :0.0:0.9'], 10), expected: 'Stable truth' };

        // Memory pressure
        yield { name: 'memory-flood', inputs: generateRandomBeliefs(500), expected: 'No crash, graceful eviction' };

        // Semantic paradoxes
        yield { name: 'self-reference', inputs: ['(this-statement --> false).'], expected: 'Handled without crash' };

        // LM-specific
        yield { name: 'lm-hallucination', inputs: ['Translate: "Glorps are zimbles"'], expected: 'Low confidence, no conflict' };
        yield { name: 'lm-sycophancy', inputs: ['(sky --> green). :1.0:0.9', 'Is the sky blue?'], expected: 'Reports conflict' };

        // Long chains
        yield { name: 'deep-chain', inputs: generateChain(26), expected: 'Signal preserved above noise' };
    }
}
```

---

## Part 8: Feedback Loop from User Corrections

### 8.1 Correction Learning

When users correct the system, update translation weights and belief priorities:

```
User: "Remember all birds fly"
System: [Translates to: (<bird --> fly>. :1.0:0.9)]
User: "No, I meant most birds fly, not all"
System: [Updates to: (<bird --> fly>. :0.8:0.7)]
        [Logs correction for future learning]
System: "Corrected. I now believe that most birds fly."
```

```typescript
class CorrectionLearner {
    private corrections: Array<{
        originalNL: string;
        originalNarsese: string;
        correctedNarsese: string;
        pattern: string;
    }> = [];

    recordCorrection(originalNL: string, original: string, corrected: string): void {
        this.corrections.push({
            originalNL,
            originalNarsese: original,
            correctedNarsese: corrected,
            pattern: extractPattern(originalNL),
        });
        // Update translation cache with corrected version
        translationCache.record(originalNL, corrected);
    }

    getCorrectionFor(nl: string): string | null {
        const pattern = extractPattern(nl);
        const match = this.corrections.find(c => c.pattern === pattern);
        return match?.correctedNarsese ?? null;
    }
}
```

### 8.2 RLFP Integration

The existing RLFP system (`src/nar/rlfp/`) connects user feedback to policy optimization:

```typescript
class RLFPBridge {
    onUserCorrection(input: string, systemOutput: string, userFeedback: 'accept' | 'reject' | 'modify'): void {
        const preference: PreferencePair = {
            input,
            chosen: userFeedback === 'accept' ? systemOutput : userFeedback,
            rejected: userFeedback === 'reject' ? systemOutput : null,
            timestamp: Date.now(),
        };
        this.preferenceCollector.record(preference);
        this.policyOptimizer.update(preference);
    }

    onDerivationAccepted(derivation: Derivation): void {
        // Positive signal for the rules used in this derivation
        for (const ruleId of derivation.ruleIds) {
            this.ruleStats.increment(ruleId, 'accepted');
        }
    }

    onDerivationRejected(derivation: Derivation, reason: string): void {
        // Negative signal for the rules used
        for (const ruleId of derivation.ruleIds) {
            this.ruleStats.increment(ruleId, 'rejected');
        }
    }
}
```

### 8.3 Rule Priority Meta-Learning

Rule priorities adjust based on derivation utility:

```typescript
class RulePriorityLearner {
    private stats = new Map<string, { used: number; accepted: number; rejected: number }>();

    recordRuleUsage(ruleId: string, outcome: 'accepted' | 'rejected' | 'used'): void {
        const s = this.stats.get(ruleId) ?? { used: 0, accepted: 0, rejected: 0 };
        s[outcome]++;
        this.stats.set(ruleId, s);
    }

    getAdjustedPriority(ruleId: string, basePriority: number): number {
        const s = this.stats.get(ruleId);
        if (!s || s.used < 5) return basePriority; // Not enough data

        const acceptanceRate = s.accepted / (s.accepted + s.rejected);
        // Adjust: high acceptance → boost, low acceptance → reduce
        const adjustment = (acceptanceRate - 0.5) * 0.2; // ±0.1 max adjustment
        return Math.max(0.1, Math.min(1.0, basePriority + adjustment));
    }
}
```

---

## Part 9: Advanced Cognitive Functions

### 9.1 Meta-Cognitive Monitoring ("The Observer")

A background process monitors system health:

```typescript
class MetacognitiveMonitor {
    private state: 'normal' | 'confused' | 'bored' | 'overloaded' = 'normal';

    check(nar: NAR): CognitiveState {
        const stats = nar.getStatistics();
        const contradictions = countContradictions(nar.getBeliefs());
        const derivationRate = stats.derivationsPerSecond;
        const memoryPressure = stats.memoryPressure;

        if (contradictions > stats.totalConcepts * 0.1) {
            this.state = 'confused';
            return { state: 'confused', action: 'resolve-conflicts', explanation: this.explainConfusion(nar) };
        }
        if (derivationRate < 0.01 && stats.totalConcepts > 10) {
            this.state = 'bored';
            return { state: 'bored', action: 'explore', explanation: 'Low activity — exploring memory for gaps' };
        }
        if (memoryPressure > 0.9) {
            this.state = 'overloaded';
            return { state: 'overloaded', action: 'consolidate', explanation: 'Memory pressure high — consolidating' };
        }

        this.state = 'normal';
        return { state: 'normal', action: 'continue' };
    }

    async executeAction(action: string, nar: NAR): Promise<void> {
        switch (action) {
            case 'resolve-conflicts': await this.resolveConflicts(nar); break;
            case 'explore': await this.exploreMemory(nar); break;
            case 'consolidate': nar.memory.consolidate(); break;
        }
    }
}
```

**NL Interface**:
- "You seem confused." → System reports conflicts and asks for resolution
- "Are you thinking hard?" → System reports cognitive state
- "Take a break." → System triggers consolidation cycle

### 9.2 Temporal Causal Discovery

Detect patterns in event streams and generate implication beliefs:

```typescript
class TemporalCausalDetector {
    private eventLog: Array<{ event: string; timestamp: number }> = [];

    observe(event: string): void {
        this.eventLog.push({ event, timestamp: Date.now() });
        // Keep only recent events
        const cutoff = Date.now() - 3600000; // 1 hour
        this.eventLog = this.eventLog.filter(e => e.timestamp > cutoff);
    }

    detectPatterns(): TemporalRelation[] {
        const patterns: TemporalRelation[] = [];
        const events = [...new Set(this.eventLog.map(e => e.event))];

        for (const a of events) {
            for (const b of events) {
                if (a === b) continue;
                const aTimes = this.eventLog.filter(e => e.event === a).map(e => e.timestamp);
                const bTimes = this.eventLog.filter(e => e.event === b).map(e => e.timestamp);

                // Check if A consistently precedes B
                const precedesCount = countPrecedes(aTimes, bTimes, 5000); // 5s window
                if (precedesCount > 3 && precedesCount / aTimes.length > 0.7) {
                    patterns.push({ cause: a, effect: b, confidence: precedesCount / aTimes.length });
                }
            }
        }
        return patterns;
    }

    generateBeliefs(patterns: TemporalRelation[]): string[] {
        return patterns.map(p =>
            `((<${p.cause}> =/> <${p.effect}>). :${p.confidence.toFixed(1)}:${(p.confidence * 0.9).toFixed(1)})`
        );
    }
}
```

**NL Interface**:
- "I notice that every time it rains, the ground gets wet." → System forms `(<rain> =/> <ground-wet>)` belief
- "What causes X?" → System searches temporal patterns for effects preceding X

### 9.3 Concept Clustering & Abstraction ("Sleep Cycle")

Periodically analyze belief graph to discover clusters and invent abstract concepts:

```typescript
class ConceptClusterer {
    findClusters(concepts: Concept[], minSize = 3): ConceptCluster[] {
        // Build adjacency matrix from link strengths
        const adjacency = this.buildAdjacency(concepts);
        // Use connected components with minimum link strength threshold
        return this.findConnectedComponents(adjacency, concepts, minSize);
    }

    async suggestAbstractions(cluster: ConceptCluster, lm: LMClient): Promise<AbstractConcept> {
        const { object } = await generateObject({
            model: lm.model,
            prompt: `These concepts are closely related: ${cluster.concepts.map(c => c.term.toString()).join(', ')}.
                     What abstract category do they belong to?`,
            schema: z.object({
                name: z.string(),
                definition: z.string(),
                sharedProperties: z.array(z.string()),
            }),
        });

        return {
            name: object.name,
            definition: object.definition,
            members: cluster.concepts,
            sharedProperties: object.sharedProperties,
        };
    }
}
```

**NL Interface**:
- "What do cats, dogs, and birds have in common?" → "They are all Animals."
- "Think about what connects X, Y, and Z." → System runs clustering and reports abstraction

### 9.4 Counterfactual Reasoning

Explore "what if" scenarios by temporarily negating beliefs:

```typescript
async counterfactual(term: Term, negate: boolean, nar: NAR): Promise<CounterfactualReport> {
    // Save current state
    const originalBelief = nar.memory.getBelief(term);
    if (!originalBelief) return { possible: false, reason: 'No belief to counterfactual' };

    // Create temporary negated belief
    const negatedTruth = negate
        ? { f: 1 - originalBelief.truth.f, c: originalBelief.truth.c * 0.5 }
        : originalBelief.truth;

    // Run reasoning with negated belief
    nar.memory.temporarilyReplace(term, negatedTruth);
    const result = await nar.run(5);
    const newBeliefs = nar.getNewBeliefs();

    // Restore original state
    nar.memory.restore(term, originalBelief);

    // Compare: what changed?
    const differences = compareBeliefSets(nar.getBeliefs(), newBeliefs);

    return {
        original: beliefToNL(originalBelief),
        counterfactual: negate ? `NOT ${beliefToNL(originalBelief)}` : beliefToNL(originalBelief),
        whatWouldChange: differences.map(d => beliefToNL(d)),
        dependentBeliefs: findDependentBeliefs(term, nar),
    };
}
```

**NL Interface**:
- "What if cats weren't mammals?" → System reports what beliefs would change
- "Would X still be true if Y were false?" → System checks dependency

---

## Part 10: Pipeline Architecture

### 10.1 Unified Processing Pipeline

Building on BOT6's pipeline design, the system processes all input through a composable stage pipeline with bounded loop-back:

```
InputNormalizer → AuthChecker → CommandProcessor* → InputClassifier
  → NLAnalyzer → NLDecomposer → SeNARSProcessor → LMResponder
  → DirectiveProcessor ↻ (loop: SeNARSProcessor → LMResponder → DirectiveProcessor)
  → ResponseComposer → ResponseFormatter → StatePersistor

* CommandProcessor: early exit, skips remaining stages
```

**New stages**:
- `NLAnalyzer`: Extracts intents, concepts, ambiguity from NL input
- `NLDecomposer`: Breaks compound intents into ordered sub-goals

### 10.2 Pipeline Presets

| Preset | Stages | Loop-Back | Use Case |
|--------|--------|-----------|----------|
| `full` | All 13 stages | Enabled | Complete LM+NAR interaction |
| `chat` | Normalizer → Auth → Command → Classifier → LMResponder → Composer → Formatter → Persistor | Disabled | LM-only conversation |
| `reasoning` | Normalizer → Auth → Command → Classifier → NLAnalyzer → SeNARSProcessor → Composer → Formatter → Persistor | Disabled | NAR-only reasoning |
| `nl-cognitive` | Full pipeline + NLDecomposer | Enabled | Complex NL with decomposition |

### 10.3 Event Bus

Stages emit typed events for observability (from BOT6):

```typescript
interface PipelineEvents {
    'nl:analyzed': { input: string; analysis: NLAnalysis };
    'nl:decomposed': { intents: NLIntent[] };
    'nl:clarification-needed': { ambiguity: Ambiguity };
    'nl:translation': { nl: string; narsese: string; tier: number };
    'nal:derived': { premises: string[]; rule: string; conclusion: string; truth: Truth };
    'lm:called': { ruleId: string; prompt: string; response: string; durationMs: number };
    'lm:validation-failed': { output: string; reason: string };
    'attention:adjusted': { concept: string; oldPriority: number; newPriority: number };
    'memory:consolidated': { archived: number; merged: number; abstracted: number };
    'cognitive:state-change': { oldState: string; newState: string; action: string };
    'correction:learned': { original: string; corrected: string };
}
```

---

## Part 11: REPL and Interaction Commands

### 11.1 REPL Commands

| Command | Description | Requires |
|---------|-------------|----------|
| `/mode auto\|chat\|reason` | Switch interaction mode | — |
| `/depth N` | Set reasoning depth | SeNARS |
| `/budget chat\|reasoning\|deep\|balanced` | Set cognitive budget | — |
| `/beliefs [pattern]` | List beliefs, optionally filtered | SeNARS |
| `/concepts` | Show concept graph | SeNARS |
| `/trace <term>` | Show derivation history | SeNARS |
| `/explain <term>` | Show reasoning path in NL | SeNARS + LM |
| `/rules [list\|enable\|disable]` | Manage NAL rules | SeNARS |
| `/lm-rules [list\|enable\|disable]` | Manage LM rules | LM |
| `/nl-parsers [list\|add\|remove]` | Manage NL parsers | — |
| `/focus <topic>` | Set attention focus | SeNARS |
| `/forget <pattern>` | Remove beliefs matching pattern | SeNARS |
| `/history [N]` | View last N turns | — |
| `/context` | Show current attention/focus | SeNARS |
| `/export [file]` | Export beliefs as Narsese | SeNARS |
| `/import <file>` | Import Narsese file | SeNARS |
| `/reset` | Reset conversation state | — |
| `/benchmark` | Run reasoning benchmark | SeNARS |
| `/adversarial [scenario]` | Run adversarial test | SeNARS |
| `/self.status` | Show cognitive state | SeNARS |
| `/self.analyze` | Run self-analysis | SeNARS + LM |
| `/pipeline` | Inspect pipeline stages | — |
| `/debug on\|off` | Toggle Narsese debug output | — |

### 11.2 Output Formatting

- **Normal mode**: Natural language only, Narsese hidden
- **Debug mode** (`/debug on`): Show Narsese alongside NL
- **Color coding**: Green (c > 0.7), Yellow (0.3-0.7), Red (< 0.3)
- **Indentation**: Derivation depth indicated by indentation
- **Collapsible**: Large derivation sets collapsible

---

## Part 12: Execution Protocol

### 12.1 Development Cycle

```
1. Analyze: Read current state of src/nar/rules/, src/nar/lm/, src/nar/nl/, src/nar/memory/
2. Experiment: Run a targeted test (adversarial scenario, NL translation, reasoning chain)
3. Observe: Did it crash? Derive nonsense? Loop? Misinterpret NL? Oscillate?
4. Fix: Modify code at the correct abstraction level
5. Verify: Run full test suite + generated regression tests
6. Report: Summarize limitation, fix, and new capability
7. Repeat: New capabilities reveal new edge cases
```

### 12.2 Priority Order

| Priority | Area | Rationale |
|----------|------|-----------|
| **P0** | NL→NAL translation pipeline (Tier 1+2 wired) | Foundation for all NL interaction |
| **P0** | LM result interpretation (confidence, derivation summary) | User-facing quality |
| **P1** | Compound intent decomposition | Handles real user input |
| **P1** | Clarification protocol | Prevents wrong translations |
| **P1** | Context window management | LM quality depends on it |
| **P2** | Goal-driven attention | Improves reasoning relevance |
| **P2** | Adversarial testing suite | Finds real bugs |
| **P2** | Self-correction loop | Improves LM reliability |
| **P3** | Counterfactual reasoning | Advanced cognitive function |
| **P3** | Concept clustering/abstraction | Knowledge compression |
| **P3** | Temporal causal discovery | Learning from observation |
| **P3** | Meta-cognitive monitoring | Self-awareness |
| **P4** | Rule priority meta-learning | Long-term optimization |
| **P4** | Cognitive budget allocation | Resource management |
| **P4** | Feedback loop (RLFP) | Learning from corrections |

### 12.3 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| NL→NAL translation accuracy | > 90% for common patterns | Test suite coverage |
| Clarification rate | < 10% of inputs | Event log |
| Derivation quality (no spurious) | ≤ 5 derivations per single belief | Assertion test |
| Contradiction detection | 100% of direct conflicts | Adversarial test |
| LM self-correction success | > 80% within 2 retries | Validation log |
| Cognitive budget adherence | 0 over-budget turns | Metrics |
| User correction learning | Corrections reduce repeat errors by 50% | RLFP stats |
| Explanation quality | User accepts > 80% of explanations | Feedback |

---

## Appendix A: Complete Interaction Flow Examples

### A.1: Learning via NL with Derivation

```
User: "Remember that all dolphins are mammals."
System: [NLAnalyzer: intent=believe, concepts=[dolphin, mammal]]
        [Regex match: "all X are Y" → (<dolphin --> mammal>. :1.0:0.9)]
        [SeNARSProcessor: nar.believe('<dolphin --> mammal>. :1.0:0.9')]
        [Reasoning: No new derivations (no related beliefs)]
System: "I've noted that dolphins are mammals."

User: "And mammals are animals."
System: [Regex match: "X are Y" → (<mammal --> animal>. :0.9:0.9)]
        [nar.believe('<mammal --> animal>. :0.9:0.9')]
        [Reasoning: deduction on (<dolphin --> mammal>) + (<mammal --> animal>)
         → (<dolphin --> animal>. :0.9:0.8)]
        [LMResponder: explains derivation]
System: "Understood. Since dolphins are mammals and mammals are animals,
         I've also concluded that dolphins are animals."

User: "Why do you think dolphins are animals?"
System: [NLAnalyzer: intent=explain, concepts=[dolphin, animal]]
        [traceAPI.explain('<dolphin --> animal>')]
        [LMResponder: summarizes derivation path]
System: "I believe this because:
         1. You told me 'all dolphins are mammals'.
         2. You told me 'mammals are animals'.
         3. By deductive reasoning, dolphins must be animals.
         Confidence: high (based on your direct statements)."
```

### A.2: Counterfactual Reasoning

```
User: "What if dolphins weren't mammals?"
System: [NLAnalyzer: intent=counterfactual, concepts=[dolphin, mammal]]
        [counterfactual('<dolphin --> mammal>', negate=true)]
        [Saves original belief, runs reasoning with negated version]
        [Compares: what beliefs would change?]
System: "If dolphins weren't mammals, I could no longer conclude that
         dolphins are animals (based on that rule alone). I would need
         other evidence, such as 'dolphins are vertebrates' and
         'vertebrates are animals'."
```

### A.3: Cognitive Control via NL

```
User: "Focus on marine biology."
System: [NLAnalyzer: intent=focus, concepts=[marine, biology]]
        [attentionController.boostTopic('marine', factor=2.0, ttl=50)]
        [attentionController.boostTopic('biology', factor=2.0, ttl=50)]
        [Boosts cascade to related: dolphin, fish, ocean, mammal]
System: "I'm now prioritizing concepts related to marine biology."

User: "Forget everything about sharks."
System: [NLAnalyzer: intent=forget, concepts=[shark]]
        [memory.removeConceptsMatching('shark')]
        [Removes: (shark --> fish), (shark --> animal), etc.]
System: "I've removed all beliefs and concepts related to sharks."

User: "What were we talking about?"
System: [NLAnalyzer: intent=recall]
        [episodicMemory.recallRecent(5)]
        [LMResponder: summarizes recent conversation]
System: "We were discussing marine mammals, specifically dolphins and
         their classification as mammals and animals."
```

### A.4: Compound Intent with Decomposition

```
User: "Remember cats are mammals, then figure out if Whiskers is an animal, and forget anything about fish."

System: [NLAnalyzer: compound input detected]
        [LMDecomposer: breaks into 3 intents]
        Intent 1: believe('<cat --> mammal>. :0.9:0.9')
        Intent 2: query('<Whiskers --> animal>?') [depends on Intent 1]
        Intent 3: forget(pattern='fish')

        [Execute Intent 1: nar.believe('<cat --> mammal>. :0.9:0.9')]
        [Execute Intent 2: nar.question('<Whiskers --> animal>?')]
          → If Whiskers --> cat exists: derives Whiskers --> animal
          → If not: "I don't know if Whiskers is an animal. I know cats are mammals,
                     but I have no information about Whiskers."
        [Execute Intent 3: memory.removeConceptsMatching('fish')]

System: "I've noted that cats are mammals. [If derived:] I've also concluded
         that Whiskers is an animal (since Whiskers is a cat and cats are mammals).
         I've removed all beliefs about fish."
```

### A.5: Ambiguity and Clarification

```
User: "Birds fly"

System: [NLAnalyzer: detects ambiguity]
        Pattern 1: "X fly" → could be property: (<bird --> [fly]>)
        Pattern 2: "Birds fly" → could be universal: (<bird --> fly>. :1.0:0.9)
        Pattern 3: "Birds fly" → could be existential: (<bird --> fly>. :0.5:0.5)
        [Confidence too low for automatic selection]

System: "When you say 'Birds fly', do you mean:
         1. All birds fly
         2. Some birds fly
         3. Flying is a property of birds"

User: "All of them"
System: [Resolves to universal: (<bird --> fly>. :1.0:0.9)]
        [Records correction for future: "Birds fly" + "All" → universal]
System: "I've noted that all birds fly."
```

---

## Appendix B: LM Prompt Templates

### B.1: Translation Prompt

```
You are a reasoning system that translates natural language to Narsese logic.

## Current Knowledge Context
{attention_report}
{related_beliefs}

## Recent Successful Translations
{few_shot_examples}

## Narsese Syntax
- (A --> B) = "A is a kind of B" (inheritance)
- (A <-> B) = "A is similar to B" (similarity)
- (A ==> B) = "if A then B" (implication)
- (A =/> B) = "A causes B" (temporal implication)
- [property] = property term
- --(statement) = negation

## Rules
- Use :frequency:confidence truth values (default :0.9:0.9 for confident statements)
- Universal claims ("all X are Y") → frequency 1.0
- Typical claims ("X are Y") → frequency 0.9
- Existential claims ("some X are Y") → frequency 0.5
- Keep confidence below 1.0 unless the user explicitly says "all" or "always"

Translate: "{input}"

Return JSON matching the Translation schema.
```

### B.2: Explanation Prompt

```
You are explaining a reasoning result to a user.

## The Conclusion
{conclusion_narsese} → {conclusion_nl}

## How It Was Derived
{derivation_path}

## Truth Value
Frequency: {f}, Confidence: {c}

## Related Knowledge
{related_beliefs}

Explain this conclusion in natural language. Include:
1. What the conclusion means
2. How it was derived (in simple terms)
3. How confident we are and why
4. What additional information would strengthen or weaken it

Be concise and direct.
```

### B.3: Clarification Prompt

```
The input "{input}" is ambiguous. Possible interpretations:

{options}

Generate a clarifying question that helps the user choose between these interpretations.
The question should be natural and concise.

Return JSON: { "question": "...", "options": ["...", "..."] }
```

---

## Appendix C: Existing Components to Wire

The following components already exist in the codebase but are not fully integrated into the NL interface:

| Component | Location | Current State | Needed Integration |
|-----------|----------|---------------|-------------------|
| `NLTranslator` | `src/nar/nl/translator.ts` | Exists, not wired to pipeline | Wire as Tier 2 parser |
| `TranslationCache` | N/A | Does not exist | Create for few-shot retrieval |
| `BidirectionalFeedbackLoop` | `src/nar/lm/feedback.ts` | Exists, not wired | Connect to correction learner |
| `ProactiveEnricher` | `src/nar/lm/enrichment.ts` | Exists, not triggered | Trigger during sleep cycle |
| `EmbeddingLayer` | `src/nar/memory/links/` | Exists | Use in premise selection |
| `RLFP system` | `src/nar/rlfp/` | Exists | Connect to correction learning |
| `MetacognitiveMonitor` | `src/nar/metrics/` | Exists | Wire to cognitive state |
| `SelfAnalyzer` | `src/nar/self/` | Exists | Use for self-analysis command |
| `ExplainTool` | `src/nar/tools/` | Exists | Wire to /explain and "why" queries |
| `EpisodicMemory` | `src/nar/memory/` | Exists | Wire to "what were we talking about" |
| `Focus` | `src/nar/memory/` | Exists | Add topic-based boosting |
| `ClarificationSchema` | `src/nar/nl/schemas.ts` | Exists | Wire to ambiguity detection |
| `GoalDecompositionSchema` | `src/nar/nl/schemas.ts` | Exists | Wire to compound intent |
| `13 LM Rules` | `src/nar/lm/rules.ts` | Exists | Wire with activation conditions |
| `RuleProcessor` | `src/nar/rules/processor.ts` | Exists | Add LM rule activation strategy |
| `TranslationSchema` | `src/nar/nl/schemas.ts` | Exists | Already used, expand with context |

---

**End of GROW2.md**
*This document replaces GROW.md as the living blueprint for SeNARS cognitive architecture evolution. It specifies the complete LM-NAL synergy model, interaction patterns, and implementation roadmap.*
