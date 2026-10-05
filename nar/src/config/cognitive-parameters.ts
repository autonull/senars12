import { createLogger, deepEqual, deepFreeze, deepMerge, errMsg, keyedBy } from '@senars/util';
import { cognitiveBound, cognitiveBounds } from '@senars/util/config';
import { type BagSlotParams, bagSlotErrors } from '../bag/registration';
import {
  type StrategyCatalog,
  type StrategyConfig,
  type StrategySpec,
  type StrategyType,
  strategySpecErrors,
} from '../strategies/registration';

const log = createLogger({ scope: 'cognitive-params' });

/**
 * Cognitive Architecture Parameters
 *
 * All hyperparameters controlling SeNARS behavior are defined here.
 * These can be tuned, optimized, or evolved without code changes.
 *
 * Categories:
 * - Priority Management: boosts, decay
 * - LM Integration: when and how LM rules fire
 * - Attention Mechanisms: how concepts gain/lose priority
 * - Inference Control: derivation limits
 */

export interface CognitiveParameters {
  /** Priority Management */
  priority: PriorityConfig;

  /** LM Integration */
  lm: LMConfig;

  /** Attention Mechanisms */
  attention: AttentionConfig;

  /** Inference Control */
  inference: InferenceConfig;

  /** Model Runner Control */
  modelRunner: ModelRunnerConfig;

  /** Memory Control */
  memory: MemoryParams;

  /** Pluggable strategy configuration */
  strategies: {
    sampling: StrategySlotParams;
    /**
     * One premise strategy, or several composed per task. A list lets several
     * associative memories (term links, embedding similarity, co-activation)
     * contribute premises in one pass; overlapping terms are deduped to the
     * highest-priority claim.
     */
    premise: StrategySlotParams;
    derivation: StrategySlotParams;
    lmRule: StrategySlotParams & { maxRules: number };
    attention: StrategySlotParams;
    bag: BagSlotParams;
  };
}

/**
 * A strategy slot names a strategy and its configuration; the registry turns
 * that pair into a validated, memoized instance (TODO27 §2.2). A list names
 * several strategies composed into one.
 *
 * The bag slot is the exception: there is no strategy to name, because
 * `PriorityBag` is the only AIKR queue. The slot is its configuration, and it
 * carries a contract (`bag/registration.ts`) rather than a registry.
 */
export interface StrategySlotParams {
  type: StrategySpec;
  config?: StrategyConfig;
}

/**
 * Every strategy slot, as the pair that the two sides of the system spell
 * differently: the config graph says `lmRule`, the registry says `lm-rule`.
 *
 * Declared once and keyed by the registry type, because that direction is the
 * lossless one — indexing it yields the slot's config key at its literal type,
 * so a fifth slot added here reaches the controller, the registry and the
 * validation walk together. It was three hand-written copies of these five pairs
 * in two files (`SLOT_KEY`, `SLOT_TYPES` in the registry, this table), and they
 * were already free to disagree.
 */
export const STRATEGY_SLOTS = {
  sampling: { key: 'sampling', type: 'sampling' },
  premise: { key: 'premise', type: 'premise' },
  derivation: { key: 'derivation', type: 'derivation' },
  'lm-rule': { key: 'lmRule', type: 'lm-rule' },
  attention: { key: 'attention', type: 'attention' },
} as const satisfies Record<
  StrategyType,
  { key: keyof CognitiveParameters['strategies']; type: StrategyType }
>;

/** The same slots read from the config side, for a caller holding a slot key. */
export const STRATEGY_SLOTS_BY_KEY = keyedBy(
  Object.values(STRATEGY_SLOTS),
  ({ key }) => key,
  ({ type }) => type
);

export interface PriorityConfig {
  /** Initial priority for new concepts */
  initialPriority: number;

  /** Maximum priority (ceiling) */
  maxPriority: number;

  /** Priority boost when concept is directly mentioned */
  directMentionBoost: number;

  /** Priority boost for related concepts */
  relatedConceptBoost: number;

  /** Priority decay rate per cycle */
  decayRate: number;

  /** Activation propagation strength */
  propagationStrength: number;
}

export interface LMConfig {
  /** Enable LM rules */
  enabled: boolean;

  /** Require single premise for LM rules */
  singlePremiseEnabled: boolean;

  /** Maximum LM rules to fire per cycle */
  maxRulesPerCycle: number;

  /** Timeout for individual LM calls (ms) */
  callTimeoutMs: number;

  /** Enable specific LM rule categories */
  ruleCategories: {
    translation: boolean;
    explanation: boolean;
    metaReasoning: boolean;
    uncertainty: boolean;
    schemaInduction: boolean;
    temporalCausal: boolean;
    conceptElaboration: boolean;
  };

  /** Strategy for selecting which LM rules to fire */
  selectionStrategy: 'all' | 'priority' | 'rotation' | 'diverse';

  /** Rotation index for round-robin selection */
  rotationIndex?: number;
}

export interface AttentionConfig {
  /** Enable automatic attention priming */
  autoPrime: boolean;

  /** Boost amount for direct mention */
  primeBoost: number;

  /** Boost for related concepts */
  relatedBoost: number;

  /** Enable structural similarity detection */
  structuralSimilarity: boolean;

  /** Enable semantic relatedness (requires embeddings) */
  semanticRelatedness: boolean;

  /** Propagate activation to neighbors */
  propagateActivation: boolean;

  /** Number of propagation iterations */
  propagationIterations: number;
}

export interface InferenceConfig {
  /** Maximum derivations per step */
  maxDerivationsPerStep: number;

  /** Maximum derivation depth */
  maxDerivationDepth: number;

  /** Enable circular detection */
  enableCircularDetection: boolean;

  /** Enable trace collection */
  enableTraceCollection: boolean;

  /** CPU throttle delay (ms) between derivations */
  cpuThrottleMs: number;

  /** Maximum concepts to sample for inference */
  maxSampledConcepts: number;

  /** Enable single-premise LM rules */
  singlePremiseLMRules?: boolean;

  /** Maximum LM rules to fire per step */
  maxLMRulesPerStep?: number;

  /** Derivation ranking at admission (score = c × decisiveness − sizePenalty) */
  ranking?: {
    maxAdmissions: number;
    minScore: number;
  };
}

export interface ModelRunnerConfig {
  /** Maximum reasoning loops per turn */
  maxLoops: number;
}

/**
 * The tunable half of memory. Named `...Params`, not `MemoryConfig`, because
 * `memory/config.ts` owns the component's own forty-field `MemoryConfig` and the
 * two shared a name while sharing no fields.
 */
export interface MemoryParams {
  /** Activation decay rate per cycle */
  activationDecayRate: number;
}

/** Build default parameters from the shared cognitive bounds. */
export function buildDefaults(): CognitiveParameters {
  return {
    priority: {
      initialPriority: cognitiveBound.at('priority.initialPriority', 'default'),
      maxPriority: cognitiveBound.at('priority.maxPriority', 'default'),
      directMentionBoost: cognitiveBound.at('priority.directMentionBoost', 'default'),
      relatedConceptBoost: cognitiveBound.at('priority.relatedConceptBoost', 'default'),
      decayRate: cognitiveBound.at('priority.decayRate', 'default'),
      propagationStrength: cognitiveBound.at('priority.propagationStrength', 'default'),
    },
    lm: {
      enabled: true,
      singlePremiseEnabled: true,
      maxRulesPerCycle: cognitiveBound.at('lm.maxRulesPerCycle', 'default'),
      callTimeoutMs: cognitiveBound.at('lm.callTimeoutMs', 'default'),
      ruleCategories: {
        translation: true,
        explanation: true,
        metaReasoning: true,
        uncertainty: true,
        schemaInduction: true,
        temporalCausal: true,
        conceptElaboration: true,
      },
      /** @deprecated Use strategies.lmRule.type instead */
      selectionStrategy: 'all',
    },
    attention: {
      autoPrime: true,
      primeBoost: cognitiveBound.at('attention.primeBoost', 'default'),
      relatedBoost: cognitiveBound.at('attention.relatedBoost', 'default'),
      structuralSimilarity: true,
      semanticRelatedness: false,
      propagateActivation: true,
      propagationIterations: cognitiveBound.at('attention.propagationIterations', 'default'),
    },
    inference: {
      maxDerivationsPerStep: cognitiveBound.at('inference.maxDerivationsPerStep', 'default'),
      maxDerivationDepth: cognitiveBound.at('inference.maxDerivationDepth', 'default'),
      enableCircularDetection: true,
      enableTraceCollection: false,
      cpuThrottleMs: cognitiveBound.at('inference.cpuThrottleMs', 'default'),
      maxSampledConcepts: cognitiveBound.at('inference.maxSampledConcepts', 'default'),
      ranking: {
        maxAdmissions: cognitiveBound.at('inference.rankingMaxAdmissions', 'default'),
        minScore: cognitiveBound.at('inference.rankingMinScore', 'default'),
      },
    },
    modelRunner: {
      maxLoops: cognitiveBound.at('modelRunner.maxLoops', 'default'),
    },
    memory: {
      activationDecayRate: cognitiveBound.at('memory.activationDecayRate', 'default'),
    },
    strategies: {
      sampling: { type: 'priority' },
      premise: { type: 'default-formation' },
      derivation: { type: 'default' },
      lmRule: { type: 'priority', maxRules: 5 },
      attention: { type: 'simple' },
      bag: {},
    },
  };
}

export const DEFAULT_COGNITIVE_PARAMETERS: CognitiveParameters = deepFreeze(buildDefaults());

/**
 * Fast inference configuration - minimal LM usage
 */
export const FAST_COGNITIVE_CONFIG: CognitiveParameters = deepFreeze({
  ...DEFAULT_COGNITIVE_PARAMETERS,
  lm: {
    ...DEFAULT_COGNITIVE_PARAMETERS.lm,
    enabled: false,
  },
});

/**
 * Parameter space for optimization — the tunable subset of `cognitiveBounds`,
 * named rather than mirrored.
 *
 * This was 13 rows of `getCognitiveBound(category, key, 'min' | 'max' | 'default')`,
 * which is a second copy of the table that no ratchet could see: widening a bound
 * in `@senars/util` left this one describing the old range. The rows are named
 * because the *subset* is a decision (which parameters are tunable), and the
 * numbers inside each row are not.
 */
export const PARAMETER_SPACE = {
  priority: {
    initialPriority: cognitiveBound.range('priority.initialPriority'),
    directMentionBoost: cognitiveBound.range('priority.directMentionBoost'),
    relatedConceptBoost: cognitiveBound.range('priority.relatedConceptBoost'),
  },
  lm: {
    maxRulesPerCycle: cognitiveBound.range('lm.maxRulesPerCycle'),
    callTimeoutMs: cognitiveBound.range('lm.callTimeoutMs'),
  },
  attention: {
    primeBoost: cognitiveBound.range('attention.primeBoost'),
    relatedBoost: cognitiveBound.range('attention.relatedBoost'),
  },
  inference: {
    maxDerivationsPerStep: cognitiveBound.range('inference.maxDerivationsPerStep'),
    maxDerivationDepth: cognitiveBound.range('inference.maxDerivationDepth'),
    rankingMaxAdmissions: cognitiveBound.range('inference.rankingMaxAdmissions'),
    rankingMinScore: cognitiveBound.range('inference.rankingMinScore'),
  },
  modelRunner: { maxLoops: cognitiveBound.range('modelRunner.maxLoops') },
  memory: { activationDecayRate: cognitiveBound.range('memory.activationDecayRate') },
} as const;

/**
 * Validate cognitive parameters.
 *
 * `catalog` is the registry's read-only slice. It is injected rather than
 * imported because `cognitive/registry.ts` already depends on this module, and
 * `strategies/registration` is a leaf: the strategy pass needs no registry
 * import to exist. Without a catalog the strategy pass is skipped, so a caller
 * that only has numbers still gets the numeric validation.
 */
export function validateParameters(
  params: Partial<CognitiveParameters>,
  catalog?: StrategyCatalog
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (params.priority) {
    const p = params.priority;
    const minInitial = cognitiveBound.at('priority.initialPriority', 'min');
    const maxInitial = cognitiveBound.at('priority.initialPriority', 'max');
    if (p.initialPriority < minInitial || p.initialPriority > maxInitial)
      errors.push(`priority.initialPriority must be in [${minInitial}, ${maxInitial}]`);
    const minBoost = cognitiveBound.at('priority.directMentionBoost', 'min');
    const maxBoost = cognitiveBound.at('priority.directMentionBoost', 'max');
    if (p.directMentionBoost < minBoost || p.directMentionBoost > maxBoost)
      errors.push(`priority.directMentionBoost must be in [${minBoost}, ${maxBoost}]`);
  }

  if (params.lm?.selectionStrategy) {
    log.warn('selectionStrategy in LMConfig is deprecated. Use strategies.lmRule.type instead.');
  }

  if (catalog && params.strategies) {
    for (const slot of Object.values(STRATEGY_SLOTS)) {
      const params_ = params.strategies[slot.key];
      if (!params_) continue;
      errors.push(
        ...strategySpecErrors(
          slot.key,
          slot.type,
          params_.type,
          params_.config,
          catalog.list(slot.type)
        )
      );
    }
  }

  // The bag slot names no strategy, so it validates its own config.
  if (params.strategies) errors.push(...bagSlotErrors(params.strategies.bag));

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Partial parameters over the frozen defaults.
 *
 * One deep merge, so a nested knob is reachable at any depth. The previous
 * spelling named every section and then named, again, which nested leaves had to
 * be copied by hand (`ranking`, `ruleCategories`) — a list that goes stale the
 * moment a section gains a sub-object, at which point a knob writes through a
 * shared reference. Freezing the defaults is what makes the shared untouched
 * branches safe rather than quietly mutable: this is ESM, so such a write throws
 * at the call site instead of polluting `isolate:false` state.
 */
export const mergeParameters = (partial: Partial<CognitiveParameters>): CognitiveParameters =>
  deepMerge(DEFAULT_COGNITIVE_PARAMETERS, partial);

/** Per-slot strategy change detection — avoids serializing the whole strategy graph to compare it. */
export function sameStrategies(
  a: CognitiveParameters['strategies'],
  b: CognitiveParameters['strategies']
): boolean {
  const keys = Object.keys(a) as (keyof CognitiveParameters['strategies'])[];
  return keys.every((key) => deepEqual(a[key], b[key]));
}

/**
 * Parse a run's parameter file, the way `tune-runner` writes one.
 *
 * The tuner emits `{ "cognitiveParams": { … } }`; a hand-written file may be the
 * bare parameter object. Both are accepted, because the second is what a person
 * writes and the first is what the tool produces — refusing one of them buys
 * nothing. Validation is the same pass a live config goes through, so a file
 * that names an unregistered strategy fails here rather than at resolution.
 */
export function readCognitiveParams(source: string): {
  params: CognitiveParameters;
  errors: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (err) {
    return { params: DEFAULT_COGNITIVE_PARAMETERS, errors: [`not valid JSON: ${errMsg(err)}`] };
  }

  const raw = (parsed as { cognitiveParams?: unknown } | null)?.cognitiveParams ?? parsed;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { params: DEFAULT_COGNITIVE_PARAMETERS, errors: ['expected a parameter object'] };
  }

  const params = mergeParameters(raw as Partial<CognitiveParameters>);
  const { errors } = validateParameters(params);
  return { params, errors };
}
