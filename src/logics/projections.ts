/**
 * Projection Rules — admission rules for NAL/Axiomatic/Fuzzy translations.
 *
 * Projections are admitted rules that translate between logical systems,
 * not casts. They preserve truth structure and carry certificates.
 */

import { Term, VariableTerm, TermOp, termInterner } from '../kernel/terms/intern';
import { Truth, type TruthValue } from '../kernel/truth';
import { Formula, Atom, Connective, isAtom, isCompound, implies, iff, and } from './axiomatic/ast';
import { SenarsError } from '../errors/senars-error';

/** Projection direction. */
export type ProjectionDirection = 'NAL_TO_AXIOMATIC' | 'AXIOMATIC_TO_NAL' | 'NAL_TO_FUZZY' | 'FUZZY_TO_NAL';

/** Projection rule. */
export interface ProjectionRule {
  readonly id: string;
  readonly name: string;
  readonly direction: ProjectionDirection;
  readonly condition: (source: ProjectionSource) => boolean;
  readonly project: (source: ProjectionSource) => ProjectionTarget;
  readonly confidence: number; // 0-1, how much confidence is preserved
  readonly certificate?: string; // Certificate template
}

/** Source for projection. */
export interface ProjectionSource {
  readonly term: Term;
  readonly truth: TruthValue;
  readonly stamp: { id: string; derivation: readonly string[] };
  readonly context?: Record<string, unknown>;
}

/** Target of projection. */
export interface ProjectionTarget {
  readonly formula: Formula;
  readonly truth: TruthValue;
  readonly certificate: string;
  readonly metadata: Record<string, unknown>;
}

/** Projection engine. */
export class ProjectionEngine {
  private rules: ProjectionRule[] = [];

  constructor() {
    this.registerBuiltinRules();
  }

  /** Register a projection rule. */
  register(rule: ProjectionRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.confidence - a.confidence);
  }

  /** Get applicable rules for a direction. */
  getRules(direction: ProjectionDirection): ProjectionRule[] {
    return this.rules.filter(r => r.direction === direction);
  }

  /** Apply projection. */
  project(source: ProjectionSource, direction: ProjectionDirection): ProjectionTarget | null {
    const rules = this.getRules(direction);

    for (const rule of rules) {
      if (rule.condition(source)) {
        return rule.project(source);
      }
    }

    return null;
  }

  /** Register built-in projection rules. */
  private registerBuiltinRules(): void {
    // NAL -> Axiomatic: Inheritance to Implication
    this.register({
      id: 'nal_inheritance_to_implication',
      name: 'Inheritance to Implication',
      direction: 'NAL_TO_AXIOMATIC',
      condition: (source) => source.term.op === TermOp.INHERITANCE,
      project: (source) => {
        const term = source.term as import('../kernel/terms/intern').CompoundTerm;
        const subj = term.args[0]!;
        const pred = term.args[1]!;

        const antecedent = this.termToAtom(subj);
        const consequent = this.termToAtom(pred);

        return {
          formula: implies(antecedent, consequent),
          truth: source.truth,
          certificate: `proj_nal_ax_inh_imp(${source.stamp.id})`,
          metadata: { sourceStamp: source.stamp.id, projection: 'inheritance_to_implication' },
        };
      },
      confidence: 0.95,
    });

    // NAL -> Axiomatic: Similarity to Equivalence
    this.register({
      id: 'nal_similarity_to_equivalence',
      name: 'Similarity to Equivalence',
      direction: 'NAL_TO_AXIOMATIC',
      condition: (source) => source.term.op === TermOp.SIMILARITY,
      project: (source) => {
        const term = source.term as import('../kernel/terms/intern').CompoundTerm;
        const subj = term.args[0]!;
        const pred = term.args[1]!;

        const left = this.termToAtom(subj);
        const right = this.termToAtom(pred);

        return {
          formula: iff(left, right),
          truth: source.truth,
          certificate: `proj_nal_ax_sim_iff(${source.stamp.id})`,
          metadata: { sourceStamp: source.stamp.id, projection: 'similarity_to_equivalence' },
        };
      },
      confidence: 0.95,
    });

    // NAL -> Axiomatic: Conjunction
    this.register({
      id: 'nal_conjunction_to_and',
      name: 'Conjunction to And',
      direction: 'NAL_TO_AXIOMATIC',
      condition: (source) => source.term.op === TermOp.CONJUNCTION,
      project: (source) => {
        const term = source.term as import('../kernel/terms/intern').CompoundTerm;
        const formulas = term.args.map(arg => this.termToAtom(arg));

        let formula: Formula = formulas[0]!;
        for (let i = 1; i < formulas.length; i++) {
          formula = and(formula, formulas[i]!);
        }

        return {
          formula,
          truth: source.truth,
          certificate: `proj_nal_ax_conj_and(${source.stamp.id})`,
          metadata: { sourceStamp: source.stamp.id, projection: 'conjunction_to_and' },
        };
      },
      confidence: 0.9,
    });

    // Axiomatic -> NAL: Implication to Inheritance (when possible)
    this.register({
      id: 'ax_implication_to_inheritance',
      name: 'Implication to Inheritance',
      direction: 'AXIOMATIC_TO_NAL',
      condition: (source) => {
        const formula = source.context?.formula as Formula | undefined;
        if (!formula || !isCompound(formula)) return false;
        return formula.connective === Connective.IMPLIES && formula.left !== undefined && formula.right !== undefined && isAtom(formula.left) && isAtom(formula.right);
      },
      project: (source) => {
        const formula = source.context?.formula as Formula;
        if (!isCompound(formula)) throw new SenarsError('Expected compound formula', 'VALIDATION_ERROR');
        const left = formula.left as Atom;
        const right = formula.right as Atom;

        const subj = this.atomToTerm(left);
        const pred = this.atomToTerm(right);

        return {
          formula: { predicate: 'inheritance', args: [subj, pred], negated: false },
          truth: source.truth,
          certificate: `proj_ax_nal_imp_inh(${source.stamp.id})`,
          metadata: { projection: 'implication_to_inheritance' },
        };
      },
      confidence: 0.85, // Lower because not all implications are inheritances
    });

    // Axiomatic -> NAL: Equivalence to Similarity
    this.register({
      id: 'ax_equivalence_to_similarity',
      name: 'Equivalence to Similarity',
      direction: 'AXIOMATIC_TO_NAL',
      condition: (source) => {
        const formula = source.context?.formula as Formula | undefined;
        if (!formula || !isCompound(formula)) return false;
        return formula.connective === Connective.IFF && formula.left !== undefined && formula.right !== undefined && isAtom(formula.left) && isAtom(formula.right);
      },
      project: (source) => {
        const formula = source.context?.formula as Formula;
        if (!isCompound(formula)) throw new SenarsError('Expected compound formula', 'VALIDATION_ERROR');
        const left = formula.left as Atom;
        const right = formula.right as Atom;

        const subj = this.atomToTerm(left);
        const pred = this.atomToTerm(right);

        return {
          formula: { predicate: 'similarity', args: [subj, pred], negated: false },
          truth: source.truth,
          certificate: `proj_ax_nal_iff_sim(${source.stamp.id})`,
          metadata: { projection: 'equivalence_to_similarity' },
        };
      },
      confidence: 0.85,
    });

    // NAL -> Fuzzy: Truth to Fuzzy Membership
    this.register({
      id: 'nal_truth_to_fuzzy',
      name: 'Truth to Fuzzy Membership',
      direction: 'NAL_TO_FUZZY',
      condition: () => true,
      project: (source) => {
        // Map (f, c) to fuzzy membership with uncertainty
        const membership = source.truth.f;
        const uncertainty = 1 - source.truth.c;

        return {
          formula: { predicate: 'fuzzy_membership', args: [
            termInterner.constant(membership.toFixed(3)),
            termInterner.constant(uncertainty.toFixed(3)),
          ], negated: false },
          truth: source.truth,
          certificate: `proj_nal_fuzzy_truth(${source.stamp.id})`,
          metadata: { membership, uncertainty, projection: 'truth_to_fuzzy' },
        };
      },
      confidence: 0.8,
    });
  }

  /** Convert NAL term to axiomatic atom. */
  private termToAtom(term: Term): Atom {
    if (term.op === TermOp.CONSTANT) {
      return { predicate: (term as import('../kernel/terms/intern').ConstantTerm).value, args: [], negated: false };
    }
    if (term.op === TermOp.VARIABLE) {
      return { predicate: (term as VariableTerm).name, args: [], negated: false };
    }
    // Compound term - use predicate name
    const ct = term as import('../kernel/terms/intern').CompoundTerm;
    return { predicate: ct.op, args: ct.args, negated: false };
  }

  /** Convert axiomatic atom to NAL term. */
  private atomToTerm(atom: Atom): Term {
    if (atom.args.length === 0) {
      return termInterner.constant(atom.predicate);
    }
    if (atom.args.length === 1) {
      return atom.args[0]!;
    }
    return termInterner.compound(TermOp.PRODUCT, ...atom.args);
  }
}

/** Create projection engine. */
export function createProjectionEngine(): ProjectionEngine {
  return new ProjectionEngine();
}

/** High-level projection function. */
export function project(
  term: Term,
  truth: TruthValue,
  stamp: { id: string; derivation: readonly string[] },
  direction: ProjectionDirection
): ProjectionTarget | null {
  const engine = createProjectionEngine();
  return engine.project({ term, truth, stamp }, direction);
}

/** Batch projection. */
export function projectBatch(
  sources: ProjectionSource[],
  direction: ProjectionDirection
): (ProjectionTarget | null)[] {
  const engine = createProjectionEngine();
  return sources.map(s => engine.project(s, direction));
}

/** Check if projection is lossless (confidence = 1). */
export function isLossless(projection: ProjectionTarget): boolean {
  return projection.metadata.confidence === 1;
}