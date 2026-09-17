Verification result: **not yet — directionally right, but incomplete as stated.**

The previous “JSON semantic graph” idea is the right move away from asking small LLMs to emit raw Narsese. But if that graph is treated as the *only* intermediate representation, it will fail the three criteria:

| Criterion | Verdict | Reason |
|---|---:|---|
| **Complete** | ❌ | A shallow semantic graph does not by itself cover full NAL: variables/scoping, images, products, sets, term-level conjunctions, temporal operators, goals/operations, truth/desire/stamps, and lossless round-tripping. |
| **Effective** | ⚠️ | It can be effective for small models, but only if the schema is constrained, candidate-based, and model-adaptive. A too-rich graph schema will overwhelm a 0.8B–2B model. |
| **Efficient** | ⚠️ | JSON graphs can become token-heavy and structurally redundant. Efficiency requires bounded graphs, node sharing, canonical hashing, and strict output budgets. |

The corrected design is:

> **JSON is sufficient as a boundary format, but not as a single flat semantic schema. You need two layers: a lossless canonical NAL term DAG, and a bounded semantic frame graph for LLM extraction.**

---

## 1. Complete: what the previous IR misses

A full NAL intermediate representation must cover at least these patterns:

### Missing term patterns

| NAL feature | Example | Why a simple semantic graph may miss it |
|---|---|---|
| Atomic terms | `cat` | Easy. |
| Variables | `?x`, `#x`, `$x` | Need binding, scope, and variable-kind distinction. |
| Inheritance | `(cat --> animal)` | Easy. |
| Similarity | `(cat <-> dog)` | Needs symmetric relation, not just subject/predicate. |
| Instance / property / instance-property | `A {-- B`, `A --] B`, `A {-] B` | Need explicit copula kinds. |
| Implication / equivalence | `(A ==> B)`, `(A <=> B)` | Need higher-order term composition. |
| Temporal implication | predictive / retrospective / concurrent | Need tense, order, and event linkage. |
| Conjunction / disjunction / negation | `(A & B)`, `(A | B)`, `(- A)` | These are term constructors, not merely sentence contexts. |
| Extensional/intensional sets | `{A B}`, `[A B]` | Need set literal constructors. |
| Products | `(*, A, B)` | Need ordered n-ary argument structure. |
| Images | `(/, R, _, B)`, `(\, R, A, _)` | Need role position and hole/placeholders. |
| Sequences / parallel events | `(A; B)`, parallel composition | Need temporal ordering and event structure. |
| Operations / goals | `^op(args)!` | Need operator terms, desire values, achievement context. |
| Truth/desire/stamp | `%f;c%`, desire values, evidence stamps | Needed for kernel admission, revision, and evidence independence. |

So a semantic graph that only says:

```json
{ "subject": "server", "predicate": "down" }
```

is not complete.

Even this is not enough:

```json
{
  "subject": "cat",
  "predicate": "chase",
  "object": "mouse"
}
```

Because NAL may need to express:

```narsese
(*, cat, mouse) --> chase
```

or:

```narsese
(/, chase, _, mouse) --> cat
```

or:

```narsese
((?c --> cat) && (?m --> mouse) && ((* , ?c, ?m) --> chase)) =/> (?m --> running)
```

Those require products, images, variables, conjunction, temporal implication, and scoped quantification.

---

## 2. The corrected architecture: two JSON layers

Use JSON, but split responsibilities.

### Layer A — Semantic Frame Graph

This is the LLM-facing representation.

It should be close to natural-language semantics: entities, events, roles, modality, polarity, quantification, temporal relations, goals, questions.

It does **not** need to be losslessly equivalent to every NAL term. Its job is to be easy for a small model to produce.

### Layer B — Canonical NAL Term DAG

This is the trusted internal representation.

It is a lossless JSON encoding of Narsese terms and tasks. It covers every term constructor supported by SeNARS.

The pipeline becomes:

```text
NL text
  ↓ LLM, constrained JSON
Semantic Frame Graph
  ↓ deterministic compiler
Canonical NAL Term DAG
  ↓ printer / parser / registry
Narsese text / JSON / internal Term AST
```

And in reverse:

```text
NAL Term AST
  ↓ deterministic projector
Semantic Frame Graph
  ↓ LLM verbalization
NL text
```

For exact internal exchange:

```text
NAL Term AST <-> Canonical Term JSON
```

That path must be lossless.

For natural-language exchange:

```text
NL <-> Semantic Frame Graph <-> NAL Term AST
```

That path is probabilistic and may be lossy, but it is auditable.

---

## 3. JSON sufficiency

### JSON is sufficient as a syntax

JSON can encode trees, DAGs, node references, arrays, enums, metadata, candidates, and provenance. With Zod validation, it is also a good untrusted-boundary format.

### JSON is not sufficient as a flat triple schema

This is not enough:

```json
{
  "subject": "cat",
  "predicate": "animal"
}
```

### JSON is sufficient if it encodes either:

1. **A canonical NAL term DAG**, for lossless internal representation.
2. **A bounded semantic frame graph**, for LLM extraction.

The mistake would be collapsing those two responsibilities into one schema.

---

# 4. Layer A: Semantic Frame Graph

This should be the representation given to the LLM.

A compact version:

```typescript
type Quantifier =
  | 'specific'
  | 'all'
  | 'some'
  | 'none'
  | 'query';

type Modality =
  | 'actual'
  | 'possible'
  | 'necessary'
  | 'desired'
  | 'obligatory'
  | 'predicted'
  | 'reported';

type Polarity =
  | 'positive'
  | 'negative'
  | 'unknown';

interface FrameEntity {
  id: string;
  name: string;
  kind?: string;
  quantifier?: Quantifier;
  set?: 'extensional' | 'intensional';
  members?: string[];
}

interface FrameArg {
  role: string;
  ref: string;
  order: number;
}

interface Frame {
  id: string;
  name: string;
  kind: 'entity' | 'event' | 'state' | 'relation' | 'property' | 'operation';
  args?: FrameArg[];
  polarity?: Polarity;
  modality?: Modality;
  tense?: 'past' | 'present' | 'future' | 'eternal';
  truthHint?: {
    frequency?: number;
    confidence?: number;
  };
}

interface FrameContext {
  id: string;
  kind:
    | 'condition'
    | 'unless'
    | 'cause'
    | 'before'
    | 'after'
    | 'and'
    | 'or'
    | 'not'
    | 'goal'
    | 'question';
  args: string[];
  modality?: Modality;
  tense?: 'past' | 'present' | 'future' | 'eternal';
}

interface SemanticFrameCandidate {
  entities: FrameEntity[];
  frames: Frame[];
  contexts: FrameContext[];
  ambiguityFlags: string[];
  sourceSpans?: string[];
  confidence?: number;
}

interface SemanticFrameBatch {
  candidates: SemanticFrameCandidate[];
}
```

This is much better than subject/predicate triples because it supports:

- n-ary relations;
- events;
- states;
- operations;
- role order;
- quantifiers;
- modality;
- polarity;
- temporal contexts;
- goals;
- questions;
- multiple candidates;
- ambiguity flags.

---

## 5. Layer B: Canonical NAL Term DAG

This layer must be complete.

A minimal but complete JSON shape:

```typescript
type TermRef = string;

type VariableKind =
  | 'independent' // ?x
  | 'dependent'   // #x
  | 'query';      // $x

type StatementKind =
  | 'inheritance'
  | 'similarity'
  | 'instance'
  | 'property'
  | 'instanceProperty'
  | 'implication'
  | 'equivalence'
  | 'predictiveImplication'
  | 'retrospectiveImplication'
  | 'concurrentImplication';

type CompoundKind =
  | 'conjunction'
  | 'disjunction'
  | 'negation'
  | 'extensionalIntersection'
  | 'intensionalIntersection'
  | 'extensionalUnion'
  | 'intensionalUnion'
  | 'extensionalDifference'
  | 'intensionalDifference'
  | 'sequence'
  | 'parallel';

type TermNode =
  | {
      t: 'atom';
      name: string;
    }
  | {
      t: 'variable';
      kind: VariableKind;
      name: string;
    }
  | {
      t: 'set';
      kind: 'extensional' | 'intensional';
      members: TermRef[];
    }
  | {
      t: 'product';
      args: TermRef[];
    }
  | {
      t: 'image';
      kind: 'extensional' | 'intensional';
      relation: TermRef;
      args: Array<TermRef | { t: 'hole'; position: number }>;
    }
  | {
      t: 'statement';
      kind: StatementKind;
      subject: TermRef;
      predicate: TermRef;
    }
  | {
      t: 'compound';
      kind: CompoundKind;
      args: TermRef[];
    }
  | {
      t: 'operation';
      operator: string;
      args: TermRef[];
    };

interface CanonicalTermGraph {
  nodes: Record<TermRef, TermNode>;
  root: TermRef;
}
```

Then the task envelope:

```typescript
type TaskKind =
  | 'belief'
  | 'goal'
  | 'question'
  | 'quest';

interface CanonicalTaskJson {
  task: TaskKind;
  term: CanonicalTermGraph;

  truth?: {
    frequency: number;
    confidence: number;
  };

  desire?: {
    desire: number;
    confidence: number;
  };

  tense?: 'past' | 'present' | 'future' | 'eternal';

  stamp?: {
    evidenceIds: string[];
    sourceQuality:
      | 'PRIMARY'
      | 'SECONDARY'
      | 'GENERAL'
      | 'TERTIARY'
      | 'LLM_PRIOR'
      | 'PEER_AGENT';
    createdAt?: string;
  };

  provenance?: {
    sourceText?: string;
    sourceSpans?: string[];
    llmCandidateId?: string;
    ambiguityFlags?: string[];
  };
}
```

This layer is what gives **complete NAL expressivity**.

---

# 6. Why this makes the system effective

The small model should not be asked:

> “Produce full Narsese with products, images, variables, truth values, and temporal implications.”

It should be asked:

> “Extract entities, frames, roles, quantifiers, modality, and contexts.”

That is a much more model-native task.

For example:

```text
If a cat chases a mouse, the mouse runs.
```

The small model can plausibly produce:

```json
{
  "candidates": [
    {
      "entities": [
        {
          "id": "c",
          "name": "cat",
          "quantifier": "all"
        },
        {
          "id": "m",
          "name": "mouse",
          "quantifier": "all"
        }
      ],
      "frames": [
        {
          "id": "chase",
          "name": "chase",
          "kind": "event",
          "args": [
            { "role": "agent", "ref": "c", "order": 0 },
            { "role": "patient", "ref": "m", "order": 1 }
          ]
        },
        {
          "id": "run",
          "name": "run",
          "kind": "event",
          "args": [
            { "role": "agent", "ref": "m", "order": 0 }
          ]
        }
      ],
      "contexts": [
        {
          "id": "cond",
          "kind": "condition",
          "args": ["chase", "run"],
          "tense": "future"
        }
      ],
      "ambiguityFlags": []
    }
  ]
}
```

Then the deterministic compiler can produce the appropriate NAL term, for example conceptually:

```narsese
((?c --> cat) && (?m --> mouse) && ((* , ?c, ?m) --> chase)) =/> (?m --> running)
```

The exact surface syntax depends on SeNARS’s canonical Narsese grammar, but the important point is that the LLM never had to invent the product, variable scope, or temporal implication syntax.

---

## 7. Example: images and products

Natural language:

```text
John is the father of Mary.
```

Frame representation:

```json
{
  "entities": [
    { "id": "j", "name": "John", "quantifier": "specific" },
    { "id": "m", "name": "Mary", "quantifier": "specific" }
  ],
  "frames": [
    {
      "id": "f",
      "name": "father",
      "kind": "relation",
      "args": [
        { "role": "holder", "ref": "j", "order": 0 },
        { "role": "target", "ref": "m", "order": 1 }
      ]
    }
  ],
  "contexts": [],
  "ambiguityFlags": []
}
```

Compiler choices:

As a product:

```narsese
(*, John, Mary) --> father
```

As an image, if the query is “Who is the father of Mary?”:

```narsese
(/, father, _, Mary) --> ?x
```

Or if the query is “John is what with respect to Mary?”:

```narsese
(\, father, John, _) --> ?y
```

The image syntax is hard for small models. The role graph is much easier.

So the compiler chooses the image/product form based on:

- frame role order;
- query target;
- focus;
- argument position;
- desired canonicalization policy.

---

## 8. Example: goals and operations

Natural language:

```text
Take the system offline.
```

Frame:

```json
{
  "entities": [
    {
      "id": "s",
      "name": "system",
      "quantifier": "specific"
    }
  ],
  "frames": [
    {
      "id": "offline_state",
      "name": "offline",
      "kind": "state",
      "args": [
        { "role": "theme", "ref": "s", "order": 0 }
      ],
      "modality": "desired"
    }
  ],
  "contexts": [
    {
      "id": "goal",
      "kind": "goal",
      "args": ["offline_state"]
    }
  ],
  "ambiguityFlags": []
}
```

Compiler can produce either:

```narsese
(system --> offline)!
```

or, if an operation is available:

```narsese
(^take_offline, system)!
```

This fixes the bare-term goal problem. The LLM does not need to know whether the target should be a bare term, a statement, an operation, or a wrapped goal. The compiler decides.

---

# 9. Efficient: constraints required

JSON graphs can become expensive. To keep this efficient under AIKR:

### LLM-side constraints

```typescript
interface FrameExtractionLimits {
  maxCandidates: number;
  maxEntitiesPerCandidate: number;
  maxFramesPerCandidate: number;
  maxContextsPerCandidate: number;
  maxArgsPerFrame: number;
  maxOutputTokens: number;
  maxRetries: number;
}
```

Recommended defaults for small models:

```typescript
{
  maxCandidates: 2,
  maxEntitiesPerCandidate: 12,
  maxFramesPerCandidate: 12,
  maxContextsPerCandidate: 6,
  maxArgsPerFrame: 4,
  maxOutputTokens: 512,
  maxRetries: 1
}
```

For larger models, these can increase.

### Compiler-side constraints

The deterministic compiler should enforce:

```typescript
interface CompileLimits {
  maxTermDepth: number;
  maxTermNodes: number;
  maxVariables: number;
  maxSetMembers: number;
  maxProductArity: number;
  maxImageArity: number;
}
```

If limits are exceeded, do not crash. Emit:

- a partial term;
- a question task;
- a low-confidence candidate;
- or a `formalization-failed` event.

This is AIKR-consistent.

---

# 10. Translation registry

For omnidirectionality, do not hardcode one pipeline. Register translation edges.

```typescript
type Representation =
  | 'nl'
  | 'semantic-frame-json'
  | 'canonical-term-json'
  | 'nal-ast'
  | 'narsese-text'
  | 'goal-text'
  | 'question-text';

type TranslationMode =
  | 'exact'
  | 'lossless'
  | 'probabilistic'
  | 'lossy-semantic';

interface TranslationEdge {
  from: Representation;
  to: Representation;
  mode: TranslationMode;
  requiresLM: boolean;
  minModelTier?: 'tiny' | 'small' | 'medium' | 'large';
  budget: {
    maxTokens?: number;
    maxLatencyMs?: number;
  };
  translate: (input: unknown, ctx: TranslationContext) => Promise<TranslationResult>;
}
```

Example edges:

| From | To | Mode | LM required? |
|---|---|---|---:|
| `nl` | `semantic-frame-json` | probabilistic | yes |
| `semantic-frame-json` | `nal-ast` | deterministic | no |
| `nal-ast` | `canonical-term-json` | lossless | no |
| `canonical-term-json` | `nal-ast` | lossless | no |
| `nal-ast` | `narsese-text` | lossless | no |
| `narsese-text` | `nal-ast` | lossless | no |
| `nal-ast` | `semantic-frame-json` | lossy-semantic | no |
| `semantic-frame-json` | `nl` | probabilistic | yes |
| `nal-ast` | `goal-text` | deterministic | no |
| `goal-text` | `nal-ast` | deterministic/probabilistic | maybe |

Path selection should consider:

- resource budget;
- model tier;
- required fidelity;
- latency;
- provenance requirements;
- whether the task is belief, goal, question, or quest.

For example:

```text
nl -> nal-ast
```

can resolve as:

```text
nl -> semantic-frame-json -> nal-ast
```

while:

```text
canonical-term-json -> nal-ast
```

is direct and lossless.

---

# 11. Model-size policy

This is where we find the minimum viable model honestly.

Do not ask:

> “What is the smallest model that can output Narsese?”

Ask:

> “What is the smallest model that can reliably extract semantic frames?”

That is measurable.

### Tiny model path

For 0.5B–1.5B models:

```text
NL -> minimal frame JSON -> deterministic compiler -> NAL
```

Minimal frame JSON should include only:

- entities;
- simple frames;
- roles;
- polarity;
- modality;
- goal/question flag.

No complex variable scoping. No image syntax. No nested term constructors.

### Small model path

For 1.5B–3B models:

```text
NL -> full frame JSON -> deterministic compiler -> NAL
```

Add:

- contexts;
- quantifiers;
- temporal relations;
- multiple candidates;
- ambiguity flags.

### Medium/large model path

For larger models:

```text
NL -> direct Narsese candidates -> validator/compiler
```

or:

```text
NL -> frame JSON -> NAL
```

The frame path should remain the default for auditability.

### Fallback path

If LM output is invalid:

```text
NL -> symbolic fallback -> partial task/question
```

Never let an invalid LLM output become an unvalidated belief.

---

# 12. Verification plan

To prove the design is complete, effective, and efficient, add these tests.

## A. Completeness tests

Generate one canonical term for every constructor:

```typescript
const requiredConstructors = [
  'atom',
  'independentVariable',
  'dependentVariable',
  'queryVariable',
  'inheritance',
  'similarity',
  'instance',
  'property',
  'instanceProperty',
  'implication',
  'equivalence',
  'predictiveImplication',
  'retrospectiveImplication',
  'concurrentImplication',
  'conjunction',
  'disjunction',
  'negation',
  'extensionalSet',
  'intensionalSet',
  'product',
  'extensionalImage',
  'intensionalImage',
  'sequence',
  'parallel',
  'operation'
];
```

For each:

```text
Term -> CanonicalTermJson -> Term
```

must produce the same canonical hash.

Also:

```text
Term -> Narsese text -> Term
```

must produce the same canonical hash, modulo canonical normalization.

## B. Semantic compiler tests

For each frame graph:

```text
SemanticFrameCandidate -> CanonicalTermGraph
```

must be deterministic.

Same input graph should always produce the same canonical term hash.

## C. Small-model effectiveness tests

Benchmark the LLM on frame extraction, not Narsese validity.

Metrics:

| Metric | Meaning |
|---|---|
| Entity F1 | Did it extract the right entities? |
| Role F1 | Did it assign agent/patient/theme correctly? |
| Modality accuracy | actual / possible / desired / necessary |
| Polarity accuracy | positive / negative |
| Context accuracy | condition / unless / cause / before / after |
| Candidate recall | Did ambiguous inputs produce multiple candidates? |
| Compile success rate | Did extracted frames compile into valid NAL? |
| Downstream answer accuracy | Did NAR answer the intended question? |

This separates model capability from compiler correctness.

## D. Efficiency tests

Measure:

```typescript
interface TranslationMetrics {
  inputTokens: number;
  outputTokens: number;
  jsonNodes: number;
  compiledTermNodes: number;
  compileTimeMs: number;
  retryCount: number;
  validationFailures: number;
  admissionRate: number;
}
```

Assert:

- frame JSON stays under token budget;
- compiler is linear in nodes/edges;
- repeated frames hit semantic cache;
- invalid JSON does not cause retry storms;
- high pressure drops low-priority translation jobs first.

## E. Safety tests

Assert:

- frame JSON cannot bypass PerceptionGate;
- truth values from LLM are prior-quality only;
- source quality maps to confidence ceiling;
- reward cannot mutate belief truth;
- ambiguous sentences do not collapse into one overconfident parse;
- malformed JSON becomes a question or rejected proposal, not a belief.

---

# 13. Final verdict

### Is JSON sufficient?

**Yes, as a transport and boundary format.**

But only with the right schema split.

### Is a single semantic JSON graph sufficient?

**No.**

A single graph schema tries to do two incompatible jobs:

1. be easy for small LLMs to generate;
2. be losslessly expressive for full NAL.

Those should be separated.

### Correct design

```text
LLM-facing:
  Semantic Frame Graph JSON
  - bounded
  - role/event based
  - ambiguous
  - candidate-based
  - optimized for small models

Kernel-facing:
  Canonical NAL Term DAG JSON
  - lossless
  - complete
  - variable-scoped
  - task-typed
  - truth/desire/stamp aware
```

With that split, the system becomes:

- **Complete**, because the canonical term DAG covers full NAL expressivity.
- **Effective**, because the LLM only performs semantic frame extraction, not symbolic compilation.
- **Efficient**, because deterministic compilation, canonical hashing, caching, and AIKR bounds prevent token and compute blowup.

So the answer is:

> **JSON is sufficient, but only if JSON encodes a two-layer architecture: a bounded semantic frame graph for System 1 extraction, and a canonical NAL term DAG for System 2 truth.**

