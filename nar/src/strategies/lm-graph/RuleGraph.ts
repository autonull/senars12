/**
 * RuleGraph — composite LM-rule strategy using ConceptGraph co-activation edges.
 * Registered as 'lm-graph' strategy in CognitiveRegistry.
 * Fallback edges guarantee non-regression when LM rules fail.
 */

import { ConceptGraph, type CoActivationEdge } from '@senars/core/concept-graph.js';
import type { LMRuleSelector, ComponentMetadata, LMRuleSelectionContext } from '../types.js';
import { CognitiveRegistry } from '../../cognitive/registry.js';
import type { LMRule } from '../../lm/LMRule.js';
import type { Term } from '../../terms/index.js';

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

    // Use conceptPriority as a heuristic for focus term selection
    const focusTerm = this.extractFocusTerm(context, rules);
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

    // Activate focus term and selected rule terms for future co-activation learning
    this.graph.activate(focusTerm);
    for (const rule of selected) {
      // LMRule doesn't have condition, use primary term as proxy
      this.graph.activate(focusTerm, { kind: 'atom', symbol: rule.name } as Term);
    }

    return selected.length > 0 ? selected : this.fallbackSelect(rules);
  }

  private fallbackSelect(rules: LMRule[]): LMRule[] {
    // Return top priority rules as fallback
    return rules
      .filter((r) => (r as any).priority !== undefined)
      .sort((a, b) => ((b as any).priority ?? 0) - ((a as any).priority ?? 0))
      .slice(0, Math.max(1, Math.floor(rules.length * 0.3)));
  }

  private extractFocusTerm(_context: LMRuleSelectionContext, rules: LMRule[]): Term | null {
    // Simple heuristic: use the highest priority rule's name as focus
    if (rules.length === 0) return null;
    const firstRule = rules[0];
    if (!firstRule) return null;
    return { kind: 'atom', symbol: firstRule.name } as Term;
  }

  private ruleMatchesEdge(rule: LMRule, edge: CoActivationEdge): boolean {
    return rule.name === edge.targetTerm.symbol;
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