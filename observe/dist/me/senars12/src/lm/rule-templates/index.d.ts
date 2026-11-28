/**
 * The shipped LM rule set, and the lookup over it.
 *
 * A rule's prompt is a field of its definition, beside its fallback and schema:
 * it was a parallel table keyed by the same ids, which nothing checked for
 * agreement, so a renamed rule kept compiling and reached the LM with `undefined`
 * in its prompt. The registry owns that table and the id lookup together, which
 * is why `createRule` is handed a definition rather than reaching for one — the
 * builder importing the registry is what closed the seven-module cycle.
 */
import type { LMRuleDefinition } from './definition';
export type { LMRuleDefinition } from './definition';
export declare const ruleDefs: LMRuleDefinition[];
export declare const getRuleDef: (id: string) => LMRuleDefinition;
//# sourceMappingURL=index.d.ts.map