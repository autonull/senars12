/**
 * ProofMettaProposer — learns MeTTa rules from ProofStream via PerceptionGate.SELF_METTA.
 * Refactorer inlines them via the `metta` tool.
 * Closes the MeTTa↔NAL arbiter loop on system's own proofs.
 * Renamed from MettaProposer to avoid collision with reflex/metta-proposer.ts (C13).
 * Implements IProposer for use in Negotiator.
 */

import { mean } from '@senars/util';
import type { DerivationRecord, DerivationStep } from '@senars/kernel/schemas';
import type { Term } from '../terms/index.js';
import { termParser, serializeTerm, TermBuilder } from '../terms/index.js';
import { substituteVariables } from '../terms/substitute.js';
import { agreeByExactAlgebra } from '../reflex/metta-proposer.js';
import type { IProposer, NegotiationInput, ProposerContribution } from '../reflex/Negotiator.js';
import type { ActionProposal, LearningEvent } from '../reflex/Reflex.js';

export interface MettaRule {
  readonly id: string;
  readonly pattern: string; // MeTTa pattern like (= (add $x 0) $x)
  /** Abstracted NAL rule category this pattern was generalized from (e.g. `inheritance`). */
  readonly ruleCategory: string;
  readonly sourceDerivation: string; // derivationId that produced this rule
  readonly confidence: number;
  readonly createdAt: number;
  readonly applications: number;
}

export interface ProofStreamEntry {
  readonly derivation: DerivationRecord;
  readonly timestamp: number;
}

export interface ProofMettaProposerOptions {
  maxRules?: number;
  minConfidence?: number;
  patternMinSupport?: number;
  /** Optional MeTTa evaluator for IProposer.propose — evaluates if learned rules support an action. */
  mettaEvaluator?: (expression: string) => boolean | null;
  /** Optional function to map an action to a MeTTa expression for evaluation. */
  actionToExpression?: (action: string) => string | undefined;
}

/** Internal representation of a generalized rule pattern using Terms with variables. */
interface GeneralizedPattern {
  premises: Term[];
  conclusion: Term;
  ruleId: string; // Abstracted rule identifier
}

export class ProofMettaProposer implements IProposer {
  private readonly rules = new Map<string, MettaRule>();
  private readonly proofStream: ProofStreamEntry[] = [];
  private readonly maxRules: number;
  private readonly minConfidence: number;
  private readonly patternMinSupport: number;
  private readonly mettaEvaluator?: (expression: string) => boolean | null;
  private readonly actionToExpression?: (action: string) => string | undefined;
  private ruleCounter = 0;
  // Persistent pattern counts across all derivations, keyed by serialized pattern
  private readonly patternCounts = new Map<string, { count: number; confidence: number; examples: string[]; pattern: GeneralizedPattern }>();

  constructor(options: ProofMettaProposerOptions = {}) {
    this.maxRules = options.maxRules ?? 100;
    this.minConfidence = options.minConfidence ?? 0.7;
    this.patternMinSupport = options.patternMinSupport ?? 3;
    this.mettaEvaluator = options.mettaEvaluator;
    this.actionToExpression = options.actionToExpression;
  }

  /** Learn MeTTa rules from a proof stream (derivation records). */
  learnFromProofStream(proofStream: ProofStreamEntry[]): MettaRule[] {
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

  /** Extract rewrite patterns from a derivation, accumulating counts across all derivations. */
  private extractPatterns(derivation: DerivationRecord): void {
    for (const step of derivation.steps) {
      const generalized = this.generalizeStep(step);
      if (!generalized) continue;

      const patternKey = this.serializePattern(generalized);
      const existing = this.patternCounts.get(patternKey);
      if (existing) {
        existing.count++;
        existing.confidence = Math.max(existing.confidence, step.truth.confidence);
        existing.examples.push(`${step.ruleId}: ${step.premises.join(', ')} => ${step.conclusion}`);
      } else {
        this.patternCounts.set(patternKey, { 
          count: 1, 
          confidence: step.truth.confidence, 
          examples: [`${step.ruleId}: ${step.premises.join(', ')} => ${step.conclusion}`],
          pattern: generalized
        });
      }
    }

    // Convert frequent patterns to MeTTa rules
    for (const [patternKey, info] of this.patternCounts) {
      if (info.count >= this.patternMinSupport && info.confidence >= this.minConfidence && !this.rules.has(patternKey)) {
        const mettaPattern = this.patternToMetta(info.pattern);
        this.addRule(patternKey, info.pattern, mettaPattern, info.confidence, derivation.derivationId, info.examples);
      }
    }
  }

  /** Generalize a derivation step into a MeTTa rewrite pattern using anti-unification on Terms. */
  private generalizeStep(step: DerivationStep): GeneralizedPattern | null {
    // Parse string terms back to Term objects
    const premises: Term[] = [];
    for (const p of step.premises) {
      const parsed = termParser.parse(p);
      if (parsed) premises.push(parsed);
    }
    const conclusionParsed = termParser.parse(step.conclusion);
    if (!conclusionParsed || premises.length === 0) return null;

    // Anti-unification: find most general pattern by replacing repeated atoms with variables
    const allTerms = [...premises, conclusionParsed];
    const atomCounts = new Map<string, number>();
    
    // Collect all atomic symbols
    for (const term of allTerms) {
      this.collectAtoms(term, atomCounts);
    }

    // Create variable substitutions for atoms appearing multiple times
    const varBindings = new Map<string, Term>();
    let varCounter = 0;
    for (const [atom, count] of atomCounts) {
      if (count > 1) {
        varBindings.set(atom, TermBuilder.atom(`$${++varCounter}`));
      }
    }

    // Apply substitutions to get generalized terms
    const generalizedPremises = premises.map(p => substituteVariables(p, varBindings));
    const generalizedConclusion = substituteVariables(conclusionParsed, varBindings);

    return {
      premises: generalizedPremises,
      conclusion: generalizedConclusion,
      ruleId: this.abstractRuleId(step.ruleId)
    };
  }

  /** Collect all atomic symbols from a Term. */
  private collectAtoms(term: Term, counts: Map<string, number>): void {
    if (term.kind === 'atom') {
      counts.set(term.symbol, (counts.get(term.symbol) ?? 0) + 1);
    } else {
      for (const arg of term.args ?? []) {
        this.collectAtoms(arg, counts);
      }
    }
  }

  /** Abstract a concrete rule ID to a generic pattern category. */
  private abstractRuleId(ruleId: string): string {
    // Map specific rule IDs to generic categories
    if (ruleId.includes('deduction')) return 'deduction';
    if (ruleId.includes('induction')) return 'induction';
    if (ruleId.includes('abduction')) return 'abduction';
    if (ruleId.includes('conjunction')) return 'conjunction';
    if (ruleId.includes('revision')) return 'revision';
    if (ruleId.includes('conversion')) return 'conversion';
    if (ruleId.includes('similarity')) return 'similarity';
    if (ruleId.includes('inheritance')) return 'inheritance';
    if (ruleId.includes('structural')) return 'structural';
    return 'rule';
  }

  /** Serialize a generalized pattern to a string key for Map lookup. */
  private serializePattern(pattern: GeneralizedPattern): string {
    const premiseStrs = pattern.premises.map(p => serializeTerm(p)).join(' ');
    return `${pattern.ruleId}(${premiseStrs}) => ${serializeTerm(pattern.conclusion)}`;
  }

  /** Convert a generalized Term pattern to MeTTa syntax string. */
  private patternToMetta(pattern: GeneralizedPattern): string {
    const premiseStrs = pattern.premises.map(p => serializeTerm(p)).join(' ');
    return ` (= (${premiseStrs}) ${serializeTerm(pattern.conclusion)} )`;
  }

  private addRule(patternKey: string, pattern: GeneralizedPattern, mettaPattern: string, confidence: number, sourceDerivation: string, examples: string[]): void {
    if (this.rules.size >= this.maxRules) {
      this.pruneWeakest();
    }

    const id = `metta-rule-${this.ruleCounter++}`;
    const rule: MettaRule = {
      id,
      pattern: mettaPattern,
      ruleCategory: pattern.ruleId,
      sourceDerivation,
      confidence,
      createdAt: Date.now(),
      applications: 0,
    };
    this.rules.set(patternKey, rule);
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
      avgConfidence: mean(rules, (r) => r.confidence),
    };
  }

  /** IProposer.propose: evaluate reflex proposals against learned MeTTa rules. */
  propose(input: NegotiationInput): ProposerContribution {
    if (!this.mettaEvaluator || !this.actionToExpression || input.reflexProposals.length === 0) {
      return {};
    }
    return agreeByExactAlgebra(input, this.actionToExpression, this.mettaEvaluator, {
      source: 'proof-metta',
      confidence: 1.0,
    });
  }

  /** IProposer.learn: accept learning events (no-op for ProofMettaProposer; learns from derivations via learnFromDerivation). */
  learn(_event: LearningEvent): void {
    // ProofMettaProposer learns from derivation records, not reflex learning events.
    // Derivation learning happens via learnFromDerivation() called from consolidateLearning.
  }
}

export function createProofMettaProposer(options?: ProofMettaProposerOptions): ProofMettaProposer {
  return new ProofMettaProposer(options);
}