/**
 * The vocabulary a rule template is written in.
 *
 * A leaf, deliberately: the templates declare `LMRuleDefinition[]` and the
 * builder consumes the same shape, so when the type lived beside the builder
 * every template imported the builder to name it and the builder imported the
 * templates to find a definition — a cycle through seven modules for one
 * interface. The declaration vocabulary is data about a rule, so it belongs with
 * the templates, and the builder reaches down to it.
 */
import type { Term } from '../../terms';
import type { Task, TaskType } from '../../types';

/** Activation predicate over the two premise terms and their context. */
export type RuleActivation = (
  primary: Term,
  secondary?: Term,
  context?: Record<string, unknown>
) => boolean;

/** Pure-NAL body, invoked when the model's call fails or is refused. */
export type RuleFallback = (
  primary: Term,
  secondary?: Term,
  context?: Record<string, unknown>
) => Task[] | null;
export interface LMRuleDefinition {
  id: string;
  /** The rule's prompt, before the shared Narsese preamble. */
  prompt: string;
  name: string;
  description: string;
  priority: number;
  singlePremise?: boolean;
  taskType?: TaskType;
  budget?: number;
  multiline?: boolean;
  activationCondition?: RuleActivation;
  schema?: import('zod').ZodSchema;
  enableTools?: boolean;
  constitutionAware?: boolean;
  /** GBNF grammar name (constrained decoding) or inline grammar text. */
  grammar?: string;
  maxOutputTokens?: number;
  fallback?: RuleFallback;
}
