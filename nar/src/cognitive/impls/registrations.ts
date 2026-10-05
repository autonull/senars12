/**
 * The declarative catalogue of every built-in strategy (TODO27 §2.1).
 *
 * A strategy that is not declared here is not configurable; a strategy that is
 * declares what it accepts. Adding a strategy is one entry — nothing else in
 * the system learns its name, and the catalogue is the only place that knows a
 * strategy's default configuration.
 */

import { z } from 'zod';
import { createStrategy } from '../../reason/strategies/base';
import { CompositeAttention } from '../../strategies/attention/CompositeAttention.js';
import {
  GoalRelevanceAttention,
  SimpleAttention,
  SpreadingActivation,
} from '../../strategies/attention/index.js';
import type { AttentionModel } from '../../strategies/types.js';

/**
 * All three attention models share one constructor parameter — the prime boost
 * `SimpleAttention` contributes — so one registration shape covers them.
 */
const ATTENTION_MODELS = {
  simple: (boost: number) => new SimpleAttention(boost),
  spreading: (boost: number) => new SpreadingActivation(boost),
  'goal-relevance': (boost: number) => new GoalRelevanceAttention(boost),
} as const satisfies Record<string, (boost: number) => AttentionModel>;

import { rngFrom } from '@senars/util';
import {
  AllSelector,
  AnytimeDerivation,
  DefaultDerivation,
  DiverseSampling,
  DiverseSelector,
  FocusedDerivation,
  GoalBiasedSampling,
  NoveltySampling,
  PrioritySampling,
  PrioritySelector,
  RotationSelector,
  SampledDerivation,
  WindowedRouletteStrategy,
} from '../../strategies/index.js';
import { RuleGraph } from '../../strategies/lm-graph/RuleGraph.js';
import { CompositeLMRuleSelector } from '../../strategies/lm-selectors/CompositeLMRuleSelector.js';
import { type PremiseOverrides, premiseSampleShape } from '../../strategies/premise/config.js';
import { PrologResolutionStrategy } from '../../strategies/premise/prolog-resolution.js';
import {
  CompositeStrategy,
  createPremiseStrategy,
  DecompositionStrategy,
  PREMISE_PRIMITIVES,
} from '../../strategies/premise/selection-strategies.js';
import { EmbeddingLinkStrategy, TermLinkStrategy } from '../../strategies/premise/term-link.js';
import {
  configSchema,
  configurable,
  fixed,
  type StrategyRegistration,
  stateful,
} from '../../strategies/registration.js';
import { CompositeSampling } from '../../strategies/sampling/CompositeSampling.js';
import { defineScoredSampling } from '../../strategies/sampling/scored.js';
import type { Strategy, StrategyType } from '../../strategies/types.js';
import { unitInterval } from '@senars/util/config';

/**
 * A `seed` in the config pins a strategy's own stream; absent one it draws from
 * the registry's ambient stream, so seeding the NAR seeds every strategy that
 * samples (TODO27 §16). One PRNG for the repository, not one per module.
 */
const strategyRng = (seed: number | undefined, ambient: () => number): (() => number) =>
  rngFrom(seed, ambient);

const LINK_CONFIG = configSchema({
  minStrength: unitInterval.default(0.3),
  limit: z.number().int().min(1).default(20),
});

type LinkCtor = new (config?: { minStrength?: number; limit?: number }) => Strategy;

const premise = (registration: StrategyRegistration): StrategySlotEntry => [
  'premise',
  registration,
];

const linkRegistration = (name: string, description: string, Ctor: LinkCtor) =>
  premise(
    configurable({
      name,
      description,
      schema: LINK_CONFIG,
      factory: (config) =>
        new Ctor({ minStrength: config.minStrength as number, limit: config.limit as number }),
    })
  );

/**
 * The premise primitives' whole sampling pipeline is their configuration: the
 * table entry supplies every default, so a configured variant and the exported
 * singleton are two projections of one declaration.
 */
const premisePrimitive = (name: keyof typeof PREMISE_PRIMITIVES): StrategySlotEntry => {
  const spec = PREMISE_PRIMITIVES[name];
  return premise(
    configurable({
      name,
      description: spec.description,
      schema: configSchema(premiseSampleShape(spec)),
      factory: (config) =>
        createPremiseStrategy(name, {
          sampleSize: config.sampleSize as number,
          limit: config.limit as number,
          source: config.source as PremiseOverrides['source'],
          scorer: config.scorer as PremiseOverrides['scorer'],
          filters: config.filters as PremiseOverrides['filters'],
          minScore: config.minScore as number,
          skipSameTerm: config.skipSameTerm as boolean,
        }),
    })
  );
};

const SAMPLED_CONFIG = configSchema({
  fraction: z.number().min(0.01).max(1).default(0.3),
  seed: z.number().optional(),
});

const ROTATION_CONFIG = configSchema({ offset: z.number().int().min(0).default(0) });

/**
 * The one built-in that composes *other registered strategies by name*. Its
 * factory needs the registry to resolve them, which is what `StrategyFactoryDeps`
 * is for; the cross-field `validate` is what makes a typo'd part name a boundary
 * error rather than a `ConfigurationError` thrown from inside a factory.
 */
const COMPOSITE_ATTENTION_PART = z
  .object({
    name: z.string(),
    weight: z.number().min(0),
  })
  .strict();

const COMPOSITE_ATTENTION_CONFIG = configSchema({
  models: z
    .array(COMPOSITE_ATTENTION_PART)
    .min(1)
    .default([{ name: 'simple', weight: 1 }]),
});

/** The names a composite attention may name: every attention registration but itself. */
const COMPOSABLE_ATTENTION = Object.keys(ATTENTION_MODELS);

export type StrategySlotEntry = readonly [StrategyType, StrategyRegistration];
export type StrategySlot = readonly StrategySlotEntry[];

export const DEFAULT_REGISTRATIONS: StrategySlot = [
  // ── sampling ────────────────────────────────────────────────────────────
  [
    'sampling',
    fixed({
      name: 'priority',
      description: 'Priority-weighted sample',
      factory: () => new PrioritySampling(),
    }),
  ],
  [
    'sampling',
    fixed({
      name: 'top-n',
      description: 'Take the N highest-priority concepts',
      // Its own class spelled out `rankedSample(..., c => c.priority)` — which is
      // what the factory it already exported declares. `priority` stays a class
      // because it reads through `memory.topConcepts`, the one reader that keeps
      // the store's own admission order for ties.
      factory: () =>
        defineScoredSampling({
          name: 'top-n',
          description: 'Take the N highest-priority concepts',
          score: (concept) => concept.priority,
        }),
    }),
  ],
  [
    'sampling',
    fixed({
      name: 'novelty',
      description: 'Prefer least-recently-touched concepts',
      factory: () => new NoveltySampling(),
    }),
  ],
  [
    'sampling',
    fixed({
      name: 'goal-biased',
      description: 'Bias the sample toward active goals',
      factory: () => new GoalBiasedSampling(),
    }),
  ],
  [
    'sampling',
    fixed({
      name: 'diverse',
      description: 'Spread the sample across concept families',
      factory: () => new DiverseSampling(),
    }),
  ],
  [
    'sampling',
    configurable({
      name: 'windowed-roulette',
      description: 'Roulette over a sliding window of recent concepts',
      schema: configSchema({
        windowSize: z.number().int().min(1).default(10),
        seed: z.number().optional(),
      }),
      factory: (config, { rng }) =>
        new WindowedRouletteStrategy({
          windowSize: config.windowSize as number,
          rng: strategyRng(config.seed as number | undefined, rng),
        }),
    }),
  ],

  // ── premise ─────────────────────────────────────────────────────────────
  linkRegistration(
    'term-link',
    'Term-link premises plus the subject and predicate link neighbourhoods',
    TermLinkStrategy
  ),
  linkRegistration(
    'embedding-link',
    "Semantic premises from the embedding layer's similarity links",
    EmbeddingLinkStrategy
  ),
  premisePrimitive('default-formation'),
  premisePrimitive('bag'),
  premisePrimitive('resolution'),
  premisePrimitive('goal-driven'),
  premisePrimitive('analogical'),
  premisePrimitive('sampled'),
  premisePrimitive('exhaustive'),
  premisePrimitive('semantic'),
  premise(
    fixed({
      name: 'decomposition',
      description: 'Decompose conjunctions into component beliefs',
      factory: () => new DecompositionStrategy(),
    })
  ),
  premise(
    configurable({
      name: 'prolog-resolution',
      description: 'SLD resolution with unification, Horn clause backward chaining, occurs-check',
      schema: configSchema({
        maxDepth: z.number().int().min(1).default(10),
        maxResults: z.number().int().min(1).default(5),
        occursCheck: z.boolean().default(true),
      }),
      factory: (config) =>
        new PrologResolutionStrategy({
          maxDepth: config.maxDepth as number,
          maxResults: config.maxResults as number,
          occursCheck: config.occursCheck as boolean,
        }),
    })
  ),

  // ── derivation ──────────────────────────────────────────────────────────
  [
    'derivation',
    fixed({
      name: 'default',
      description: 'Iterate all secondaries, fire sync+LM per pair',
      factory: () => new DefaultDerivation(),
    }),
  ],
  [
    'derivation',
    fixed({
      name: 'anytime',
      description: 'Yield as results become available, stop early if signal aborted',
      factory: () => new AnytimeDerivation(),
    }),
  ],
  [
    'derivation',
    fixed({
      name: 'focused',
      description: 'Prioritize high-relevance secondaries',
      factory: () => new FocusedDerivation(),
    }),
  ],
  [
    'derivation',
    configurable({
      name: 'sampled',
      description: 'Random subset of secondaries',
      schema: SAMPLED_CONFIG,
      factory: (config, { rng }) =>
        new SampledDerivation(
          strategyRng(config.seed as number | undefined, rng),
          config.fraction as number
        ),
    }),
  ],

  // ── lm-rule ─────────────────────────────────────────────────────────────
  [
    'lm-rule',
    fixed({
      name: 'all',
      description: 'Fire all eligible LM rules',
      factory: () => new AllSelector(),
    }),
  ],
  [
    'lm-rule',
    fixed({
      name: 'priority',
      description: 'Top-N by rule priority',
      factory: () => new PrioritySelector(),
    }),
  ],
  [
    'lm-rule',
    configurable({
      name: 'rotation',
      description: 'Round-robin across cycles from a fixed offset',
      schema: ROTATION_CONFIG,
      factory: (config) => new RotationSelector(config.offset as number),
    }),
  ],
  [
    'lm-rule',
    fixed({
      name: 'diverse',
      description: 'One per category, then round-robin',
      factory: () => new DiverseSelector(),
    }),
  ],

  [
    'lm-rule',
    // Stateful: the graph edges and rule performance are the point, and they
    // have to survive a `reconfigure` (Invariant S1). Built on first resolution.
    stateful({
      name: 'lm-graph',
      description: 'ConceptGraph co-activation with RLFPLearner rewards',
      factory: () => new RuleGraph(),
    }),
  ],

  // ── attention ───────────────────────────────────────────────────────────
  ...(
    [
      ['simple', 'Fixed boost on prime, exponential decay'],
      ['spreading', 'Prime propagates through term links'],
      ['goal-relevance', 'Boost proportional to goal term overlap'],
    ] as const satisfies ReadonlyArray<readonly [string, string]>
  ).map(
    ([name, description]): StrategySlotEntry => [
      'attention',
      configurable({
        name,
        description,
        schema: configSchema({ boost: unitInterval.default(0.3) }),
        factory: (config) => ATTENTION_MODELS[name](config.boost as number),
      }),
    ]
  ),
  [
    'attention',
    configurable({
      name: 'composite',
      description: 'Weighted mean of several attention models',
      schema: COMPOSITE_ATTENTION_CONFIG,
      validate: (config) => {
        const models = config.models as Array<{ name: string; weight: number }>;
        return [
          ...models
            .filter(({ name }) => !COMPOSABLE_ATTENTION.includes(name))
            .map(
              ({ name }) =>
                `config.models[].name: no attention strategy named '${name}' (available: ${COMPOSABLE_ATTENTION.join(', ')})`
            ),
          ...(models.every(({ weight }) => weight === 0)
            ? ['config.models: at least one weight must be positive']
            : []),
        ];
      },
      factory: (config, { resolve }) =>
        new CompositeAttention(
          (config.models as Array<{ name: string; weight: number }>).map(({ name, weight }) => ({
            model: resolve<AttentionModel>('attention', name),
            weight,
          }))
        ),
    }),
  ],
];
