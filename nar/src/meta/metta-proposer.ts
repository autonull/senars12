/**
 * MettaProposer — learns MeTTa rules from ProofStream via PerceptionGate.SELF_METTA.
 * Refactorer inlines them via the `metta` tool.
 * Closes the MeTTa↔NAL arbiter loop on system's own proofs.
 */

import type { DerivationRecord } from '@senars/kernel/schemas.js';
import type { Term } from '../terms/index.js';
import { serializeTerm } from '../terms/index.js';

export interface MettaRule {
  readonly id: string;
  readonly pattern: string; // MeTTa pattern like (= (add $x 0) $x)
  readonly sourceDerivation: string; // derivationId that produced this rule
  readonly confidence: number;
  readonly createdAt: number;
  readonly applications: number;
}

export interface ProofStreamEntry {
  readonly derivation: DerivationRecord;
  readonly timestamp: number;
}

export interface MettaProposerOptions {
  maxRules?: number;
  minConfidence?: number;
  patternMinSupport?: number;
}

export class MettaProposer {
  private readonly rules = new Map<string, MettaRule>();
  private readonly proofStream: ProofStreamEntry[] = [];
  private readonly maxRules: number;
  private readonly minConfidence: number;
  private readonly patternMinSupport: number;
  private ruleCounter = 0;

  constructor(options: MettaProposerOptions = {}) {
    this.maxRules = options.maxRules ?? 100;
    this.minConfidence = options.minConfidence ?? 0.7;
    this.patternMinSupport = options.patternMinSupport ?? 3;
  }

  /** Learn MeTTa rules from a proof stream (derivation records). */
  learn(proofStream: ProofStreamEntry[]): MettaRule[] {
    for (const entry of proofStream) {
      this.proofStream.push(entry);
      this.extractPatterns(entry.derivation);
    }
    return this.pruneAndRank();
  }

  /** Learn from a single derivation record. */
  learnFromDerivation(derivation: DerivationRecord): MettaRule[] {
    this.proofStream.push({ derivation, timestamp: Date.now() });
    this.extractPatterns(derivation);
    return this.pruneAndRank();
  }

  /** Extract rewrite patterns from a derivation. */
  private extractPatterns(derivation: DerivationRecord): void {
    // Look for repeated inference patterns that can be generalized
    const stepPatterns = new Map<string, { count: number; confidence: number; examples: string[] }>();

    for (const step of derivation.steps) {
      // Create a generalized pattern from the step
      const pattern = this.generalizeStep(step);
      if (!pattern) continue;

      const existing = stepPatterns.get(pattern);
      if (existing) {
        existing.count++;
        existing.confidence = Math.max(existing.confidence, step.truth.confidence);
        existing.examples.push(`${step.ruleId}: ${step.premises.join(', ')} => ${step.conclusion}`);
      } else {
        stepPatterns.set(pattern, { count: 1, confidence: step.truth.confidence, examples: [`${step.ruleId}: ${step.premises.join(', ')} => ${step.conclusion}`] });
      }
    }

    // Convert frequent patterns to MeTTa rules
    for (const [pattern, info] of stepPatterns) {
      if (info.count >= this.patternMinSupport && info.confidence >= this.minConfidence) {
        this.addRule(pattern, info.confidence, derivation.derivationId, info.examples);
      }
    }
  }

  /** Generalize a derivation step into a MeTTa rewrite pattern. */
  private generalizeStep(step: DerivationRecord['steps'][0]): string | null {
    // Simple pattern extraction: look for variable-binding patterns
    // In practice, this would do proper anti-unification
    const premises = step.premises.map((p) => this.abstractTerm(p)).join(' ');
    const conclusion = this.abstractTerm(step.conclusion);
    
    if (premises && conclusion) {
      return ` (= (${step.ruleId} ${premises}) ${conclusion} )`;
    }
    return null;
  }

  /** Abstract concrete terms to variables for pattern generalization. */
  private abstractTerm(termStr: string): string {
    // Replace concrete atoms with variables based on position
    // This is a simplified version; full implementation would do proper anti-unification
    return termStr
      .replace(/\(([a-z][a-z0-9_-]*)\)/g, '($1)') // Keep atoms
      .replace(/\(([A-Z][a-z0-9_-]*)\)/g, '($1)'); // Keep atoms
  }

  private addRule(pattern: string, confidence: number, sourceDerivation: string, examples: string[]): void {
    if (this.rules.size >= this.maxRules) {
      this.pruneWeakest();
    }

    const id = `metta-rule-${this.ruleCounter++}`;
    const rule: MettaRule = {
      id,
      pattern,
      sourceDerivation,
      confidence,
      createdAt: Date.now(),
      applications: 0,
    };
    this.rules.set(id, rule);
  }

  private pruneWeakest(): void {
    const sorted = [...this.rules.entries()].sort((a, b) => a[1].confidence - b[1].confidence);
    const toRemove = sorted.slice(0, Math.floor(this.maxRules * 0.1));
    for (const [id] of toRemove) {
      this.rules.delete(id);
    }
  }

  private pruneAndRank(): MettaRule[] {
    return [...this.rules.values()]
      .sort((a, b) => b.confidence * b.applications - a.confidence * a.applications)
      .slice(0, this.maxRules);
  }

  /** Get all learned rules. */
  getRules(): MettaRule[] {
    return [...this.rules.values()];
  }

  /** Get rules applicable to a term. */
  getRulesForTerm(term: Term): MettaRule[] {
    const termStr = serializeTerm(term);
    return this.getRules().filter((r) => r.pattern.includes(termStr));
  }

  /** Record successful application of a rule. */
  recordApplication(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      // Create updated rule with incremented applications
      const updated: MettaRule = {
        ...rule,
        applications: rule.applications + 1,
      };
      this.rules.set(ruleId, updated);
    }
  }

  /** Export rules as MeTTa program string. */
  exportAsMetta(): string {
    return [...this.rules.values()]
      .map((r) => r.pattern)
      .join('\n');
  }

  /** Get statistics. */
  getStats(): { totalRules: number; proofStreamLength: number; avgConfidence: number } {
    const rules = this.getRules();
    return {
      totalRules: rules.length,
      proofStreamLength: this.proofStream.length,
      avgConfidence: rules.length > 0 ? rules.reduce((sum, r) => sum + r.confidence, 0) / rules.length : 0,
    };
  }
}

export function createMettaProposer(options?: MettaProposerOptions): MettaProposer {
  return new MettaProposer(options);
}