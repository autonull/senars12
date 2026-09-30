/**
 * Derivation record schemas — standalone verifier input: a minimal,
 * dependency-free derivation proof. Used by the standalone Derivation Verifier.
 */

import { parseOrThrow } from '@senars/util';
import { z } from 'zod';
import { TruthValueSchema } from './truth.js';

export const DerivationStepSchema = z.object({
  stepId: z.string().uuid(),
  ruleId: z.string(),
  ruleCategory: z.enum([
    'core',
    'logic',
    'propositional',
    'higher-order',
    'comparison',
    'classical',
    'structural',
    'temporal',
    'procedural',
    'meta-cognitive',
    'variable',
  ]),
  premises: z.array(z.string()), // Term strings
  conclusion: z.string(), // Term string
  truth: TruthValueSchema,
  substitution: z.record(z.string(), z.string()).optional(), // Variable bindings
  premiseTruths: z.array(TruthValueSchema).optional(), // Truth of each premise, in order — enables standalone truth-algebra verification
  evidenceLineage: z.array(z.string().uuid()), // Parent derivation IDs
  independence: z.enum(['independent', 'dependent', 'unknown']),
});

export const DerivationRecordSchema = z.object({
  derivationId: z.string().uuid(),
  taskId: z.string().uuid(),
  goalTerm: z.string(),
  steps: z.array(DerivationStepSchema),
  finalTruth: TruthValueSchema,
  totalCycles: z.number().int().nonnegative(),
  maxDepthReached: z.number().int().nonnegative(),
  timestamp: z.number().int().positive(),
  engine: z.literal('nar'),
});

export type DerivationRecord = z.infer<typeof DerivationRecordSchema>;
export type DerivationStep = z.infer<typeof DerivationStepSchema>;

export const validateDerivationRecord = (record: unknown): DerivationRecord =>
  parseOrThrow(DerivationRecordSchema, 'DerivationRecord', record);
