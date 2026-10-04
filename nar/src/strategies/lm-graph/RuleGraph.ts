import { CallTallySeries, clamp01, createCallTally, flooredRatio, selectTopN } from '@senars/util';

/**
 * Selection weights: how often a rule worked dominates, how fast it answered
 * adjusts, and a co-activation edge confirms. The three were inline literals
 * beside the arithmetic they scored, so a tuning pass had three sites to find.
 */
const SELECTION_WEIGHTS = { successRate: 0.6, latency: 0.2, edge: 0.5 } as const;

/** Latency that earns no credit. Above this a rule is neither rewarded nor punished. */
const LATENCY_CREDIT_MS = 100;

/** Rules tracked for selection scoring — a bounded series, not an open-ended map. */
const MAX_TRACKED_RULES = 512;

/**
 * RuleGraph — composite LM-rule strategy using ConceptGraph co-activation edges.
 * Registered as 'lm-graph' strategy in CognitiveRegistry.
 * Fallback edges guarantee non-regression when LM rules fail.
 */

import { type CoActivationEdge, ConceptGraph } from '../../memory/ConceptGraph.js';

import type { ModelRule } from '../../rules/types.js';
import { termsEqual } from '../../terms';
import type { Term } from '../../terms/index.js';
import type { ComponentMetadata, ModelRuleSelectionContext, ModelRuleSelector } from '../types.js';

export interface RuleGraphOptions {
  maxNodes?: number;
  maxEdgesPerNode?: number;
  decayRate?: number;
  fallbackWeight?: number;
  /** Rules kept for selection scoring; the coldest are evicted first. */
  maxTrackedRules?: number;
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
   * Per-rule success and latency, as a bounded series.
   *
   * An unbounded `Map` keyed by rule id, holding a hand-rolled EWMA the util
   * package already ships as `CallTally` — so rule ids nobody could enumerate
   * grew a map that never shed an entry, and this tally was the one of five the
   * shape existed to replace that had not been converted.
   */
  private readonly rulePerformance: CallTallySeries<string>;

  constructor(options: RuleGraphOptions = {}) {
    this.graph = new ConceptGraph({
      maxNodes: options.maxNodes ?? 5000,
      maxEdgesPerNode: options.maxEdgesPerNode ?? 30,
      decayRate: options.decayRate ?? 0.002,
    });
    this.fallbackWeight = options.fallbackWeight ?? 0.3;
    this.rulePerformance = new CallTallySeries<string>({
      maxSize: options.maxTrackedRules ?? MAX_TRACKED_RULES,
      create: createCallTally,
    });
  }

  /** Register a rule's performance for reward-based edge weighting. */
  recordPerformance(ruleId: string, success: boolean, latencyMs: number): void {
    this.rulePerformance.record(ruleId, success, latencyMs);
  }

  /** Select LM rules for a context using co-activation graph. */
  select(rules: ModelRule[], context: ModelRuleSelectionContext): ModelRule[] {
    if (rules.length === 0) return [];

    // Use focusTerm from context if provided, otherwise extract via heuristic
    const focusTerm = context.focusTerm ?? this.extractFocusTerm(context, rules);
    if (!focusTerm) return this.fallbackSelect(rules);

    const coActivations = this.graph.getCoActivations(focusTerm, 20);
    if (coActivations.length === 0) return this.fallbackSelect(rules);

    const scoredRules = rules.map((rule) => {
      let score = 0;
      const perf = this.rulePerformance.get(rule.id);
      if (perf) {
        score += perf.successRate * SELECTION_WEIGHTS.successRate;
        score +=
          clamp01(flooredRatio(LATENCY_CREDIT_MS, perf.averageDuration)) *
          SELECTION_WEIGHTS.latency;
      }
      for (const edge of coActivations) {
        if (this.ruleMatchesEdge(rule, edge)) {
          score += edge.weight * this.fallbackWeight * SELECTION_WEIGHTS.edge;
        }
      }
      return { rule, score };
    });

    const selected = selectTopN(
      scoredRules,
      Math.max(1, Math.floor(rules.length * 0.5)),
      (s) => s.score
    ).map((s) => s.rule);

    // Activate focus term and selected rule condition terms for future co-activation learning
    this.graph.activate(focusTerm);
    for (const rule of selected) {
      this.graph.activate(focusTerm, rule.condition);
    }

    return selected.length > 0 ? selected : this.fallbackSelect(rules);
  }

  private fallbackSelect(rules: ModelRule[]): ModelRule[] {
    // Return top-N rules by registration order (no priority field on LM rules)
    const limit = Math.max(1, Math.floor(rules.length * 0.3));
    return rules.slice(0, limit);
  }

  private extractFocusTerm(_context: ModelRuleSelectionContext, rules: ModelRule[]): Term | null {
    // Simple heuristic: use the highest priority rule's condition term as focus
    if (rules.length === 0) return null;
    const firstRule = rules[0];
    if (!firstRule) return null;
    return firstRule.condition;
  }

  private ruleMatchesEdge(rule: ModelRule, edge: CoActivationEdge): boolean {
    return termsEqual(rule.condition, edge.targetTerm);
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
