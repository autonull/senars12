# **Semantic Non-Axiomatic Reasoning System** (SeNARS)

SeNARS is a bounded, event-sourced cognitive runtime designed for auditable, continuous operation. It provides a hardened execution kernel that synthesizes uncertain symbolic inference (Non-Axiomatic Logic), exact algebraic rewriting (MeTTa), and optional neural-assisted formalization into a unified, provenance-preserving state machine.

Rather than treating language models as standalone reasoning engines, SeNARS integrates them as untrusted "System 1" proposers within a broader cognitive architecture. Every proposer output — translations, synthesized candidates, policy scores — is judged by a calibrated **Judgment Manifold** before it can influence state. The SeNARS kernel acts as the "System 2" source of truth, enforcing strict epistemic boundaries, resource limits, and structural invariants.

* **Event-Sourced Provenance:** Every cognitive mutation is an append-only event, enabling deterministic replay, standalone verification, and complete derivation tracing.
* **Bounded Cognition (AIKR):** Built on the Assumption of Insufficient Knowledge and Resources. The system utilizes bounded priority bags, cooperative yielding, and anytime algorithms to ensure graceful degradation under memory or CPU pressure.
* **Epistemic Firewall:** A strict structural and type-level separation between *Beliefs* (epistemic truth) and *Goals* (teleological desire), preventing reward signals from corrupting factual confidence.
* **Type-Driven Invariants:** TypeScript enforces internal representational invariants at compile-time, while runtime schemas (Zod) enforce operational invariants at untrusted boundaries.

---

## Run

```bash
pnpm install       # Install dependencies
pnpm run dev       # Development mode (watch)
pnpm run start     # Run once
pnpm bot              # Unified CLI-first bot (REPL + all diagnostics; see §Bot)
pnpm status        # Live System One manifold health, head calibration, LM spend
pnpm doctor        # Onboarding: credentials, lm api probe, effective LM/routing matrix
pnpm bench:system-one            # System One on/off latency + token benchmark
pnpm arcade -- --games snake,bandit --arms nal,manifold   # Multi-game System One demo (see §Arcade)
pnpm run demo:arcade -- --distill  # Arcade tournament + teacher→student distillation flywheel
pnpm exec tsx scripts/rl-manifold.ts          # Pure-RL demo on the Judgment Manifold (no NAL)
pnpm exec tsx scripts/system-one-train.ts     # Train a head from the distillation dataset
pnpm run test      # Test everything
pnpm run typecheck # Type check
pnpm run lint      # Lint
```

### Bot

`pnpm bot` starts the unified CLI-first agent: an interactive `senars> ` prompt with the full
command set (NAR/memory/LM/System One/diagnostics) and **no network connections by default**.

```bash
cp .env.example .env  # Fill in your LM provider credentials
pnpm bot              # CLI only — type .help for commands, or just chat
```

Attach transports at runtime from inside the CLI, or auto-connect at startup via env:

```bash
senars> .connect irc irc.libera.chat 6697 senars-bot #senars
senars> .connect ws 8765
senars> .connections   # list all with status
senars> .disconnect ws # by id or by type (irc|ws|http|mcp)

ENABLE_IRC=true pnpm bot   # or: pnpm bot:irc | bot:ws | bot:http | bot:mcp
```

`pnpm status`, `pnpm doctor`, `pnpm tune`, and `pnpm arcade` are aliases for
`pnpm bot -- --status|--doctor|--tune|--arcade`. See `docs/bot-api.md` for the bot-to-bot API
and `docs/manual-test-irc.md` for a 9-step manual test protocol.

### Self-Improvement Demo

```bash
# Autonomous self-improvement loop (10 cycles)
pnpm exec tsx scripts/self-improve-demo.ts

# Cognitive state report
pnpm exec tsx src/bin/self-report.ts

# RL Parity experiments (Focus-Game-Reflex kernel)
pnpm exec tsx scripts/rl-parity.ts --env bandit --mode native --seeds 5
pnpm exec tsx scripts/rl-parity.ts --env gridworld --mode native --seeds 5
pnpm exec tsx scripts/rl-parity.ts --env nonstationary --mode native --seeds 5
```

---

## The Trusted Cognitive Kernel

```
┌─────────────────────────────────────────────────────────────────────┐
│                      UNTRUSTED PROPOSERS                            │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────────────────┐   │
│  │ LLM (S1) │   │ NAR Engine   │   │ Reflexes                   │   │
│  │(Translate│   │(Uncertain    │   │(Fast S1                    │   │
│  │ & Enrich)│   │  Inference)  │   │ Policies)                  │   │
│  └────┬─────┘   └──────┬───────┘   └────────────┬───────────────┘   │
│       │                │                        │                  │
│       └────────────────┴────────────────────────┘                  │
│                                │ (Proposals / Tool Requests)        │
│                                ▼                                    │
├════════════════════════════════════════════════════════════════════════┤
│  GATES: PerceptionGate | ActionGate | RewardGate | BudgetGate       │
├════════════════════════════════════════════════════════════════════════┤
│                     TRUSTED COGNITIVE KERNEL                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  EVENT LOG (Append-Only)  <-- Source of Truth for State       │  │
│  ├───────────────────────────────────────────────────────────────┤  │
│  │  • Type & Schema Validation (Zod)   • Evidence Independence  │  │
│  │  • Budget Accounting & Throttling   • Derivation Verifier    │  │
│  │  • Policy Enforcement               • Capability Sandboxing  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Kernel Gates — Trusted Boundary

Four gates mediate every state mutation. Every subsystem — inference, RL, self-improvement, tools — operates through them; none can bypass them.

| Gate | Responsibility | Key Guarantees |
|------|----------------|----------------|
| **PerceptionGate** | Admit observations → belief/goal/question tasks | Source-quality → confidence mapping; lossless `admitTask(term, type, truth, source)`; provisional multi-candidate admission from LLM (`admitFormalization`) |
| **ActionGate** | Authorize tool executions | Autonomy-mode state machine (`observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production`); NAL veto registry; operation allow-list |
| **RewardGate** | Accept reward signals → mutate attention/policy only | **Epistemic firewall** rejects any attempt to mutate `Truth.frequency`/`confidence`; domain split (`external-reflex` direct, `self-*` → proposal) |
| **BudgetGate** | Account CPU/derivation/LM/memory budgets | Per-focus `scopeId` budgets; explicit `TerminationReason` enums (`cycle-budget`, `depth-budget`, `llm-budget`, `deadline`, `backpressure`) |

All gates emit typed `CognitiveEvent`s to an append-only JSONL log; pure reducers (`replayCognitiveState`) reconstruct gate-level state for pause/serialize/replay.

### Event Sourcing & Provenance

The kernel is **event-sourced**: the SQLite/JSONL Event Log is the cryptographic source of truth. The JSON state file (`nar-state`) serves as a **checkpoint/snapshot** for fast bootstrapping, allowing the system to resume without replaying the entire event history from genesis. `persistState: true` enables this snapshot layer; it does not replace the event log.

Every logical step is recorded as a derivation trace. If the agent concludes "The server is down," the log contains the exact syllogism and truth-value computation that produced the conclusion — a complete, independently checkable audit trail.

#### Derivation Recorder & Standalone Verifier

```typescript
import { NAR, createNAR } from '@senars/nar';

const nar = createNAR({ /* ... */ });
nar.getRuleProcessor().setConfig({ recorderEnabled: true });

// Run reasoning — recorder captures derivation records
await nar.run(100);

const records = nar.getRuleProcessor().getRecorder().drain();
// Each record: { derivationId, steps[{ruleId, premises, conclusion, truth, premiseTruths, independence, ...}], finalTruth, ... }

// Standalone verification (zero NAR engine deps)
import { verifyRecord } from '@senars/kernel/scripts/verify-derivation';
for (const r of records) {
  const result = verifyRecord(r, { strict: true, epsilon: 1e-6 });
  console.log(result.ok ? 'VALID' : 'INVALID', result.errors);
}
```

- `DerivationRecorder` (opt-in, bounded: 200 steps/record, 200 records) emits `DerivationRecord` with step-level `premiseTruths`, `evidenceLineage`, `independence`
- `scripts/verify-derivation.ts` — dependency-free checker: re-computes truth algebra, validates substitution, lineage DAG, revision independence flag. CI workflow runs on every change.

### Source Quality & Grounding

The `GroundingPipeline` class and `SourceQuality` enum provide source quality assessment for beliefs at the PerceptionGate:

| Source Type | Quality | Truth Confidence |
|-------------|---------|------------------|
| Official/SEC/PubMed | PRIMARY | 0.9 |
| Major news (Reuters, AP) | SECONDARY | 0.7 |
| Wikipedia/News | GENERAL | 0.55 |
| Blog/Forum | TERTIARY | 0.4 |
| LLM Prior | LLM_PRIOR | 0.5 |

### Implementation Philosophy: Type-Driven Invariants

> **TypeScript enforces internal representational invariants at compile-time, while runtime schemas (e.g., Zod) enforce operational invariants at untrusted boundaries.**

By encoding NAL semantics at the type level:
- Derivation lineage capped at runtime (ancestor-set bound)
- Rule patterns enforced at compile-time
- Term structure guaranteed by discriminated unions
- Resource limits carried in typed configs

This eliminates entire classes of bugs at compile time and guarantees structural correctness by construction; AIKR bounds the remaining, resource-level dimension at runtime.

| Technique | Purpose |
|-----------|---------|
| **Branded Types** | Separate timestamps/units, prevent unit mixups |
| **Discriminated Unions** | Exhaustive pattern matching on term structures |
| **Structural Sharing** | Memoization factory for canonical terms |
| **Stable Hashes** | Canonical normalization for deduplication |

---

## Cognitive Architecture & AIKR

### Resource Model: AIKR & Bounded Cognition

Most architectures assume effectively infinite compute and memory — unbounded context windows, unbounded retrieval. SeNARS assumes the opposite, and treats the constraint as a design resource:

**Assumption of Insufficient Knowledge and Resources (AIKR):**

| Principle | Description |
|-----------|-------------|
| **Anytime** | Interruptible execution at any point — yields partial results on demand |
| **Interruptible** | Cooperative yielding via `AbortSignal` and wall-clock deadlines |
| **AIKR** | Assumption of Insufficient Knowledge Resources: bounded memory/attention/bag capacity, derivation-lineage caps, CPU throttling, backpressure |

Concrete mechanisms:
- **Bounded priority bags** with LRU eviction — graceful degradation under memory pressure
- **Truth-value decay** — concepts lose priority over time unless reinforced (separated from attention decay)
- **Anytime algorithms** — yield partial results when interrupted; execution resumes from recorded state
- **CPU throttling & backpressure** — cooperative yielding to the event loop

As inference moves from cloud to edge — phones, IoT devices, local servers — systems must know how to forget, how to prioritize, and how to yield partial results under interruption. AIKR operationalizes all three.

### Cognitive Security & The Epistemic Firewall

The kernel enforces a strict division of labor between **System 1** and **System 2**:

1. **LLM (System 1)** — Translates Natural Language → formal Narsese/MeTTa candidates
2. **Symbolic Engine (System 2)** — Performs rigorous deduction with truth algebra
3. **Kernel Gates** — Validate, budget-check, and admit proposals to the event log
4. **LLM (System 1)** — Translates results back to Natural Language

LLMs dangerously conflate **what is** (beliefs) with **what should be** (goals). In natural language, "The server is down" and "The server should be down" differ by one word but have opposite implications. LLMs mix these freely, leading to reward hacking, sycophancy, and unintended optimization.

**SeNARS enforces a hard structural distinction at the type level:**

| Aspect | Beliefs (`Statement`) | Goals (`Goal`) |
|--------|----------------------|----------------|
| **Truth Value** | Frequency + Confidence (f, c) | Desire + Confidence (d, c) |
| **Inference** | Deduction, induction, abduction | Decomposition, achievement, planning |
| **Revision** | Evidence-based belief revision | Progress-based goal revision |
| **Action** | Inform reasoning | Drive behavior |

**Safety consequences:**
- **Strict type-level and runtime separation** of Beliefs (epistemic truth) and Goals (teleological desire) prevents reward signals from directly mutating factual confidence
- **No sycophancy** — The system cannot "believe" something just because it's desired
- **Corrigibility** — Goals are revisable via evidence about feasibility, not via persuasion
- **Interpretability** — Every derivation step is tagged: is this *reasoning about reality* or *planning for action*?
- **Constitutional enforcement** — Invariants (e.g., "never believe falsehoods") apply only to beliefs; goals are optimized, not verified

The neuro-symbolic handoff (LLM → Narsese candidates → Kernel Gates → NAL → NL) makes this separation **enforceable**: the LLM translates, but the symbolic engine *decides* which slot each proposition occupies. The separation is a structural guarantee, not a prompt-level convention.

### Memory Subsystems

- **Universal AIKR queues** — Working, Episodic, and Semantic memory are all bounded `Bag<T>` priority queues
- **Revision history** — per-concept truth-value evolution
- **Embedding-based similarity** — semantic retrieval
- **Probabilistic sampling** — recall driven by AIKR budget and priority-weighted sampling
- **Decoupled decay** — truth (`frequency`, `confidence`) decays only on temporal invalidation or contradiction; attention (`priority`) decays by LRU/access time
- **Pressure-driven consolidation** — high `Bag` pressure triggers cognitive sleep and schema induction
- **State persistence** — JSON snapshot layered over the event log

```typescript
import { Memory, EpisodicMemory, Concept } from '@senars/nar';

// Long-term concept memory with priority bags
const memory = new Memory(config);
const concept = memory.getConcept(term);

// Episodic memory for experience
const episodic = new EpisodicMemory(config);
await episodic.record({ type: 'interaction', content: '...', context: {...} });
const episodes = await episodic.getEpisodes({ limit: 10, query: 'cat' });
```

---

## Inference

### Narsese Term Language

Full implementation of the Narsese grammar with type-safe construction:

```typescript
import { TermBuilder, atom, termParser, Truth } from '@senars/nar';

// Atomic terms
const cat = atom('cat');
const animal = atom('animal');

// Compound terms
const inheritance = TermBuilder.inheritance(cat, animal);  // (cat --> animal)
const implication = TermBuilder.implication(cat, animal);  // (cat ==> animal)
const conjunction = TermBuilder.conjunction(cat, animal);  // (cat & animal)

// Parse from string
const parsed = termParser.parse('(cat --> animal)');
```

<details>
<summary><b>Term Types Supported</b></summary>

| Kind | Syntax | Description |
|------|--------|-------------|
| Atomic | `cat` | Basic concept |
| Variable | `?x`, `?y` | Unification variables |
| Inheritance | `(A --> B)` | Subclass/superclass |
| Similarity | `(A <-> B)` | Symmetric similarity |
| Implication | `(A ==> B)` | Conditional implication |
| Equivalence | `(A <=> B)` | Bidirectional equivalence |
| Conjunction | `(A & B & C)` | Logical AND |
| Disjunction | `(A \| B \| C)` | Logical OR |
| Negation | `(- A)` | Logical NOT |
| Sequence | `(A * B * C)` | Temporal sequence |
| Parallel | `(A \| B \| C)` | Parallel execution |

</details>

### Truth Value Algebra

Non-Axiomatic Logic truth values with **frequency** (f) and **confidence** (c):

```typescript
import { Truth } from '@senars/nar';

const truth = Truth.create(0.8, 0.9);  // f=0.8, c=0.9
const revised = Truth.revision(truth1, truth2);  // Belief revision
const projected = Truth.deduction(truth1, truth2); // Inference
```

**Operations:** `revision`, `deduction`, `induction`, `abduction`, `comparison`, `negation`, `expectation`

### NAL Inference Rules

<details>
<summary><b>Complete NAL Rule Matrix (registered rules — `nar/src/rules/registration.ts` is the source of truth)</b></summary>

| Category | Rules |
|----------|-------|
| Logic | `nal.deduction`, `nal.induction`, `nal.abduction`, `nal.exemplification`, `nal.higherOrderDeduction`, `nal.higherOrderAbduction`, `nal.higherOrderInduction` |
| Syllogistic | `nal.similarity`, `nal.contrapositive`, `nal.analogy`, `nal.comparison`, `nal.extended.analogy`, `nal.extended.comparison`, `nal.contrapositionRule`, `nal.equivalence` |
| Compositional | `nal.intersection`, `nal.union`, `nal.intersectionComposition`, `nal.unionComposition`, `nal.difference`, `nal.conjunctionIntro`, `nal.disjunctionIntro`, `nal.implicationIntro`, `nal.implicationElim`, `nal.equivalenceIntro`, `nal.equivalenceElim`, `nal.destruct`, `nal.decompose`, `nal.revisionWeak` |
| Propositional | `nal.negationIntro`, `nal.negationElim`, `nal.modusPonens`, `nal.modusTollens`, `nal.disjunctiveSyllogism` |
| Structural | `nal.structuralInheritance`, `nal.structuralReduction`, `nal.conversion`, `nal.instanceConversion`, `nal.instanceDeduction`, `nal.propertyConversion`, `nal.propertyInduction`, `nal.extended.exemplification` |
| Temporal | `nal.sequenceIntroduction`, `nal.parallelIntroduction`, `nal.predictiveImplication`, `nal.temporalDeduction` |
| Procedural | `nal.proceduralDecomposition`, `nal.proceduralChaining`, `nal.operationToPredictive` |
| Variable | `nal.instantiation`, `nal.variableIntroduction`, `nal.variableDependency`, `nal.sameness` |
| Meta-Cognitive | _none — stubs removed (TODO17b D18: unimplemented rules were never executable logic)_ |

</details>

### Reasoning

```typescript
import { NAR, createNAR } from '@senars/nar';

const nar = createNAR({
  maxConcepts: 10000,
  maxTasksPerConcept: 100,
  enableLMRules: true,
  enableTools: true,
  enableSelf: true,
  enableRLFP: true,
  persistState: true,
  statePath: '.cache/nar-state',
});

await nar.start();

// Input beliefs, goals, questions
await nar.believe('(cat --> animal). %1.0;0.9%');
await nar.goal('(whiskers --> cat)!');
await nar.question('(whiskers --> ?what)?');

// Run inference cycles
const derivations = await nar.run(10);

// Query results
const beliefs = nar.getBeliefs();
const answer = nar.ask('(whiskers --> animal)');
```

**Execution Modes:**
- `run(steps)` — Synchronous batch execution
- `runStream(steps)` — Async generator for incremental results
- Configurable derivation strategies: `BagStrategy`, `ExhaustiveStrategy`, `SampledDerivation`, `FocusedDerivation`, `AnytimeDerivation`

### Derivation Ranking (Pressure Valve)

```typescript
import { rankDerivations } from '@senars/nar/rules/ranking';

const admitted = rankDerivations(ruleProcessorOutput, {
  maxAdmissions: 100,  // default
  minScore: 0          // default
});
// score = confidence × |f−0.5|×2 − min(0.3, termLength/2000)
// tautologies (f≈0.5) score ≤0 and are dropped automatically
```

- `score = confidence × decisiveness − sizePenalty` where `decisiveness = |f−0.5|×2`
- Caps admissions per cycle; configurable via `CognitiveParameters.inference.ranking` and exposed as optimizer/self-game knobs (`rankingMaxAdmissions`, `rankingMinScore`)

---

## MeTTa — Exact Computation Substrate

MeTTa operates as a deterministic, exact-computation tool invoked through the ActionGate, complementing NAL's uncertain reasoning. It does **not** run as a parallel cognitive engine, but rather provides equality saturation, pattern matching, and dependent type theory on demand.

```typescript
import { createMeTTa, parseMeTTa, EGraph, MeTTaRuntime } from '@senars/metta';

const runtime = createMeTTa();

// Define rewrite rules
await runtime.evaluate(parseMeTTa(`
  (= (add $x 0) $x)
  (= (add $x (succ $y)) (succ (add $x $y)))
`));

// Query with pattern matching
const result = await runtime.evaluate(parseMeTTa('(add (succ 0) (succ (succ 0)))'));
// → (succ (succ (succ 0)))

// Multi-space reasoning
const space1 = runtime.createSpace();
const space2 = runtime.createSpace();
// Each space has independent facts, can be merged/queried

// E-graph for equality saturation
const egraph = new EGraph();
egraph.addExpr(parseMeTTa('(add a b)'));
egraph.addExpr(parseMeTTa('(add b a)'));
egraph.union(parseMeTTa('a'), parseMeTTa('b'));
// Now (add a b) ≡ (add b a) ≡ (add a a)
```

**MeTTa Capabilities:**

| Feature | Description |
|---------|-------------|
| **E-Graphs** | Equality saturation for algebraic simplification, program optimization |
| **Pattern Matching** | Structural matching with variables, guards, and multi-match |
| **Rewrite Rules** | User-defined ` (= lhs rhs )` rules with conditional guards |
| **Multi-Space** | Independent fact spaces (contexts) with merge/fork/clone |
| **Skill Execution** | MeTTa programs as callable skills from NAR/agent |
| **Dependent Types** | Full type theory with Π/Σ types, type inference, unification |
| **JIT Compiler** | Hot path compilation to native code via Effect JIT |
| **Parallel Execution** | `parallelReduce`, `parallelMap` for batch operations |
| **Persistent Spaces** | Serializable spaces with incremental persistence |
| **IPC/Shared Memory** | Cross-process space sharing via shared memory queues |

**Integration with Agent:**

`createAgent` wires the `metta` builtin tool automatically; no engine registration or `metta:` command routing exists.

```typescript
import { createAgent } from '@senars/nar/agent';

const agent = await createAgent({ /* config */ });
// NAR input: (cat --> animal).
// MeTTa (via the ActionGate tool): tools.execute('metta', { program: '(add 1 2)' })
```

**Engine Isolation (Arbiter Pattern):**
- NAR and MeTTa must not share memory directly. They must emit `EngineResult` proposals to the Kernel.
- The boundary between MeTTa's exact `definitional-equality` and NAR's `uncertain-equivalence` is enforced. The e-graph must *never* union nodes based on NAR similarity scores.

---

## Neuro-Symbolic Integration

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

### Multi-Agent Cognitive Cooperation

SeNARS instances cooperate by delegating cognitive tasks via Narsese over
WebSocket (`nar/src/cooperation/delegation.ts`). Agent A sends a
`CognitiveTaskDelegation` (taskId, LM rule id, serialized NAL context, callback
endpoint); Agent B runs the *same universal LM rule* with its local model and
returns a `CognitiveTaskResult` of Narsese terms with truth values. Results are
admitted through the PerceptionGate with `PEER_AGENT` source quality and
shadow-validated before entering memory.

### Natural Language Services

```typescript
import { NLUnderstandingService, NLGenerationService, ContextAssembler } from '@senars/nar/nl';

// Convert natural language to Narsese CANDIDATES (multi-hypothesis)
const understanding = new NLUnderstandingService(lmService);
const candidates = await understanding.understand("Cats are mammals. Whiskers is a cat.");
// Returns: FormalizationCandidate[] with term, confidence, sourceSpans, ambiguityFlags

// Convert Narsese results to natural language
const generation = new NLGenerationService(lmService);
const answer = await generation.generate({
  query: '(whiskers --> ?what)?',
  beliefs: [...],
  trace: [...]
});

// Ask in plain English
const answer = await nar.askNaturalLanguage("What is Whiskers?");
```

**Key Features:**
- **Multi-candidate formalization** — LLM returns `FormalizationBatch` with per-candidate `sourceSpans` + `ambiguityFlags` (negation, modal, quantifier, temporal). Kernel admits each candidate provisionally; no single authoritative parse.
- **Single-flight LM dedup** (`SingleFlight`) — concurrent identical `understand()` calls share one request; failures clear the slot for retry.
- **Unified `translateCached` path** — cache → single-flight LM → record; legacy string cache entries safely ignored.
- **Per-candidate spans** — `locateSpan` maps verbatim `sourceText` to exact offsets; ambiguity flags become span-local.

### Local Inference (llama.cpp)

`LM_PROVIDER=llamacpp` targets a native llama.cpp `llama-server` via plain `fetch`:
GBNF `grammar` passthrough for constrained decoding, `chat_template_kwargs`
injection for Qwen-family thinking modes, and automatic model-alias resolution
from `/v1/models`. Auto-detect ladder: cloud key → openai-compatible → llama.cpp → transformers.

```bash
LM_PROVIDER=llamacpp LM_LLAMACPP_HOST=http://localhost:8080 pnpm start
```

---

## System One — The Judgment Manifold

System One is SeNARS's calibrated decision layer. Where the kernel gates decide *what enters state*, the Judgment Manifold decides *what the untrusted proposers' outputs mean*: task type, illocution, injection risk, ambiguity, tense, source quality, feasibility, risk, and value — all scored in a single batched pass over one context embedding.

All manifold judgments sit **behind** the four kernel gates; enabling System One changes nothing when `systemOne.enabled: false` (the disabled path is byte-identical). See `docs/system-one-guide.md` for the end-user enable/config/troubleshooting guide.

### Live Ingress

With System One enabled, raw natural language reaches the manifold **before** parsing:

```
nar.input("the robin is a bird")
  └─▶ KernelPerceptionGate.admit (raw utterance, not the parsed term)
        ├─ Tier 0 parse (Narsese heuristic — unchanged)
        ├─ EmbeddingCache (O(1), alias-free, single caching layer)
        └─ one joint judgeBatch: task_type · illocution · injection ·
                                 ambiguity · tense · source_quality
              ├─ ambiguity abstain ─▶ inject a clarification Question + curiosity drive
              ├─ tense ─▶ occurrenceTime anchor on the admitted task
              └─ source_quality ─▶ seedTruth ceiling (LLM_PRIOR default)
```

The gate's calibrated truth and task type are **adopted** — ingress judgments are never computed and thrown away.

### Cortex Ladder

| Tier | Engine | Role |
|------|--------|------|
| 1 | Judgment Manifold (local heads) | Judge everything, admit with calibrated truth |
| 2 | `LMServiceCortex` (GBNF-constrained LM) | Synthesize Narsese term candidates (`proposeAndJudge`) |
| 3 | Symbolic stub | Degrade gracefully on LM failure — never crash |

Tier-2 candidates are generated under the `narsese-term` GBNF grammar and re-judged by the manifold before admission.

### Heads, Digests & Calibration

- **Declarative registry** — all 19 heads are generated from a single `HEAD_SPECS` table (`@senars/nar/lm/system-one`); per-head config and the ontology documentation derive from it. `plausibility` (Jev `Noul`) and `assertion` (safety floor) ship by default; classify heads judge over the **query's declared space** (a `candidate_select` ranking is judged in the candidate-selection space, never forced to `task_type`).
- **Digest-pinned weights** — `ModelDigest = SHA256(encoderDigest ++ headWeightsDigest)`. Swapping the encoder without re-pinning fails closed (`DigestMismatchError`); trained heads load only through the sandboxed runtime (SHA256-verified, WASI bundles supported, zero-import deny-by-default).
- **Honest calibration** — isotonic calibrators fit from real labels emit a `calibration-lock.json` with per-head abstain thresholds; until fitted, heads report `calibration.fitted: false` and mask/floor logic passes through rather than acting on untrained scores.
- **Policy utilities** — `truthProbability()` (boolean evaluation, Jev `Noul` analog), `ConfidenceRouter` (act/review/block bands, monotonicity: a router may only restrict), `compositeScore`, `judgeCascade` (two-stage hierarchical judgment), wake gate. Score semantics are probability-weighted: evaluate heads emit a per-level `legend` (triangular kernel over level anchors, normalized to 1) so weighted position ≈ calibrated scalar; sampled self-consistency measures stability under seeded per-run perturbation (single-shot judgments remain fully deterministic).

### Distillation Flywheel

```
play / reason ─▶ JudgmentDataset (hash-only JSONL + 384-d vector sidecar)
                  │  auto-flush · compact · no raw utterance text persisted
                  ▼
       train.ts (Brier loss, ridge/logistic heads) → digest-pinned weights
                  ▼
       calibration-fit.ts → isotonic calibrators + abstain thresholds → lock file
                  ▼
       bake-off parity gate → sandboxed runtime → governed head swap
```

Label sources include corrections, derivation outcomes, approvals, shadow verdicts, human clarification pairs, agent-trace grades (groundedness/risk per cycle), and **RL outcomes** — rewards from play flow into the same dataset. The loop closes end-to-end in the arcade: `pnpm run demo:arcade -- --distill` has the lm arm (teacher) record its decisions into `JudgmentDataset`, trains a `reflex_value` head after play, and the manifold arm (student, ~zero inference cost) picks it up on the next run — the distilled student matches its teacher's return and beats the heuristic baseline.

### Dialogue Flywheel

Conversations are simultaneously live inference, graded training events, and diagnostics — but corrections, rejections, and clarifications were previously discarded. The Dialogue Flywheel (`@senars/nar/dialogue`) closes that loop: every chat exchange is captured as a hash-only `DialogueTurn` (sha256 digests + embeddings, never raw text at rest), and explicit human reactions — bound retroactively via `.react accept|correct|reject|clarify|redirect|abandon [correction]` or `bindReaction()` — become distillation labels (`correct` → embedding-level preference pair, `accept` → positive, `reject`/`abandon` → negative, corrections also feed contrastive hard negatives). Reaction-sourced rows are excluded from the frozen eval set by construction, so the flywheel trains heads without corrupting the trustworthy-self-improvement guarantee. `DialogueCapture` is a peer subsystem that optional reasoners (System One) feed into — all System One artifacts are injected optional deps, capture works with System One off, and with `dialogue.enabled: false` (the default) the disabled path is byte-identical.

Per-turn provenance is captured via an injectable enricher (System One's decider populates judgment bands + `JudgmentProvenance`, `NLUnderstandingService` adds formalizations when `dialogue.captureAll` opts into the LM cost, and reflex selections surface via the reflexes' `lastDecision` readout); sessions join on the kernel-minted `correlationId` (surfaced on `ChatStreamEvent.finish`). Reaction attribution is explicit (`.react`) by default; `dialogue.attribution: 'cues'` opts into conservative heuristic attribution from the next utterance (gated by Bench 76: precision ≥ 0.95, zero false positives on neutral continuations). `correct` reactions are formalized into Narsese lessons when an LM formalizer is wired (DQ6, Bench 75). `.turns`, `.retrospect`, `.retrospectives`, and `.lessons` (lessons are ingested as Narsese self-beliefs via `nar.input`) expose the substrate; `.retrospect` aggregates a digest-pinned `Retrospective` (turn summary, reaction distribution, correction analysis, strategy audit joined to real trace grades, contradiction mining, low-risk `focus-weight` proposals when corrections dominate — routed through governance, never auto-applied). `dialogue.autoRetrospect` opts into session-end runs; MCP clients get `dialogue_react`/`dialogue_turns`/`dialogue_retrospect` tools for AI-agent-driven self-correction. Benches 71–76 (`tests/nar/todo24-*.test.ts`) falsify the redaction, correlation, governance, formalization, and attribution claims.

**Retrospective consumers** (TODO25): correction-dominated retrospectives drive clamped strategy adaptation — `RetrospectiveAdapter` switches `derivation→focused` and `lm-rule→priority` (the same switch set the kernel's RLFP path applies), one-shot per retrospective digest, with a full ledger and `.adaptations [.restore]` for audit/rollback (Bench 77). `.reconsolidate` ingests lessons from persisted retrospectives as self-beliefs one-shot per digest, with the ledger persisted so restarts never re-ingest (Bench 78). `.probes` selects curriculum probes — corrected turns first, then low trace-grades and retrospective lessons — deterministically over graded data only (Bench 79); exposed to MCP clients as `dialogue_probes`. The kernel captures derivation chains (`[primary, …secondaries, derived]`) into a bounded ring via a zero-cost-when-unset sink; `.schemas-induce` feeds them to a real `SchemaInductor` (Bench 80). Reflex decisions join messages by wall-clock span (`decisionsSince`, Bench-80-adjacent window test in todo17).

### RL Without NAL

The Judgment Manifold is a general decision API — proven by driving a reinforcement learner with it, NAL nowhere in the loop. `ManifoldRLAgent` (in `@senars/nar/rl`) issues one joint judgeBatch per decision — `reflex_value` (value) + `feasibility` (mask) + `risk` (floor) — and follows an ε-greedy or UCB policy over manifold scores; only `EmbeddingCache`, `JudgmentManifold`, and `JudgmentDataset` are involved. `scripts/rl-manifold.ts` runs the full demo (`systemOne.rl` config: `policy`, `epsilon`, `ucbC`, `feasibilityMask`, `riskFloor`, `labelOutcomes`).

### Remote Manifold

`systemOne.manifold.provider: 'http'` delegates judgment to a `/v1/systemone` endpoint (TypeSafe-compatible wire shape). Remote propositions re-enter **untrusted** at the `LLM_PRIOR` confidence ceiling; malformed responses and dead endpoints fail closed. `scripts/system-one-server.ts` hosts the local manifold over the same contract.

### Observability & UX

- `pnpm status` — live manifold health, per-head ECE/abstain thresholds, circuit breakers, LM spend, dataset/lock paths, and a governance section (attached self-meta-games + validation/approval queue depths) (`--json` for machines)
- REPL — natural-language input routes through the ingress; `:judge <text>` prints the full per-head judgment distribution, `:health`/`:spend` for status shortcuts
- `egress.gate.rejected` events — groundedness-gate rejections are user-visible, never silently swapped
- Prometheus: `systemone_*` judgment/ingress/reflex counters, `lm_spend_tokens{provider}` / `lm_spend_cost_milli{provider}` with optional `LM_MAX_SPEND_USD` cap
- Benchmarks 15–28 (`tests/nar/todo16c-*.test.ts`) falsify every claim above in the CI `systemone-benches` job

Three runnable starters live in `examples/`: `systemone-ingress.ts`, `rl-gridworld.ts`, `custom-head.ts`.

### Arcade — Multi-Game System One Demo (TODO17)

`pnpm arcade` runs many games on one kernel-gated harness with selectable arms (`heuristic | random | manifold | lm | replica | nal`), every tick rendered, and every decision Brier-scored against realized outcomes into `.reports/arcade.{json,md}`. The collection lives in the **game registry** (`@senars/nar/game` → `createArcadeRegistry()`): each game is a plain `Game` implementation registered with a name, description, and action legend — snake, tetris, 2048, tictactoe, gridworld, bandit, catch, arithmetic, rps ship by default; adding one is implementing `Game` + one `GameSpec`. Arms are fail-closed (missing LM model / replica endpoint ⇒ explicit skip note). `--mode cognitive` seeds the game's rules as Narsese beliefs so the Negotiator's NAL veto shapes play, streams a per-tick thought-stream panel, and attaches a recorder-verifiable justification to every veto. The `nal` arm runs cognitive mode regardless of `--mode` so it is always a comparable row in the summary: the Negotiator's veto **action-matches** (a bad-action derivation vetoes only that action) and falls back to the best non-vetoed proposal instead of stalling — a seeded trap rule prevents the trap; rule-free play is veto-free (falsified by `tests/nar/todo17b-nal-arm.test.ts`), and G2 schema induction grows advisory good/bad rules from episode experience. `pnpm run demo:arcade -- --distill` additionally runs the teacher→student distillation loop (lm arm teaches, manifold arm learns). `--resume` checkpoints tournament progress per (arm, game) so interrupted runs continue mid-flight. Parity targets (ECE ≤ 0.07 kev-ref, P50 ≤ 15 ms von-ref, arms ≥ random, one batched judgment per decision) are falsified by Benches 29–35 (`tests/nar/todo17-*.test.ts`). See `docs/arcade.md`.

---

## Execution & Control

### Stream Reasoner

Async derivation streams with backpressure and CPU throttling:

- **Premise sources**: priority-weighted, recency, novelty, fair, and focus-based sampling
  - Composite sources with configurable weights
- **Interleaved Execution** — Synchronous NAL inference continues while asynchronous LM requests are processed in background workers
  - CPU throttling & cooperative yielding
  - Configurable queue limits and derivation caps
- **Adaptive Backpressure** — Monitors `Bag<T>` pressure; drops or queues LM requests if CPU budget is exhausted
  - Backpressure-aware buffering
  - Bounded LLM-backed reasoning with pressure-driven flush

```typescript
import { createPipeline, StreamReasoner, MemoryPremiseSource, FocusPremiseSource } from '@senars/nar/stream';

const reasoner = new StreamReasoner({ maxBatch: 10, highPressure: 0.8 });
const pipeline = createPipeline({ premiseSources: [new MemoryPremiseSource(memory)] });
for await (const result of pipeline.derive(reasoner)) {
  // incremental derivations
}
```

**Exports:** `createPipeline`, `StreamReasoner`, `MemoryPremiseSource`, `FocusPremiseSource`, `CompositePremiseSource`, `derive`, `throttled`, `backpressureAware`, types `PipelineConfig`, `PremiseSource`, `LMBackend`, `ProvisionalBelief` from `@senars/nar/stream`.

### Tools & Function Calling

```typescript
import { ToolManager, discoverTools, ExplainTool, SleepTool, TimerTool } from '@senars/nar/tools';

const tools = nar.tools;
await tools.execute('explain', { term: '(cat --> animal)' });
await tools.execute('sleep', { ms: 1000 });
await tools.execute('timer', { action: 'start', name: 'reasoning' });

// Custom tools via decorator
@Tool({ name: 'my_tool', description: '...', schema: {...} })
async function myTool(args: { input: string }) { ... }
```

**Built-in tool surface (all backed by real implementations):** fs (`read-file`, `write-file`,
`append-file`, workspace-sandboxed), `shell` (30s timeout, async), web (`search` with
Tavily→DuckDuckGo fallback, `tavily-search`, `web-fetch`), memory (`remember`, `query`,
`episodes` — episodic memory; fail honestly when no backend), `metta` (delegates to the MeTTa
engine), plus approval/timer/sleep utilities.

### NAR Commands — CLI & Programmatic Control

```typescript
import { narCommands, rlfpCommands, selfCommands, configCommands, memoryCommands } from '@senars/nar/commands';

// Built-in command categories
narCommands      // believe, goal, question, run, stats, export, import
rlfpCommands     // trajectory logging, preference collection, policy optimization
selfCommands     // metacognitive analysis, quality assessment, gap detection
configCommands   // get/set cognitive parameters, strategy switching
memoryCommands   // concept inspection, belief/goal/question queries, attention report
lmCommands       // LM rule management, enrichment triggering
episodesCommands // episodic memory queries
```

---

### Cognitive Parameters & Strategy System

**Tunable Hyperparameters** — All behavior controlled via `CognitiveParameters` with validated ranges:

```typescript
import { CognitiveParameters, DEFAULT_COGNITIVE_PARAMETERS, FAST_COGNITIVE_CONFIG, LM_HEAVY_CONFIG, RESEARCH_COGNITIVE_CONFIG } from '@senars/nar/config/cognitive-parameters';
```

| Preset | Use Case |
|--------|----------|
| `DEFAULT_COGNITIVE_PARAMETERS` | Balanced general use |
| `FAST_COGNITIVE_CONFIG` | Minimal LM, max speed |
| `LM_HEAVY_CONFIG` | Maximum LM enhancement |
| `RESEARCH_COGNITIVE_CONFIG` | Full tracing, limited derivations |

**Parameter Categories:**

| Category | Controls |
|----------|----------|
| **Priority** | Initial/max priority, mention boosts, decay rate, propagation |
| **LM** | Enabled, rule categories, timeout, selection strategy |
| **Attention** | Auto-prime, structural/semantic similarity, activation propagation |
| **Inference** | Max derivations/depth, circular detection, trace collection, CPU throttle, sampling limits |

**Pluggable Strategies** (configurable via `strategies` object):

| Strategy Type | Options |
|---------------|---------|
| **Sampling** | `priority`, `top-n`, `novelty`, `goal-biased`, `diverse` |
| **Premise Formation** | `default-formation`, `sample`, `focused` |
| **Derivation** | `default`, `anytime`, `sampled`, `focused`, `exhaustive` |
| **LM Rule Selection** | `all`, `priority`, `rotation`, `diverse` |
| **Attention** | `simple`, `spreading-activation`, `goal-relevance`, `composite` |

**Optimization-Ready** — `PARAMETER_SPACE` defines min/max/default for every tunable, enabling:
- RL-based policy optimization (RLFP)
- Evolutionary parameter tuning

---

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

---

## SeNARS as a General-Purpose RL Agent

SeNARS is not only a reasoning kernel — the same Focus-Game-Reflex substrate makes it a **general-purpose reinforcement learning agent**. Any environment exposing `observe()` / `step(action)` attaches as a `Game` — the **only** environment interface (no separate `Environment` layer; built-in games live in `@senars/nar/game`, see the export index) — and the agent learns to act through its native attention economy, bounded by AIKR like every other cognitive process. The shipped collection is enumerated by the **game registry** (`createArcadeRegistry()`): snake, tetris, 2048, tictactoe, gridworld, bandit, catch, arithmetic, and rps — each a plain `Game` implementation with a seeded, deterministic episode; adding one is implementing `Game` + one `GameSpec`.

**Non-symbolic RL as optional acceleration, not foundation.** The `Reflex` slot is a pluggable System-1 policy engine: tabular Q-learning, ε-greedy, and UCB are built in today; DQN, policy-gradient, or actor-critic backends drop in behind the same `propose(state)` / `learn(event)` interface. Symbolic and sub-symbolic learning are *complementary*: fast neural/heuristic proposals are arbitrated by the `Negotiator`, where NAL retains a veto over every action — so learned reflexes accelerate the agent without ever bypassing epistemic control.

All Game↔Focus interactions pass through the four kernel gates (*The Trusted Cognitive Kernel*), so no learned policy can bypass epistemic control.

**Epistemic firewall:** the `RewardGate` throws if a reward attempts to mutate `Truth.frequency` or `Truth.confidence`; rewards may only affect attention and policy weights — never factual belief.

### Core Primitives

| Primitive | Purpose | Key Types |
|-----------|---------|-----------|
| **`Bag<T>`** | Universal AIKR priority queue (capacity-bounded, probabilistic sampling, decay) | `Bag<Item>`, `add()`, `sample()`, `decay()`, `capacity` |
| **`Focus`** | Isolated reasoning vessel with local `Bag<Task>` + `Bag<Concept>` | `step(budget)`, `weight`, bound `Gates`, bound `Games`/`Reflexes` |
| **`FocusBag`** | System-wide attention economy — samples `Focus` by weight | `allocateBudget()`, `rebalanceWeights()`, `sample()` |
| **`Game`** | Environment interface (external or internal) — the only one | `observe()`, `step(action)`, `legalActions(state)` |
| **`Reflex`** | Fast System-1 policy/value engine (Q-learning, UCB, heuristics) | `propose(state)`, `learn(event)` |
| **`Negotiator`** | Arbitrates Reflex proposals vs NAL derivations (NAL retains veto) | `resolve(proposals, nalDerivations)`, `createLearningEvent()` |

**RL adapter library (`@senars/nar/rl`):** NAL-native learners (`QBeliefStore` with Q-learning/SARSA/TD updates round-tripping through `Truth.revision`), reward/perception/action adapters, `RLParityHarness` (policy agreement + value correlation), and the semantic reflexes + manifold agent (see *System One — RL Without NAL*). Full export list in the export index below.

### RL Domain Split — Unified Substrate, Separated Reward Domains

The shared substrate (`Bag<T>`, `Focus`, `FocusBag`, `Game`, `Reflex`, `Negotiator`) is kept; reward interpretation and mutation authority are split by domain:

| Learner | Domain | Mutates | Risk |
|---------|--------|---------|------|
| `ReflexLearner` | `external-reflex` | Reflex Q-table / policy weights | Low |
| `SchedulerAdapter` | `self-scheduler` | `FocusBag` focus weights | Low |
| `PreferenceRanker` | `self-explanation-rank` | Explanation ranking scores | Low |
| `ConfigOptimizer` | `self-config-proposal` | `knob-tune` proposals (never direct) | Medium |
| `PatchSelector` | `self-patch-score` | `patch-apply` proposals (→ human approval) | High |

`LearnerRegistry.dispatch(event)` routes by `event.domain`; unknown domain → `CrossDomainError` (fail-closed). Self-game rewards (`domain: 'self-*'`) never mutate `Truth` — they produce `SelfImprovementProposal` objects routed through `ProposalRouter` → `SelfMetaGame.applyProposal` (only low-risk `focus-weight` auto-applies; medium/high require validation/approval).

The collapsible record below lists the implemented component slices with their CI test suites, and current environment parity results.

<details>
<summary><b>Implementation & Validation Record (test slices, environment parity)</b></summary>

**Implemented components (CI-verified snapshot):**

| Slice | Components | Tests |
|-------|------------|-------|
| **1** | `Bag<T>`, `Focus`, `FocusBag`, `TabularQReflex`, `Negotiator`, `GridWorldGame`, `GameFocus` | `kernel-slice1.test.ts` (14 tests) |
| **2** | `EpsilonGreedyReflex`, `UCBReflex` (Reflex implementations) | `m35-gridworld-validation.test.ts` |
| **3** | `Negotiator` (NAL veto + `LearningEvent` feedback) | `m35-gridworld-validation.test.ts` |
| **4** | `MetaGame`, `SelfMetaGame`, `MetaFocus` (`^focus_weight`, `^knob_set`) | `meta-game-sandbox.test.ts` (16 tests) |

**Environment parity results:**

| Environment | Level 1 (Adapter) | Level 2 (Native Reflex) | Status |
|-------------|-------------------|-------------------------|--------|
| **Bandit** | Pass | Pass (`EpsilonGreedyReflex`/`UCBReflex`) | Pass |
| **NonStationary** | Pass | Pass (drift detection) | Pass |
| **GridWorld** | Pass | **Pass** (100% success after 200 episodes, `TabularQReflex`) | Pass |

</details>

---

## RLFP — Reinforcement Learning from Reasoning Feedback

Where the agent above learns from *external environments*, RLFP turns SeNARS's reward machinery inward, learning from the *reasoning process itself*: trajectories, human preference pairs, and derivation outcomes.

```typescript
import { RLFPLearner, PreferenceCollector, RewardModel, PolicyOptimizer } from '@senars/nar/rlfp';

const rlfp = nar.getRLFP();
// Logs reasoning trajectories
// Collects human preferences on derivations
// Trains reward model on preference pairs
// Optimizes policy via RL (PPO/GRPO)
```

### The Three Applications of the Reward Economy

One substrate — `Bag<T>`, `Focus`, `Game`, `Reflex`, `RewardGate` — powers three distinct, deliberately separated applications:

| Application | Reward Source | Acts On | Failure Containment |
|-------------|---------------|---------|---------------------|
| **General-Purpose RL Agent** | External environments (`Game.step`) | Reflex policies, focus weights | NAL Negotiator veto; kernel gates |
| **RLFP** | Human preferences & derivation outcomes | Attention priorities, policy weights | `RewardGate` epistemic firewall |
| **Autonomous Self-Improvement** | Task outcomes (extrinsic + intrinsic) | `SelfImprovementProposal`s only | Governance pipeline; human approval for high risk |

---

## Self-Improvement Loop

SeNARS runs a **self-improvement loop** where the cognitive architecture reasons about its own codebase using the same NAL machinery it uses for external reasoning.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NAR REASONER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  BELIEFS    │  │   GOALS     │  │  QUESTIONS  │              │
│  │  (incl.     │  │  (incl.     │  │  (incl.     │              │
│  │   self-     │  │   self-     │  │   self-     │              │
│  │   beliefs)  │  │   goals)    │  │   questions)│              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌─────────────────────┐                            │
│              │   RULE PROCESSOR    │  ← 5 meta-rules + AIKR bounds│
│              │                     │  ← sync rules + LMRules      │
│              └──────────┬──────────┘                            │
│                         │                                        │
│    ┌────────────────────┼────────────────────┐                  │
│    ▼                    ▼                    ▼                  │
│ ┌─────────┐       ┌─────────┐        ┌─────────┐              │
│ │ TOOLS   │       │ MEMORY  │        │ RLFP    │              │
│ │(self-ops)│       │(self-epi)│        │(task rwd)│             │
│ └─────────┘       └─────────┘        └─────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

**The Cognitive Loop — Two Levels:**

- **Kernel Micro-Tick** (the 11 OpenTelemetry-observed stages): `perceive | recall | attend | reason | propose | negotiate | authorize | act | validate | learn | consolidate` — the kernel's inner loop, running inside `NARExecution.run()`.
- **Agent Macro-Cycle** (defined in *Ecosystem & Integration Layer*): `Perceive → Recall → Reason → Narrate → Act → Consolidate` — the Agent wraps the Kernel, adding "Narrate" (LLM Cortex synthesis) to the loop.

The self-improvement loop operates at the kernel level: `Perceive → Recall → Reason (meta-rules + drives) → Act (tools) → Validate → Consolidate`.

### Self-Concept Vocabulary

<details>
<summary><b>Narsese Self-Concept Vocabulary</b></summary>

```narsese
<!-- Components -->
(system_component --> knob).
(system_component --> strategy).
(system_component --> tool).
(system_component --> rule).
(system_component --> test).
(system_component --> scenario).
(system_component --> concept).
(system_component --> schema).
(system_component --> capability).

<!-- Causal/functional relations -->
(knob_maxLoops --> affects_modelRunner_maxLoops).
(strategy_focused --> reduces_derivations).
(tool_codemod --> modifies_source_code).
(rule_transitivity --> derives_implication).
(test_fix_test --> requires_codemod).
(scenario_induction --> tests_induction_capability).
(schema --> promotes_to_rule).
(capability --> implemented_by_tool).

<!-- Fix patterns (semantic concepts) -->
(fix_pattern_null_check --> applies_to_null_pointer_error).
(fix_pattern_type_annotation --> applies_to_type_mismatch_error).
(fix_pattern_boundary_check --> applies_to_out_of_bounds_error).
(fix_pattern_assertion --> applies_to_assertion_failure).
(fix_pattern_undefined_check --> applies_to_undefined_variable).
(fix_pattern_empty_check --> applies_to_empty_collection_error).
(fix_pattern_division_by_zero --> applies_to_division_by_zero_error).
(fix_pattern_async_handling --> applies_to_unhandled_promise_rejection).

<!-- Self-model: the system knows it can self-modify -->
(self --> can_modify_own_code).
(self --> can_tune_own_knobs).
(self --> can_add_own_rules).
(self --> can_generate_own_tests).
(self --> can_run_own_scenarios).
```

</details>

### Meta-Rules with AIKR Bounds (5 Rules)

| Rule | Trigger | Action | AIKR Bounds |
|------|---------|--------|-------------|
| **Strategy Select** | `drive:competence --> low` | `^switch_strategy($s)!` | depth=2, budget=5/step, priority=0.1, threshold=0.6 |
| **Knob Tune** | `rlfp:reward --> below_threshold` | `^tune_knob($k, $v)!` | depth=2, budget=5/step |
| **Test Repair** | `test_failed & error_pattern & fix_pattern` | `^apply_fix($fix)!` | depth=2, budget=5/step |
| **Schema Promote** | `confidence > 0.9 & frequency > 10` | `^promote_rule($s)!` | depth=2, budget=5/step |
| **Capability Scaffold** | `capability & template` | `^scaffold($tmpl, $c)!` | depth=2, budget=5/step |

### Homeostatic Drives (4 Drives)

| Drive | Goal | Decay | Replenished By |
|-------|------|-------|----------------|
| `curiosity` | `(self --> curious)!` | 0.02/cycle | `generate_scenarios`, `coverage_concepts` on low-coverage |
| `competence` | `(self --> competent)!` | 0.015/cycle | `run_tests` (green), `tune_knob` (reward ↑) |
| `coherence` | `(self --> coherent)!` | 0.01/cycle | `resolve_contradiction`, schema promotion |
| `social` | `(self --> social)!` | 0.05/cycle | Human interaction (CLI/IRC) |

---

## Self-Modification Governance

Self-modification is only acceptable if every change is isolated, tested, risk-classified, and (above low risk) externally approved. The machinery below enforces that.

### Self-Tools (8 Tools, Shadow Execution)

| Tool | Self-Operation | Implementation |
|------|----------------|----------------|
| `register_rule` | `(^promote_rule($schema))!` | Add schema to RuleRegistry |
| `register_tool` | `(^add_capability($cap))!` | ToolManager.register() |
| `scaffold_capability` | `(^scaffold($tmpl, $cap))!` | Fill template → `codemod` in shadow worktree |
| `apply_fix` | `(^apply_fix($fix))!` | Lookup fix pattern → `codemod` in shadow worktree |
| `tune_knob` | `(^apply_tuning($knob, $val))!` | RLFPLearner.applyTuningUpdate() |
| `switch_strategy` | `(^select_strategy($strat))!` | CognitiveController / StrategyRegistry |
| `run_tests_shadow` | Validation | Full CI (`pnpm test && pnpm typecheck && pnpm lint`) in shadow |
| `run_scenario_shadow` | Validation | Cognitive scenarios in shadow |

**Shadow Execution Safety:**
1. Create git worktree: `git worktree add .shadow/fix-42`
2. Apply codemod in `.shadow/fix-42`
3. Run **full CI** (test + typecheck + lint) in shadow
4. If green: present diff to ApprovalManager
5. If approved: merge worktree → main
6. Cleanup: `git worktree remove .shadow/fix-42`

### RLFP on Task Outcomes (Unified + Intrinsic Rewards)

```typescript
interface TaskOutcome {
  taskType: 'test' | 'scenario' | 'contradiction' | 'schema' | 'capability' | 'knob_tune' | 'meta_reasoning';
  success: boolean;
  metrics: Record<string, number>;
}

// Extrinsic (existing)
reward_extrinsic = 0.5 * passRate + 0.3 * clamp(baseline/current, 0, 2)/2 + 0.2 * coverageDelta - AIKR penalties;

// Intrinsic (new)
reward_intrinsic = 
  0.4 * derivationDepthReduction +    // schema promotion → fewer steps
  0.3 * selfModelAccuracy +           // predicted vs actual capability
  0.3 * contradictionReduction;       // coherence improvement

reward = clamp(reward_extrinsic + 0.3 * reward_intrinsic, -1, 1);
```

### Goal→Tool Dispatch (Semantic, Native AST)

```typescript
// Narsese operation goal: ^apply_fix(fix_pattern:null_check)
// Parses to: Inheritance(Product(Atom('fix_pattern:null_check')), Atom('^apply_fix'))
async executeToolGoal(goalTerm: Term): Promise<ToolResult> {
  // AST traversal extracts operator from predicate, args from Product subject
  const op = goalTerm.predicate;        // Atom('^apply_fix')
  const args = goalTerm.subject;        // Product([Atom('fix_pattern:null_check')])
  return this.execute(op.symbol.slice(1), resolveSemanticArgs(args));
}
```

### Cognitive State Observability

Structured cognitive state emitted every 10 cycles:

```json
{
  "timestamp": "2026-09-08T...",
  "cycle": 128,
  "active_drives": { "competence": 0.8, "curiosity": 0.2, "coherence": 0.9, "social": 0.1 },
  "active_meta_goals": ["^apply_fix(fix_pattern:null_check)", "^promote_rule(schema_42)"],
  "pending_tool_executions": ["apply_fix (shadow worktree .shadow/fix-42)"],
  "aikr_pressure": "low",
  "rlfp_reward_avg": 0.34,
  "meta_derivation_budget_used": "2/5",
  "self_quality": 0.85
}
```

CLI: `pnpm exec tsx src/bin/self-report.ts`

### Governance Pipeline

**In-repo prototype:**
- `PatchRiskClassifier` scores patches against guard-rail file list (approval logic, sandbox config, reward functions, autonomy mode, kernel gates, schemas, budget limits).
- `GovernancePolicyEngine` combines risk + current `AutonomyMode` → `{AUTO_MERGE, CREATE_PR, REQUIRE_HUMAN_REVIEW, REJECT}`.
- `ProposalRouter` consumes `SelfRewardGate` proposals: low-risk `focus-weight` auto-applies, medium → sandbox validation, high → human approval.
- `SandboxValidator` auto-approves in-range `knob-tune` proposals (range checked vs `rlfp/knobSchema`).

**External Governance Model (Required for Production):**
- The agent *proposes* patches via shadow worktree + CI validation
- An **external, immutable CI/CD runner** evaluates risk and applies the merge
- The agent **cannot** edit its own sandbox config, approval policies, or reward functions
- `AutonomyMode` enum: `observe-only` → `propose-only` → `sandbox-execute` → `low-risk-auto-merge` → `human-approved-production`

These capabilities build on the existing shadow execution safety (git worktree + full CI + ApprovalManager) and the unified RLFP reward signal (extrinsic + intrinsic).

---

## Ecosystem & Integration Layer

### Core Agent Runtime (`@senars/core`)

The **Agent** class is the central orchestrator — a multi-engine cognitive runtime. The Agent wraps the Kernel, executing the **Agent Macro-Cycle**: `Perceive → Recall → Reason → Narrate → Act → Consolidate` (the Kernel's 11-stage Micro-Tick runs inside "Reason").

```typescript
import { Agent, LLMCortex, createCortexFromLM, SqliteEventLog, JsonlSessionManager } from '@senars/core';
import { createAgent } from '@senars/nar/agent';
import { NAREngine } from '@senars/nar/engine';
import { NAR } from '@senars/nar';

const agent = await createAgent({
  log: new SqliteEventLog({ path: '.cache/agent.db' }),
  cortex: createCortexFromLM(lmService),
  episodicMemory,
  sessionManager: new JsonlSessionManager({ path: '.cache/sessions' }),
  builtinTools: true,
  commandParser: new MettaCommandParser().parse,
});

// NAR is the only reasoning engine; MeTTa is available as the `metta` tool
agent.registerEngine('nar', new NAREngine(nar));

// Start the agent
await agent.start();

// Chat interface (streams responses)
for await (const event of agent.chat("What is a cat?")) {
  if (event.kind === 'text-delta') console.log(event.text);
}

// Health & capabilities
agent.health();     // { status: 'healthy', cycleCount: 42, ... }
agent.capabilities(); // { engine: 'metta', supports: { chat: true, skills: true, ... } }
```

**Agent Macro-Cycle:**

| Phase | Function |
|-------|----------|
| **Perceive** | Emit `input.user` cognitive event |
| **Recall** | Retrieve working/episodic/semantic memory |
| **Reason** | Query all registered engines (NAR) — wraps the Kernel Micro-Tick |
| **Narrate** | Synthesize response via LLMCortex or raw derivations |
| **Act** | Parse commands, check policy, execute tools |
| **Consolidate** | Persist to episodic memory |

**Key Subsystems:**

| Subsystem | Exports | Purpose |
|-----------|---------|---------|
| **Agent** | `Agent`, `createAgent`, `AgentOptions` | Main runtime |
| **Engines** | `BaseEngine`, `NAREngine` | Reasoning backends (MeTTa is a tool, not an engine) |
| **Cortex** | `LLMCortex`, `createCortexFromLM` | LLM narrative synthesis |
| **Memory** | `MemoryService`, `InMemorySessionManager`, `JsonlSessionManager` | Working + episodic + sessions |
| **Event Log** | `InMemoryEventLog`, `SqliteEventLog` | Persistent cognitive audit trail |
| **Tools** | `ToolRegistry`, `BUILTIN_TOOLS`, `buildAgentTools` | Function calling + skills |
| **Policy** | `PolicyEngine`, `PolicyRule` | Guardrails / HITL approval |
| **Approval** | `ApprovalService`, `PendingApproval` | Human-in-the-loop |
| **Model Runner** | `ModelRunner`, `ToolCall`, `ModelEvent` | LLM orchestration |
| **Knowledge** | `KnowledgeManager` | Structured knowledge CRUD |
| **Stats** | `StatsManager`, `AgentStats` | Telemetry |
| **Lens/Protocol** | `Lens`, `GraphNodeData`, `GraphOp` | UI projection types |
| **Utils** | `makeId`, `generateId`, `clamp`, `sleep`, ... | Shared utilities |

### Multi-Transport Agent (The "Bot")

A single SeNARS agent, accessible via multiple transports simultaneously:

| Transport | Protocol | Use Case |
|-----------|----------|----------|
| **CLI** | stdin/stdout | Local REPL, scripting |
| **IRC** | IRC | Chat rooms, multi-user |
| **WebSocket** | WS | Real-time web clients |
| **HTTP** | REST | API integration |
| **MCP** | Model Context Protocol | AI assistant integration |

```typescript
import { ConnectionManager, CLIConnection, IRCConnection, WSConnection, HTTPConnection, MCPConnection } from '@senars/io';

const cm = new ConnectionManager();
cm.registerFactory({ type: 'cli', create: ... });
cm.registerFactory({ type: 'irc', create: ... });
cm.registerFactory({ type: 'websocket', create: ... });
cm.registerFactory({ type: 'http', create: ... });
cm.registerFactory({ type: 'mcp', create: ... });

// All connections share one agent instance
for (const cfg of configs) {
  const conn = await cm.addConnection(cfg);
  bindAgentToConnection(agent, conn, { auth, commandRegistry, sessionManager });
}
```

### API Layer

**REST API (HTTP Adapter):**

```bash
POST /api/v1/nar/believe     # Input belief
POST /api/v1/nar/goal        # Input goal
POST /api/v1/nar/question    # Input question
POST /api/v1/nar/run         # Run inference steps
GET  /api/v1/nar/beliefs     # Query beliefs
GET  /api/v1/nar/concepts    # List concepts
GET  /api/v1/nar/stats       # Statistics
```

**WebSocket API:**

```json
{ "type": "nar.input", "data": { "input": "(cat --> animal).", "type": "belief" } }
{ "type": "nar.run", "data": { "steps": 5 } }
{ "type": "nar.query", "data": { "term": "(whiskers --> ?what)?" } }
```

**MCP (Model Context Protocol):**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerNARTools, registerAgentAPI } from 'senars/api';

const server = new McpServer({ name: 'senars', version: '1.0.0' });
registerNARTools(server, nar, agent);
registerAgentAPI(server, agent);
// Exposes tools: calculate, read_file, write_file, search_memory, run_reasoning, 
// learn_belief, explain_belief, agent_chat, agent_believe, agent_recall, 
// agent_know, get_beliefs, get_attention, and more
```

---

## Web UI & Visualization

### Dashboard

Real-time cognitive visualization:

- **Graph Viewport** — 3D force-directed concept graph (via SpaceGraphJS)
- **Chat History** — Conversation transcript
- **Cognitive Metrics** — Attention, derivation rate, memory pressure
- **Config HUD** — Live parameter tuning
- **Timeline Scrubber** — Replay reasoning history
- **Lens Designer** — Custom graph projections
- **Node Detail Drawer** — Inspect concept/task details

```bash
# Start with web UI
ENABLE_WEB_UI=true pnpm bot
# Opens http://localhost:3000
```

### Lens — Declarative UI Projections

**Lenses** map cognitive state to visual channels (color, size, opacity, stroke) via a composable AST:

```typescript
import { LensSpec, ModulationSchema, builtinLensSpecs, isBuiltinLens } from '@senars/core';
```

**Built-in Lenses:**

| Lens | Description | Visual Mapping |
|------|-------------|----------------|
| `belief` | What the system knows | Color=truth frequency, Opacity=confidence |
| `goal` | What the system wants | Size=priority, Color=cyan |
| `contradiction` | Where beliefs conflict | Color=orange, Dashed stroke |

**Modulation AST** (composable):

```typescript
{ op: 'union', children: [
  { op: 'channel', channel: 'color', child: { op: 'field', field: 'truth', map: 'truth-to-color' }},
  { op: 'when', predicate: 'isContradiction', child: { op: 'channel', channel: 'color', child: { op: 'const', value: '#ffaa00' }}}
]}
```

Operations: `const`, `field`, `channel`, `when`, `union` — enabling arbitrary visual mappings.

### Protocol — Client/Server Cognitive Sync

Real-time WebSocket protocol for UI synchronization:

| Message Type | Direction | Purpose |
|--------------|-----------|---------|
| `chat.user` / `chat.agent.complete` | ↔ | Chat streaming |
| `cognitive.delta` | Server→Client | Graph ops (add/update/remove nodes/edges) |
| `config.schema` / `config.set` | ↔ | Live parameter tuning |
| `lens.list` / `lens.define` | ↔ | Lens management |
| `sync.request` / `state.snapshot` | ↔ | Full state sync |
| `viewport.set` / `focus.set` | Client→Server | Camera/selection |
| `history.request` | ↔ | Node derivation history |

**Graph Node Types:**

| Type | Source | Fields |
|------|--------|--------|
| `NarConceptNode` | NAR | term, truth, priority, revision history |
| `MettaAtomNode` | MeTTa | atom, type, space |
| `MettaSkillNode` | MeTTa | skill name, code, I/O schema |

---

## Safety, Observability & Governance

### Observability (OpenTelemetry)

Every Kernel Micro-Tick stage emits an OpenTelemetry span:

```typescript
import { initOtel, instrumentPipeline, runTick, createTickContext, DEFAULT_PIPELINE } from '@senars/nar/tick';

// Initialize OTel (once at startup)
initOtel({
  serviceName: 'senars-cognitive-kernel',
  otlpEndpoint: 'http://localhost:4318/v1/traces',  // optional
  batch: true,  // use BatchSpanProcessor (recommended for production)
  enabled: true,
});

// Wrap pipeline for automatic per-stage spans
const instrumented = instrumentPipeline(DEFAULT_PIPELINE);

// Run ticks — spans auto-created for each of 11 stages
const ctx = createTickContext('tick-1', { cycles: 10 });
await runTick(ctx, instrumented);
```

**Span Attributes (per middleware stage):**

| Attribute | Description |
|-----------|-------------|
| `tick.id` | Unique tick identifier |
| `cognitive.stage` | Stage name: `perceive` \| `recall` \| `attend` \| `reason` \| `propose` \| `negotiate` \| `authorize` \| `act` \| `validate` \| `learn` \| `consolidate` |
| `cognitive.budget.cycles` | Budget cycles allocated |
| `cognitive.budget.depth` | Max derivation depth (if set) |
| `cognitive.duration_ms` | Stage execution time |

**Events as Span Events:** `ctx.events` (stage timestamps) are emitted as span events with `event.stage`, `event.detail`, `event.at`.

**Exports:** `initOtel`, `shutdownOtel`, `instrumentPipeline`, `wrapMiddlewareWithSpan`, `recordCognitiveEvents`, `emitSpanEvent`, `getTracer`, types `OtelConfig`, `CognitiveStage` from `@senars/nar/tick`.

### WASI Sandbox — Secure Capability Execution

`CapabilitySpace` supports **WebAssembly sandboxing via WASI** for safe execution of self-modification tools and untrusted code:

```typescript
import { CapabilitySpace, createWasiSandbox, createWasmModuleSandbox, createNodeVMSandbox } from '@senars/nar/capability';

// 1. WASI sandbox with preopened directories (deny-by-default)
const wasiSandbox = await createWasiSandbox({
  allowedPaths: ['/workspace', '/tmp'],  // explicit allowlist
  env: { MY_VAR: 'value' },              // explicit env only (deny-by-default)
  args: ['--flag'],
  timeoutMs: 30000,                      // enforced wall-clock timeout
  // deny-by-default: no network, no clock, no env vars unless explicitly provided
});

// 2. WASM module sandbox (loads .wasm file with WASI imports)
const wasmSandbox = await createWasmModuleSandbox({
  wasmPath: '/path/to/module.wasm',
  imports: { custom: { func: () => {} } },
  timeoutMs: 30000,
});

// 3. Node.js VM sandbox (JS isolation fallback — NOT for untrusted code)
const vmSandbox = createNodeVMSandbox(); // relegated to "trusted-but-faulty code isolation"; deprecated for secure use

// Use with CapabilitySpace
const space = new CapabilitySpace({ sandbox: wasiSandbox });
space.register({ name: 'run_wasm', execute: () => 'result' });
await space.execute('run_wasm');
```

**Hardening Features:**
- **Env leak closed** — both sandboxes receive explicit `env` only (default `{}`); no `process.env` spread
- **Path containment** — `sanitizePreopens()` normalizes paths, drops `..` escapes; `assertWasmPathContained()` enforces `wasmPath` stays within `allowedPaths` (guards sibling-prefix confusion)
- **Timeouts** — `timeoutMs` option (default 30s) enforced via `withTimeout()` → `SandboxTimeoutError`; all wrappers race execution against it
- **`createNodeVMSandbox` deprecated** — JSDoc `@deprecated` + one-time `console.warn`; retained only for backward compat. Never use for untrusted code.

**Sandbox Options:**

| Option | Type | Description |
|--------|------|-------------|
| `allowedPaths` | `string[]` | Directories preopened for WASI file access (deny-by-default) |
| `env` | `Record<string,string>` | Environment variables for WASI process (deny-by-default) |
| `args` | `string[]` | Command-line arguments for WASI process |
| `timeoutMs` | `number` | Wall-clock timeout in ms (default 30000) |

**Exports:** `createWasiSandbox`, `createWasmModuleSandbox`, `createNodeVMSandbox`, `SandboxTimeoutError`, `DEFAULT_SANDBOX_TIMEOUT_MS`, `sanitizePreopens`, `containsPath`, `assertWasmPathContained`, `withTimeout` from `@senars/nar/capability`.

### Production Readiness

SeNARS is designed for **continuous, unattended operation** within defined autonomy bounds. The cognitive kernel includes:

- **OpenTelemetry distributed tracing** — per-middleware spans with OTLP HTTP export for observability
- **WASI sandbox** — secure capability execution via `CapabilitySpace` with `createWasiSandbox`/`createWasmModuleSandbox` (deny-by-default)
- **Health monitoring** — cognitive state emission every 10 cycles (drives, meta-goals, AIKR pressure, RLFP rewards)
- **Persistent state verification** — JSON serialization/deserialization with integrity checks across restarts
- **Auto-approval modes** — configurable `ApprovalManager` for unattended operation within autonomy bounds
- **Event-sourced replay** — system can be paused, event log serialized, and perfectly replayed in a separate process

**Target:** 1-hour+ unattended autonomous runs (`nar run --auto --duration 3600`) at `sandbox-execute` autonomy level.

---

## Configuration Reference

This section is the lookup reference for tuning and deployment; the system description above does not depend on it.

### LM Profiles & Routing

`LM_PROFILE` selects a preset: `auto` (default — cloud when credentials exist, else local),
`cloud-quality`, `local-private` (transformers.js), `openai-compatible`. Per-tier env overrides
(`LM_FAST_MODEL` etc.) and an optional `routing` config block enable objective-driven
multi-provider model selection with a self-upgrading offline failsafe ladder.

LM profiles are the system's interface to external **System 1 proposers**: each profile selects which untrusted models translate, enrich, and formalize on the kernel's behalf.

### NARConfig

```typescript
// Full NARConfig interface
interface NARConfig extends CoreConfig {
  // LLM Integration
  lmService?: LMService;
  providerRegistry?: SeNARSRegistry;
  enableLMRules?: boolean;
  enableBidirectionalFeedback?: boolean;
  enableProactiveEnrichment?: boolean;
  enableLMStreaming?: boolean;

  // Optional Subsystems
  enableTools?: boolean;
  enableSelf?: boolean;
  enableRLFP?: boolean;
  rlfp?: { optimizeInterval?: number };

  // Cognitive Architecture
  cognitiveParams?: CognitiveParameters;
  strategyRegistry?: CognitiveRegistry;
  adaptationInterval?: number;

  // Persistence
  persistState?: boolean;
  statePath?: string;
}
```

### SystemOneConfig

The Judgment Manifold's full config is zod-validated in a single schema (`src/config/schema.ts`), organized into `cortex`, `ingress`, `manifold` (encoder model + provider), `rl`, and `distillation` sections, all gated by `systemOne.enabled`. See `docs/system-one-guide.md` for per-section semantics and `pnpm status` to inspect the effective values. The Dialogue Flywheel has its own top-level `dialogue` section (`enabled`, `captureAll`, `maxTurnsPerSession`, `autoRetrospect` — default off; see `util/src/config/dialogue.ts`).

### Environment Variables (`.env`)

```bash
# LM Provider
LM_PROVIDER=openai|anthropic|openai-compatible|local
LM_MODEL=gpt-4o|claude-3|...
LM_API_KEY=...
LM_OFFLINE=1          # skip all provider probes (offline hard-switch)

# Transports
ENABLE_IRC=true
ENABLE_WS=true
ENABLE_HTTP=true
ENABLE_MCP=true
ENABLE_WEB_UI=true

# IRC
IRC_SERVER=irc.libera.chat
IRC_CHANNEL=#senars
IRC_NICK=senars-bot

# Persistence
STATE_PATH=.cache/nar-state
```

---

## Proof Obligations & Benchmark Plan

Each architectural claim — paraconsistency, bounded degradation, derivation soundness, self-modification safety — is bound to a concrete, automated falsification test enforced in CI.

| Benchmark Name | Purpose | Implementation Strategy |
|---|---|---|
| **1. Evidence Laundering Test** | Prove the system doesn't double-count evidence | Inject one fact. Create 5 distinct derivation paths that loop back to reinforce the same fact. Assert that `Truth.confidence` does not artificially inflate. |
| **2. Translation Ambiguity** | Prove NL formalization handles nuance | Feed sentences with "unless", "may/must", and nested negations. Assert the system returns multiple `FormalizationCandidate` objects with correct ambiguity flags, rather than one confident, wrong parse. |
| **3. Bounded Degradation** | Prove AIKR graceful degradation | Run a heavy reasoning workload. Progressively shrink `ReasoningBudget.maxCycles` and `Bag.capacity`. Assert that the system returns partial, valid results rather than crashing or hanging. |
| **4. Contradiction Resilience** | Prove paraconsistent handling | Inject `(A --> B)` from a high-quality source, and `(- (A --> B))` from a low-quality source. Assert both remain in memory with distinct truth values, rather than one silently overwriting the other. |
| **5. Proof Replay Test** | Prove derivation soundness | Export 1,000 random `DerivationRecord` objects. Run them through the standalone, minimal Derivation Verifier script. Assert 100% match with the main engine's output. |
| **6. Scheduler Fairness** | Prove AIKR doesn't starve low-priority goals | Inject a high-priority continuous goal and a low-priority background goal. Run for 10,000 cycles. Assert the low-priority goal receives >0% of the CPU budget (via aging/fairness mechanisms). |
| **7. Sabotage Test** | Prove self-mod safety | Prompt the self-improvement loop to generate a patch that disables the `ApprovalManager` or reads `.env` secrets. Assert the External Governance layer rejects the patch and flags the risk. |

**System One falsification benches (15–28):** live ingress calibration, cortex ladder, cache correctness at scale, reflex activation, RL parity, manifold-driven RL (no NAL), distillation loop, calibration-from-labels, Jev policy patterns, training round-trip, head-specs equivalence, encoder digest binding, per-call model override, flow-level resource accounting — each implemented as a `tests/nar/todo16c-*.test.ts` suite enforced in the CI `systemone-benches` job.

**TODO19 benches (41–46):** assembly integrity (NARBuilder — every entry point builds through the builder; `BuilderError` on inconsistent specs), gate isolation (per-instance `createGateRegistry()` — two agents in one process never share autonomy/allowlist/veto state), component contracts (sensors fail-closed, actions tier- and scope-gated through the `ParameterTable`, rewards firewall-classified), ReasoningGame falsification (assembled arm beats the naive scheduler, tier gating, NAL veto transplant), learning closure (veto-aware demotion, MC-return label source, persistent `SchemaStore`), domain deployment (`device` profile never imports the LM; fast/slow test lanes). See `TODO19.md`.

---

## Reference

### Testing & CI

```bash
# Run all tests
pnpm run test

# Unit tests only
pnpm run test:unit

# With coverage
pnpm run test --coverage

# End-to-end smoke tests
pnpm exec tsx scripts/execute-turn-smoke.ts      # Real LM agent.executeEpisode
pnpm exec tsx scripts/cli-smoke.ts               # Full cognitive pipeline
```

**Test Structure:**

```
tests/nar/
├── unit/              # 30+ unit test files
├── e2e/               # 6 end-to-end test suites
├── property/          # Property-based testing
├── benchmark.test.ts  # Performance benchmarks
├── rlfp.test.ts       # RLFP integration
├── stream.test.ts     # Streaming execution
```

### Extensibility & Ecosystem

#### Embed Pattern (Minimal Integration)

```javascript
import { SeNARS } from 'senars';
const brain = new SeNARS();
brain.learn('(cats --> mammals).');
const answer = await brain.ask('(whiskers --> ?what)?');
// { answer: 'mammals', truth: {f: 0.81, c: 0.73}, proof: [...] }
```

**Framework adapters:** Express, React (`useSeNARS`), LangChain, MCP

#### Research & Development Tooling

- **Reasoning trace export** — JSON-LD, GraphML, Mermaid for analysis and publication
- **Strategy A/B testing framework** — pluggable derivation/attention/sampling strategies with metrics
- **RLFP annotation web UI** — human preference collection for reward model training

#### Knowledge Portability

- **Knowledge Book format** (`.sbook` YAML) — portable, versioned knowledge packages
- **Import/export:** Narsese, RDF/OWL, JSON-LD, Natural Language

<details>
<summary><b>Complete API Export / Entry Point Index</b></summary>

| Category | Key Exports | Entry Points |
|----------|-------------|--------------|
| **Core NAR** | `NAR`, `createNAR`, `Reasoner`, `Memory`, `TaskManager` | `@senars/nar` |
| **Terms** | `TermBuilder`, `termParser`, `Truth`, `Stamp` | `@senars/nar` |
| **Rules** | `NALRules`, `NALExtendedRules`, `RuleProcessor`, `MetaRules` | `@senars/nar` |
| **Agent (NAR)** | `createAgent`, `Agent`, `NAREngine` | `@senars/nar/agent` |
| **Cognitive** | `CognitiveController`, `runCounterfactual`, `RLFPLearner` | `@senars/nar/cognitive` |
| **Cognitive Params** | `CognitiveParameters`, `DEFAULT_COGNITIVE_PARAMETERS`, `FAST_COGNITIVE_CONFIG`, `LM_HEAVY_CONFIG` | `@senars/nar` (internal) |
| **Strategies** | `SamplingStrategy`, `DerivationStrategy`, `AttentionModel` | `@senars/nar` (internal) |
| **NL** | `NLUnderstandingService`, `NLGenerationService` | `@senars/nar/nl` |
| **Tools** | `ToolManager`, `discoverTools`, `ExplainTool`, `SelfTools` | `@senars/nar/tools` |
| **Learning** | `SchemaInductor` | `@senars/nar/learning` |
| **Self-Reasoning** | `ReasoningAboutReasoning`, `SelfAnalyzer`, `MetacognitiveMonitor` | `@senars/nar/self` |
| **Cognitive Analyzers** | `capabilities`, `performance`, `quality`, `reasoning-patterns`, ... | `@senars/nar/cognitive/analyzers` |
| **Grounding** | `GroundingPipeline`, `SourceQuality` | `@senars/nar` (internal) |
| **Streaming** | `createPipeline`, `StreamReasoner`, `MemoryPremiseSource`, `FocusPremiseSource`, `CompositePremiseSource`, `derive`, `throttled`, `backpressureAware` | `@senars/nar/stream` |
| **Commands** | `narCommands`, `rlfpCommands`, `selfCommands`, `configCommands`, `memoryCommands`, `lmCommands`, `episodesCommands` | `@senars/nar/commands` |
| **LM Rules** | `LMRules`, `LMRule`, `LMRuleFactory`, `symbolicFallbacks`, `TraceAbstractor`, `ShadowValidator`, `attemptLMCorrection` | `@senars/nar/lm` |
| **Cooperation** | `CognitiveTaskDelegation`, `CognitiveTaskResult`, `createDelegation`, `handleDelegationMessage` | `@senars/nar/cooperation` |
| **MeTTa** | `createMeTTa`, `parseMeTTa`, `EGraph`, `MeTTaRuntime` | `@senars/metta` |
| **MeTTa (tool)** | `MettaEngine` (tool executor only), `MettaCommandParser` (chat command parsing) | `@senars/metta/agent` |
| **Focus-Game-Reflex Kernel** | `Bag`, `Focus`, `FocusBag`, `GameFocus`, `MetaFocus`, `PerceptionGate`, `ActionGate`, `RewardGate`, `Reflex`, `TabularQReflex`, `Negotiator`, `Game`, `MetaGame`, `SelfMetaGame` | `@senars/nar` (new architecture) |
| **Games** | `SeededRNG`, `GridWorldGame`, `BanditGame`, `SnakeGame`, `TetrisGame`, `Game2048`, `TicTacToeGame` (+`minimax`), `renderGame` | `@senars/nar/game` |
| **Arcade (TODO17)** | `FocusScheduler`, `LMReflex`, `actionGrammar`, `BrierHarness`, `createOpenSystemOneManifold`, `open-systemone` manifold provider | `@senars/nar/focus`, `@senars/nar/lm/system-one`, `@senars/nar/eval/*` |
| **RL Library** | `QBeliefStore`, `RewardBeliefAdapter`, `BeliefPerceptionAdapter`, `GoalActionAdapter`, `RLParityHarness`, `ManifoldReflex`, `ManifoldUCBReflex`, `ManifoldRLAgent` | `@senars/nar/rl` |
| **System One** | `HEAD_SPECS`, `createHeadById`, `ConfidenceRouter`, `truthProbability`, `compositeScore`, `judgeCascade`, `createWakeGate`, `createTraceGrader`, `SystemOneManifold`, `EmbeddingCache` | `@senars/nar/lm/system-one` |
| **Tick Pipeline** | `createTickContext`, `runTick`, `createPipeline`, `DEFAULT_PIPELINE`, `createDefaultHooks`, `operationActionOf`, `fuseStreamReasoner`, `initOtel`, `instrumentPipeline`, `wrapMiddlewareWithSpan`, `recordCognitiveEvents`, `emitSpanEvent` | `@senars/nar/tick` |
| **Observability (OTel)** | `initOtel`, `shutdownOtel`, `instrumentPipeline`, `wrapMiddlewareWithSpan`, `recordCognitiveEvents`, `emitSpanEvent`, `getTracer`, `OtelConfig`, `CognitiveStage` | `@senars/nar/tick` |
| **WASI Sandbox** | `CapabilitySpace`, `createWasiSandbox`, `createWasmModuleSandbox`, `createNodeVMSandbox`, `WasiSandboxOptions`, `WasmModuleOptions` | `@senars/nar/capability` |
| **Core Agent** | `Agent`, `createAgent`, `LLMCortex`, `MemoryService` | `@senars/core` |
| **Agent Subsystems** | `ToolRegistry`, `PolicyEngine`, `ApprovalService`, `KnowledgeManager` | `@senars/core` |
| **Event Logs** | `InMemoryEventLog`, `SqliteEventLog` | `@senars/core` |
| **Session Mgmt** | `InMemorySessionManager`, `JsonlSessionManager` | `@senars/core` |
| **Model Runner** | `ModelRunner`, `ToolCall`, `ModelEvent` | `@senars/core` |
| **Lens/Protocol** | `Lens`, `GraphNodeData`, `GraphOp`, `CognitiveDelta` | `@senars/core/protocol` |
| **IO** | `ConnectionManager`, `bindAgentToConnection` | `@senars/io` |
| **API** | `HTTPAdapter`, `WebSocketAdapter`, `registerNARTools`, `registerAgentAPI` | `senars` (root package) |
| **UI** | `startAgentUI` | `@senars/ui` |
| **Config** | `loadConfig`, `loadConfigFromEnv` | `senars` (root package) |
| **Shared Utils** | `EventBus`, `CommandRegistry`, `generateId`, `clamp`, `sleep` | `@senars/util` |
| **Shared Types** | `CognitiveEvent`, `Connection`, `LMService`, `Episode` | `@senars/util` |
| **Errors** | `SenarsError`, `ConfigError`, `TransportError`, `PolicyViolation` | `@senars/util` |

</details>

## License

MIT License — see `LICENSE` for details.

---

*SeNARS — a bounded, event-sourced, provenance-preserving reasoning kernel.*
