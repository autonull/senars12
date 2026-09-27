import type { ZodSchema } from 'zod';
import type { TaskType } from '../../types';
import type { LMRuleConfig } from '../lm-service.js';
import type { LMContext, ValidationResult } from './types.js';
import type { Term } from '../../terms';

export interface LMRuleConfigV2<In = unknown, Out = unknown>
  extends Omit<LMRuleConfig, 'promptTemplate'> {
  inputSchema?: ZodSchema<In>;
  outputSchema?: ZodSchema<Out>;
  validate?: (output: Out) => ValidationResult;
  promptTemplate?: string | ((input: In, context: LMContext) => string);
  promptVersion?: 1 | 2;
  taskType?: TaskType;
  schema?: ZodSchema;
  enableTools?: boolean;
  constitutionAware?: boolean;
  condition?: Term; // NEW: explicit term for RuleGraph co-activation matching
}
