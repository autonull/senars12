/**
 * Oracle Spec Table — declarative oracle configurations.
 *
 * All 18 oracles defined as data, not code. New oracle = 1 spec entry.
 * Auto-generates configs, validation, and docs.
 */

import { z } from 'zod';
import { nonEmpty, positiveInt, nonNegativeInt, intBetween, unitInterval, temperature } from '../config/boundary';

export type OracleProvider =
  | 'openai'
  | 'anthropic'
  | 'llamacpp'
  | 'z3'
  | 'clingo'
  | 'minisat'
  | 'tau-prolog'
  | 'custom';

export type OracleOperation =
  | 'lm.generateText'
  | 'lm.embed'
  | 'lm.classify'
  | 'engine.z3'
  | 'engine.clingo'
  | 'engine.minisat'
  | 'engine.tau-prolog'
  | 'retrieval.semantic'
  | 'retrieval.keyword'
  | 'formalization.narsese'
  | 'formalization.prolog'
  | 'distillation.train'
  | 'distillation.predict'
  | 'gbnf.generate'
  | 'credit-assignment.evaluate'
  | 'cascade-gates.execute'
  | 'learned-head.predict'
  | 'imagination.simulate'
  | 'lemma-promotion.score';

export interface OracleSpec {
  /** Unique operation identifier (e.g., 'lm.generateText') */
  operation: OracleOperation;
  /** Provider name */
  provider: OracleProvider;
  /** Human-readable name */
  name: string;
  /** Description of what this oracle does */
  description: string;
  /** Input schema (Zod) */
  inputSchema: z.ZodSchema<any>;
  /** Output schema (Zod) */
  outputSchema: z.ZodSchema<any>;
  /** Default configuration */
  defaultConfig?: Record<string, unknown>;
  /** Required environment variables */
  requiredEnv?: string[];
  /** Optional: cost per call (milli-dollars) */
  costMilli?: number;
  /** Optional: max latency budget (ms) */
  maxLatencyMs?: number;
  /** Optional: whether this oracle can run offline */
  offlineCapable?: boolean;
}

/** Input schema for LM text generation. */
const LmGenerateInput = z.object({
  prompt: nonEmpty,
  systemPrompt: z.string().optional(),
  temperature: temperature.optional(),
  maxTokens: positiveInt.optional(),
  stopSequences: z.array(z.string()).optional(),
  seed: z.number().int().optional(),
}).strict();

/** Output schema for LM text generation. */
const LmGenerateOutput = z.object({
  text: z.string(),
  usage: z.object({
    promptTokens: nonNegativeInt,
    completionTokens: nonNegativeInt,
    totalTokens: nonNegativeInt,
  }).optional(),
  finishReason: z.enum(['stop', 'length', 'content_filter', 'tool_calls', 'error']).optional(),
}).strict();

/** Input schema for LM embedding. */
const LmEmbedInput = z.object({
  texts: z.array(nonEmpty).min(1),
  model: z.string().optional(),
}).strict();

/** Output schema for LM embedding. */
const LmEmbedOutput = z.object({
  embeddings: z.array(z.array(z.number())),
  usage: z.object({
    promptTokens: nonNegativeInt,
    totalTokens: nonNegativeInt,
  }).optional(),
}).strict();

/** Input schema for engine Z3. */
const Z3Input = z.object({
  smtLib: nonEmpty,
  timeoutMs: positiveInt.optional(),
}).strict();

/** Output schema for engine Z3. */
const Z3Output = z.object({
  result: z.enum(['sat', 'unsat', 'unknown']),
  model: z.record(z.string(), z.unknown()).optional(),
  proof: z.string().optional(),
  timeMs: nonNegativeInt,
}).strict();

/** Input schema for semantic retrieval. */
const RetrievalInput = z.object({
  query: nonEmpty,
  topK: positiveInt.optional(),
  filter: z.record(z.string(), z.unknown()).optional(),
}).strict();

/** Output schema for semantic retrieval. */
const RetrievalOutput = z.object({
  results: z.array(z.object({
    id: nonEmpty,
    score: unitInterval,
    content: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })),
}).strict();

/** Input schema for formalization narsese. */
const FormalizationNarseseInput = z.object({
  text: nonEmpty,
  context: z.string().optional(),
}).strict();

/** Output schema for formalization narsese. */
const FormalizationNarseseOutput = z.object({
  term: nonEmpty,
  confidence: unitInterval,
}).strict();

/** Input schema for formalization prolog. */
const FormalizationPrologInput = z.object({
  text: nonEmpty,
  context: z.string().optional(),
}).strict();

/** Output schema for formalization prolog. */
const FormalizationPrologOutput = z.object({
  clauses: z.array(nonEmpty),
}).strict();

/** Input schema for distillation train. */
const DistillationTrainInput = z.object({
  dataset: z.array(z.object({
    input: z.string(),
    output: z.string(),
  })),
  epochs: positiveInt.optional(),
}).strict();

/** Output schema for distillation train. */
const DistillationTrainOutput = z.object({
  modelPath: z.string(),
  metrics: z.object({
    loss: z.number(),
    accuracy: unitInterval,
  }),
}).strict();

/** Input schema for distillation predict. */
const DistillationPredictInput = z.object({
  input: nonEmpty,
  modelPath: z.string(),
}).strict();

/** Output schema for distillation predict. */
const DistillationPredictOutput = z.object({
  output: z.string(),
  confidence: unitInterval,
}).strict();

/** Input schema for GBNF generate. */
const GbnfGenerateInput = z.object({
  grammar: nonEmpty,
  prompt: z.string().optional(),
  maxTokens: positiveInt.optional(),
}).strict();

/** Output schema for GBNF generate. */
const GbnfGenerateOutput = z.object({
  text: z.string(),
  valid: z.boolean(),
}).strict();

/** Input schema for credit assignment evaluate. */
const CreditAssignmentInput = z.object({
  derivationId: nonEmpty,
  premises: z.array(nonEmpty),
  conclusion: nonEmpty,
}).strict();

/** Output schema for credit assignment evaluate. */
const CreditAssignmentOutput = z.object({
  credit: unitInterval,
  breakdown: z.record(z.string(), z.number()),
}).strict();

/** Input schema for cascade gates execute. */
const CascadeGatesInput = z.object({
  gates: z.array(z.object({
    name: nonEmpty,
    condition: z.string(),
  })),
  context: z.record(z.string(), z.unknown()),
}).strict();

/** Output schema for cascade gates execute. */
const CascadeGatesOutput = z.object({
  passed: z.boolean(),
  failedGates: z.array(nonEmpty),
  trace: z.array(z.object({
    gate: nonEmpty,
    result: z.boolean(),
    reason: z.string().optional(),
  })),
}).strict();

/** Input schema for learned head predict. */
const LearnedHeadInput = z.object({
  features: z.array(z.number()),
  headId: nonEmpty,
}).strict();

/** Output schema for learned head predict. */
const LearnedHeadOutput = z.object({
  prediction: z.number(),
  confidence: unitInterval,
}).strict();

/** Input schema for imagination simulate. */
const ImaginationInput = z.object({
  state: z.record(z.string(), z.unknown()),
  horizon: positiveInt.optional(),
  numTrajectories: positiveInt.optional(),
}).strict();

/** Output schema for imagination simulate. */
const ImaginationOutput = z.object({
  trajectories: z.array(z.object({
    states: z.array(z.record(z.string(), z.unknown())),
    rewards: z.array(z.number()),
    totalReward: z.number(),
  })),
}).strict();

/** Input schema for lemma promotion score. */
const LemmaPromotionInput = z.object({
  lemma: nonEmpty,
  evidence: z.array(z.object({
    premise: nonEmpty,
    weight: unitInterval,
  })),
}).strict();

/** Output schema for lemma promotion score. */
const LemmaPromotionOutput = z.object({
  score: unitInterval,
  shouldPromote: z.boolean(),
}).strict();

/** Input schema for engine clingo. */
const ClingoInput = z.object({
  program: nonEmpty,
  timeoutMs: positiveInt.optional(),
}).strict();

/** Output schema for engine clingo. */
const ClingoOutput = z.object({
  result: z.enum(['sat', 'unsat', 'unknown']),
  models: z.array(z.record(z.string(), z.unknown())).optional(),
  timeMs: nonNegativeInt,
}).strict();

/** Input schema for engine minisat. */
const MinisatInput = z.object({
  cnf: nonEmpty,
  timeoutMs: positiveInt.optional(),
}).strict();

/** Output schema for engine minisat. */
const MinisatOutput = z.object({
  result: z.enum(['sat', 'unsat', 'unknown']),
  model: z.array(z.number().int()).optional(),
  timeMs: nonNegativeInt,
}).strict();

/** Input schema for engine tau-prolog. */
const TauPrologInput = z.object({
  program: nonEmpty,
  query: nonEmpty,
  timeoutMs: positiveInt.optional(),
}).strict();

/** Output schema for engine tau-prolog. */
const TauPrologOutput = z.object({
  solutions: z.array(z.record(z.string(), z.unknown())),
  timeMs: nonNegativeInt,
}).strict();

/** All oracle specifications — single source of truth. */
export const ORACLE_SPECS: Record<string, OracleSpec> = {
  'lm.generateText': {
    operation: 'lm.generateText',
    provider: 'openai',
    name: 'LM Text Generation',
    description: 'Generate text using an LM provider (OpenAI, Anthropic, llama.cpp)',
    inputSchema: LmGenerateInput,
    outputSchema: LmGenerateOutput,
    defaultConfig: { temperature: 0.7, maxTokens: 2048 },
    requiredEnv: ['OPENAI_API_KEY'],
    costMilli: 500,
    maxLatencyMs: 30000,
    offlineCapable: false,
  },
  'lm.generateText.llamacpp': {
    operation: 'lm.generateText',
    provider: 'llamacpp',
    name: 'LM Text Generation (llama.cpp)',
    description: 'Generate text using local llama.cpp',
    inputSchema: LmGenerateInput,
    outputSchema: LmGenerateOutput,
    defaultConfig: { temperature: 0.7, maxTokens: 2048 },
    requiredEnv: ['LM_LLAMACPP_MODEL'],
    costMilli: 0,
    maxLatencyMs: 60000,
    offlineCapable: true,
  },
  'lm.embed': {
    operation: 'lm.embed',
    provider: 'openai',
    name: 'LM Embeddings',
    description: 'Generate embeddings using OpenAI',
    inputSchema: LmEmbedInput,
    outputSchema: LmEmbedOutput,
    defaultConfig: { model: 'text-embedding-3-small' },
    requiredEnv: ['OPENAI_API_KEY'],
    costMilli: 100,
    maxLatencyMs: 10000,
    offlineCapable: false,
  },
  'lm.embed.llamacpp': {
    operation: 'lm.embed',
    provider: 'llamacpp',
    name: 'LM Embeddings (llama.cpp)',
    description: 'Generate embeddings using local llama.cpp',
    inputSchema: LmEmbedInput,
    outputSchema: LmEmbedOutput,
    defaultConfig: {},
    requiredEnv: ['LM_LLAMACPP_MODEL'],
    costMilli: 0,
    maxLatencyMs: 30000,
    offlineCapable: true,
  },
  'engine.z3': {
    operation: 'engine.z3',
    provider: 'z3',
    name: 'Z3 SMT Solver',
    description: 'Solve SMT constraints using Z3',
    inputSchema: Z3Input,
    outputSchema: Z3Output,
    defaultConfig: { timeoutMs: 30000 },
    costMilli: 0,
    maxLatencyMs: 30000,
    offlineCapable: true,
  },
  'engine.clingo': {
    operation: 'engine.clingo',
    provider: 'clingo',
    name: 'Clingo ASP Solver',
    description: 'Solve Answer Set Programming problems using Clingo',
    inputSchema: ClingoInput,
    outputSchema: ClingoOutput,
    defaultConfig: { timeoutMs: 30000 },
    costMilli: 0,
    maxLatencyMs: 30000,
    offlineCapable: true,
  },
  'engine.minisat': {
    operation: 'engine.minisat',
    provider: 'minisat',
    name: 'MiniSat SAT Solver',
    description: 'Solve SAT problems using MiniSat',
    inputSchema: MinisatInput,
    outputSchema: MinisatOutput,
    defaultConfig: { timeoutMs: 30000 },
    costMilli: 0,
    maxLatencyMs: 30000,
    offlineCapable: true,
  },
  'engine.tau-prolog': {
    operation: 'engine.tau-prolog',
    provider: 'tau-prolog',
    name: 'Tau Prolog Engine',
    description: 'Execute Prolog queries using Tau Prolog',
    inputSchema: TauPrologInput,
    outputSchema: TauPrologOutput,
    defaultConfig: { timeoutMs: 30000 },
    costMilli: 0,
    maxLatencyMs: 30000,
    offlineCapable: true,
  },
  'retrieval.semantic': {
    operation: 'retrieval.semantic',
    provider: 'custom',
    name: 'Semantic Retrieval',
    description: 'Retrieve relevant documents using semantic similarity',
    inputSchema: RetrievalInput,
    outputSchema: RetrievalOutput,
    defaultConfig: { topK: 10 },
    costMilli: 0,
    maxLatencyMs: 5000,
    offlineCapable: true,
  },
  'retrieval.keyword': {
    operation: 'retrieval.keyword',
    provider: 'custom',
    name: 'Keyword Retrieval',
    description: 'Retrieve relevant documents using keyword matching',
    inputSchema: RetrievalInput,
    outputSchema: RetrievalOutput,
    defaultConfig: { topK: 10 },
    costMilli: 0,
    maxLatencyMs: 1000,
    offlineCapable: true,
  },
  'formalization.narsese': {
    operation: 'formalization.narsese',
    provider: 'custom',
    name: 'Narsese Formalization',
    description: 'Convert natural language to Narsese',
    inputSchema: FormalizationNarseseInput,
    outputSchema: FormalizationNarseseOutput,
    defaultConfig: {},
    costMilli: 0,
    maxLatencyMs: 5000,
    offlineCapable: true,
  },
  'formalization.prolog': {
    operation: 'formalization.prolog',
    provider: 'custom',
    name: 'Prolog Formalization',
    description: 'Convert natural language to Prolog',
    inputSchema: FormalizationPrologInput,
    outputSchema: FormalizationPrologOutput,
    defaultConfig: {},
    costMilli: 0,
    maxLatencyMs: 5000,
    offlineCapable: true,
  },
  'distillation.train': {
    operation: 'distillation.train',
    provider: 'custom',
    name: 'Distillation Training',
    description: 'Train a distilled model from teacher predictions',
    inputSchema: DistillationTrainInput,
    outputSchema: DistillationTrainOutput,
    defaultConfig: { epochs: 10 },
    costMilli: 0,
    maxLatencyMs: 300000,
    offlineCapable: true,
  },
  'distillation.predict': {
    operation: 'distillation.predict',
    provider: 'custom',
    name: 'Distillation Prediction',
    description: 'Run inference with a distilled model',
    inputSchema: DistillationPredictInput,
    outputSchema: DistillationPredictOutput,
    defaultConfig: {},
    costMilli: 0,
    maxLatencyMs: 1000,
    offlineCapable: true,
  },
  'gbnf.generate': {
    operation: 'gbnf.generate',
    provider: 'custom',
    name: 'GBNF Grammar Generation',
    description: 'Generate text constrained by a GBNF grammar',
    inputSchema: GbnfGenerateInput,
    outputSchema: GbnfGenerateOutput,
    defaultConfig: { maxTokens: 512 },
    costMilli: 0,
    maxLatencyMs: 10000,
    offlineCapable: true,
  },
  'credit-assignment.evaluate': {
    operation: 'credit-assignment.evaluate',
    provider: 'custom',
    name: 'Credit Assignment Evaluation',
    description: 'Evaluate credit assignment for a derivation',
    inputSchema: CreditAssignmentInput,
    outputSchema: CreditAssignmentOutput,
    defaultConfig: {},
    costMilli: 0,
    maxLatencyMs: 1000,
    offlineCapable: true,
  },
  'cascade-gates.execute': {
    operation: 'cascade-gates.execute',
    provider: 'custom',
    name: 'Cascade Gates Execution',
    description: 'Execute a cascade of gates for decision making',
    inputSchema: CascadeGatesInput,
    outputSchema: CascadeGatesOutput,
    defaultConfig: {},
    costMilli: 0,
    maxLatencyMs: 5000,
    offlineCapable: true,
  },
  'learned-head.predict': {
    operation: 'learned-head.predict',
    provider: 'custom',
    name: 'Learned Head Prediction',
    description: 'Run prediction with a learned head',
    inputSchema: LearnedHeadInput,
    outputSchema: LearnedHeadOutput,
    defaultConfig: {},
    costMilli: 0,
    maxLatencyMs: 1000,
    offlineCapable: true,
  },
  'imagination.simulate': {
    operation: 'imagination.simulate',
    provider: 'custom',
    name: 'Imagination Simulation',
    description: 'Simulate future trajectories using imagination',
    inputSchema: ImaginationInput,
    outputSchema: ImaginationOutput,
    defaultConfig: { horizon: 10, numTrajectories: 5 },
    costMilli: 0,
    maxLatencyMs: 30000,
    offlineCapable: true,
  },
  'lemma-promotion.score': {
    operation: 'lemma-promotion.score',
    provider: 'custom',
    name: 'Lemma Promotion Scoring',
    description: 'Score a lemma for promotion to belief',
    inputSchema: LemmaPromotionInput,
    outputSchema: LemmaPromotionOutput,
    defaultConfig: {},
    costMilli: 0,
    maxLatencyMs: 1000,
    offlineCapable: true,
  },
};

/** Create a validated oracle config from a spec with optional overrides. */
export function createOracleConfig(
  specKey: string,
  overrides?: Record<string, unknown>
): OracleSpec & { config: Record<string, unknown> } {
  const spec = ORACLE_SPECS[specKey];
  if (!spec) {
    throw new Error(`Unknown oracle spec: ${specKey}`);
  }
  return {
    ...spec,
    config: { ...spec.defaultConfig, ...overrides },
  };
}

/** Get all specs for a given operation (e.g., all 'lm.generateText' providers). */
export function getSpecsByOperation(operation: OracleOperation): OracleSpec[] {
  return Object.values(ORACLE_SPECS).filter((s) => s.operation === operation);
}

/** Get all specs for a given provider. */
export function getSpecsByProvider(provider: OracleProvider): OracleSpec[] {
  return Object.values(ORACLE_SPECS).filter((s) => s.provider === provider);
}

/** Validate an oracle config against its spec. */
export function validateOracleConfig(specKey: string, config: unknown): void {
  const spec = ORACLE_SPECS[specKey];
  if (!spec) {
    throw new Error(`Unknown oracle spec: ${specKey}`);
  }
  spec.inputSchema.parse(config);
}