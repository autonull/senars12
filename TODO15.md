# SeNARS Open-Ended Continuous Development Specification

Based on the current SeNARS architecture in the repository, the target should **not** be “an LLM that writes code.” It should be a continuously running cognitive/development substrate in which the symbolic kernel, asynchronous LLM, evaluator, memory, and development tools form a closed experimental loop.

The existing architecture already has most of the pieces: event sourcing, bounded cognition, Stream Reasoner, LM rules, metacognition, self-optimization, schema induction, feedback learning, and a self-improvement demo. ([GitHub][1])

The missing step is to connect those pieces into a **persistent, open-ended development flywheel**, while replacing the current localhost `llama-server` transport with an embedded `node-llama-cpp` backend.

---

# 1. Target Architecture

```text
                         ┌───────────────────────────┐
                         │       HUMAN / USER        │
                         │ goals, questions, review  │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                        SE NARS COGNITIVE LOOP                    │
│                                                                  │
│  ┌───────────────┐      ┌───────────────────┐                   │
│  │ Stream        │─────▶│ NAL / MeTTa /     │                   │
│  │ Reasoner      │      │ symbolic engines  │                   │
│  └───────┬───────┘      └─────────┬─────────┘                   │
│          │                         │                             │
│          │ asynchronous            │                             │
│          ▼                         ▼                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    LLM TASK BROKER                         │  │
│  │                                                            │  │
│  │ hypothesis │ analogy │ schema │ critique │ planning │ ... │  │
│  └───────────────────────┬────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│              ┌──────────────────────────────┐                    │
│              │       node-llama-cpp         │                    │
│              │                              │                    │
│              │ resident GGUF model          │                    │
│              │ GPU-resident layers          │                    │
│              │ contexts / sequences         │                    │
│              │ constrained generation       │                    │
│              └──────────────┬───────────────┘                    │
│                             │                                    │
│                             ▼                                    │
│                    PROPOSALS / RESULTS                          │
│                             │                                    │
│                             ▼                                    │
│                    ┌─────────────────┐                           │
│                    │    Kernel Gates │                           │
│                    └────────┬────────┘                           │
│                             │                                    │
│                             ▼                                    │
│                      EVENT-SOURCED STATE                         │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
                 ┌────────────────────────────┐
                 │ DEVELOPMENT ENVIRONMENT    │
                 │                            │
                 │ repository                 │
                 │ tests                      │
                 │ benchmarks                 │
                 │ experiments                │
                 │ patches / branches         │
                 │ telemetry                  │
                 └────────────┬───────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ EVALUATOR       │
                     │                 │
                     │ correctness     │
                     │ regressions     │
                     │ capabilities    │
                     │ resources      │
                     │ novelty        │
                     └────────┬────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ EXPERIENCE MEMORY   │
                    │                     │
                    │ observations        │
                    │ hypotheses          │
                    │ failures            │
                    │ successful patches  │
                    │ strategies          │
                    │ schemas             │
                    └──────────┬──────────┘
                               │
                               └───────────────► back into cognition
```

The key property is that **there is no single “LLM call.”**

There is an ongoing stream of cognitive requests competing for bounded resources.

That matches the existing Stream Reasoner design, which already supports asynchronous LM work while symbolic inference continues, with queue limits and adaptive backpressure. ([GitHub][1])

---

# 2. Llama.cpp Integration

## 2.1 Replace the transport, not the abstraction

Do **not** redesign SeNARS around llama.cpp.

Keep:

```text
LMService
    │
    ├── Cloud provider
    ├── Ollama
    ├── llama-server
    ├── Transformers
    └── NodeLlamaCppProvider   ← new default
```

The current repository already has `createLMService()` and the LM rule system built around the service abstraction. ([GitHub][1])

The new implementation should therefore be:

```text
NodeLlamaCppLMService implements LMService
```

rather than allowing llama.cpp concepts to leak throughout the cognitive engine.

---

# 3. Embedded Runtime

The desired lifecycle is:

```ts
const llama = await getLlama();

const model = await llama.loadModel({
  modelPath
});

const context = await model.createContext({
  contextSize,
  batchSize,
  flashAttention,
  sequences
});
```

Then the runtime stays resident.

There should be **no request-per-generation process startup**, no localhost HTTP server, and no JSON serialization between SeNARS and the model.

`node-llama-cpp` provides native GPU backends, including CUDA, Metal, and Vulkan, and automatically selects an available backend by default. ([node-llama-cpp][2])

For NVIDIA systems it can use CUDA and automatically offload as many model layers as fit in VRAM; explicit `gpuLayers` configuration is also available. ([node-llama-cpp][3])

---

# 4. Model Manager

Create:

```text
LlamaRuntimeManager
```

Responsibilities:

* model discovery
* model loading
* model lifetime
* GPU configuration
* context creation
* context recycling
* model replacement
* runtime telemetry
* graceful shutdown
* VRAM budgeting

It should expose something like:

```ts
interface LlamaRuntime {
  model: ModelInfo;
  gpu: GpuInfo;

  generate(request: LMRequest): Promise<LMResult>;

  stream(request: LMRequest): AsyncIterable<LMToken>;

  createSession(options?: SessionOptions): Promise<LMContext>;

  reconfigure(config: LlamaRuntimeConfig): Promise<void>;

  reload(model: ModelSpec): Promise<void>;

  stats(): LlamaRuntimeStats;
}
```

---

# 5. Runtime Reconfiguration

This is important to distinguish.

### Hot configurable

These should be changeable without replacing the model:

* temperature
* top-k / top-p
* token budget
* grammar
* stop sequences
* sampling strategy
* prompt
* task priority
* timeout
* context selection
* concurrency limits

### Context-level configurable

Potentially requires creating/replacing a context:

* context size
* batch size
* sequence count
* KV-cache configuration

`node-llama-cpp` exposes context configuration including `contextSize`, `batchSize`, `sequences`, Flash Attention, threads, batching, and KV-cache options. ([node-llama-cpp][4])

### Model-level configurable

Requires controlled model lifecycle:

* GGUF model
* quantization
* GPU layer allocation
* LoRA adapters

Changing these should become a **runtime reconfiguration transaction**, rather than mutating a live context underneath an active generation.

---

# 6. GPU Memory Is a First-Class AIKR Resource

Do not treat VRAM as an incidental implementation detail.

Add it to SeNARS' resource model:

```text
AIKR Resources

CPU
RAM
VRAM
LM tokens
LM concurrency
context capacity
derivation budget
wall-clock deadline
```

For example:

```ts
interface LMResourceBudget {
  maxConcurrentRequests: number;
  maxTokensPerRequest: number;
  maxTokensPerCycle: number;

  maxVRAMBytes?: number;
  reservedVRAMBytes?: number;

  deadlineMs: number;
}
```

The runtime should report:

```text
VRAM total
VRAM available
model VRAM
KV cache VRAM
active contexts
queued requests
```

This fits directly into the existing BudgetGate/AIKR philosophy. SeNARS already treats CPU, derivation, LM, memory, backpressure, and termination as bounded resources. ([GitHub][1])

---

# 7. The LLM Is Omnidirectional

This is the crucial architectural point.

The LLM should **not** be modeled as:

```text
user → LLM → NARS
NARS → LLM → user
```

Instead:

```text
                    ┌─────────────┐
                    │     LLM     │
                    └──────┬──────┘
                           ↕
       ┌───────────────────┼────────────────────┐
       ↕                   ↕                    ↕
   perception         reasoning             memory
       ↕                   ↕                    ↕
   hypotheses          analogies             schemas
       ↕                   ↕                    ↕
   planning            critique             questions
       ↕                   ↕                    ↕
   explanation         debugging          development
```

The existing LM rule matrix is already moving in this direction: hypothesis generation, analogy, causal modeling, schema induction, meta-reasoning, uncertainty calibration, curiosity, goal decomposition, etc. ([GitHub][1])

The implementation should formalize this into a general **LM Task Protocol**.

---

# 8. LM Task Protocol

Every LLM request becomes:

```ts
interface LMTask {
  id: string;

  kind:
    | "hypothesis"
    | "analogy"
    | "schema"
    | "critique"
    | "explanation"
    | "causal"
    | "planning"
    | "question-generation"
    | "formalization"
    | "memory-enrichment"
    | "debugging"
    | "code-analysis"
    | "patch-proposal"
    | "test-generation"
    | "meta-reasoning"
    | "development";

  priority: number;

  deadline?: number;

  budget: LMTaskBudget;

  context: LMTaskContext;

  outputSchema: unknown;

  abortSignal?: AbortSignal;
}
```

The scheduler decides **whether this task deserves model time**.

The model never decides that itself.

---

# 9. Concurrency Model

The main reasoning loop must never await the LLM.

Bad:

```ts
const result = await llm.generate(...);
nar.reason(result);
```

Desired:

```ts
const task = lmBroker.submit(...);

nar.step();

for await (const result of lmBroker.completed()) {
  kernel.admit(result);
}
```

Conceptually:

```text
                    ┌─────────────┐
                    │ NAL cycles  │
                    └──────┬──────┘
                           │
                           │ continues
                           ▼
                 ┌──────────────────┐
                 │ LM Task Queue    │
                 └────────┬─────────┘
                          │
                     scheduling
                          │
                          ▼
                 ┌──────────────────┐
                 │ llama.cpp GPU    │
                 └────────┬─────────┘
                          │
                    result arrives
                          │
                          ▼
                 ┌──────────────────┐
                 │ Kernel Gate      │
                 └──────────────────┘
```

This preserves the Stream Reasoner's existing interleaving/backpressure model. ([GitHub][1])

---

# 10. Context Strategy

Do **not** give every cognitive task the entire system state.

Use specialized contexts:

### Ephemeral context

For:

* hypothesis
* analogy
* classification
* small inference assistance

### Persistent task context

For:

* debugging
* development
* multi-step investigation
* long-running reasoning

### System context

For:

* architectural self-model
* constitution
* capabilities
* current configuration

### Evidence context

Retrieved dynamically from:

* NAR
* event log
* episodic memory
* source files
* test results
* prior experiments

This prevents context growth from becoming the new bottleneck.

---

# 11. Constrained Generation

Where the LLM output crosses a kernel boundary, use structured output.

The existing system already uses JSON schemas and GBNF grammar for LM rules. ([GitHub][1])

`node-llama-cpp` supports grammar-constrained generation and JSON-schema-derived grammars. ([node-llama-cpp][5])

Therefore:

```text
LLM
 ↓
typed proposal
 ↓
Zod validation
 ↓
semantic validation
 ↓
Kernel Gate
 ↓
event
```

Never:

```text
LLM text
 ↓
execute
```

---

# 12. Development Flywheel

Now the important part.

The continuous development loop should be:

```text
OBSERVE
   ↓
IDENTIFY GAP
   ↓
FORM HYPOTHESIS
   ↓
DESIGN EXPERIMENT
   ↓
GENERATE TEST
   ↓
IMPLEMENT CHANGE
   ↓
RUN TESTS
   ↓
MEASURE
   ↓
ANALYZE
   ↓
COMPARE WITH BASELINE
   ↓
RETAIN / REJECT
   ↓
LEARN
   ↓
NEW GAP
   └───────────────────────↺
```

This should run indefinitely.

---

# 13. Observation

The system continuously observes:

### Runtime

* derivation throughput
* queue pressure
* LM latency
* token throughput
* VRAM
* RAM
* CPU
* dropped LM tasks
* timeouts
* backpressure

### Cognition

* successful derivations
* failed derivations
* contradictions
* unresolved questions
* low-confidence conclusions
* repeated reasoning patterns
* dead ends
* redundant inference

### Development

* failing tests
* uncovered code
* recurring failures
* TODOs
* stale implementations
* performance regressions
* type errors
* lint failures
* flaky tests
* capability gaps

### Learning

* hypotheses that succeeded
* hypotheses that failed
* useful schemas
* useless schemas
* successful strategies
* expensive strategies
* false positives

---

# 14. Gap Detection

The system periodically asks:

```text
What cannot I currently explain?

What repeatedly fails?

What consumes disproportionate resources?

Which reasoning patterns repeatedly terminate unsuccessfully?

Which capabilities are missing?

Which tests do not discriminate between competing implementations?

Which successful behaviors are not yet represented as reusable schemas?
```

This is where the existing self-analyzer becomes central. SeNARS already exposes reasoning-gap analysis, quality assessment, correction analysis, performance analysis, and resource analysis. ([GitHub][1])

---

# 15. Hypothesis Formation

The LLM proposes hypotheses.

Example:

```text
Observation:
  causal reasoning repeatedly times out.

Hypothesis:
  temporal premises are being sampled too uniformly.

Prediction:
  goal-biased temporal sampling will improve successful
  causal derivations without increasing average derivation count.

Experiment:
  compare strategies A/B across 100 seeded scenarios.
```

The hypothesis itself becomes an event:

```ts
HypothesisProposed
```

---

# 16. Experiment Generation

The system converts the hypothesis into an executable experiment.

```ts
interface Experiment {
  id: string;

  hypothesisId: string;

  baseline: Revision;

  candidate: Revision;

  fixtures: Fixture[];

  metrics: MetricDefinition[];

  budget: ExperimentBudget;

  stoppingCriteria: StoppingCriteria;
}
```

This is where the flywheel becomes genuinely open-ended.

The system isn't merely fixing predetermined TODOs.

It can invent experiments.

---

# 17. Tests Are Executable Knowledge

A generated test should become a permanent artifact if it demonstrates a previously uncovered capability or failure.

Three categories:

### Regression

```text
This must never break again.
```

### Capability

```text
The system should be able to do X.
```

### Discovery

```text
We don't know the correct behavior yet.
```

Discovery tests are particularly important.

They allow the system to explore without pretending that every question has a predetermined answer.

---

# 18. Development Sandbox

Every autonomous development attempt gets an isolated workspace:

```text
experiment/
    base/
    candidate/
    artifacts/
    logs/
    metrics/
    patches/
```

The development agent may:

* inspect source
* search code
* create tests
* modify source
* run typecheck
* run lint
* run unit tests
* run experiments
* inspect traces
* inspect metrics

It cannot directly mutate the canonical runtime.

---

# 19. Patch Lifecycle

Every change follows:

```text
PROPOSE
   ↓
PATCH
   ↓
COMPILE
   ↓
UNIT TEST
   ↓
INTEGRATION TEST
   ↓
PROPERTY TEST
   ↓
COGNITIVE TEST
   ↓
REGRESSION TEST
   ↓
RESOURCE TEST
   ↓
EVALUATE
```

Then:

```text
FAILED ──────► archive failure
                   │
                   ▼
              learn from it
```

or:

```text
PASSED
  ↓
candidate result
  ↓
promotion policy
  ↓
retain
```

---

# 20. Promotion Must Be Evidence-Based

The system should never say:

> “The new version feels better.”

Instead:

```text
Candidate
   │
   ├── correctness
   ├── regression
   ├── capability
   ├── resource
   ├── stability
   └── reproducibility
          │
          ▼
      Evaluation
          │
          ▼
   Promotion decision
```

The existing architecture already distinguishes self-improvement proposals by risk and routes them through proposal machinery rather than allowing arbitrary direct mutation. ([GitHub][1])

Keep that principle.

---

# 21. Three Autonomy Levels

## Level 0 — Observe

The system:

* observes
* analyzes
* proposes experiments
* produces patches

No mutation.

## Level 1 — Sandbox Autonomous

The system may:

* create branches
* modify code
* generate tests
* run arbitrary experiments inside the sandbox
* retain successful experiments

But canonical source remains untouched.

## Level 2 — Controlled Promotion

The system may automatically promote changes satisfying strict criteria.

For example:

```text
all mandatory tests pass
AND
no regression detected
AND
resource budget not exceeded
AND
experiment reproducible
AND
change within permitted scope
```

Anything outside that scope becomes a proposal.

The repository's existing ActionGate already models progression from observe-only through sandbox execution and ultimately human-approved production. ([GitHub][1])

---

# 22. Never Optimize the Wrong Thing

This is especially important for SeNARS.

The development reward must **not** simply be:

```text
"make tests pass"
```

Otherwise the system will eventually optimize the evaluator.

Instead, maintain multiple independent evidence channels:

```text
correctness
+
generalization
+
novel capability
+
resource efficiency
+
trace validity
+
reproducibility
+
test diversity
```

And keep the evaluator itself outside the agent's mutation authority.

---

# 23. Evaluator Independence

The agent can modify:

```text
src/
tests/
experiments/
```

But it must not automatically modify:

```text
evaluation policy
promotion policy
kernel security policy
event-log verifier
```

Those constitute the epistemic boundary.

The existing architecture's standalone derivation verifier is an excellent model for this: the verifier independently recomputes derivation correctness rather than trusting the reasoning engine's own assertion. ([GitHub][1])

---

# 24. Development Memory

Every experiment should create an experience:

```ts
interface DevelopmentEpisode {
  observation: Observation;
  hypothesis: Hypothesis;
  intervention: Intervention;
  result: ExperimentResult;

  metrics: Metrics;

  successful: boolean;

  lessons: Lesson[];

  artifacts: ArtifactRef[];
}
```

Store:

```text
"What happened?"
"Why did we think it would work?"
"What actually happened?"
"What changed?"
"What should we try next?"
```

That becomes long-term development memory.

---

# 25. Schema Induction

Successful development episodes should feed the existing schema induction machinery.

Example:

```text
Repeated episodes:

failure:
  overloaded LM queue

successful intervention:
  goal-priority scheduling

successful outcome:
  lower deadline misses

        ↓

induce schema

"Under high LM pressure,
prioritize goal-relevant tasks
over background enrichment."

        ↓

NAR representation
        ↓
future reasoning
```

The repository already explicitly supports LM-proposed schemas followed by NARS validation/adoption. ([GitHub][1])

That should become one of the main learning mechanisms of the flywheel.

---

# 26. Self-Model

The system should maintain a machine-readable self-model:

```text
Capabilities
Known limitations
Current architecture
Available tools
Available models
Resource constraints
Recent failures
Successful strategies
Active experiments
Pending hypotheses
Current development goals
```

The LLM receives relevant slices of this model rather than a giant prompt.

---

# 27. The Development Agent Should Be a SeNARS Agent

Do not build:

```text
SeNARS
+
separate coding agent
```

Build:

```text
SeNARS
    └── Development Focus
          ├── code observations
          ├── hypotheses
          ├── goals
          ├── experiments
          ├── patches
          └── evaluations
```

In other words, software development becomes another **environment** in which the cognitive architecture operates.

That is much more consistent with the existing `Focus`, `Game`, `Reflex`, `Negotiator`, and reward-domain separation than creating a parallel agent architecture. ([GitHub][1])

---

# 28. Development as a Game

The development environment can expose:

```ts
interface DevelopmentGame {
  observe(): DevelopmentState;

  legalActions(state): DevelopmentAction[];

  step(action): Promise<DevelopmentObservation>;
}
```

Actions might include:

```text
inspect-file
search-code
inspect-test
create-test
modify-file
run-test
run-experiment
run-typecheck
run-lint
analyze-trace
compare-results
create-hypothesis
abandon-experiment
propose-patch
```

The state is:

```text
repository
+
tests
+
runtime
+
experiments
+
knowledge
+
resources
```

This makes development itself compatible with the existing Focus/Game substrate.

---

# 29. Reward Domain

Development feedback belongs in:

```text
self-development
```

not:

```text
external-reflex
```

And absolutely not in the belief truth system.

The current repository already explicitly prevents self-improvement rewards from mutating `Truth`; self-improvement produces proposals instead. ([GitHub][1])

Keep that invariant.

---

# 30. Continuous Operation

The final runtime becomes:

```text
while (alive) {

    observeRuntime();

    runSymbolicInference();

    drainCompletedLMTasks();

    updateMemory();

    detectReasoningGaps();

    if (developmentBudgetAvailable()) {
        generateDevelopmentTasks();
    }

    if (experimentAvailable()) {
        executeExperiment();
    }

    evaluateExperiments();

    induceSchemas();

    updateStrategies();

    persistEvents();

    yield();
}
```

There should be **no terminal state called “finished development.”**

There are only:

```text
currently investigating
currently improving
currently waiting
currently reasoning
currently learning
```

---

# 31. Open-Endedness Requires Curiosity

Once the system reaches:

```text
all tests pass
```

the loop must **not stop**.

Instead:

```text
What capability is still missing?
```

Examples:

```text
Can I reason about longer temporal sequences?

Can I discover a more efficient inference strategy?

Can I explain this derivation more compactly?

Can I find redundant rules?

Can I discover a new reusable schema?

Can I solve a class of problems I couldn't solve yesterday?

Can I reduce resource consumption while preserving capability?

Can I construct a better experiment?
```

This turns the test harness into an **experimental environment**, rather than merely a gate.

---

# 32. Metrics

Maintain three classes of metrics.

## Cognitive

```text
derivations/sec
successful conclusions
contradiction rate
question resolution
hypothesis utility
schema utility
reasoning depth
```

## LLM

```text
queue latency
time-to-first-token
tokens/sec
tokens/request
GPU utilization
VRAM
context utilization
timeouts
abort rate
grammar failures
```

## Development

```text
tests added
failures discovered
failures fixed
capabilities added
regressions
patch acceptance rate
experiment success rate
novel discoveries
resource delta
```

---

# 33. Event Log

Every flywheel transition should be event-sourced.

Examples:

```text
ObservationRecorded
GapDetected
HypothesisProposed
ExperimentCreated
TestGenerated
PatchProposed
PatchApplied
TestStarted
TestCompleted
ExperimentEvaluated
ExperimentFailed
ExperimentSucceeded
SchemaInduced
StrategyUpdated
CandidatePromoted
CandidateRejected
```

This is especially natural because SeNARS already treats the append-only event log as the source of truth and supports replay. ([GitHub][1])

---

# 34. Deterministic Replay

A critical property:

```text
event log
   ↓
replay
   ↓
same cognitive state
```

LLM calls themselves can be recorded as:

```text
model
model hash
prompt
context hash
sampling parameters
grammar
seed, if applicable
response
latency
resource usage
```

Then an experiment can distinguish:

```text
engine nondeterminism
from
model nondeterminism
from
environment nondeterminism
```

---

# 35. The LLM Should Also Be an Experimental Subject

This is a subtle but important extension.

The system shouldn't only improve *around* the model.

It should experiment with:

```text
prompt structure
context selection
grammar
sampling
task routing
model selection
context allocation
LM rule selection
number of hypotheses
verification strategy
```

Those become ordinary cognitive parameters.

The repository already has a parameter space and optimization infrastructure intended for grid/random/Bayesian/RL/evolutionary optimization. ([GitHub][1])

The flywheel can therefore optimize the **way SeNARS uses the model**, rather than merely optimizing the model itself.

---

# 36. Model Switching

The runtime should support:

```text
small fast model
        ↓
routine LM rules

larger model
        ↓
difficult hypotheses

specialized model
        ↓
coding / embeddings / reranking
```

But this should be controlled by the LM broker.

For example:

```ts
LMTask {
  complexity: 0.82,
  deadline: 150,
  preferredModel: "fast"
}
```

versus:

```ts
LMTask {
  complexity: 0.97,
  deadline: 5000,
  preferredModel: "reasoning"
}
```

The cognitive architecture decides **what computation is worth buying**.

---

# 37. First Implementation Sequence

I would implement this in exactly this order:

### Phase 1 — Embedded llama.cpp

```text
NodeLlamaCppLMService
        ↓
LMService
```

* resident model
* GPU detection
* generation
* streaming
* grammar
* abort
* metrics

### Phase 2 — Llama Runtime Manager

Add:

* model lifecycle
* contexts
* resource accounting
* reconfiguration
* VRAM telemetry

### Phase 3 — LM Broker

Add:

* asynchronous queue
* priorities
* deadlines
* concurrency
* deduplication
* cancellation
* backpressure

### Phase 4 — Development Environment

Add:

* sandbox
* experiment runner
* repository observations
* patch lifecycle
* test execution

### Phase 5 — Development Memory

Add:

* hypotheses
* experiments
* outcomes
* lessons
* schemas

### Phase 6 — Continuous Evaluator

Add:

* capability tests
* regression corpus
* generated tests
* property tests
* resource evaluation

### Phase 7 — Autonomous Flywheel

Connect:

```text
observation
→ gap
→ hypothesis
→ experiment
→ implementation
→ evaluation
→ memory
→ next hypothesis
```

### Phase 8 — Controlled Self-Modification

Enable:

```text
sandbox autonomy
→ candidate promotion
→ configurable auto-promotion
```

only after the preceding machinery is reliable.

---

# 38. Definition of Done

The implementation is complete when this can happen:

```text
pnpm start
       │
       ▼
SeNARS loads its model directly into the process
       │
       ▼
GPU is configured automatically
       │
       ▼
Stream Reasoner begins running
       │
       ├───────────────► NAL inference
       │
       ├───────────────► MeTTa
       │
       └───────────────► asynchronous LM tasks
                                │
                                ▼
                           llama.cpp
                                │
                                ▼
                         Kernel admission
                                │
                                ▼
                         cognitive memory
                                │
                                ▼
                       gap detection
                                │
                                ▼
                       development task
                                │
                                ▼
                       sandbox experiment
                                │
                                ▼
                         tests + metrics
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
                  reject                  retain
                    │                       │
                    └──────────┬────────────┘
                               ▼
                         learned lesson
                               │
                               └──────────────► next cycle
```

And critically:

**the system continues reasoning while the LLM is generating, continues learning while experiments execute, and continues developing after the original test suite passes.**

---

# 39. The Architectural Principle

The final principle I'd put at the top of the implementation document is:

> **The LLM is not the developer, the reasoner, or the authority. It is a continuously available probabilistic computational substrate inside the SeNARS cognitive economy.**

NAL supplies uncertain symbolic inference.

MeTTa supplies exact computation.

The LLM supplies high-bandwidth associative generation.

The Stream Reasoner schedules them asynchronously.

The Kernel Gates decide what can enter trusted state.

The Event Log provides provenance.

The evaluator provides external evidence.

The development environment provides a world in which hypotheses can be tested.

Memory preserves what was learned.

And the flywheel continually turns:

**observe → hypothesize → experiment → evaluate → learn → reason → observe again.**

That is the point at which SeNARS stops being merely an application containing an LLM and becomes a **continuously experimenting cognitive runtime**.

The repository's current architecture is unusually well positioned for this because it already has the necessary conceptual boundaries—bounded cognition, asynchronous LM reasoning, event sourcing, meta-reasoning, optimization, schema induction, and gated self-improvement. ([GitHub][1])

For the llama.cpp portion specifically, `node-llama-cpp` gives us the embedded native runtime, GPU backend selection, GPU-layer control, context configuration, grammar-constrained decoding, and low-level context/sequence APIs needed to make that architecture practical without retaining an HTTP inference hop. ([node-llama-cpp][2])

[node-llama-cpp documentation](https://node-llama-cpp.withcat.ai/?utm_source=chatgpt.com)

[1]: https://github.com/autonull/senars12 "GitHub - autonull/senars12 · GitHub"
[2]: https://node-llama-cpp.withcat.ai/guide/?utm_source=chatgpt.com "Getting Started | node-llama-cpp"
[3]: https://node-llama-cpp.withcat.ai/guide/CUDA?utm_source=chatgpt.com "CUDA Support | node-llama-cpp"
[4]: https://node-llama-cpp.withcat.ai/api/type-aliases/LlamaContextOptions?utm_source=chatgpt.com "Type Alias: LlamaContextOptions | node-llama-cpp"
[5]: https://node-llama-cpp.withcat.ai/guide/grammar?utm_source=chatgpt.com "Using Grammar | node-llama-cpp"
