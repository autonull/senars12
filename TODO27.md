# TODO27: Strategy Composition & Configuration — One Resolution Path

**Version:** 1.0 (2026-09-28) · **Predecessor:** REFACTOR.todo8 §8 B/C, the premise-strategy
landing (`8b8cb1f8`), and the associative-memory port (`e7a52b21`).

**Status: design decided. Nothing implemented. This document closes the questions; it does not
reopen them.**

---

## 0. North Star

The three preceding commits made the *layer* axis real: one `AssociativeMemory` port, one
registry, premise strategies that name the memories they read. What they could not finish is the
other half — the **strategy** axis. Today a strategy is a *name* that resolves to a
pre-built singleton, and the `config` next to that name in `CognitiveParameters` is inert.

The target is one sentence:

> **A strategy slot names a strategy and its configuration; the registry turns that pair into a
> validated, memoized instance, and nothing else in the system constructs or selects a strategy.**

Everything in this document is in service of that. Five slots, three composition forms, one
`resolve()`.

---

## 1. Current-state audit (verified 2026-09-28, post-`e7a52b21`)

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 1 | **`config` on every strategy slot is inert.** All five slots declare `config?: Record<string, unknown>`; the controller resolves via `registry.get(type, name)`, which returns a pre-built instance. No code path anywhere reads `strategies.*.config` — `rg "strategies\.\w+\.config"` across `nar/src`, `src`, `core/src` returns zero hits. A user writing `{ premise: { type: 'term-link', config: { minStrength: 0.9 } } }` gets silence. | `config/cognitive-parameters.ts:41-51`; `cognitive/controller.ts:146-171`; `cognitive/registry.ts:113-127` | B |
| 2 | **Three composition mechanisms coexist.** (a) `registry.compose` / `composePremise` — a `switch (type)` over five cases with `any` casts, **zero consumers**, also declared on the public `StrategyRegistry` interface. (b) `CompositeStrategy` (premise). (c) `composeStrategy` / `StrategyExpression` (derivation). | `cognitive/registry.ts:184-234` (impl), `strategies/types.ts:139-145` (interface); `premise/selection-strategies.ts:141`; `reason/strategy-algebra.ts:237` | A, D |
| 3 | **`createAdaptive` is dead too** — declared on `StrategyRegistry`, implemented in the registry, no consumers. | `cognitive/registry.ts:237-239`; `strategies/types.ts:146` | A |
| 4 | **No validation of strategy names or configs.** `validateParameters` checks two `priority` bounds and warns on one deprecated key. A typo'd `premise.type` surfaces as a `ConfigurationError` from deep inside `reconfigure`, with no list of valid names. | `config/cognitive-parameters.ts:318-345`; `cognitive/registry.ts:115-117` | C |
| 5 | **Telemetry fires per `get()`, not per resolution.** `emitStrategySelection` is called inside `get`. A factory-per-call resolution would emit one span per recall, not per choice — wrong signal for the OTel `strategy_selected` counter the status surface reads. | `cognitive/registry.ts:118`; `otel/index.ts:299` | B |
| 6 | **Two `StrategyController` interfaces have drifted from the real one.** The dialogue adapter declares `getStrategy(): string \| undefined` and `setStrategy(type, string \| StrategyExpression)`; the controller returns `string \| string[] \| undefined` and accepts `string \| string[] \| StrategyExpression`. Structurally assignable, so `tsc` is silent — and `adapt.ts:92` restores a `previous` that can now be an array, through a parameter typed as not-an-array. | `dialogue/consumers/adapt.ts:14-17,92`; `cognitive/controller.ts:73-77,99-110` | E |
| 7 | **The associative port is read-only.** `AssociativeMemory` has `recall` and no write verb, so a strategy that wants to *record* an association must reach past the port for `LinkManager.addLink` or `EmbeddingLayer.addLink`. The layer axis is half-open. | `memory/associative.ts` | E |
| 8 | **A latent unbounded accumulator sits in the memory path.** `EmbeddingLayer.storedEntries` is a plain `Map` grown by `store()`, with `search`/`getAll` and a `StoredEntry` type — all zero-consumer. Unbounded today only because nothing calls it; it is one call away from violating `unboundedAccumulators: mustRemainZero`. | `memory/links/EmbeddingLayer.ts:35,93-115` | E |
| 9 | **No way to ask what a strategy needs or accepts.** `registry.list(type)` returns `ComponentMetadata` for whichever strategies happened to be wrapped in the `withMeta` helper. There is no declaration of a strategy's config shape, its memory dependencies, or whether it is stateful. | `cognitive/registry.ts:125-132`; `premise/selection-strategies.ts:16-21` | B |
| 10 | **Five slots, five bespoke resolution paths.** sampling / derivation / lm-rule each do their own `registry.get` with their own special cases; premise composes; lm-rule has a `RuleGraph` side-effect branch. | `cognitive/controller.ts:135-175` | B, D |

---

## 2. Design

### 2.1 A registration carries a factory, a schema, and a statefulness flag

```ts
// nar/src/strategies/registration.ts  (leaf: types + zod only)
export type StrategyConfig = Readonly<Record<string, unknown>>;

export interface StrategyRegistration<T extends StrategyImpl = StrategyImpl> {
  readonly name: string;
  readonly description: string;
  /**
   * True ⇒ exactly one instance exists for the process lifetime and `config` is
   * rejected. State that must survive a `reconfigure` (rule performance, graph
   * edges) belongs in a stateful strategy.
   */
  readonly stateful: boolean;
  readonly defaultConfig: StrategyConfig;
  /** Validates and defaults a user-supplied config. Stateless strategies only. */
  readonly schema?: ZodType<StrategyConfig>;
  readonly factory: (config: StrategyConfig) => T;
}
```

**Invariant S1 — stateful strategies are singletons.** `RuleGraph` (rule-performance map, graph
edges), the LM selector, and any strategy holding a cache are `stateful: true`. They are
constructed once and returned as-is. Passing `config` to one is a `ConfigurationError`, not a
silent no-op — this is the failure mode finding #1 turned into a hard error rather than a shrug.

**Invariant S2 — a stateless strategy's config is fully described by its schema.** Zod is the
operational-invariance boundary the README already commits to; `factory` receives parsed output
with defaults applied, never raw user input.

### 2.2 One resolution function, three tiers

```ts
resolve<T extends StrategyImpl>(type: StrategyType, spec: StrategySpec, config?: StrategyConfig): T

type StrategySpec = string | string[] | StrategyExpression;
```

| Tier | Input | Behaviour | Identity |
|------|-------|-----------|----------|
| 0 | `spec` is a name, no `config` | return the registered default instance | `toBe()` the registered object |
| 1 | `spec` is a name, `config` given | `schema.parse(config)` → `factory(parsed)`, memoized by `sha256(name ‖ canonicalJson(parsed))` | stable per digest |
| 2 | `spec` is a list or expression | compose, register under a deterministic label, memoized | stable per label |

**Tier 0 is the parity guarantee.** With no `config` — which is every default, every preset, and
every existing test — resolution is *reference-identical* to today's `registry.get`. This is the
same C7 "plain name is byte-identical" rule the repo already applies to `StrategyExpression`, and
Bench 100 asserts it with `toBe`, not `toEqual`.

**Canonical JSON** for the digest sorts keys recursively, so `{a,b}` and `{b,a}` are one instance.
An array-valued config (e.g. `filters`) sorts *elements*, not positions — order is not semantic
for a config bag, and this keeps the digest stable against equivalent user spellings.

### 2.3 Telemetry fires once per resolution

```ts
emitStrategySelection({ strategyType, strategyName, configDigest, tier })
```

`get()` (Tier 0, the recall-hot path) keeps its current single emission. Tiers 1–2 emit at
*resolution*, i.e. on `reconfigure`/`setStrategy`, which is where a configuration actually
changed. The `strategy_selected` counter therefore means "a strategy was chosen" rather than "a
strategy was consulted", which is what the OTel span and the `.status` governance section assume.

### 2.4 Validation moves to the boundary

`validateParameters` gains a strategy pass, backed by the registry:

- unknown name → error naming the slot and listing the candidates
- `stateful: true` + `config` → error naming the strategy
- `config` present on a stateless strategy without a schema → error (an unvalidatable config is
  an unconfigurable strategy)
- `type: string[]` → each name validated; empty list is an error

Because `DEFAULT_COGNITIVE_PARAMETERS` is `deepFreeze`d (`config/cognitive-parameters.ts:241`),
`schema.parse` always produces a fresh object; no parsed config can write through to the module
default. This is the same isolation `mergeSection` exists to protect (`cognitive-parameters.ts:354-360`).

### 2.5 Composition is uniform, and the dead paths die

`resolve` accepts the same three spec forms for all five slots:

- `string` → the strategy
- `string[]` → premise `CompositeStrategy(…, 'dedup')`; sampling/attention/lm-rule use their
  existing composite classes (`CompositeAttention`, `CompositeLMRule`, the composite bag in
  `registry.ts:78-95`); derivation reuses `CompositeDerivation`
- `StrategyExpression` → `composeStrategy` (derivation-only combinators stay derivation-only;
  `sequence` is the only combinator that is meaningful for a synchronous, total slot)

Deleted: `registry.compose`, `registry.composePremise`, `registry.createAdaptive`, and their
`StrategyRegistry` interface members (`strategies/types.ts:139-146`). They have no consumers and
the `any`-cast `switch` is a type hole in a file that is otherwise the strategy system's front door.

### 2.6 The associative port gains a write verb

```ts
export interface AssociativeMemory {
  readonly name: string;
  recall(term: Term, options?: RecallOptions): RecallHit[];
  /** Optional: a read-through view legitimately cannot write. */
  associate?(from: Term, to: Term, options?: AssociateOptions): boolean;
}

associative.associate(name, from, to, options): boolean   // false when unsupported
```

The registry-level verb returns `false` rather than throwing, so callers never branch on
capability. `LinkLayerMemory` implements it over `Layer.addLink`. This is what closes finding #7:
a strategy records an association through the same port it reads through, and a read-only memory
is a valid implementation rather than a special case.

---

## 3. Naming & vocabulary

| Identifier | Kind | Meaning |
|---|---|---|
| `StrategyRegistration` | interface | `{ name, description, stateful, defaultConfig, schema?, factory }` — §2.1 |
| `StrategySpec` | type | `string \| string[] \| StrategyExpression` — the only shape a slot may hold |
| `StrategyConfig` | type | `Readonly<Record<string, unknown>>`, schema-validated for stateless strategies |
| `resolve` | method | `CognitiveRegistry.resolve(type, spec, config?)` — Tier 0/1/2 |
| `configDigest` | fn | `sha256(name ‖ canonicalJson(config))`; the memo key and the telemetry attribute |
| `canonicalJson` | fn | recursive key-sorted JSON, for digest stability |
| `AssociativeMemory.associate` | method | optional write verb — §2.6 |
| `CompositeMode` | type | `concatenate \| dedup` (landed in `e7a52b21`; supersedes `sequential/parallel/weighted`) |

---

## 4. Phases

Landable in order; each is independently shippable and each has its own bench. Effort is
engineering time excluding review.

### Phase A — Delete the dead composition surface
- Remove `registry.compose` / `composePremise` / `createAdaptive` and the `StrategyRegistry`
  interface members at `strategies/types.ts:139-146`. Impl spans `registry.ts:184-239`; the
  `any`-cast `switch` is `registry.ts:188-234`.
- Verify zero consumers first (`rg "\.compose\(|composePremise|createAdaptive"`); the audit
  already shows none outside the two definition sites.
- **Bench 100** — `deps:check` cycle count unchanged or lower; `exports:audit` still green; the
  removed names are unresolvable (`@ts-expect-error` on a reference each).
- Files: `cognitive/registry.ts`, `strategies/types.ts`.
- Effort: ~1h. Zero behavioural risk — this is removal of unreferenced code.

### Phase B — Registration, resolution, memoization, telemetry
- New leaf module `nar/src/strategies/registration.ts`: `StrategyRegistration`, `StrategySpec`,
  `StrategyConfig`, `canonicalJson`, `configDigest`.
- `CognitiveRegistry` gains an instance cache (`Map<type, Map<digest, StrategyImpl>>`) and
  `resolve()`. `get()` becomes Tier 0 of `resolve()` — one implementation, two names, so the
  existing public `get` keeps working and no caller churns.
- `initializeDefaults` migrates to `register(registration)`; the composite-bag class at
  `registry.ts:78-95` (`BagComposite`) becomes a registration with `stateful: true`.
- Controller collapses findings #10 to one call per slot.
- **Bench 101** — Tier 0 returns the *same object* as `get()` (`toBe`); a stateless strategy with
  `config` produces two `toEqual`-but-not-`toBe` instances for different digests and one shared
  instance for a repeated digest; key order does not change the digest; `stateful: true` +
  `config` throws `ConfigurationError`; `emitStrategySelection` fires once per resolution, not
  per recall.
- Files: `strategies/registration.ts` (NEW), `cognitive/registry.ts`, `cognitive/controller.ts`,
  `otel/index.ts` (attribute only).
- Effort: ~1.5d.

### Phase C — Validation at the boundary
- `validateParameters` gains the strategy pass (§2.4). It needs registry access without importing
  the registry (cycle risk: `registry.ts` already imports from `config/`), so validation takes an
  injected `StrategyCatalog` — the read-only `{ list(type), resolve }` slice — rather than the
  registry itself.
- `switch-strategy.ts` self tool: validate before applying, and surface the candidate list in the
  error. `applyAndValidate`'s revert path keeps working (a revert is just another `setStrategy`).
- **Bench 102** — unknown name lists candidates and names the slot; unknown `config` key is
  rejected by the schema; an empty `premise.type: []` is rejected; a valid change round-trips
  through `setStrategy` → `getStrategy`; `validateParameters` on the defaults is a no-op
  (parity).
- Files: `config/cognitive-parameters.ts`, `tools/adapters/self/switch-strategy.ts`,
  `cognitive/controller.ts`.
- Effort: ~1d.

### Phase D — Uniform composition
- `resolve` accepts `string[]` for all five slots; premise keeps `CompositeStrategy(…, 'dedup')`,
  the other slots route to their existing composite classes.
- Retire the `'composite'` premise `StrategyExpression` path if a list covers it; a premise list
  and a premise `sequence` must not be two spellings of one thing.
- **Bench 103** — a `string[]` on each of the five slots resolves and returns a working composite;
  premise list + `sequence` expression produce identical premise sets for the same inputs
  (one spelling wins, the other is removed); a list containing an unknown name fails at
  validation, not at the first recall.
- Files: `cognitive/registry.ts`, `cognitive/controller.ts`, `premise/selection-strategies.ts`,
  `reason/strategy-algebra.ts`.
- Effort: ~1d.

### Phase E — Close the residuals
- `AssociativeMemory.associate` + registry-level `associate` (§2.6); `LinkLayerMemory` implements
  it. **Bench 104** — associate-then-recall round-trips; a read-only memory returns `false`
  without throwing; a caller writes through the port without importing `LinkManager`.
- Delete `EmbeddingLayer.storedEntries` / `store` / `search` / `getAll` / `StoredEntry`
  (finding #8). **Bench 104** additionally asserts `complexity:budget` `unboundedAccumulators`
  stays 0 and that no `Map` without a bound remains in the memory path.
- Fix the drifted `StrategyController` in `dialogue/consumers/adapt.ts` to mirror the controller
  (finding #6), and re-check `AdaptationRecord.from/to` which are typed `string | undefined` and
  would now receive arrays.
- `registry.list` returns full registrations (name, description, stateful, defaultConfig keys) so
  the bot's `.strategies`-style introspection can answer "what does this accept" (finding #9).
- Effort: ~1d.

### Phase F — Docs & benches
- `docs/strategy-composition.md`: the resolution tiers, the S1 stateful rule, and how to register
  a strategy. A new plugin author should not have to read `registry.ts` to learn this.
- Benches land as `tests/nar/todo27-*.test.ts`, numbered 100–104, in the CI unit tier.
- Effort: ~0.5d.

---

## 5. Acceptance benches

| Bench | File | Falsifies |
|---|---|---|
| 100 | `todo27-dead-composition.test.ts` | The removed names are unresolvable; no cycle regression. |
| 101 | `todo27-resolution.test.ts` | Tier-0 object identity; digest memoization; key-order stability; stateful config rejection; telemetry cardinality. |
| 102 | `todo27-validation.test.ts` | Unknown name / bad config / empty list all fail with an actionable message; defaults stay valid. |
| 103 | `todo27-composition.test.ts` | A list composes on all five slots; one spelling of premise composition. |
| 104 | `todo27-associative-write.test.ts` | Associate/recall round-trip; read-only memory degrades to `false`; no unbounded map in the memory path. |

Every bench asserts *behaviour*, never implementation: identity (`toBe`) only where identity is
the contract (Tier 0, memoization), values otherwise. No mocks — the benches drive the real
`CognitiveRegistry`, the real `Memory`, and real `RuleGraph`.

---

## 6. Decision points — decided, not deferred

| # | Question | Decision | Rejected alternative |
|---|----------|----------|---------------------|
| D1 | Factory-per-call or memoized? | Memoized by config digest; Tier 0 is reference-identical. | Factory-per-call — would emit a span per recall (finding #5) and reset stateful strategies. |
| D2 | How to handle `config` on a stateful strategy? | `ConfigurationError`. Invariant S1. | Silently ignore (today's behaviour — the bug). Or allow config and document that state resets; unacceptable for `RuleGraph`. |
| D3 | Zod on every strategy, or only configurable ones? | Only where `config` is accepted; absence of a schema on a stateless strategy is itself a validation error. | Zod everywhere — 20+ strategies would need schemas for configs nobody can express. |
| D4 | One composition language for all slots, or the existing `StrategyExpression` extended? | Same three *spec forms* for all slots; the full combinator algebra stays derivation-only. | Full algebra everywhere — `conditional`/`loop`/`timeout` are meaningless for a synchronous, total slot, and `timeout` needs the `AbortSignal` the premise interface has no room for. |
| D5 | Keep `registry.compose` for API compatibility? | Delete. Zero consumers, and it is the only `any`-cast hole in the registry. | Keep and deprecate — preserves a footgun with no user. |
| D6 | Does the associative port get a write verb? | Yes, optional `associate` + a registry-level `associate` returning `false`. | Write-only-through-`LinkManager` (today) — the port stays half-open and every writer imports a link type. |
| D7 | Should `type: string[]` be the premise spelling, or a `sequence` expression? | The list. It is the shape the config already moved to in `e7a52b21`, and it removes a redundant spelling. | Keeping both — two spellings of one concept, which is the class of collision this work exists to remove. |
| D8 | What about the `EmbeddingLayer` vector store — keep and wire it, or delete? | Delete. Zero consumers, latent unbounded accumulator, and semantic *links* (which do have consumers) already cover retrieval. | Wire it as a fourth memory — that is a feature, and it needs a demand signal, not a cleanup slot. |

---

## 7. Out of scope (explicit)

- **Per-rule LM configuration.** Rules are selected by selector, not configured individually.
- **A third-party plugin API for strategies.** `PluginLoader` exists in `core`; wiring strategies
  through it is a separate design with its own trust story (digest-pinned? sandboxed?).
- **Making `AssociativeMemory.recall` async.** `indexConcept` generates embeddings asynchronously;
  the port is synchronous by necessity because `Strategy.selectSecondary` is synchronous. On-demand
  embedding similarity for unindexed terms stays out until the strategy interface can be async.
- **Removing the `StrategyExpression` derivation combinators** other than where D4 forces it.
- **Attention-model composition beyond `CompositeAttention`.**
- **The `nar.ts` monolith budget** (`<940` lines, currently 887) — unrelated, and a live budget
  with a passing bench.

---

## 8. Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Instance identity change breaks a holder of a strategy reference | Medium | Tier 0 is `toBe`-identical; memoized per digest otherwise; Bench 101 asserts identity, and a deliberate `toEqual`/`not.toBe` pair so the distinction is recorded rather than assumed. |
| Config digest instability from key order or float formatting | Low | `canonicalJson` sorts recursively; Bench 101 pins `{a,b}` ≡ `{b,a}` and a numeric case. |
| Schema parse cost on a hot path | Low | Parsing happens at resolution, not recall; Tiers memoize. |
| A parsed config writes through to the frozen module default | Low | `schema.parse` always allocates; Bench 102 asserts `DEFAULT_COGNITIVE_PARAMETERS` is byte-identical after a configured `setStrategy`. |
| `stateful` misclassification silently resets state | Medium | The flag is on the registration and reviewable; a stateless strategy that starts holding state is a review finding, and Bench 101 covers the singleton guarantee. |
| Removing `compose` breaks an out-of-repo consumer | Low | It is not in the `exports` map as a public subpath and has no in-repo consumer; `exports:audit` is the gate. |
| Validation becomes a startup tax | Low | Validated once per `setStrategy`/`reconfigure`, memoized with the instance. |

---

## 9. Definition of done

1. B Benches 100–104 green in the CI unit tier.
2. `config` demonstrably changes behaviour for at least one registered strategy in each stateless
   slot, asserted by value — not by "it was passed through".
3. An unknown strategy name fails at `validateParameters`/`setStrategy` with the candidate list,
   never from inside `reconfigure`.
4. `config` on a `stateful` strategy is a `ConfigurationError`.
5. `registry.compose` / `composePremise` / `createAdaptive` and the `EmbeddingLayer` vector store
   are gone; `rg` finds no references.
6. One spec form (`string | string[] | StrategyExpression`) is accepted by every slot, with one
   spelling per behaviour.
7. No regression: `test:unit` (currently 2436 passing, 3 skipped), `lint`, `typecheck`,
   `typecheck:bin`, `deps:gate` (≤ 5 cycles), `exports:audit`, `complexity:budget` all green.
8. `docs/strategy-composition.md` written.

---

## 10. Follow-ups (recorded, not scheduled)

- **Config-driven attention** (`CompositeAttention` ignores weights) — needs a demand signal.
- **`AdaptiveStrategy`** is registered but unreachable from config; either wire it or delete it
  (same verdict as `createAdaptive`, taken in Phase A).
- **Association provenance.** `associate` has no source tag, so a link written by a strategy is
  indistinguishable from one written by inference. Worth a `source` field on `AssociateOptions`
  when something consumes it.
- **Non-`term`-keyed memories.** `LinkLayerMemory` and `GraphMemory` cover the two current shapes;
  a third storage kind (e.g. an LRU-only, term-less index) needs no registry change but would need
  its own `AssociativeMemory` impl.

---

*Findings verified against the tree at `e7a52b21`. Line references are to that commit. If a finding
does not reproduce on a clean checkout of it, the finding is wrong and this document should be
corrected rather than the code.*
