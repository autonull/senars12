# Strategy Composition & Configuration

A **strategy slot** names a strategy and its configuration. The registry turns that pair into a
validated, memoized instance, and nothing else in the system constructs or selects a strategy.

```ts
// nar/src/cognitive/registrations.ts — the one declaration of every built-in strategy
['premise', configurable({
  name: 'term-link',
  description: 'Term-link premises plus the subject and predicate link neighbourhoods',
  schema: configSchema({ minStrength: z.number().min(0).max(1).default(0.3), limit: z.number().int().min(1).default(20) }),
  factory: (config) => new TermLinkStrategy({ minStrength: config.minStrength as number, limit: config.limit as number }),
})],
```

That entry is the whole contract: the name callers write, the description introspection reports,
the configuration a user may pass, and how the instance is built.

---

## 1. The registration

`nar/src/strategies/registration.ts` is a leaf module — zod plus types, no strategy imports — so
`config/` and `cognitive/` can both depend on the contract without joining the strategies→lm→nar
SCC.

| Field | Meaning |
|---|---|
| `name` | The string a slot may hold |
| `description` | What the strategy does; shown by `registry.list` |
| `stateful` | `true` ⇒ one instance per process, `config` rejected |
| `defaultConfig` | The tier-0 configuration, derived from the schema |
| `schema?` | Validates and defaults a user-supplied config |
| `factory` | Builds an instance from a *parsed* config — never raw input |

Three constructors, all in the same module:

- `configurable({ name, description, schema, factory })` — a stateless strategy with expressible config
- `fixed({ name, description, factory })` — `configurable` with an empty schema: any config key is an error
- `singleton(name, description, instance)` — a pre-built instance; `stateful: true`

### Invariant S1 — stateful strategies are singletons

`RuleGraph` (rule-performance map, graph edges) and anything holding a cache are registered as
singletons. Passing `config` to one is a `ConfigurationError`, not a silent no-op. State that must
survive a reconfigure belongs in a stateful strategy.

### Invariant S2 — a stateless config is fully described by its schema

Schemas are **strict**: a key the strategy does not declare is a user error. `factory` receives
parsed output with defaults applied, so two spellings of the same configuration produce the same
instance.

---

## 2. Resolution: three tiers

```ts
resolve<T>(type: StrategyType, spec: StrategySpec, config?: StrategyConfig): T
type StrategySpec = string | string[] | StrategyExpression
```

| Tier | Input | Behaviour | Identity |
|---|---|---|---|
| 0 | a bare name, no `config` | the registered default instance | `toBe()` the same object every time |
| 1 | a bare name plus `config` | `schema.parse(config)` → `factory(parsed)`, memoized by digest | stable per digest |
| 2 | a list or an expression | composed, memoized by a deterministic label | stable per label |

**Tier 0 is the parity guarantee.** With no `config` — every default, every preset, every existing
test — resolution is reference-identical to the pre-TODO27 `registry.get`.

**The digest** is `sha256(name ‖ canonicalJson(parsed))`, where `canonicalJson` sorts object keys
recursively *and* array elements: order is not semantic in a config bag, so `{a,b}` ≡ `{b,a}` and
`['x','y']` ≡ `['y','x']`.

`get(type, name)` is tier 0 under a second name, kept because it is the recall-hot path and
`RuleGraph` needs the typed instance.

---

## 3. Composition: one spec form, five semantics

Every slot accepts `string | string[] | StrategyExpression` and routes it to its own composite:

| Slot | `string[]` composes as | `StrategyExpression` |
|---|---|---|
| sampling | `CompositeSampling` — union, deduped by term, top `count` by priority | rejected |
| premise | `CompositeStrategy(…, 'dedup')` — highest-priority claim per term | rejected |
| derivation | the algebra's `sequence` | `composeStrategy` |
| lm-rule | `CompositeLMRuleSelector` — union, deduped by rule id, capped by `maxRules` | rejected |
| attention | `CompositeAttention` — equal weights | rejected |

A `StrategyExpression` is **derivation-only** (decision D4): `conditional`, `loop` and `timeout`
are meaningless for a synchronous, total slot. A premise *list* is the one spelling of premise
composition (D7) — there is no second way to spell it.

A single-element list resolves to the strategy itself: a composite of one is an indirection with no
behaviour.

---

## 4. Validation at the boundary

Validation lives in `strategySpecErrors(slot, type, spec, config, registrations)`, a pure function
over a registration list. Two callers:

```ts
// config/cognitive-parameters.ts — the catalog is injected, never imported
validateParameters(params, registry);

// cognitive/registry.ts — validate without building anything
registry.validate('premise', spec, config, 'premise');
```

The rules:

- unknown name → error naming the slot (and the list position) **and listing the candidates**
- empty list → error
- `config` on a stateful strategy → error naming the strategy
- unknown or out-of-range `config` key → the schema's own message
- `config` on a composed slot → error: configure its parts instead
- an expression on a non-derivation slot → error naming the list form

`CognitiveController.setStrategy` and its constructor validate before anything is rebuilt, so a bad
name can never surface from inside `reconfigure`.

`DEFAULT_COGNITIVE_PARAMETERS` is `deepFreeze`d and `schema.parse` always allocates, so no parsed
config can write through to the module default.

---

## 5. Telemetry: once per resolution

```ts
emitStrategySelection({ strategyType, strategyName, configDigest?, context: { tier } })
```

- **Tier 0** (`get`) emits on every call — the recall path, unchanged.
- **Tiers 1–2** emit when a *new* instance is built, i.e. once per distinct configuration.

The `strategy_selected` counter therefore means "a strategy was chosen", not "a strategy was
consulted" — which is what the OTel span and the `.status` governance section assume. A memo hit
emits nothing, so the event count is bounded by the number of distinct configurations, not by the
number of cycles.

---

## 6. Registering a strategy

```ts
import { configurable, configSchema } from '@senars/nar/strategies/registration';
import { z } from 'zod';

export const MY_REGISTRATIONS = [
  ['premise', configurable({
    name: 'my-strategy',
    description: 'What it does, in one line',
    schema: configSchema({ depth: z.number().int().min(1).default(3) }),
    factory: (config) => new MyStrategy({ depth: config.depth as number }),
  })],
] as const;
```

Then, for a runtime-added strategy:

```ts
registry.register('premise', configurable({ /* … */ }));
```

`initializeDefaults()` registers everything in `DEFAULT_REGISTRATIONS`. A name that is not
registered is a validation error with the candidate list attached — there is no silent fallback.

### What a plugin author does *not* need to do

Nothing else in the system learns a strategy's name. The controller resolves five slots through one
call; premise selection, sampling, derivation, LM-rule selection and attention each read their slot
from `CognitiveParameters` and never construct a strategy.

---

## 7. The associative port

```ts
interface AssociativeMemory {
  readonly name: string;
  recall(term: Term, options?: RecallOptions): RecallHit[];
  associate?(from: Term, to: Term, options?: AssociateOptions): boolean;  // optional write verb
}
```

`AssociativeRegistry.associate(name, from, to, options)` returns `false` rather than throwing when
the memory behind a name cannot write, so callers never branch on capability. A read-through view is
a valid implementation rather than a special case, and a strategy records an association through the
same port it reads through — no `LinkManager` import.

---

## Benches

| Bench | File | Falsifies |
|---|---|---|
| 100 | `todo27-dead-composition.test.ts` | No second composition surface; defaults stay valid |
| 101 | `todo27-resolution.test.ts` | Tier-0 identity; digest memoization; key-order stability; stateful rejection; telemetry cardinality; per-slot behavioural config |
| 102 | `todo27-validation.test.ts` | Unknown name / bad config / empty list / composed config, all with an actionable message |
| 103 | `todo27-composition.test.ts` | A list composes on all five slots; one spelling per concept |
| 104 | `todo27-associative-write.test.ts` | Associate/recall round-trip; read-only degrades to `false`; no document store |
