/**
 * Consolidated LM rule definitions. A rule's prompt is a field of its
 * definition, beside its fallback and schema: it was a parallel table keyed by
 * the same ids, which nothing checked for agreement, so a renamed rule kept
 * compiling and reached the LM with `undefined` in its prompt.
 */
import type { LMRuleDefinition } from '../rule-builders.js';
import { beliefRules } from './belief-rules.js';
import { goalRules } from './goal-rules.js';
import { metaRules } from './meta-rules.js';
import { questionRules } from './question-rules.js';

export const ruleDefs: LMRuleDefinition[] = [
  ...beliefRules,
  ...goalRules,
  ...questionRules,
  ...metaRules,
];
