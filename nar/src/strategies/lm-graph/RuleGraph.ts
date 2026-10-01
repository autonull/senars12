import { clamp01, selectTopN, weightedMean } from '@senars/util';

/** Newest sample carries 10% of the mean; the rest is the retained 90%. */
const EWMA_WEIGHT = 9;

/**
 * RuleGraph — composite LM-rule strategy using ConceptGraph co-activation edges.
 * Registered as 'lm-graph' strategy in CognitiveRegistry.
 * Fallback edges guarantee non-regression when LM rules fail.
 */

import { ConceptGraph, type CoActivationEdge } from '../../memory/ConceptGraph.js';

import type { ModelRule } from '../../rules/types.js';
import type { ComponentMetadata, ModelRuleSelectionContext, ModelRuleSelector } from '../types.js';
import type { Term } from '../../terms/index.js';
import { termsEqual } from '../../terms';

export interface RuleGraphOptions {
  maxNodes?: number;
  maxEdgesPerNode?: number;
  decayRate?: number;
  fallbackWeight?: number;
}

interface RulePerformance {
  ruleId: string;
  successRate: number;
  avgLatencyMs: number;
  lastUsed: number;
}

export class RuleGraph implements ModelRuleSelector {
  readonly metadata: ComponentMetadata = { name: 'lm-graph', description: 'ConceptGraph-based LM rule selector with RLFPLearner rewards' };
  readonly name = 'lm-graph';

  /** Published so a `Memory` can adopt it as its `graph` associative memory. */
  readonly graph: ConceptGraph;
  private readonly fallbackWeight: number;
  private readonly rulePerformance = new Map<string, RulePerformance>();

  constructor(options: RuleGraphOptions = {}) {
    this.graph = new ConceptGraph({
      maxNodes: options.maxNodes ?? 5000,
      maxEdgesPerNode: options.maxEdgesPerNode ?? 30,
      decayRate: options.decayRate ?? 0.002,
    });
    this.fallbackWeight = options.fallbackWeight ?? 0.3;
  }

  /** Register a rule's performance for reward-based edge weighting. */
  recordPerformance(ruleId: string, success: boolean, latencyMs: number): void {
    const perf = this.rulePerformance.get(ruleId) ?? {
      ruleId,
      successRate: 0.5,
      avgLatencyMs: latencyMs,
      lastUsed: Date.now(),
    };
    perf.successRate = weightedMean(perf.successRate, EWMA_WEIGHT, success ? 1 : 0);
    perf.avgLatencyMs = weightedMean(perf.avgLatencyMs, EWMA_WEIGHT, latencyMs);
    perf.lastUsed = Date.now();
    this.rulePerformance.set(ruleId, perf);
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
        score += perf.successRate * 0.6;
        score += clamp01(100 / Math.max(1, perf.avgLatencyMs)) * 0.2;
      }
      for (const edge of coActivations) {
        if (this.ruleMatchesEdge(rule, edge)) {
          score += edge.weight * this.fallbackWeight * 0.5;
        }
      }
      return { rule, score };
    });

    const selected = selectTopN(scoredRules, Math.max(1, Math.floor(rules.length * 0.5)), (s) => s.score).map(
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
