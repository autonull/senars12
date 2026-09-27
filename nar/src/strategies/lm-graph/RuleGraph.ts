/**
 * RuleGraph — composite LM-rule strategy using ConceptGraph co-activation edges.
 * Registered as 'lm-graph' strategy in CognitiveRegistry.
 * Fallback edges guarantee non-regression when LM rules fail.
 */

import { ConceptGraph, type CoActivationEdge } from '@senars/core/concept-graph';
import type { LMRuleSelector, ComponentMetadata, LMRuleSelectionContext } from '../types.js';
import { CognitiveRegistry } from '../../cognitive/registry.js';
import type { LMRule } from '../../lm/LMRule.js';
import type { Term } from '../../terms/index.js';
import { termsEqual } from '../../terms';

/** Shared ConceptGraph instance for co-activation graph (used by RuleGraph, premise sources, and scorers). */
let sharedConceptGraph: ConceptGraph | null = null;

export function getSharedConceptGraph(): ConceptGraph | null {
  return sharedConceptGraph;
}

export function setSharedConceptGraph(graph: ConceptGraph): void {
  sharedConceptGraph = graph;
}

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

export class RuleGraph implements LMRuleSelector {
  readonly metadata: ComponentMetadata = { name: 'lm-graph', description: 'ConceptGraph-based LM rule selector with RLFPLearner rewards' };
  readonly name = 'lm-graph';

  private readonly graph: ConceptGraph;
  private readonly fallbackWeight: number;
  private readonly rulePerformance = new Map<string, RulePerformance>();

  constructor(options: RuleGraphOptions = {}) {
    this.graph = new ConceptGraph({
      maxNodes: options.maxNodes ?? 5000,
      maxEdgesPerNode: options.maxEdgesPerNode ?? 30,
      decayRate: options.decayRate ?? 0.002,
    });
    setSharedConceptGraph(this.graph);
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
    perf.successRate = perf.successRate * 0.9 + (success ? 0.1 : 0);
    perf.avgLatencyMs = perf.avgLatencyMs * 0.9 + latencyMs * 0.1;
    perf.lastUsed = Date.now();
    this.rulePerformance.set(ruleId, perf);
  }

  /** Select LM rules for a context using co-activation graph. */
  select(rules: LMRule[], context: LMRuleSelectionContext): LMRule[] {
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
        score += Math.min(1, 100 / Math.max(1, perf.avgLatencyMs)) * 0.2;
      }
      for (const edge of coActivations) {
        if (this.ruleMatchesEdge(rule, edge)) {
          score += edge.weight * this.fallbackWeight * 0.5;
        }
      }
      return { rule, score };
    });

    scoredRules.sort((a, b) => b.score - a.score);
    const selected = scoredRules.slice(0, Math.max(1, Math.floor(rules.length * 0.5))).map((s) => s.rule);

    // Activate focus term and selected rule condition terms for future co-activation learning
    this.graph.activate(focusTerm);
    for (const rule of selected) {
      this.graph.activate(focusTerm, rule.condition);
    }

    return selected.length > 0 ? selected : this.fallbackSelect(rules);
  }

  private fallbackSelect(rules: LMRule[]): LMRule[] {
    // Return top-N rules by registration order (no priority field on LM rules)
    const limit = Math.max(1, Math.floor(rules.length * 0.3));
    return rules.slice(0, limit);
  }

  private extractFocusTerm(_context: LMRuleSelectionContext, rules: LMRule[]): Term | null {
    // Simple heuristic: use the highest priority rule's condition term as focus
    if (rules.length === 0) return null;
    const firstRule = rules[0];
    if (!firstRule) return null;
    return firstRule.condition;
  }

  private ruleMatchesEdge(rule: LMRule, edge: CoActivationEdge): boolean {
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

/** Register RuleGraph as 'lm-graph' strategy type. */
export function registerRuleGraph(registry: CognitiveRegistry, options?: RuleGraphOptions): RuleGraph {
  const ruleGraph = new RuleGraph(options);
  registry.register('lm-rule', 'lm-graph', ruleGraph as any);
  return ruleGraph;
}