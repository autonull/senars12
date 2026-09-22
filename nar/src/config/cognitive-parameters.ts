import { createLogger } from '../logger/index.js';
import { cognitiveBounds, getCognitiveBound } from '@senars/util/config';

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
  memory: MemoryConfig;

  /** Pluggable strategy configuration */
  strategies: {
    sampling: { type: string; config?: Record<string, unknown> };
    premise: { type: string; config?: Record<string, unknown> };
    derivation: { type: string; config?: Record<string, unknown> };
    lmRule: { type: string; maxRules: number; config?: Record<string, unknown> };
    attention: { type: string; config?: Record<string, unknown> };
  };
}

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

  /** Master switch for LM rules */
  enableLMRules?: boolean;

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

export interface MemoryConfig {
  /** Activation decay rate per cycle */
  activationDecayRate: number;
}

/** Build default parameters from the shared cognitive bounds. */
function buildDefaults(): CognitiveParameters {
  return {
    priority: {
      initialPriority: getCognitiveBound('priority', 'initialPriority', 'default'),
      maxPriority: getCognitiveBound('priority', 'maxPriority', 'default'),
      directMentionBoost: getCognitiveBound('priority', 'directMentionBoost', 'default'),
      relatedConceptBoost: getCognitiveBound('priority', 'relatedConceptBoost', 'default'),
      decayRate: getCognitiveBound('priority', 'decayRate', 'default'),
      propagationStrength: getCognitiveBound('priority', 'propagationStrength', 'default'),
    },
    lm: {
      enabled: true,
      singlePremiseEnabled: true,
      maxRulesPerCycle: getCognitiveBound('lm', 'maxRulesPerCycle', 'default'),
      callTimeoutMs: getCognitiveBound('lm', 'callTimeoutMs', 'default'),
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
      primeBoost: getCognitiveBound('attention', 'primeBoost', 'default'),
      relatedBoost: getCognitiveBound('attention', 'relatedBoost', 'default'),
      structuralSimilarity: true,
      semanticRelatedness: false,
      propagateActivation: true,
      propagationIterations: getCognitiveBound('attention', 'propagationIterations', 'default'),
    },
    inference: {
      maxDerivationsPerStep: getCognitiveBound('inference', 'maxDerivationsPerStep', 'default'),
      maxDerivationDepth: getCognitiveBound('inference', 'maxDerivationDepth', 'default'),
      enableCircularDetection: true,
      enableTraceCollection: false,
      cpuThrottleMs: getCognitiveBound('inference', 'cpuThrottleMs', 'default'),
      maxSampledConcepts: getCognitiveBound('inference', 'maxSampledConcepts', 'default'),
      ranking: {
        maxAdmissions: getCognitiveBound('inference', 'rankingMaxAdmissions', 'default'),
        minScore: getCognitiveBound('inference', 'rankingMinScore', 'default'),
      },
    },
    modelRunner: {
      maxLoops: getCognitiveBound('modelRunner', 'maxLoops', 'default'),
    },
    memory: {
      activationDecayRate: getCognitiveBound('memory', 'activationDecayRate', 'default'),
    },
    strategies: {
      sampling: { type: 'priority' },
      premise: { type: 'default-formation' },
      derivation: { type: 'default' },
      lmRule: { type: 'priority', maxRules: 5 },
      attention: { type: 'simple' },
    },
  };
}

export const DEFAULT_COGNITIVE_PARAMETERS: CognitiveParameters = buildDefaults();

/**
 * Fast inference configuration - minimal LM usage
 */
export const FAST_COGNITIVE_CONFIG: CognitiveParameters = {
  ...DEFAULT_COGNITIVE_PARAMETERS,
  lm: {
    ...DEFAULT_COGNITIVE_PARAMETERS.lm,
    enabled: false,
  },
};

/**
 * LM-heavy configuration - maximum enhancement
 */
export const LM_HEAVY_CONFIG: CognitiveParameters = {
  ...DEFAULT_COGNITIVE_PARAMETERS,
  lm: {
    ...DEFAULT_COGNITIVE_PARAMETERS.lm,
    maxRulesPerCycle: 13,
    callTimeoutMs: 8000,
  },
};

/**
 * Research configuration - all tracing enabled
 */
export const RESEARCH_COGNITIVE_CONFIG: CognitiveParameters = {
  ...DEFAULT_COGNITIVE_PARAMETERS,
  inference: {
    ...DEFAULT_COGNITIVE_PARAMETERS.inference,
    enableTraceCollection: true,
    maxDerivationsPerStep: 100, // Limit for detailed analysis
  },
};

/**
 * Parameter space for optimization
 * Defines ranges for each tunable parameter
 */
export const PARAMETER_SPACE = {
  priority: {
    initialPriority: { min: getCognitiveBound('priority', 'initialPriority', 'min'), max: getCognitiveBound('priority', 'initialPriority', 'max'), default: getCognitiveBound('priority', 'initialPriority', 'default') },
    directMentionBoost: { min: getCognitiveBound('priority', 'directMentionBoost', 'min'), max: getCognitiveBound('priority', 'directMentionBoost', 'max'), default: getCognitiveBound('priority', 'directMentionBoost', 'default') },
    relatedConceptBoost: { min: getCognitiveBound('priority', 'relatedConceptBoost', 'min'), max: getCognitiveBound('priority', 'relatedConceptBoost', 'max'), default: getCognitiveBound('priority', 'relatedConceptBoost', 'default') },
  },

  lm: {
    maxRulesPerCycle: { min: getCognitiveBound('lm', 'maxRulesPerCycle', 'min'), max: getCognitiveBound('lm', 'maxRulesPerCycle', 'max'), default: getCognitiveBound('lm', 'maxRulesPerCycle', 'default') },
    callTimeoutMs: { min: getCognitiveBound('lm', 'callTimeoutMs', 'min'), max: getCognitiveBound('lm', 'callTimeoutMs', 'max'), default: getCognitiveBound('lm', 'callTimeoutMs', 'default') },
  },

  attention: {
    primeBoost: { min: getCognitiveBound('attention', 'primeBoost', 'min'), max: getCognitiveBound('attention', 'primeBoost', 'max'), default: getCognitiveBound('attention', 'primeBoost', 'default') },
    relatedBoost: { min: getCognitiveBound('attention', 'relatedBoost', 'min'), max: getCognitiveBound('attention', 'relatedBoost', 'max'), default: getCognitiveBound('attention', 'relatedBoost', 'default') },
  },

  inference: {
    maxDerivationsPerStep: { min: getCognitiveBound('inference', 'maxDerivationsPerStep', 'min'), max: getCognitiveBound('inference', 'maxDerivationsPerStep', 'max'), default: getCognitiveBound('inference', 'maxDerivationsPerStep', 'default') },
    maxDerivationDepth: { min: getCognitiveBound('inference', 'maxDerivationDepth', 'min'), max: getCognitiveBound('inference', 'maxDerivationDepth', 'max'), default: getCognitiveBound('inference', 'maxDerivationDepth', 'default') },
    rankingMaxAdmissions: { min: getCognitiveBound('inference', 'rankingMaxAdmissions', 'min'), max: getCognitiveBound('inference', 'rankingMaxAdmissions', 'max'), default: getCognitiveBound('inference', 'rankingMaxAdmissions', 'default') },
    rankingMinScore: { min: getCognitiveBound('inference', 'rankingMinScore', 'min'), max: getCognitiveBound('inference', 'rankingMinScore', 'max'), default: getCognitiveBound('inference', 'rankingMinScore', 'default') },
  },

  modelRunner: {
    maxLoops: { min: getCognitiveBound('modelRunner', 'maxLoops', 'min'), max: getCognitiveBound('modelRunner', 'maxLoops', 'max'), default: getCognitiveBound('modelRunner', 'maxLoops', 'default') },
  },

  memory: {
    activationDecayRate: { min: getCognitiveBound('memory', 'activationDecayRate', 'min'), max: getCognitiveBound('memory', 'activationDecayRate', 'max'), default: getCognitiveBound('memory', 'activationDecayRate', 'default') },
  },
} as const;

/**
 * Validate cognitive parameters
 */
export function validateParameters(params: Partial<CognitiveParameters>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (params.priority) {
    const p = params.priority;
    const minInitial = getCognitiveBound('priority', 'initialPriority', 'min');
    const maxInitial = getCognitiveBound('priority', 'initialPriority', 'max');
    if (p.initialPriority < minInitial || p.initialPriority > maxInitial)
      errors.push(`priority.initialPriority must be in [${minInitial}, ${maxInitial}]`);
    const minBoost = getCognitiveBound('priority', 'directMentionBoost', 'min');
    const maxBoost = getCognitiveBound('priority', 'directMentionBoost', 'max');
    if (p.directMentionBoost < minBoost || p.directMentionBoost > maxBoost)
      errors.push(`priority.directMentionBoost must be in [${minBoost}, ${maxBoost}]`);
  }

  if (params.lm?.selectionStrategy) {
    log.warn('selectionStrategy in LMConfig is deprecated. Use strategies.lmRule.type instead.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge partial parameters with defaults
 */
/** Shallow-merge over defaults, copying mutable nested leaves — a knob writing
 *  through a shared `ranking`/`ruleCategories` reference would otherwise mutate
 *  the module default (isolate:false test pollution, F5 ParameterTable seeds). */
function mergeNested<T extends object>(base: T, over: Partial<T> | undefined, nested: (keyof T)[]): T {
  const out: T = { ...base, ...over };
  for (const k of nested) {
    const v = out[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = { ...(v as object) } as never;
  }
  return out;
}

export function mergeParameters(partial: Partial<CognitiveParameters>): CognitiveParameters {
  const d = DEFAULT_COGNITIVE_PARAMETERS;
  return {
    priority: { ...d.priority, ...partial.priority },
    lm: mergeNested(d.lm, partial.lm, ['ruleCategories']),
    attention: { ...d.attention, ...partial.attention },
    inference: mergeNested(d.inference, partial.inference, ['ranking']),
    modelRunner: { ...d.modelRunner, ...partial.modelRunner },
    memory: { ...d.memory, ...partial.memory },
    strategies: {
      ...DEFAULT_COGNITIVE_PARAMETERS.strategies,
      ...partial.strategies,
      sampling: {
        ...DEFAULT_COGNITIVE_PARAMETERS.strategies.sampling,
        ...partial.strategies?.sampling,
      },
      premise: {
        ...DEFAULT_COGNITIVE_PARAMETERS.strategies.premise,
        ...partial.strategies?.premise,
      },
      derivation: {
        ...DEFAULT_COGNITIVE_PARAMETERS.strategies.derivation,
        ...partial.strategies?.derivation,
      },
      lmRule: { ...DEFAULT_COGNITIVE_PARAMETERS.strategies.lmRule, ...partial.strategies?.lmRule },
      attention: {
        ...DEFAULT_COGNITIVE_PARAMETERS.strategies.attention,
        ...partial.strategies?.attention,
      },
    },
  };
}
