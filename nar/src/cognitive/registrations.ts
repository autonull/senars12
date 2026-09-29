/**
 * The declarative catalogue of every built-in strategy (TODO27 §2.1).
 *
 * A strategy that is not declared here is not configurable; a strategy that is
 * declares what it accepts. Adding a strategy is one entry — nothing else in
 * the system learns its name, and the catalogue is the only place that knows a
 * strategy's default configuration.
 */

import { z } from 'zod';
import { createStrategy } from '../reason/strategies/base';
import { CompositeAttention } from '../strategies/attention/CompositeAttention.js';
import {
  GoalRelevanceAttention,
  SimpleAttention,
  SpreadingActivation,
} from '../strategies/attention/index.js';
import type { AttentionModel } from '../strategies/types.js';

/**
 * All three attention models share one constructor parameter — the prime boost
 * `SimpleAttention` contributes — so one registration shape covers them.
 */
const ATTENTION_MODELS = {
  simple: (boost: number) => new SimpleAttention(boost),
  spreading: (boost: number) => new SpreadingActivation(boost),
  'goal-relevance': (boost: number) => new GoalRelevanceAttention(boost),
} as const satisfies Record<string, (boost: number) => AttentionModel>;
import { CompositeLMRuleSelector } from '../strategies/lm-selectors/CompositeLMRuleSelector.js';
import { CompositeSampling } from '../strategies/sampling/CompositeSampling.js';
import {
  CompositeStrategy,
  createPremiseStrategy,
  DecompositionStrategy,
  PREMISE_PRIMITIVES,
} from '../strategies/premise/selection-strategies.js';
import {
  EmbeddingLinkStrategy,
  TermLinkStrategy,
} from '../strategies/premise/term-link.js';
import { PrologResolutionStrategy } from '../strategies/premise/prolog-resolution.js';
import {
  AnytimeDerivation,
  AllSelector,
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
  TopNSampling,
  WindowedRouletteStrategy,
} from '../strategies/index.js';
import {
  configurable,
  configSchema,
  fixed,
  type StrategyRegistration,
} from '../strategies/registration.js';
import type { Strategy, StrategyType } from '../strategies/types.js';

/** A seeded LCG so a configured sampling strategy stays reproducible. */
const seededRng = (seed: number | undefined): (() => number) => {
  if (seed === undefined) return Math.random;
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

const LINK_CONFIG = configSchema({
  minStrength: z.number().min(0).max(1).default(0.3),
  limit: z.number().int().min(1).default(20),
});

type LinkCtor = new (config?: { minStrength?: number; limit?: number }) => Strategy;

const premise = (registration: StrategyRegistration): StrategySlotEntry => ['premise', registration];

const linkRegistration = (name: string, description: string, Ctor: LinkCtor) =>
  premise(configurable({
    name,
    description,
    schema: LINK_CONFIG,
    factory: (config) =>
      new Ctor({ minStrength: config.minStrength as number, limit: config.limit as number }),
  }));

const premisePrimitive = (name: keyof typeof PREMISE_PRIMITIVES): StrategySlotEntry => {
  const spec = PREMISE_PRIMITIVES[name];
  return premise(configurable({
    name,
    description: spec.description,
    schema: configSchema({
      sampleSize: z.number().int().min(1).default(spec.sampleSize),
      limit: z.number().int().min(1).default(spec.limit),
    }),
    factory: (config) =>
      createPremiseStrategy(name, {
        sampleSize: config.sampleSize as number,
        limit: config.limit as number,
      }),
  }));
};

const SAMPLED_CONFIG = configSchema({
  fraction: z.number().min(0.01).max(1).default(0.3),
  seed: z.number().optional(),
});

const ROTATION_CONFIG = configSchema({ offset: z.number().int().min(0).default(0) });

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
      factory: () => new TopNSampling(),
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
      factory: (config) =>
        new WindowedRouletteStrategy({
          windowSize: config.windowSize as number,
          rng: seededRng(config.seed as number | undefined),
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
      factory: (config) =>
        new SampledDerivation(
          seededRng(config.seed as number | undefined),
          config.fraction as number
        ),
    }),
  ],

  // ── lm-rule ─────────────────────────────────────────────────────────────
  ['lm-rule', fixed({ name: 'all', description: 'Fire all eligible LM rules', factory: () => new AllSelector() })],
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
        schema: configSchema({ boost: z.number().min(0).max(1).default(0.3) }),
        factory: (config) => ATTENTION_MODELS[name](config.boost as number),
      }),
    ]
  ),
  [
    'attention',
    configurable({
      name: 'composite',
      description: 'Weighted combination of attention models',
      schema: configSchema({}),
      factory: () => new CompositeAttention([]),
    }),
  ],
];
