/**
 * Kernel Contracts — RuleDescriptor
 * Describes a rule: name, arity, tags for classification.
 * Breaks cycles: strategies/types.ts → LMRule, Concept, Memory, RuleProcessor, Task
 */
export type RuleArity = 1 | 2 | 'n';

export type RuleTag =
  | 'logic'
  | 'syllogistic'
  | 'compositional'
  | 'propositional'
  | 'structural'
  | 'temporal'
  | 'procedural'
  | 'variable'
  | 'meta-cognitive'
  | 'lm'
  | 'higher-order';

export interface RuleDescriptor {
  readonly name: string;
  readonly arity: RuleArity;
  readonly tags: readonly RuleTag[];
  readonly description: string;
  readonly priority: number;
}

export function createRuleDescriptor(
  name: string,
  arity: RuleArity,
  tags: readonly RuleTag[],
  description: string,
  priority: number = 0
): RuleDescriptor {
  return Object.freeze({
    name,
    arity,
    tags,
    description,
    priority,
  });
}

export const STANDARD_RULE_TAGS: readonly RuleTag[] = [
  'logic',
  'syllogistic',
  'compositional',
  'propositional',
  'structural',
  'temporal',
  'procedural',
  'variable',
  'meta-cognitive',
] as const;