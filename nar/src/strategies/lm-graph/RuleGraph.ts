import type { Clock } from '@senars/util';
import {
  type CallTally,
  clamp01,
  flooredRatio,
  incrementCount,
  selectTopN,
  shareCount,
} from '@senars/util';

/**
 * Selection weights: how often a rule worked dominates, how fast it answered
 * adjusts, and a co-activation edge confirms. The three were inline literals
 * beside the arithmetic they scored, so a tuning pass had three sites to find.
 */
const SELECTION_WEIGHTS = { successRate: 0.6, latency: 0.2, edge: 0.5 } as const;

/** Latency that earns no credit. Above this a rule is neither rewarded nor punished. */
const LATENCY_CREDIT_MS = 100;

/**
 * The read side of a per-rule performance series: *how often did this rule work,
 * and how fast?*
 *
 * Named here and imported by the rule processor, which owns the series, so that
 * "the graph scores from performance" and "the processor records performance" are
 * the same statement seen from two ends rather than two independently-typed
 * shapes that happen to agree.
 */
export type RulePerformance = { get(ruleId: string): CallTally | undefined };

/**
 * RuleGraph — composite LM-rule strategy using ConceptGraph co-activation edges.
 * Registered as 'lm-graph' strategy in CognitiveRegistry.
 * Fallback edges guarantee non-regression when LM rules fail.
 */

import { ConceptGraph } from '../../memory/ConceptGraph.js';

import type { ModelRule } from '../../rules/types.js';
import { termKey } from '../../terms';
import type { Term } from '../../terms/index.js';
import type { ComponentMetadata, ModelRuleSelectionContext, ModelRuleSelector } from '../types.js';

export interface RuleGraphOptions {
  maxNodes?: number;
  maxEdgesPerNode?: number;
  decayRate?: number;
  fallbackWeight?: number;
  /** Injected clock for co-activation stamps (default `systemClock`). */
  clock?: Clock;
}

export class RuleGraph implements ModelRuleSelector {
  readonly metadata: ComponentMetadata = {
    name: 'lm-graph',
    description: 'ConceptGraph-based LM rule selector with RLFPLearner rewards',
  };
  readonly name = 'lm-graph';

  /** Published so a `Memory` can adopt it as its `graph` associative memory. */
  readonly graph: ConceptGraph;
  private readonly fallbackWeight: number;
  /**
   * The rule processor's performance series, bound by the controller.
   *
   * This graph used to keep its own tally and have the controller refill it from
   * the execution log after every adaptation — a second record of a fact the
   * processor already had, rebuilt on a drain that only runs on that one path, so
   * a rule selected outside it scored against nothing. Absent until bound, the
   * graph scores on co-activation edges alone.
   */
  #rulePerformance: RulePerformance | undefined;

  constructor(options: RuleGraphOptions = {}) {
    this.graph = new ConceptGraph({
      maxNodes: options.maxNodes ?? 5000,
      maxEdgesPerNode: options.maxEdgesPerNode ?? 30,
      decayRate: options.decayRate ?? 0.002,
      clock: options.clock,
    });
    this.fallbackWeight = options.fallbackWeight ?? 0.3;
  }

  /** Score selection against the rule processor's performance series. */
  usePerformance(performance: RulePerformance): void {
    this.#rulePerformance = performance;
  }

  /** Select LM rules for a context using co-activation graph. */
  select(rules: ModelRule[], context: ModelRuleSelectionContext): ModelRule[] {
    if (rules.length === 0) return [];

    // Use focusTerm from context if provided, otherwise extract via heuristic
    const focusTerm = context.focusTerm ?? this.extractFocusTerm(context, rules);
    if (!focusTerm) return this.fallbackSelect(rules);

    const coActivations = this.graph.getCoActivations(focusTerm, 20);
    if (coActivations.length === 0) return this.fallbackSelect(rules);

    // Edge weight per matched target, folded once for the whole selection. The
    // per-(rule, edge) `termsEqual` this replaced was a recursive descent on both
    // sides of the pair, and the edges do not move while the rules are scored.
    const edgeScoreByTarget = new Map<string, number>();
    for (const edge of coActivations) {
      incrementCount(
        edgeScoreByTarget,
        termKey(edge.targetTerm),
        edge.weight * this.fallbackWeight * SELECTION_WEIGHTS.edge
      );
    }

    const scoredRules = rules.map((rule) => {
      let score = edgeScoreByTarget.get(termKey(rule.condition)) ?? 0;
      const perf = this.#rulePerformance?.get(rule.id);
      if (perf) {
        score += perf.successRate * SELECTION_WEIGHTS.successRate;
        score +=
          clamp01(flooredRatio(LATENCY_CREDIT_MS, perf.averageDuration)) *
          SELECTION_WEIGHTS.latency;
      }
      return { rule, score };
    });

    const selected = selectTopN(scoredRules, shareCount(rules.length, 0.5), (s) => s.score).map(
      (s) => s.rule
    );

    // Activate focus term and selected rule condition terms for future co-activation learning
    this.graph.activate(focusTerm);
    for (const rule of selected) {
      this.graph.activate(focusTerm, rule.condition);
    }

    return selected.length > 0 ? selected : this.fallbackSelect(rules);
  }

  private fallbackSelect(rules: ModelRule[]): ModelRule[] {
    // Return top-N rules by registration order (no priority field on LM rules)
    const limit = shareCount(rules.length, 0.3);
    return rules.slice(0, limit);
  }

  private extractFocusTerm(_context: ModelRuleSelectionContext, rules: ModelRule[]): Term | null {
    // Simple heuristic: use the highest priority rule's condition term as focus
    if (rules.length === 0) return null;
    const firstRule = rules[0];
    if (!firstRule) return null;
    return firstRule.condition;
  }

  /** Update graph with new co-activation from successful derivation. */
  learnFromDerivation(focusTerm: Term, ruleTerm: Term): void {
    this.graph.activate(focusTerm, ruleTerm);
  }

  /** Decay graph edges periodically. */
  tick(): void {
    this.graph.decay();
  }

  getGraphStats(): { nodes: number; edges: number } {
    return this.graph.getStats();
  }
}
