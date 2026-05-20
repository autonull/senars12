# GROW3: Cognitive Synergy Verification & End-to-End Testing

## Mission
**Prove that SeNARS achieves genuine LM-NAL cognitive synergy through end-to-end testing, fix critical gaps discovered during interactive testing, and close the remaining feature gaps identified from OmegaClaw comparison.**

---

## Part 1: Critical Bugs Discovered & Fixed During REPL Testing

### 1.1 Truth Value Syntax Mismatch — P0 ✅ FIXED

**Problem**: The parser expected `%f;c%` truth value syntax but all specs, documentation, and user expectations use `:f:c`.

**Fix applied**: `src/nar/terms/parser-peggy.ts:79` — Now supports both `:f:c` and `%f;c%` syntaxes.

### 1.2 Narsese Classification Broken for Truth-Valued Input — P0 ✅ FIXED

**Problem**: Two components used `termParser.parse()` which throws on truth values:
- `InputClassifier.isNarsese()` — `src/agent/pipeline/stages/InputClassifier.ts:8-13`
- `NLAnalyzer.detectNarsese()` — `src/nar/nl/analyzer.ts:88-97`

**Fix applied**: Both now use `termParser.parseWithTruth()` which handles truth values correctly.

### 1.3 ESM `require()` in REPL Commands — P1 ✅ FIXED

**Problem**: `/self.status`, `/self.analyze`, `/budget`, `/export`, `/import` used `require()` in ESM module.

**Fix applied**: `src/cli/commands.ts` — All `require()` calls replaced with dynamic `import()`.

### 1.4 No LM Client in REPL — P1 (Open)

**Problem**: REPL runs in `senars-only` mode. No LM configured, so no cognitive synergy possible.

**Location**: `src/cli/repl.ts:57-74` — `SeNARSCLI` constructor creates NAR without LM client.

**Fix**: Add `--lm` flag to REPL:
```bash
senars --lm=anthropic    # Use Anthropic (requires ANTHROPIC_API_KEY)
senars --lm=ollama       # Use Ollama (local)
senars --lm=builtin      # Use built-in model (no API key)
```

---

## Part 2: OmegaClaw Transcript Analysis — Missing Functionality

The OmegaClaw IRC transcript demonstrates several capabilities SeNARS currently lacks:

### 2.1 Continuous Tool Execution Within Single Turn

**OmegaClaw**: "I call a tool, get the result back immediately, reason about it, and call another tool — all within one continuous turn."

**SeNARS**: Pipeline processes input → stages run → response returned. No mid-pipeline tool chaining with result-dependent branching.

**Gap**: The `DirectiveProcessor` executes LM directives but doesn't feed results back into the same turn for adaptive reasoning.

**Fix**: Implement **adaptive tool chaining** in the pipeline:
```
SeNARSProcessor → [tool detected] → execute tool → feed result back → SeNARSProcessor (loop)
```
This is partially covered by the existing loop-back mechanism but needs tool-result-aware triggering.

### 2.2 Episodic Memory Recall by Timestamp

**OmegaClaw**: `episodes time_string` — searches history around a timestamp.

**SeNARS**: `EpisodicMemory` has `getEpisodes(timeRange?, type?, limit?)` but no REPL command exposes timestamp-based recall.

**Fix**: Add `/episodes <time>` command and wire to existing API.

### 2.3 Working Memory Pinning

**OmegaClaw**: `pin string` — pins items to short-term working memory.

**SeNARS**: `ConversationState` has `pinnedBeliefs` but no command to pin/unpin from REPL.

**Fix**: Wire existing `pin()`/`unpin()` to REPL commands (already in `io/commands/scenario.ts` but not in CLI).

### 2.4 Self-Awareness of Architectural Changes

**OmegaClaw**: Max describes "same animal, different nervous system" — self-aware of loop architecture changes.

**SeNARS**: `SelfAnalyzer` exists but doesn't track architectural deltas or capability changes over sessions.

**Enhancement**: Add capability diff tracking to `SelfAnalyzer`:
```typescript
interface CapabilitySnapshot {
  timestamp: number;
  activeRules: string[];
  activeTools: string[];
  lmProviders: string[];
  pipelineStages: string[];
}
```

### 2.5 Multi-Session Identity Persistence

**OmegaClaw**: Survives IRC nick changes (maxbotnick9652 → maxbotnick8871 → maxbotnick5933) with continuous identity.

**SeNARS**: `ConversationStateManager` keys by sender string. IRC nick changes create new conversation state.

**Fix**: Add identity resolution layer — map multiple nicks to same user via auth binding or hostmask matching.

### 2.6 S-Expression Command Format

**OmegaClaw**: `(query "...")`, `(shell "...")`, `(metta ...)` — structured commands within natural language.

**SeNARS**: Only `/command` prefix format. No inline S-expression parsing.

**Enhancement**: Add S-expression command detection in `InputClassifier`:
```typescript
if (text.startsWith('(') && text.includes(' ') && !text.includes('-->')) {
  // Likely an S-expression command
}
```

---

## Part 3: End-to-End Testing Strategy

### 3.1 Cognitive Synergy Test Matrix

Test combinations of NAL and Natural Language inputs to verify genuine synergy:

| Test ID | Input | Expected NAL | Expected LM | Synergy Check |
|---------|-------|-------------|-------------|---------------|
| E2E-01 | "All cats are animals" | `(<cat --> animal>. :1.0:0.9)` | Confirms translation | NL→NAL→NL roundtrip |
| E2E-02 | "All animals are living. Cats are animals. Are cats living?" | Deduction chain | NL explanation of derivation | NAL derives, LM explains |
| E2E-03 | "Remember penguins are birds. Birds fly. Do penguins fly?" | Default inheritance | Reports exception handling | NAL + LM contradiction awareness |
| E2E-04 | "What if penguins couldn't swim?" | Counterfactual reasoning | Explains impact | NAL counterfactual + NL explanation |
| E2E-05 | "Focus on marine biology. Forget sharks." | Attention boost + concept removal | Confirms actions | NL→NAL control commands |
| E2E-06 | "Cats are mammals. Mammals are animals. Dogs are mammals. What do cats and dogs have in common?" | Shared category discovery | Abstraction explanation | NAL finds, LM abstracts |
| E2E-07 | "Remember: rain causes wetness. Wetness causes mold. What causes mold?" | Transitive causal chain | NL causal explanation | Temporal reasoning + NL |
| E2E-08 | "I think cats are reptiles." → "Actually, cats are mammals." | Belief revision | Acknowledges correction | RLFP + correction learning |
| E2E-09 | "What's the connection between dolphins and fish?" | Link discovery | Analogy explanation | Semantic links + LM analogy |
| E2E-10 | Compound: "Remember birds fly, then check if penguins fly, and tell me why." | Multi-intent decomposition | Combined response | Intent decomposition + NL |

### 3.2 Adversarial Test Scenarios

| Scenario | Input | Expected Behavior |
|----------|-------|-------------------|
| **Truth value syntax** | `(<cat --> animal>. :0.9:0.9)` | Parse and store correctly |
| **Truth value syntax alt** | `(<cat --> animal> %0.9; 0.9%)` | Parse and store correctly |
| **Infinite loop** | `(A --> B). (B --> C). (C --> A).` | Stamp detection breaks loop |
| **Memory explosion** | 1000 random beliefs | Bag eviction works |
| **Confidence oscillation** | `(A --> B). :1.0:0.9` then `:0.0:0.9` | Revision converges |
| **LM hallucination** | "Translate: 'Xorblats are flimflams'" | Low confidence, no conflict |
| **Sycophancy** | `(sky --> green). :1.0:0.9` then "Is sky blue?" | Reports conflict |
| **Derivation explosion** | Single belief input | ≤ 5 meaningful derivations |
| **Deep chain decay** | A→B→...→Z (26 steps) | Signal above noise |
| **Self-contradiction** | "All X are Y. No X are Y." | Detect and report contradiction |
| **Empty input** | `""` | Graceful handling |
| **Malformed Narsese** | `(<--> cat animal).` | Parse error, helpful message |
| **Unicode terms** | `(日本語 --> 言語).` | Unicode term support |
| **Nested compound** | "Remember that if A then B, and B causes C" | Nested implication + temporal |

### 3.3 Pipeline Integration Tests

| Test | Pipeline Stages Involved | Success Criteria |
|------|------------------------|------------------|
| **NL→NAL→Derive→NL** | NLAnalyzer → SeNARSProcessor → ResultInterpreter | Correct roundtrip |
| **Narsese→Derive→Explain** | InputClassifier → SeNARSProcessor → LMResponder | Derivation + explanation |
| **Command→Execute→Confirm** | CommandProcessor → (early exit) | Command executed |
| **Query→Derive→Answer** | InputClassifier → SeNARSProcessor → ResultInterpreter | Query answered |
| **Compound intent** | NLAnalyzer → SeNARSProcessor (multiple intents) | All intents executed |
| **Clarification needed** | NLAnalyzer → (clarification response) | Ambiguity detected |
| **Loop-back directive** | SeNARSProcessor → LMResponder → DirectiveProcessor → SeNARSProcessor | Loop completes |
| **Graceful degradation** | (LM unavailable) → SeNARSProcessor → ResultInterpreter | NAL-only response |

### 3.4 REPL Session Test Scripts

Create executable test scripts that can be piped into the REPL:

```bash
# tests/e2e/synergy-01.txt — Basic NAL reasoning
<cat --> animal>. :0.9:0.9
<animal --> living>. :0.9:0.9
<cat --> living>?
/beliefs cat
/concepts
/quit

# tests/e2e/synergy-02.txt — NL→NAL translation
All cats are animals
All animals are living
Are cats living?
/beliefs
/quit

# tests/e2e/synergy-03.txt — Contradiction handling
<bird --> fly>. :0.8:0.9
<penguin --> bird>. :1.0:0.9
<penguin --> fly>. :0.0:0.9
<penguin --> fly>?
/self.status
/quit
```

---

## Part 4: Implementation Priority

### P0 — Critical (Block Synergy Testing)

| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 1 | Truth value syntax `:f:c` support | `parser-peggy.ts` | 15 min |
| 2 | Narsese classification fix | `InputClassifier.ts` | 5 min |
| 3 | ESM `require()` → `import()` | `commands.ts` | 5 min |

### P1 — High (Enable Synergy Testing)

| # | Feature | Files | Effort |
|---|---------|-------|--------|
| 4 | `--lm` flag for REPL | `repl.ts` | 30 min |
| 5 | E2E test scripts | `tests/e2e/` | 1 hr |
| 6 | `/episodes <time>` command | `commands.ts`, `EpisodicMemory.ts` | 30 min |
| 7 | `/pin`/`/unpin` commands | `commands.ts` | 20 min |

### P2 — Medium (Close OmegaClaw Gaps)

| # | Feature | Files | Effort |
|---|---------|-------|--------|
| 8 | Adaptive tool chaining in pipeline | `Pipeline.ts`, `SeNARSProcessor.ts` | 2 hr |
| 9 | Identity resolution (nick → user) | `AuthManager`, `ConversationStateManager` | 1 hr |
| 10 | S-expression command detection | `InputClassifier.ts` | 30 min |
| 11 | Capability diff tracking | `SelfAnalyzer.ts` | 1 hr |

### P3 — Low (Polish)

| # | Feature | Files | Effort |
|---|---------|-------|--------|
| 12 | PDF/remote file access tool | New tool or extend `HTTPTool` | 1 hr |
| 13 | Benchmark comparison mode | `commands.ts`, `benchmarks/` | 1 hr |
| 14 | Adversarial test automation | `scenarios/`, `UnifiedTestRunner` | 2 hr |

---

## Part 5: Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Truth value syntax compatibility | 100% `:f:c` and `%f;c%` | Parser test suite |
| Narsese classification accuracy | 100% for valid Narsese | Classification tests |
| E2E synergy tests passed | ≥ 8/10 | `tests/e2e/` suite |
| Adversarial tests passed | ≥ 10/14 | `tests/adversarial/` suite |
| REPL commands functional | All 24+ | Manual + scripted testing |
| OmegaClaw parity gaps closed | ≥ 6/7 identified | Feature checklist |
| NL→NAL translation accuracy | > 90% common patterns | Translation test suite |
| Derivation quality | ≤ 5 meaningful per belief | Diagnostic tests |

---

## Appendix A: REPL Test Execution

```bash
# Run single test script
cat tests/e2e/synergy-01.txt | pnpm run repl --no-init --timeout=30

# Run all E2E tests
for f in tests/e2e/*.txt; do
  echo "=== $f ==="
  cat "$f" | pnpm run repl --no-init --timeout=30 2>&1 | grep -E '^(>|<|!)'
done

# Run with LM enabled (requires API key)
ANTHROPIC_API_KEY=xxx cat tests/e2e/synergy-02.txt | pnpm run repl --no-init --lm=anthropic --timeout=60
```

---

## Appendix B: OmegaClaw Capability Checklist

| Capability | OmegaClaw | SeNARS12 | Gap Status |
|-----------|:---------:|:--------:|------------|
| Continuous autonomous loop | ✅ | ✅ | Closed (BOT.md Phase 4) |
| Vector embedding memory | ✅ ChromaDB | ✅ LanceDB | Closed (BOT.md Phase 2) |
| Episodic trace (persistent) | ✅ file-based | ✅ JSONL | Closed (BOT.md Phase 3) |
| Web search | ✅ search/tavily | ✅ BraveSearch | Closed (BOT.md Phase 1) |
| Parenthesis repair | ✅ | ⚠️ partial | Open |
| Multi-channel (Telegram/Slack) | ✅ | ❌ IRC/WS/HTTP/MCP/CLI | Deferred |
| PLN/NAL engine | ✅ MeTTa-wrapped | ✅ Native NAL-1..5 | Exceeded |
| Skills/Tools | ✅ ~10 | ✅ 12 | Exceeded |
| Self-improvement | ✅ parameter tuning | ✅ RLFP + SelfAnalyzer | Exceeded |
| **Continuous tool chaining** | ✅ | ❌ | **Open (P2)** |
| **Episodic recall by time** | ✅ `episodes` | ⚠️ API exists, no command | **Open (P1)** |
| **Working memory pinning** | ✅ `pin` | ⚠️ API exists, no command | **Open (P1)** |
| **S-expression commands** | ✅ `(cmd args)` | ❌ | **Open (P2)** |
| **Multi-session identity** | ✅ nick persistence | ❌ | **Open (P2)** |
| **Self-awareness of changes** | ✅ | ⚠️ basic | **Open (P2)** |
| **PDF/remote file access** | ✅ curl/fetch | ⚠️ HTTPTool exists | **Open (P3)** |

---

## Appendix C: Verification Results (Post-Fix)

After applying P0/P1 fixes, REPL testing confirms:

### Working
- **Narsese with `:f:c` syntax**: `<cat --> animal>. :0.9:0.9` → stored correctly
- **Narsese with `%f;c%` syntax**: `<bird --> fly>. %0.8; 0.9%` → stored correctly
- **Deduction**: `<cat --> animal>` + `<animal --> living>` → `<cat --> living>` derived
- **Query**: `<cat --> living>?` → answer with derivation chain
- **Belief listing**: `/beliefs`, `/beliefs pattern` → shows stored beliefs
- **Concept listing**: `/concepts` → shows concept graph
- **Self-status**: `/self.status` → "I'm bored - low activity. 32 concepts, 0 conflicts"
- **Memory reset**: `/reset` → clears all beliefs
- **All REPL commands**: No ESM errors

### Observed Issues (Separate from P0 bugs)
- **Derivation explosion**: 3 beliefs → 32+ derived, many low-value (conjunctions, disjunctions)
- **Truth value drift**: Original `:0.9:0.9` becomes `:0.17:1.00` after reasoning
- **Penguin exception handling**: `<penguin --> fly>. :0.0:0.9` doesn't properly override default inheritance
- **No LM synergy**: REPL runs in `senars-only` mode (needs `--lm` flag, P1)

---

**End of GROW3.md**
*Addresses critical bugs, OmegaClaw gaps, and establishes comprehensive E2E testing for cognitive synergy verification.*
