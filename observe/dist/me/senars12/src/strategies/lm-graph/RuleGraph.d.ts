import type { Clock } from '@senars/util/clock';
import type { CallTally } from '@senars/util/tally';
/**
 * The read side of a per-rule performance series: *how often did this rule work,
 * and how fast?*
 *
 * Named here and imported by the rule processor, which owns the series, so that
 * "the graph scores from performance" and "the processor records performance" are
 * the same statement seen from two ends rather than two independently-typed
 * shapes that happen to agree.
 */
export type RulePerformance = {
    get(ruleId: string): CallTally | undefined;
};
/**
 * RuleGraph — composite LM-rule strategy using ConceptGraph co-activation edges.
 * Registered as 'lm-graph' strategy in CognitiveRegistry.
 * Fallback edges guarantee non-regression when LM rules fail.
 */
import { ConceptGraph } from '../../memory/ConceptGraph';
import type { ModelRule } from '../../rules/types';
import type { Term } from '../../terms/index';
import type { ModelRuleSelectionContext, ModelRuleSelector } from '../types';
import { Strategy as BaseStrategy } from '../base';
export interface RuleGraphOptions {
    maxNodes?: number;
    maxEdgesPerNode?: number;
    decayRate?: number;
    fallbackWeight?: number;
    /** Injected clock for co-activation stamps (default `systemClock`). */
    clock?: Clock;
}
export declare class RuleGraph extends BaseStrategy implements ModelRuleSelector {
    #private;
    /** Published so a `Memory` can adopt it as its `graph` associative memory. */
    readonly graph: ConceptGraph;
    private readonly fallbackWeight;
    constructor(options?: RuleGraphOptions);
    /** Score selection against the rule processor's performance series. */
    usePerformance(performance: RulePerformance): void;
    /** Select LM rules for a context using co-activation graph. */
    select(rules: ModelRule[], context: ModelRuleSelectionContext): ModelRule[];
    private fallbackSelect;
    private extractFocusTerm;
    /** Update graph with new co-activation from successful derivation. */
    learnFromDerivation(focusTerm: Term, ruleTerm: Term): void;
    /** Decay graph edges periodically. */
    tick(): void;
    getGraphStats(): {
        nodes: number;
        edges: number;
    };
}
//# sourceMappingURL=RuleGraph.d.ts.map