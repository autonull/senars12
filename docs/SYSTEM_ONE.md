# SeNARS Improvement Proposal  
## System-One Proposer Layer: A Jev-like, Online-Improving Perception/Decision Module

**Status:** Draft / Implementation Proposal  
**Scope:** SeNARS cognitive kernel, LM integration, perception gate, learning loop, evaluation  
**Primary goal:** Add a practical, low-infrastructure “System One” layer to SeNARS that approximates Jev-like behavior: fast, type-safe, probabilistic, structured decisions that feed the symbolic System Two kernel safely.

---

## 1. Summary

SeNARS currently treats language models as untrusted proposers that translate, enrich, and formalize unstructured observations into Narsese. Today, this usually depends on conventional LLMs producing text that must be parsed, normalized, corrected, and validated.

This proposal introduces a dedicated **System-One Proposer Layer**:

- A constrained, structured-output LM adapter.
- Calibrated uncertainty estimation.
- Strict schema/Narsese-subset validation.
- Budget-aware low-latency operation.
- An online experiential feedback loop.
- Event-sourced provenance through the existing SeNARS kernel gates.

The foundational proof-of-concept does **not** require massive infrastructure, custom model pretraining, distributed RL, or a novel inference engine. It can be built using:

- A small local or hosted LM.
- Constrained decoding / structured output.
- Logprob-based or verbalized confidence.
- SQLite/JSONL experience storage.
- Retrieval-augmented few-shot prompting.
- Simple calibration.
- Optional asynchronous LoRA/DPO updates later.

The result is a realistic path from conventional LM technology toward Jev-like behavior inside SeNARS.

---

## 2. Problem Statement

SeNARS needs fast, reliable perception and heuristic decision-making for tasks such as:

- Turning a messy CRM JSON payload into Narsese beliefs.
- Interpreting a sarcastic customer email.
- Classifying an incoming event as a question, goal, belief, or command.
- Routing tasks to the correct subsystem.
- Proposing likely Narsese formalizations.
- Scoring risk, urgency, sentiment, or relevance.
- Providing calibrated confidence for uncertain observations.

Pure symbolic reasoning is excellent for verification, memory, resource-bounded deliberation, contradiction handling, and auditable deduction. But it is not naturally suited to:

- High-dimensional noisy perception.
- Natural-language ambiguity.
- Implicit commonsense inference.
- Rapid heuristic classification.
- Mapping messy external state into formal symbols.

A Jev-like System-One layer fills this gap.

However, conventional LLMs are problematic:

- They generate free text.
- They can hallucinate invalid structures.
- They are often slow.
- Their confidence estimates are poorly calibrated.
- They are difficult to use as deterministic software components.

Therefore, SeNARS needs a **disciplined System-One adapter**, not just a generic LLM prompt pipeline.

---

## 3. What “Jev-like” Means in SeNARS Context

This proposal does not attempt to reproduce TypeSafe’s exact model architecture. Instead, it approximates the operationally important properties of Jev.

| Jev Property | SeNARS Approximation |
|---|---|
| Structured, type-safe outputs | Constrained JSON / restricted Narsese subset / Zod validation |
| No free-form string answers | Provider must return schema-conforming decision objects |
| Calibrated probabilities | Logprob extraction + calibration wrapper |
| Fast System One decisions | Small LM, short prompts, restricted schemas, caching, fallbacks |
| Parallel decision style | Score fixed choices via logprobs where possible, instead of long generation |
| Software-usable function call | `proposeSystemOne(request) -> SystemOneProposal` |
| Cannot produce type errors | Constrained decoding when available; otherwise reject invalid outputs |
| Learns from experience | Experience store, retrieval-augmented prompting, calibration updates |
| Safe integration | All outputs pass through SeNARS gates; no direct truth mutation |

---

## 4. Design Principles

### 4.1 System One proposes; System Two disposes

The System-One layer never directly mutates SeNARS beliefs, goals, or policies.

It only produces proposals.

All proposals pass through:

- `PerceptionGate`
- Schema validation
- Narsese normalization/validation
- Source-quality scoring
- Budget accounting
- Event logging
- Optional shadow validation

### 4.2 Type safety is mandatory

The foundational PoC must support at least one mode where invalid structured outputs are impossible or rejected before entering the kernel.

Preferred order:

1. Constrained decoding / grammar-based generation.
2. Provider structured-output mode.
3. Strict Zod validation plus rejection/fallback.

### 4.3 Uncertainty must be explicit

Every System-One proposal must include:

- Raw confidence, if available.
- Calibrated probability.
- Source quality.
- Recommended NAL truth mapping.

### 4.4 Learning must be experiential but safe

The PoC uses non-parametric online learning:

- Store corrected examples.
- Retrieve similar examples.
- Improve prompts dynamically.
- Update calibration.

Optional later:

- Streaming QLoRA/DPO updates.
- Classifier distillation.
- Bandit-based routing.

### 4.5 No massive infrastructure

The foundational PoC must run on:

- One Node.js process.
- SQLite or JSONL.
- One local or hosted small LM.
- Optional local embeddings.
- No distributed training.
- No vector database cluster.
- No custom GPU kernel work.

---

## 5. Proposed Architecture

```text
                      UNTRUSTED EXTERNAL STATE
                       messy JSON, email, text,
                       sensor payload, API event
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │   System-One Proposer    │
                    │                          │
                    │  task schema             │
                    │  prompt builder          │
                    │  experience retrieval    │
                    │  constrained provider    │
                    │  logprob extraction      │
                    │  calibration             │
                    └────────────┬─────────────┘
                                 │ SystemOneProposal
                                 ▼
                    ┌──────────────────────────┐
                    │      PerceptionGate      │
                    │                          │
                    │  schema validation       │
                    │  Narsese subset check    │
                    │  source quality          │
                    │  confidence mapping      │
                    │  contradiction screening │
                    └────────────┬─────────────┘
                                 │ admitted task / belief / goal / question
                                 ▼
                    ┌──────────────────────────┐
                    │    SeNARS Kernel         │
                    │                          │
                    │  event log               │
                    │  NAL reasoning           │
                    │  budget gate             │
                    │  reward gate             │
                    │  action gate             │
                    └────────────┬─────────────┘
                                 │ outcome / correction / reward
                                 ▼
                    ┌──────────────────────────┐
                    │   Experience Store       │
                    │                          │
                    │  request                 │
                    │  proposal                │
                    │  outcome                 │
                    │  correction              │
                    │  reward                  │
                    │  embedding / features    │
                    └────────────┬─────────────┘
                                 │ retrieval + calibration updates
                                 ▼
                    ┌──────────────────────────┐
                    │   System-One Proposer    │
                    │       improves online    │
                    └──────────────────────────┘
```

---

# 6. Foundational PoC

These are the required features for a realistic proof-of-concept.

The PoC should be implementable without fine-tuning, without distributed systems, and without replacing the existing SeNARS LM stack.

---

## 6.1 Foundational Capability Matrix

| Capability | Required for PoC | Notes |
|---|---:|---|
| Structured System-One request API | Yes | Typed request object |
| Restricted task schemas | Yes | Classification, extraction, routing, formalization |
| Constrained or strictly validated outputs | Yes | Prefer grammar/structured output |
| Narsese-subset output | Yes | Do not allow arbitrary Narsese initially |
| Confidence extraction | Yes | Logprobs preferred; verbalized confidence fallback |
| Calibration wrapper | Yes | Temperature/binning/Platt scaling |
| Experience store | Yes | SQLite/JSONL |
| Online prompt improvement | Yes | Retrieve corrected examples |
| Integration with PerceptionGate | Yes | Proposals remain untrusted |
| Event logging | Yes | All proposals/outcomes append-only |
| Budget enforcement | Yes | Latency/token/cost caps |
| Fallback path | Yes | Symbolic rules, slower LM, or human escalation |
| Evaluation harness | Yes | Golden tasks + regression metrics |
| Streaming QLoRA/DPO | No | Optional optimization |
| Custom parallel sampler | No | Optional optimization |
| Semantic cache | Recommended | Optional but useful |
| Distillation to XGBoost/MLP | No | Optional optimization |
| Multi-model bandit routing | No | Optional optimization |

---

## 6.2 Task Taxonomy

The PoC should support a small number of high-value System-One tasks.

### 6.2.1 `classify`

Assign one or more labels to an input.

Example:

```json
{
  "taskType": "classify",
  "input": {
    "text": "Yeah, sure, love being charged twice!!"
  },
  "schema": {
    "labels": ["billing_dispute", "refund_request", "feature_request", "spam"]
  }
}
```

Output:

```json
{
  "label": "billing_dispute",
  "calibratedProbability": 0.87
}
```

### 6.2.2 `extract`

Extract typed fields from unstructured input.

Example:

```json
{
  "taskType": "extract",
  "input": {
    "email": "I was charged twice on September 12 and I want my money back."
  },
  "schema": {
    "issue_type": ["billing", "technical", "account", "other"],
    "requested_action": ["refund", "explanation", "none"],
    "urgency": ["low", "medium", "high"]
  }
}
```

Output:

```json
{
  "issue_type": "billing",
  "requested_action": "refund",
  "urgency": "high",
  "calibratedProbability": 0.81
}
```

### 6.2.3 `route`

Decide where an event should be sent.

Example:

```json
{
  "taskType": "route",
  "input": {
    "message": "My payment failed but my bank says you charged me."
  },
  "routes": ["billing_agent", "support_agent", "fraud_agent", "ignore"]
}
```

Output:

```json
{
  "route": "billing_agent",
  "calibratedProbability": 0.78
}
```

### 6.2.4 `formalize`

Convert an observation into a restricted Narsese statement.

For the PoC, do not allow arbitrary Narsese. Use a restricted grammar.

Example:

```json
{
  "taskType": "formalize",
  "input": {
    "text": "The customer seems angry about a double charge."
  },
  "allowedForms": [
    "<subject --> predicate>",
    "<subject --> predicate>?",
    "<subject --> predicate>!"
  ]
}
```

Output:

```json
{
  "form": "inheritance",
  "subject": "customer",
  "predicate": "angry",
  "polarity": "belief",
  "calibratedProbability": 0.74
}
```

SeNARS converts this to:

```narsese
<customer --> angry>.
```

with an attached truth value.

---

## 6.3 Restricted Narsese Subset

The PoC should not ask the LM to generate arbitrary Narsese strings.

Instead, support a small formalization subset:

### Allowed forms

1. Inheritance belief:

```narsese
<subject --> predicate>.
```

2. Implication belief:

```narsese
<antecedent ==> consequent>.
```

3. Goal:

```narsese
<subject --> predicate>!
```

4. Question:

```narsese
<subject --> predicate>?
```

### Structured representation

```ts
type NarseseFormalization =
  | {
      form: "inheritance";
      subject: string;
      predicate: string;
      polarity: "belief" | "goal" | "question";
    }
  | {
      form: "implication";
      antecedent: string;
      consequent: string;
      polarity: "belief" | "goal" | "question";
    };
```

The System-One layer outputs the structured representation. SeNARS serializes it to canonical Narsese.

This gives most of the benefit of LM formalization while avoiding fragile free-text Narsese parsing.

---

## 6.4 Core TypeScript Interfaces

The following interfaces can be adapted to the SeNARS codebase.

```ts
export type SystemOneTaskType =
  | "classify"
  | "extract"
  | "route"
  | "formalize"
  | "score";

export interface SystemOneBudget {
  maxLatencyMs: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostUsd?: number;
}

export interface SystemOneContext {
  goals?: string[];
  beliefs?: string[];
  recentEvents?: string[];
  sourceQuality?: number;
}

export interface SystemOneRequest {
  requestId: string;
  taskType: SystemOneTaskType;
  input: unknown;
  schema: unknown; // Zod schema or JSON schema descriptor
  context?: SystemOneContext;
  budget: SystemOneBudget;
}

export interface SystemOneChoice {
  key: string;
  value: unknown;
  rawProbability?: number;
  calibratedProbability: number;
  explanation?: string;
}

export interface SystemOneFormalization {
  form: "inheritance" | "implication";
  subject?: string;
  predicate?: string;
  antecedent?: string;
  consequent?: string;
  polarity: "belief" | "goal" | "question";
}

export interface SystemOneProposal {
  proposalId: string;
  requestId: string;
  taskType: SystemOneTaskType;
  selectedChoiceKey: string;
  choices: SystemOneChoice[];
  formalization?: SystemOneFormalization;
  latencyMs: number;
  modelId: string;
  promptVersion: string;
  calibratorVersion: string;
  retrievedExperienceIds: string[];
  cacheHit: boolean;
  provenance: Record<string, unknown>;
}

export type SystemOneOutcomeKind =
  | "accepted"
  | "rejected"
  | "corrected"
  | "timeout"
  | "fallback"
  | "error";

export interface SystemOneOutcome {
  proposalId: string;
  requestId: string;
  outcome: SystemOneOutcomeKind;
  correctedChoice?: SystemOneChoice;
  correctedFormalization?: SystemOneFormalization;
  reward: number; // -1..1
  reason?: string;
  timestamp: string;
}

export interface ExperienceRecord {
  id: string;
  createdAt: string;
  taskType: SystemOneTaskType;
  redactedInput: unknown;
  requestSummary: string;
  proposal?: SystemOneProposal;
  outcome: SystemOneOutcome;
  embedding?: number[];
  tags?: string[];
}
```

---

## 6.5 System-One Provider Interface

The provider abstraction isolates SeNARS from model specifics.

```ts
export interface SystemOneProvider {
  id: string;

  propose(
    request: SystemOneRequest,
    prompt: string,
    options: {
      grammar?: string;
      jsonSchema?: unknown;
      logprobs?: boolean;
      temperature?: number;
    }
  ): Promise<{
    raw: unknown;
    latencyMs: number;
    logprobs?: Record<string, number>;
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
  }>;
}
```

### Required provider modes

For PoC, support at least:

1. **Mock provider**
   - Deterministic.
   - Used for tests.
   - Can simulate invalid output, timeout, low confidence, correction.

2. **Local constrained provider**
   - Prefer `llama.cpp` / GBNF grammar if already present in SeNARS.
   - Should support JSON or grammar-constrained completion.

3. **Hosted structured-output provider**
   - Optional but useful.
   - Use provider JSON schema mode where available.

---

## 6.6 Type-Safe Output Strategy

The PoC should use a layered safety model.

### Level 1: Constrained generation

Preferred when available.

- GBNF grammar.
- JSON schema mode.
- Regex-constrained decoding.
- Enum-only fields.

This gives the strongest Jev-like guarantee.

### Level 2: Strict validation

If constrained generation is unavailable:

- Validate with Zod.
- Reject invalid outputs.
- Do not attempt aggressive repair inside the System-One layer.
- Optionally retry once with a stricter prompt.
- If retry fails, fall back.

### Level 3: Restricted Narsese serialization

The LM never emits raw Narsese in the PoC.

It emits structured objects. SeNARS serializes them.

This avoids:

- Malformed parentheses.
- Invalid operators.
- Bad term names.
- Accidental goal/belief confusion.
- Prompt-injected symbolic commands.

---

## 6.7 Calibration

Calibration is required for the PoC, but it should be simple.

### Inputs

For each decision, collect:

```ts
{
  predictedProbability: number;
  outcome: 0 | 1;
}
```

Where `outcome = 1` means the proposal was later accepted/verified, and `0` means rejected/corrected.

### PoC calibration methods

Use one of:

1. **Temperature scaling**
   - Simple.
   - Stable.
   - Good default.

2. **Binned histogram calibration**
   - Easy to implement.
   - Interpretable.
   - Works with small data.

3. **Platt scaling**
   - Optional if enough validated samples exist.

### Calibration update policy

Update calibration when:

- At least `N` verified samples exist. Recommended: `N = 30`.
- Or when drift is detected.
- Or after a fixed number of outcomes, e.g. every 100 outcomes.

### Calibration versioning

Every proposal must record:

```ts
calibratorVersion: string;
```

This preserves provenance and replayability.

### Mapping to NAL truth

Do not blindly map calibrated probability to both frequency and confidence.

Recommended PoC mapping:

```ts
function toNalTruth(
  calibratedProbability: number,
  sourceQuality: number,
  calibrationMaturity: number
) {
  const frequency = clamp(calibratedProbability, 0, 1);

  const confidence = clamp(
    sourceQuality * (0.5 + 0.5 * calibrationMaturity),
    0.05,
    0.95
  );

  return { f: frequency, c: confidence };
}
```

Where:

```ts
calibrationMaturity = min(1, verifiedSamples / 200);
```

This keeps frequency and confidence conceptually separate.

---

## 6.8 Experience Store

The experience store is the foundation of online experiential learning.

It should be local and simple.

### Storage options

Preferred PoC storage:

- SQLite.

Fallback:

- JSONL files.

### Stored data

Each record contains:

- Task type.
- Redacted input.
- Compact request summary.
- Proposal.
- Outcome.
- Correction.
- Reward.
- Timestamp.
- Retrieved experience IDs.
- Prompt version.
- Calibrator version.
- Optional embedding.

### Privacy requirement

Before storage:

- Remove secrets.
- Remove credentials.
- Remove obvious PII if configured.
- Store only the fields needed for learning.

---

## 6.9 Online Experiential Learning Without Fine-Tuning

The foundational PoC should achieve online improvement using non-parametric learning.

This is realistic and low-infrastructure.

### Learning loop

1. System-One proposes a structured decision.
2. SeNARS admits, rejects, corrects, or escalates it.
3. Outcome is written to the event log.
4. Experience store records the outcome.
5. Future similar requests retrieve relevant examples.
6. Prompt builder includes corrected examples as few-shot context.
7. Calibration updates based on verified outcomes.
8. Proposal quality improves without weight updates.

### Retrieval strategy

For PoC, use one of:

1. Existing semantic cache embeddings, if available.
2. Simple local embedding model.
3. BM25/keyword retrieval.
4. Hash-based exact/near-duplicate lookup.

The PoC does not require a vector database service.

### Prompt builder behavior

The prompt builder should include:

- Task schema.
- Output constraints.
- Current input.
- Relevant retrieved examples.
- Corrected examples if available.
- Instruction to output calibrated confidence.
- Instruction to prefer `unknown` or low confidence when uncertain.

### Example prompt skeleton

```text
You are a fast System-One perception module for SeNARS.

Task: classify
Output must be valid JSON matching the schema.
Do not output free text.
Do not invent fields.
If uncertain, choose the lowest-confidence valid option.

Schema:
{schema}

Current input:
{redacted_input}

Relevant past corrections:
{retrieved_examples}

Return JSON only.
```

---

## 6.10 Integration with SeNARS Gates

### PerceptionGate

The `PerceptionGate` should receive System-One proposals as provisional input.

Responsibilities:

- Validate schema.
- Validate restricted Narsese form.
- Map source quality to confidence.
- Reject malformed proposals.
- Reject contradictions when shadow validation is enabled.
- Admit as belief/goal/question/task only after validation.

### RewardGate

The `RewardGate` should not allow System-One rewards to mutate factual truth directly.

It may update:

- Calibration data.
- Prompt policy.
- Retrieval weights.
- Provider routing weights.
- Attention/policy metadata.

It must not directly overwrite:

- Belief truth values.
- Epistemic state.
- Goal priorities.
- Approval policy.
- Sandbox configuration.

### BudgetGate

Every System-One request must be budgeted.

Required budget fields:

- `maxLatencyMs`
- `maxInputTokens`
- `maxOutputTokens`
- Optional `maxCostUsd`

Termination reasons should include:

- `system-one-timeout`
- `system-one-token-budget`
- `system-one-cost-budget`
- `system-one-schema-invalid`
- `system-one-provider-error`

### ActionGate

If System-One proposes an action or tool call, it still passes through normal action authorization.

System-One does not get special autonomy.

---

## 6.11 Event Sourcing

All System-One activity should be event-sourced.

Recommended event types:

```text
system_one.request.created
system_one.prompt.built
system_one.provider.called
system_one.proposal.received
system_one.proposal.invalid
system_one.proposal.accepted
system_one.proposal.rejected
system_one.proposal.corrected
system_one.outcome.recorded
system_one.calibration.updated
system_one.experience.added
system_one.fallback.triggered
```

Each event should include:

- Request ID.
- Proposal ID.
- Task type.
- Model ID.
- Prompt version.
- Calibrator version.
- Budget consumption.
- Outcome.
- Timestamp.

This preserves SeNARS’s provenance guarantees.

---

## 6.12 Fallback Policy

The PoC must define fallback behavior.

### Recommended fallback ladder

1. **Retry once with stricter schema prompt**
   - Only if latency budget remains.

2. **Use symbolic/default rule**
   - Example: default route, unknown intent, low-confidence belief.

3. **Escalate to slower System-Two LM**
   - Use only when task value justifies cost.

4. **Request human review**
   - For high-risk actions or repeated failures.

### Confidence thresholds

Recommended defaults:

| Condition | Behavior |
|---|---|
| `calibratedProbability >= 0.8` | Admit normally |
| `0.6 <= calibratedProbability < 0.8` | Admit as provisional/low-weight belief |
| `calibratedProbability < 0.6` | Escalate, fallback, or mark uncertain |

Thresholds should be configurable per task.

---

## 6.13 Evaluation Harness

A PoC is not complete without evaluation.

### Golden task set

Create a small golden set:

- 20 classification examples.
- 20 extraction examples.
- 20 routing examples.
- 20 formalization examples.
- 10 adversarial prompt-injection examples.
- 10 ambiguous/sarcastic examples.

### Metrics

| Metric | Target for PoC |
|---|---:|
| Accepted outputs schema-valid | 100% |
| Invalid outputs admitted to kernel | 0 |
| Deterministic replay works | Yes |
| Latency p50 | Task-dependent, ideally < 500ms for small tasks |
| Latency p95 | Preferably < 2s for small local model |
| Calibration error | Better than raw confidence |
| Correction rate | Should decrease after experience retrieval |
| Fallback correctness | Invalid/uncertain cases do not corrupt kernel |

Latency targets are aspirational for the PoC and depend heavily on hardware/provider. The hard requirement is budget enforcement, not absolute speed.

---

# 7. Optional / Optimizing Features

These features are valuable but should not block the foundational PoC.

They can be added after the core loop is stable.

---

## 7.1 Optional Performance Optimizations

### 7.1.1 Semantic cache

Before calling the model:

- Embed the input.
- Search recent verified experiences.
- If similarity is high, return cached decision.

Benefits:

- Lower latency.
- Lower cost.
- More consistent behavior.

Risk:

- Stale decisions.
- Overconfident cache hits.

Mitigation:

- Cache only verified outcomes.
- Include schema/task/version in cache key.
- Use conservative similarity threshold.

### 7.1.2 Parallel label scoring

For classification/routing tasks, avoid generating long answers.

Instead:

- Score each allowed label via logprobs.
- Select the highest calibrated probability.
- Return all label probabilities.

This is closer to Jev’s parallel decision style.

### 7.1.3 Tiny classifier head

For repeated tasks:

- Embed input.
- Train an MLP/XGBoost/LogisticRegression model on verified examples.
- Use it instead of the LM when confidence is high.

Benefits:

- Extremely fast.
- Cheap.
- Stable.

Use only after enough verified data exists.

### 7.1.4 Provider router

Route tasks among:

- Cache.
- Tiny classifier.
- Local SLM.
- Hosted SLM.
- Slow frontier LM.

Router can be simple:

- Task type.
- Latency budget.
- Confidence requirement.
- Cost budget.
- Historical correction rate.

---

## 7.2 Optional Learning Optimizations

### 7.2.1 Streaming QLoRA/DPO

Once enough corrected examples exist, perform asynchronous micro-batch updates.

Requirements:

- Separate training process.
- Replay buffer.
- Evaluation before adapter activation.
- Versioned adapters.
- Rollback mechanism.

This is not required for PoC.

### 7.2.2 Active learning

When uncertainty is high:

- Ask human.
- Store answer.
- Use as high-value training example.

This is especially useful for ambiguous or sarcastic inputs.

### 7.2.3 Calibration drift detection

Track:

- Expected calibration error.
- Correction rate.
- Confidence distribution.
- Task-specific accuracy.

Trigger recalibration or fallback when drift exceeds threshold.

### 7.2.4 Experience replay pruning

Prevent unbounded growth:

- Keep recent examples.
- Keep high-reward examples.
- Keep rare failure examples.
- Discard redundant examples.

---

## 7.3 Optional Safety Optimizations

### 7.3.1 Prompt-injection screening

System-One inputs may contain adversarial text.

Mitigations:

- Treat input as data, not instructions.
- Strip control sequences.
- Limit input length.
- Reject outputs that attempt to change SeNARS policy.
- Validate all formalizations against allowed subset.

### 7.3.2 Shadow validation

Before admitting formalized beliefs:

- Check against current high-confidence beliefs.
- If contradiction is severe, mark proposal as suspicious.
- Optionally route to slower verifier.

This aligns with existing SeNARS shadow validation concepts.

### 7.3.3 Red-team suite

Include tests for:

- Prompt injection.
- Schema escape attempts.
- Invalid Narsese generation.
- Goal/belief confusion.
- Overconfident hallucination.
- PII leakage into experience store.

---

# 8. Proof-of-Concept Implementation Plan

## Phase 0: Skeleton

Goal: Define types and mock provider.

Tasks:

- Add System-One types.
- Add mock provider.
- Add Zod schemas for tasks.
- Add basic proposal validation.
- Add unit tests.

Exit criteria:

- Mock provider returns valid/invalid proposals.
- Validator rejects invalid proposals.
- Tests pass.

---

## Phase 1: Provider and Prompt Builder

Goal: Produce structured proposals from a real or local provider.

Tasks:

- Add provider adapter.
- Add prompt builder.
- Add constrained output mode where available.
- Add latency/token budget enforcement.
- Add fallback on timeout/error.

Exit criteria:

- System-One can classify/extract/route/formalize simple inputs.
- Invalid outputs are rejected.
- Budget violations are recorded.

---

## Phase 2: PerceptionGate Integration

Goal: Safely admit proposals into SeNARS.

Tasks:

- Map System-One output to provisional tasks/beliefs/goals/questions.
- Map calibrated probability to NAL truth values.
- Record source quality.
- Append events to event log.
- Ensure no direct truth mutation.

Exit criteria:

- Accepted proposals appear as typed cognitive events.
- Rejected proposals never enter reasoning state.
- Replay works.

---

## Phase 3: Experience Store and Online Prompting

Goal: Enable non-parametric online learning.

Tasks:

- Add SQLite/JSONL experience store.
- Store outcomes and corrections.
- Add retrieval for similar examples.
- Add few-shot prompt injection.
- Add redaction.

Exit criteria:

- Corrections are stored.
- Similar future inputs retrieve relevant corrections.
- Prompt includes retrieved examples.

---

## Phase 4: Calibration and Evaluation

Goal: Make confidence meaningful.

Tasks:

- Collect verified outcomes.
- Add calibration wrapper.
- Add calibration versioning.
- Add golden eval set.
- Add metrics.

Exit criteria:

- Proposal includes calibrated probability.
- Calibration version is logged.
- Eval harness reports schema validity, latency, correction rate, calibration error.

---

# 9. Suggested File Layout

This can be adapted to the existing SeNARS monorepo.

```text
packages/nar/src/lm/system-one/
  index.ts
  types.ts
  schemas.ts
  provider.ts
  mock-provider.ts
  llamacpp-provider.ts
  hosted-provider.ts
  prompt-builder.ts
  calibrator.ts
  experience-store.ts
  retriever.ts
  gate-adapter.ts
  metrics.ts

tests/nar/system-one/
  schemas.test.ts
  calibrator.test.ts
  experience-store.test.ts
  prompt-builder.test.ts
  gate-integration.test.ts
  fallback.test.ts
  adversarial.test.ts

docs/tech/
  system-one.md
```

---

# 10. Configuration Example

```json
{
  "systemOne": {
    "enabled": true,
    "provider": "llamacpp",
    "modelId": "qwen2.5-1.5b-instruct-q4",
    "learningMode": "memory-prompt",
    "weightUpdate": false,
    "constraints": {
      "requireStructuredOutput": true,
      "allowRawNarsese": false
    },
    "budget": {
      "maxLatencyMs": 800,
      "maxInputTokens": 1024,
      "maxOutputTokens": 256
    },
    "confidence": {
      "acceptThreshold": 0.8,
      "provisionalThreshold": 0.6,
      "escalateBelow": 0.6
    },
    "calibration": {
      "method": "temperature",
      "minSamples": 30,
      "updateIntervalOutcomes": 100
    },
    "experience": {
      "store": "sqlite",
      "path": ".cache/system-one-experience.db",
      "maxRecords": 20000,
      "redactPii": true
    },
    "retrieval": {
      "enabled": true,
      "maxExamples": 3,
      "method": "embedding-or-bm25"
    },
    "fallback": {
      "retryOnce": true,
      "useSymbolicRules": true,
      "escalateToSlowModel": false,
      "requireHumanReviewForHighRisk": true
    }
  }
}
```

---

# 11. Acceptance Criteria for the Foundational PoC

The PoC is successful if all of the following are true.

## Functional

1. SeNARS can call:

```ts
systemOne.propose(request)
```

and receive a structured proposal.

2. For at least one provider mode:
   - Valid outputs are schema-conforming.
   - Invalid outputs are rejected.
   - No invalid output is admitted to the kernel.

3. The System-One layer can handle at least:
   - `classify`
   - `extract`
   - `route`
   - `formalize`

4. Formalization outputs use the restricted Narsese subset only.

5. Proposals include:
   - Raw confidence, if available.
   - Calibrated probability.
   - Model ID.
   - Prompt version.
   - Calibrator version.
   - Retrieved experience IDs.
   - Latency.
   - Budget usage.

## Cognitive Integration

6. All proposals pass through `PerceptionGate`.

7. Accepted proposals are converted into typed SeNARS tasks/beliefs/goals/questions.

8. System-One does not directly mutate:
   - Beliefs.
   - Goals.
   - Reward functions.
   - Approval policy.
   - Sandbox configuration.

9. All System-One events are append-only and replayable.

## Learning

10. When a proposal is corrected, an experience record is stored.

11. When a similar request occurs, relevant corrections can be retrieved.

12. The prompt builder includes retrieved corrections.

13. Calibration updates after enough verified outcomes.

## Safety

14. Budget exhaustion triggers fallback and is logged.

15. Provider timeout triggers fallback and is logged.

16. Invalid schema triggers rejection and is logged.

17. Prompt-injection attempts do not produce kernel policy changes.

18. Experience storage redacts configured sensitive fields.

## Evaluation

19. A golden task suite exists.

20. The eval suite reports:
   - Schema validity.
   - Latency.
   - Correction rate.
   - Calibration error.
   - Fallback rate.

---

# 12. Explicit Non-Goals for the PoC

To keep the proof-of-concept realistic, the following are explicitly out of scope initially:

1. Building a custom parallel-sampling transformer.
2. Pretraining a model.
3. Full RLCD-style reinforcement learning at scale.
4. Arbitrary Narsese generation.
5. Autonomous self-modification of SeNARS kernel gates.
6. Distributed training.
7. Multi-node vector database infrastructure.
8. Real-time fine-tuning on every request.
9. Perfect calibration.
10. Human-level interpretation of all sarcasm/ambiguity.

---

# 13. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Provider cannot guarantee structured output | Invalid proposals | Strict validation + retry + fallback |
| Calibration data is sparse | Bad confidence | Use conservative confidence and provisional admission |
| Experience retrieval poisons prompts | Degraded behavior | Only retrieve verified/corrected examples; cap examples |
| Prompt injection | Unsafe formalizations | Treat input as data; validate outputs; no raw Narsese |
| Latency too high | Blocks cognitive loop | Budgets, timeout, fallback, caching |
| PII stored in experience store | Privacy issue | Redaction, retention limits, local storage |
| Model drift | Degraded accuracy | Eval harness, calibration drift detection |
| Overtrust in System-One | Bad beliefs enter kernel | Source-quality limits, thresholding, shadow validation |
| Online learning becomes unstable | Unpredictable behavior | PoC uses non-parametric learning first |

---

# 14. Recommended Definition of Done

A minimal but complete PoC is done when:

1. A `SystemOneProposer` module exists.
2. It supports at least one real provider and one mock provider.
3. It produces schema-valid structured proposals.
4. It integrates with `PerceptionGate`.
5. It logs all proposals/outcomes to the event log.
6. It stores corrections in an experience store.
7. It retrieves relevant corrections for future prompts.
8. It calibrates probabilities using verified outcomes.
9. It respects budgets and fallback rules.
10. It passes unit, integration, and golden-set evaluation tests.

---

# 15. Final Scoped Recommendation

For the first implementable version, build exactly this:

## Foundational PoC

- Small LM provider.
- Restricted task schemas.
- Structured JSON output.
- Restricted Narsese formalization subset.
- Strict Zod validation.
- Simple calibration.
- SQLite experience store.
- Retrieval-augmented few-shot prompting.
- PerceptionGate integration.
- Event-sourced provenance.
- Budgeted fallback behavior.
- Evaluation harness.

## Optional Later

- Semantic cache.
- Parallel logprob scoring.
- Classifier distillation.
- Streaming QLoRA/DPO.
- Multi-model routing.
- Active learning.
- Drift detection.
- Shadow validation expansion.

This gives SeNARS a realistic, low-infrastructure path to Jev-like System-One behavior while preserving the symbolic kernel’s safety, auditability, and epistemic discipline.

