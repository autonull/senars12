# BOT7: REPL-Driven Refinement & NAR+LM Synergy

## Vision

A reasoning system where NARS and Language Models complement each other naturally:
- **NARS** provides precise logical inference, truth-value calculus, and structured knowledge
- **LM** provides natural language understanding, knowledge injection, and explanation
- **REPL** is the laboratory where we observe, diagnose, and improve their interaction

## Methodology: REPL-Driven Discovery Loop

```
Experiment → Observe → Trace → Fix → Test → Repeat
```

1. **Experiment**: Feed mixed Narsese/NL inputs, vary complexity
2. **Observe**: Identify unexpected output (noise, wrong answers, missing derivations)
3. **Trace**: Follow data flow: input → parse → classify → reason → compose → format
4. **Fix**: Address at correct abstraction level (parser, rule, processor, formatter)
5. **Test**: Add diagnostic test to `tests/nar/unit/diagnostic.test.ts`
6. **Repeat**: New tests reveal new edge cases

---

## Phase 1: Output Correctness & Noise Reduction

### 1.1 Operation (`^`) Operator Misuse in Extended Rules

**Problem**: `nal-extended.ts` produces `^` (operation) terms inside inheritance predicates, conflating executable operations with declarative knowledge.

```
// Current (wrong): (cat --> (allocate ^ dog))
// Should be:       ((cat ==> <^dog>) .)  or simply not derived
```

**Affected rules** in `nal-extended.ts`:
- `operationExecution` (line 263) — produces `operation(op, input)` from two inheritance terms
- `goalExecution` (line 268) — conflates goal satisfaction with inheritance
- `strategyEffectiveness` (line 307) — embeds operations in inheritance predicates
- `resourceAllocation` (line 315) — same issue
- `utilityEstimation` (line 331) — same issue
- `metacognitiveRevision` (line 339) — operations as both subject and predicate
- `selfModelConsistency` (line 348) — operations inside similarity

**Fix**: Either remove these rules from declarative reasoning, or rewrite to use proper higher-order relations (`==>`, `<=>`) instead of `-->` with operation terms.

**Test**: Verify no `^` in standard inheritance/syllogism derivations from pure declarative input.

### 1.2 Spurious Derivations from Single Input

**Problem**: `<dog --> animal>.` produces 32+ derived beliefs, many nonsensical:
- `(dog /> --animal))` — malformed output
- `(cat --> (allocate ^ dog))` — operation misuse
- `(animal & (allocate ^ dog))` — operation misuse

**Root causes**:
- `BagStrategy.sample(10)` selects unrelated concepts as secondary premises
- No premise relevance filtering before rule application
- Extended rules fire on any term pair match

**Fix**:
- Add subject/predicate overlap scoring for premise selection
- Filter secondary premises: require at least one shared atomic term
- Add derivation quality threshold (discard results with priority < 0.05)
- Review extended rules for over-broad matching

**Test**: Single belief input produces ≤ 5 meaningful derivations.

### 1.3 Task Stringification Consolidation

**Problem**: Inconsistent formatting across the codebase:

| Location | Format | Issue |
|----------|--------|-------|
| `ResponseComposer.ts:40` | `:${f.toFixed(1)}:${c.toFixed(1)}` | Loses precision (0.95 → "1.0") |
| `SeNARSProcessor.ts:155` | `:${answer.confidence.toFixed(2)}` | Different precision |
| `nar.ts:20` | `f=${f.toFixed(2)} c=${c.toFixed(2)}` | Different format |
| `BotContext.ts:184` | `:${f}:${c}` | Raw numbers via `as any` |

**Fix**: Create `TaskFormatter` utility:

```typescript
// src/nar/utils/task-formatter.ts
export const TaskFormatter = {
  format(task: Task, opts?: FormatOpts): string,
  formatBrief(task: Task): string,    // "(cat --> animal). :0.5:0.9"
  formatFull(task: Task): string,     // "(cat --> animal). :0.5:0.9 {depth:0, source:INPUT}"
  formatTruth(truth: Truth, opts?: TruthOpts): string,
  punct(task: Task): string,          // ".", "!", "?"
};
```

Replace all ad-hoc formatting in:
- `SeNARSProcessor.ts`
- `ResponseComposer.ts`
- `PipeOutput.ts`
- `BotContext.ts` context fragments

---

## Phase 2: Input Processing & Classification

### 2.1 NL Parser Expansion

**Current**: 5 patterns, single-word terms only.

**Required patterns**:

| Pattern | Example | Narsese Output |
|---------|---------|----------------|
| Universal | "All cats are animals" | `(<cat --> animal>. :1.0:0.9)` |
| Existential | "Some cats are black" | `(<cat --> [black]>. :0.5:0.5)` |
| Property | "Cats are furry" | `(<cat --> [furry]>. :0.9:0.9)` |
| Instance | "Whiskers is a cat" | `(<Whiskers --> cat>.)` |
| Similarity | "Cats are like dogs" | `(<cat <-> dog>. :0.8:0.8)` |
| Causal | "Rain causes wetness" | `((<rain> =/> <wetness>). :0.8:0.8)` |
| Temporal-before | "Lightning before thunder" | `((<lightning> ,/ <thunder>). :0.9:0.9)` |
| Temporal-after | "Thunder after lightning" | `((<lightning> \, <thunder>). :0.9:0.9)` |
| Implication | "If it rains then it is wet" | `((<rain> ==> <wet>). :0.9:0.9)` |
| Negation | "Cats are not dogs" | `(--(<cat --> dog>). :0.9:0.9)` |
| Conjunction | "Cats are animals and mammals" | `((<cat --> animal> & <cat --> mammal>).)` |
| Goal | "I want to know about cats" | `(<cat --> ?1>!)` |
| Query-what | "What is a cat?" | `(<cat --> ?1>?)` |
| Query-whether | "Is a cat an animal?" | `(<cat --> animal>?)` |
| Query-which | "Which animals are mammals?" | `(<$1 --> mammal>?)` |

**Requirements**:
- Multi-word term support: "machine learning", "natural language processing"
- Configurable at runtime: `/nl-parser add/remove/list`
- Ordered with explicit precedence (not fragile regex ordering)

### 2.2 LM-Assisted NL Parsing Fallback

**Problem**: When built-in NL parsers fail, no fallback exists.

**Fix**:
- After built-in parsers return `null`, invoke `lm-narsese-translation` rule
- LM generates Narsese, validated by parser before injection
- Cache successful translations for repeated patterns
- Log translation quality (accepted/rejected/modified)

**Test**: Complex NL input that no built-in parser handles gets LM translation.

### 2.3 Input Classification Accuracy

**Problem**: `NARSESE_REGEX` misses valid Narsese and produces false positives.

**Current regex**: `/^\s*\(?[^()\s]+\s*(-->|<->|==>|<=>|&&|\|\|)\s*/`

**Issues**:
- Misses compound terms: `((A & B) --> C)`
- Misses truth value suffixes: `:0.9:0.8`
- Misses simple atomic statements: `(bird.)`, `(bird?)`
- False positive: `foo --> bar` (no parentheses)

**Fix**:
- Use actual parser probe: try `termParser.parse()` and catch errors
- Classification by structure, not regex:
  - Starts with `!` → goal
  - Ends with `?` → query
  - Starts with `/` or `.` → command
  - Parses as valid Narsese → narsese
  - Contains NL keywords → reason/query
  - Default → chat

**Test**: All valid Narsese forms classified correctly; NL queries not misclassified as Narsese.

### 2.4 Input Validation

**Missing**:
- Length limits on input text (prevent DoS)
- Sanitization of special characters
- Rate limiting on LM calls
- Tautology detection (done in Phase 0)
- Reserved term rejection (TRUE, FALSE — done in Phase 0)

---

## Phase 3: Reasoning Quality

### 3.1 Rule Output Validation

**Problem**: Rules produce terms with unexpected or invalid structures.

**Fix**: Add post-rule validation in `RuleProcessor`:
- Check term kind matches expected output kind
- Validate term arity (binary ops have 2 args, unary have 1)
- Reject self-referential terms (tautologies)
- Reject terms with operation kinds in declarative context
- Log validation failures as warnings

**Test**: All rule outputs pass validation; invalid outputs logged and discarded.

### 3.2 Premise Selection Improvement

**Current**: `BagStrategy.sample(10)` — random concepts from memory.

**Fix**: Implement term-link based premise selection:
1. **Direct link**: Concepts sharing atomic terms (fast, high relevance)
2. **Semantic link**: Concepts with similar structure (medium relevance)
3. **Priority-weighted**: Higher priority concepts selected more often
4. **Recency bonus**: Recently accessed concepts get bonus

**Algorithm**:
```
score(concept, task) =
  atomic_overlap(concept.term, task.term) * 0.5 +
  structural_similarity(concept.term, task.term) * 0.3 +
  concept.priority * 0.1 +
  recency_bonus(concept) * 0.1
```

**Test**: Given `<cat --> animal>`, secondary premises include related concepts (dog, mammal) before unrelated ones.

### 3.3 Derivation Depth Control

**Problem**: `nar.run(3)` produces cascading derivations of questionable value.

**Fix**:
- Adaptive depth: shallow (1) for single belief, medium (3) for queries, deep (5+) for explicit reasoning
- Derivation relevance scoring: prune chains where each step reduces confidence below threshold
- REPL command: `/depth 1|3|5|10`
- Configurable per-input: `<cat --> animal>. /depth=5`

**Test**: Derivation chains terminate when relevance drops below threshold.

### 3.4 Revision Rule Fix

**Problem**: `revision` rule in `nal.ts` (line 110) returns `i1` unchanged — doesn't merge truth values.

**Fix**: Proper revision should:
- Match terms by structural equality
- Merge truth values using `Truth.revision()`
- Return term with revised truth (handled at Concept level, not rule level)

**Note**: Revision is already handled in `Concept.addBeliefWithRevision()`. The NAL rule should be removed or repurposed.

---

## Phase 4: Query & Answer Quality

### 4.1 Exact Match Guarantee

**Problem**: After reasoning steps, exact match concept may have low confidence, causing similar (but wrong) concept to be returned.

**Fix** (already implemented in Phase 0):
- `findConceptByTerm()` uses `termsEqual()` for structural equality
- Lower confidence threshold (0.01) for exact matches vs similar concepts (0.1)

**Test**: Query always returns exact match when concept exists, regardless of confidence.

### 4.2 Inferred Answers

**Problem**: When no exact match exists, inference quality is poor.

**Fix**:
- For inheritance queries `<S --> P>?`: search for chains `S --> X --> P`
- For similarity queries `<A <-> B>?`: search for shared properties
- Report derivation path with confidence at each step
- Indicate when answer is inferred vs direct

**Test**: Query `<cat --> mammal>?` with beliefs `<cat --> animal>.` and `<animal --> mammal>.` returns inferred answer with chain.

### 4.3 "I Don't Know" with Suggestions

**Problem**: When no answer exists, system says nothing or gives unhelpful response.

**Fix**:
- When confidence < threshold: "I don't have enough information about X"
- Suggest beliefs that would help: "If I knew <X --> Y>, I could answer"
- Track what beliefs would enable derivation (backward chaining)

---

## Phase 5: LM Integration & Synergy

### 5.1 LM-Driven NL Parsing

**Current**: `lm-narsese-translation` rule exists but not invoked from NL translation path.

**Fix**:
- In `SeNARSProcessor.translateNL()`, after built-in parsers fail, invoke LM
- Prompt: "Convert this natural language to Narsese: '{text}'. Output only Narsese."
- Validate LM output with parser before injection
- Cache successful translations

**Test**: Complex NL input → LM translation → valid Narsese → correct derivation.

### 5.2 LM Knowledge Injection

**Current**: No mechanism for LM to contribute knowledge.

**Fix**:
- LM can inject beliefs via `[BELIEVE: <term>. :f:c]` directive
- LM can suggest reasoning via `[REASONING_SUGGESTED: ...]` directive
- Injected beliefs validated before adding to memory
- Track provenance: which beliefs came from LM vs NAR derivation

**Test**: LM injects belief, NAR uses it in subsequent derivations.

### 5.3 LM Explanation of NAR Derivations

**Current**: No explanation capability.

**Fix**:
- After NAR derives beliefs, LM explains in natural language
- Prompt: "Explain this Narsese derivation in natural language: {derivations}"
- Include confidence and reasoning path
- Format: "Based on {premises}, I derived {conclusion} with confidence {c}"

**Test**: NAR derives `<cat --> mammal>`, LM explains "Since cats are animals and animals are mammals, cats are mammals."

### 5.4 Bidirectional Feedback Loop Integration

**Current**: `BidirectionalFeedbackLoop` and `ProactiveEnricher` exist but not wired into pipeline.

**Fix**:
- Integrate feedback loop as pipeline stage after `SeNARSProcessor`
- LM validates NAR-derived hypotheses
- NAR validates LM-generated beliefs
- Proactive enricher runs periodically on underconnected concepts

**Test**: LM-generated belief validated by NAR rules before acceptance.

### 5.5 Streaming Fix

**Current**: `streaming.ts` simulates streaming by iterating over completed response.

**Fix**:
- Use actual LM streaming API (SSE, chunked responses)
- Implement backpressure handling
- Cancel streaming on user interrupt

---

## Phase 6: Pipeline & Architecture

### 6.1 CommandProcessor Connection Stub

**Problem**: Creates fake `Connection` with no-op methods. Commands that `send()` or `respond()` silently fail.

**Fix**: Pass real connection or implement proper command response routing.

### 6.2 Type Safety

**Problem**: 6+ `as any` casts throughout pipeline.

| File | Line | Fix |
|------|------|-----|
| `SeNARSProcessor.ts` | 144 | Use proper `Truth` type |
| `DirectiveProcessor.ts` | 69 | Proper directive type |
| `LMResponder.ts` | 39 | Proper streaming type |
| `CommandProcessor.ts` | 46-48 | Proper command type |
| `Pipeline.ts` | 75 | Proper loopBackType |
| `BotContext.ts` | 210 | Proper conversation type |

### 6.3 Context Fragment Completion

**Problem**: `links` and `focus` context fragments return empty strings.

**Fix**: Implement actual link retrieval and focus set reporting.

### 6.4 Pipeline Loop-Back

**Problem**: Only `SeNARSProcessor`, `LMResponder`, `DirectiveProcessor` are looped. `ResponseComposer` should also run in loops.

**Fix**: Add `ResponseComposer` to loop stages; compose directive results from each pass.

---

## Phase 7: REPL Enhancements

### 7.1 Interactive Commands

| Command | Description |
|---------|-------------|
| `/mode auto\|chat\|reason` | Switch bot mode |
| `/depth N` | Set reasoning depth |
| `/beliefs [pattern]` | List beliefs, optionally filtered |
| `/concepts` | Show concept graph |
| `/trace <term>` | Show derivation history |
| `/explain <term>` | Show reasoning path in NL |
| `/rules [list\|enable\|disable]` | Manage NAL rules |
| `/lm-rules [list\|enable\|disable]` | Manage LM rules |
| `/nl-parsers [list\|add\|remove]` | Manage NL parsers |
| `/directives` | List/configure directives |
| `/history [N]` | View last N turns |
| `/context` | Show current attention/focus |
| `/export [file]` | Export beliefs as Narsese |
| `/import <file>` | Import Narsese file |
| `/reset` | Reset conversation state |
| `/benchmark` | Run reasoning benchmark |
| `/pipeline` | Inspect pipeline stages |

### 7.2 Output Formatting

- Color-coded truth values: green (c > 0.7), yellow (0.3-0.7), red (< 0.3)
- Indentation for derivation depth
- Collapsible output for large derivation sets
- JSON mode for programmatic use (`--json` flag)
- Quiet mode (`--quiet` flag) — already exists

### 7.3 Session Persistence

- Save/load session state (memory + conversation)
- Export beliefs to Narsese file
- Import domain knowledge files
- Auto-save on exit

---

## Phase 8: Self-Monitoring & Meta-Reasoning

### 8.1 Loop Detection

- Detect when derivations cycle (A → B → A)
- Report and break loops
- Track loop frequency for rule tuning

### 8.2 Confidence Reporting

- Report confidence with every answer
- Indicate confidence source: direct belief, single derivation, chain
- Suggest beliefs to improve confidence

### 8.3 Attention & Focus

- Report what concepts are currently in focus
- Explain why certain concepts are prioritized
- Allow manual attention control

---

## Diagnostic Test Strategy

Every fix gets a diagnostic test in `tests/nar/unit/diagnostic.test.ts`:

```
tests/nar/unit/diagnostic.test.ts
├── Tautology Detection (7 tests)
├── NAR Tautology Rejection (2 tests)
├── Revision vs New Derivation (2 tests)
├── Query Answer Accuracy (3 tests)
├── Derivation Chain Integrity (2 tests)
├── [Phase 1] Operation Operator (3 tests)
├── [Phase 1] Spurious Derivations (2 tests)
├── [Phase 2] NL Parser Coverage (10 tests)
├── [Phase 2] Classification Accuracy (5 tests)
├── [Phase 3] Rule Output Validation (3 tests)
├── [Phase 3] Premise Selection (3 tests)
├── [Phase 4] Inferred Answers (3 tests)
├── [Phase 5] LM Translation (3 tests)
├── [Phase 5] Knowledge Injection (3 tests)
└── [Phase 8] Loop Detection (2 tests)
```

---

## Implementation Order

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| 1.1 Operation misuse | Critical | Medium | None |
| 1.2 Spurious derivations | Critical | Medium | 1.1 |
| 1.3 TaskFormatter | High | Low | None |
| 2.1 NL parser expansion | High | Medium | 1.3 |
| 2.2 LM NL fallback | High | Medium | 2.1, 5.1 |
| 2.3 Classification fix | High | Low | None |
| 3.1 Rule validation | High | Medium | 1.1 |
| 3.2 Premise selection | Medium | High | None |
| 3.3 Depth control | Medium | Low | None |
| 3.4 Revision fix | Low | Low | None |
| 4.1 Exact match | Done | — | — |
| 4.2 Inferred answers | Medium | Medium | 3.2 |
| 4.3 "I don't know" | Medium | Low | 4.2 |
| 5.1 LM NL parsing | High | Medium | 2.2 |
| 5.2 Knowledge injection | Medium | Medium | 5.1 |
| 5.3 LM explanation | Medium | Medium | 5.2 |
| 5.4 Feedback loop | Medium | High | 5.2 |
| 5.5 Streaming fix | Low | High | None |
| 6.1 Connection stub | High | Low | None |
| 6.2 Type safety | Medium | Medium | None |
| 6.3 Context fragments | Low | Low | None |
| 6.4 Pipeline loop | Medium | Low | None |
| 7.1 REPL commands | Medium | High | 1.3 |
| 7.2 Output formatting | Low | Medium | 1.3 |
| 7.3 Session persistence | Low | Medium | None |
| 8.1 Loop detection | Medium | Medium | None |
| 8.2 Confidence reporting | Medium | Low | 4.2 |
| 8.3 Attention/focus | Low | Medium | 6.3 |

---

## Success Metrics

- **No `^` operators** in standard inheritance derivations
- **≤ 5 derivations** from single belief input
- **100% exact match** for queries with existing concepts
- **15+ NL patterns** supported
- **LM translation** works for unparseable NL
- **All diagnostic tests pass** (50+ tests)
- **Zero `as any` casts** in pipeline stages
- **10+ REPL commands** functional
- **Confidence reported** with every answer
