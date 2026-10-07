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
2. **Judgment Manifold (System 1)** — Scores those candidates — task type, ambiguity, injection risk, source quality, feasibility — via calibrated embedding heads. Still statistical; no symbolic derivation occurs here, so its output is a proposal quality score, not a conclusion.
3. **NAL / MeTTa (System 2)** — Performs rigorous deduction, induction, and exact rewriting with truth algebra. This is where logical conclusions are *derived*, and where the derivation trace comes from.
4. **Kernel Gates (governance)** — Validate, budget-check, and admit derivations to the append-only event log. Gates admit System 2 output too: a derivation is a candidate until admitted.
5. **LLM (System 1)** — Translates results back to Natural Language

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

The axis itself is one type. `CognitiveAxis` (`'epistemic' | 'teleological'`) is what a decision is
*about*, and `DecisionAxis` is that same type under the name the decision port reads by — so a
value cannot be `epistemic` on one side of a boundary and something else on the other. Likewise
`BeliefTruth` is the one declared shape for a `{ frequency, confidence }` pair: nineteen interfaces
spelled it inline, and none of them carried the `0..1` bound that `BeliefTruthSchema` enforces at
the boundaries where truth actually crosses an untrusted edge.

The neuro-symbolic handoff (LLM → Narsese candidates → Kernel Gates → NAL → NL) makes this separation **enforceable**: the LLM translates, but the symbolic engine *decides* which slot each proposition occupies. The separation is a structural guarantee, not a prompt-level convention.

### Memory Subsystems

- **Universal AIKR queues** — Working, Episodic, and Semantic memory are all bounded `Bag<T>` priority queues
- **Revision history** — per-concept truth-value evolution
- **Embedding-based similarity** — semantic retrieval
- **Probabilistic sampling** — recall driven by AIKR budget and priority-weighted sampling
- **Decoupled decay** — truth (`frequency`, `confidence`) decays only on temporal invalidation or contradiction; attention (`priority`) decays by LRU/access time
- **Pressure-driven consolidation** — high `Bag` pressure triggers cognitive sleep and schema induction
- **State persistence** — JSON snapshot layered over the event log
- **Ports, not one god-object** — the reasoning cycle depends on nine named contracts in `nar/src/memory/ports/` (`ConceptReader`/`ConceptWriter`, `TaskAdmission`, `BeliefTable`, `GoalEnumeration`, `LinkPort`, `StatisticsView`, `SymbolIndex`, `MemoryClock`, `AttentionOwner`), composed as `MemoryPorts`; `MemoryView` is the read surface the strategy layer takes. `Memory` still composes them and still satisfies them, and `pnpm memory:ports` fails when a cycle-path module names it instead — so a widened dependency is a red gate rather than a review comment. A consumer can be driven by a different implementation; `tests/nar/todo29a-a5.test.ts` does exactly that with an array-backed store and no index.

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
