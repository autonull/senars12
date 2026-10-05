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
The catalogue below is `nar/src/cognitive/registrations.ts` — the source of truth.

| Strategy Type | Options |
|---------------|---------|
| **Sampling** | `priority`, `top-n`, `novelty`, `goal-biased`, `diverse`, `windowed-roulette` |
| **Premise Formation** | `default-formation`, `bag`, `resolution`, `goal-driven`, `analogical`, `sampled`, `exhaustive`, `semantic`, `decomposition`, `prolog-resolution`, `term-link`, `embedding-link` |
| **Derivation** | `default`, `anytime`, `focused`, `sampled` |
| **LM Rule Selection** | `all`, `priority`, `rotation`, `diverse`, `lm-graph` |
| **Attention** | `simple`, `spreading`, `goal-relevance`, `composite` |

Each slot takes a **spec and a configuration**: a strategy name, a list of names composed into one,
or — for derivation — a strategy expression. The registry is the only place a strategy is built,
validated and memoized; `config` is schema-validated and a `stateful` strategy rejects it outright.
`AdaptiveStrategy` is exported but not reachable from config. See
[`docs/strategy-composition.md`](docs/strategy-composition.md) for the resolution tiers, the
stateful rule, and how to register a strategy.

**Optimization-Ready** — `PARAMETER_SPACE` defines min/max/default for every tunable, enabling:
- RL-based policy optimization (RLFP)
- Evolutionary parameter tuning
