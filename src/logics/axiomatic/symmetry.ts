/**
 * Symmetry Detection — symmetry groups for model checking.
 *
 * Detects symmetries in formulas and models to reduce search space.
 */

import { Term, ConstantTerm, VariableTerm, TermOp, termInterner } from '../../kernel/terms/intern.js';
import { Formula, Atom, Model, Permutation, SymmetryGroup, isAtom, isQuantified, isCompound } from './ast.js';

/** Symmetry detection configuration. */
export interface SymmetryConfig {
  /** Maximum permutations to generate. */
  maxPermutations: number;
  /** Enable variable symmetry detection. */
  detectVariableSymmetry: boolean;
  /** Enable constant symmetry detection. */
  detectConstantSymmetry: boolean;
  /** Enable predicate symmetry detection. */
  detectPredicateSymmetry: boolean;
}

/** Default configuration. */
export const defaultSymmetryConfig: SymmetryConfig = {
  maxPermutations: 1000,
  detectVariableSymmetry: true,
  detectConstantSymmetry: true,
  detectPredicateSymmetry: true,
};

/** Symmetry detector. */
export class SymmetryDetector {
  private config: SymmetryConfig;

  constructor(config: Partial<SymmetryConfig> = {}) {
    this.config = { ...defaultSymmetryConfig, ...config };
  }

  /** Detect symmetries in a formula. */
  detectSymmetries(formula: Formula): SymmetryGroup {
    const permutations: Permutation[] = [];
    const generators: Permutation[] = [];

    // Detect variable symmetries
    if (this.config.detectVariableSymmetry) {
      const varPerms = this.detectVariableSymmetries(formula);
      permutations.push(...varPerms);
      generators.push(...varPerms.slice(0, 3)); // First few as generators
    }

    // Detect constant symmetries
    if (this.config.detectConstantSymmetry) {
      const constPerms = this.detectConstantSymmetries(formula);
      permutations.push(...constPerms);
      generators.push(...constPerms.slice(0, 3));
    }

    // Detect predicate symmetries
    if (this.config.detectPredicateSymmetry) {
      const predPerms = this.detectPredicateSymmetries(formula);
      permutations.push(...predPerms);
      generators.push(...predPerms.slice(0, 3));
    }

    return {
      permutations: permutations.slice(0, this.config.maxPermutations),
      generators: generators.slice(0, 10),
    };
  }

  /** Detect variable symmetries (permutations of quantified variables). */
  private detectVariableSymmetries(formula: Formula): Permutation[] {
    const permutations: Permutation[] = [];

    function collectVariables(f: Formula, vars: VariableTerm[]): VariableTerm[] {
      if (isAtom(f)) {
        for (const arg of f.args) {
          if (arg.op === TermOp.VARIABLE && !vars.some(v => v === arg)) {
            vars.push(arg as VariableTerm);
          }
        }
      } else if (isQuantified(f)) {
        for (const v of f.variables) {
          if (!vars.some(existing => existing === v)) {
            vars.push(v);
          }
        }
        return collectVariables(f.body, vars);
      } else if (isCompound(f)) {
        const cf = f as { left?: Formula; right?: Formula; operand?: Formula };
        if (cf.left) vars = collectVariables(cf.left, vars);
        if (cf.right) vars = collectVariables(cf.right, vars);
        if (cf.operand) vars = collectVariables(cf.operand, vars);
      }
      return vars;
    }

    const vars = collectVariables(formula, []);

    // Generate permutations of variables that preserve structure
    // For simplicity, generate all pairwise swaps of same-type variables
    for (let i = 0; i < vars.length; i++) {
      for (let j = i + 1; j < vars.length; j++) {
        const v1 = vars[i]!;
        const v2 = vars[j]!;

        // Check if swapping preserves formula structure
        if (this.canSwapVariables(formula, v1, v2)) {
          const mapping = new Map<Term, Term>();
          mapping.set(v1, v2);
          mapping.set(v2, v1);
          permutations.push({ mapping, order: 2 });
        }
      }
    }

    return permutations;
  }

  /** Check if two variables can be swapped. */
  private canSwapVariables(formula: Formula, v1: VariableTerm, v2: VariableTerm): boolean {
    // Check if both variables appear in same contexts
    const v1Contexts = this.getVariableContexts(formula, v1);
    const v2Contexts = this.getVariableContexts(formula, v2);

    // Simple heuristic: same predicate positions
    return JSON.stringify([...v1Contexts].sort()) === JSON.stringify([...v2Contexts].sort());
  }

  /** Get contexts where variable appears. */
  private getVariableContexts(formula: Formula, variable: VariableTerm): Set<string> {
    const contexts = new Set<string>();

    function visit(f: Formula, context: string): void {
      if (isAtom(f)) {
        for (let i = 0; i < f.args.length; i++) {
          if (f.args[i] === variable) {
            contexts.add(`${f.predicate}[${i}]`);
          }
        }
      } else if (isQuantified(f)) {
        visit(f.body, context);
      } else if (isCompound(f)) {
        const cf = f as { left?: Formula; right?: Formula; operand?: Formula };
        if (cf.left) visit(cf.left, context);
        if (cf.right) visit(cf.right, context);
        if (cf.operand) visit(cf.operand, context);
      }
    }

    visit(formula, '');
    return contexts;
  }

  /** Detect constant symmetries. */
  private detectConstantSymmetries(formula: Formula): Permutation[] {
    const permutations: Permutation[] = [];
    const constants = this.getConstants(formula);

    // Generate permutations of constants that preserve structure
    for (let i = 0; i < constants.length; i++) {
      for (let j = i + 1; j < constants.length; j++) {
        const c1 = constants[i]!;
        const c2 = constants[j]!;

        if (this.canSwapConstants(formula, c1, c2)) {
          const mapping = new Map<Term, Term>();
          mapping.set(c1, c2);
          mapping.set(c2, c1);
          permutations.push({ mapping, order: 2 });
        }
      }
    }

    return permutations;
  }

  /** Get all constants in formula. */
  private getConstants(formula: Formula): ConstantTerm[] {
    const constants: ConstantTerm[] = [];

    function visit(f: Formula): void {
      if (isAtom(f)) {
        for (const arg of f.args) {
          if (arg.op === TermOp.CONSTANT) {
            const c = arg as ConstantTerm;
            if (!constants.some(existing => existing.value === c.value)) {
              constants.push(c);
            }
          }
        }
      } else if (isQuantified(f)) {
        visit(f.body);
      } else if (isCompound(f)) {
        const cf = f as { left?: Formula; right?: Formula; operand?: Formula };
        if (cf.left) visit(cf.left);
        if (cf.right) visit(cf.right);
        if (cf.operand) visit(cf.operand);
      }
    }

    visit(formula);
    return constants;
  }

  /** Check if two constants can be swapped. */
  private canSwapConstants(formula: Formula, c1: ConstantTerm, c2: ConstantTerm): boolean {
    // Check if both constants appear in same predicate positions
    const c1Positions = this.getConstantPositions(formula, c1);
    const c2Positions = this.getConstantPositions(formula, c2);

    return JSON.stringify([...c1Positions].sort()) === JSON.stringify([...c2Positions].sort());
  }

  /** Get positions where constant appears. */
  private getConstantPositions(formula: Formula, constant: ConstantTerm): Set<string> {
    const positions = new Set<string>();

    function visit(f: Formula): void {
      if (isAtom(f)) {
        for (let i = 0; i < f.args.length; i++) {
          if (f.args[i] === constant) {
            positions.add(`${f.predicate}[${i}]`);
          }
        }
      } else if (isQuantified(f)) {
        visit(f.body);
      } else if (isCompound(f)) {
        const cf = f as { left?: Formula; right?: Formula; operand?: Formula };
        if (cf.left) visit(cf.left);
        if (cf.right) visit(cf.right);
        if (cf.operand) visit(cf.operand);
      }
    }

    visit(formula);
    return positions;
  }

  /** Detect predicate symmetries. */
  private detectPredicateSymmetries(formula: Formula): Permutation[] {
    const permutations: Permutation[] = [];
    const predicates = this.getPredicates(formula);

    // Group predicates by arity
    const byArity = new Map<number, string[]>();
    for (const [pred, arity] of predicates) {
      const list = byArity.get(arity) ?? [];
      list.push(pred);
      byArity.set(arity, list);
    }

    // Generate permutations within same arity groups
    for (const [arity, preds] of byArity) {
      if (preds.length < 2) continue;

      for (let i = 0; i < preds.length; i++) {
        for (let j = i + 1; j < preds.length; j++) {
          const p1 = preds[i]!;
          const p2 = preds[j]!;

          if (this.canSwapPredicates(formula, p1, p2)) {
            const mapping = new Map<Term, Term>();
            // Map predicate applications
            mapping.set(termInterner.constant(p1), termInterner.constant(p2));
            mapping.set(termInterner.constant(p2), termInterner.constant(p1));
            permutations.push({ mapping, order: 2 });
          }
        }
      }
    }

    return permutations;
  }

  /** Get all predicates in formula. */
  private getPredicates(formula: Formula): Map<string, number> {
    const predicates = new Map<string, number>();

    function visit(f: Formula): void {
      if (isAtom(f)) {
        predicates.set(f.predicate, f.args.length);
      } else if (isQuantified(f)) {
        visit(f.body);
      } else if (isCompound(f)) {
        const cf = f as { left?: Formula; right?: Formula; operand?: Formula };
        if (cf.left) visit(cf.left);
        if (cf.right) visit(cf.right);
        if (cf.operand) visit(cf.operand);
      }
    }

    visit(formula);
    return predicates;
  }

  /** Check if two predicates can be swapped. */
  private canSwapPredicates(formula: Formula, p1: string, p2: string): boolean {
    // Check if predicates appear in structurally similar contexts
    // For now, allow swap if same arity and no distinguishing constraints
    return true; // Simplified - would need more analysis
  }
}

/** Apply permutation to formula. */
export function applyPermutation(formula: Formula, permutation: Permutation): Formula {
  function apply(f: Formula): Formula {
    if (isAtom(f)) {
      const newArgs = f.args.map(arg => permutation.mapping.get(arg) ?? arg);
      return { ...f, args: newArgs };
    }

    if (isQuantified(f)) {
      const newVars = f.variables.map(v => permutation.mapping.get(v) ?? v) as VariableTerm[];
      return { ...f, variables: newVars, body: apply(f.body) };
    }

    if (isCompound(f)) {
      const cf = f as { left?: Formula; right?: Formula; operand?: Formula };
      return {
        ...f,
        left: cf.left ? apply(cf.left) : undefined,
        right: cf.right ? apply(cf.right) : undefined,
        operand: cf.operand ? apply(cf.operand) : undefined,
      };
    }

    return f;
  }

  return apply(formula);
}

/** Apply permutation to model. */
export function applyPermutationToModel(model: Model, permutation: Permutation): Model {
  const newInterpretation = new Map<string, Set<string[]>>();

  for (const [predicate, tuples] of model.interpretation) {
    // Check if predicate is permuted
    const predConst = termInterner.constant(predicate);
    const mappedPred = permutation.mapping.get(predConst);
    const newPredicate = mappedPred && mappedPred.op === TermOp.CONSTANT
      ? (mappedPred as ConstantTerm).value
      : predicate;

    const newTuples = new Set<string[]>();
    for (const tuple of tuples) {
      const newTuple = tuple.map(arg => {
        const argConst = termInterner.constant(arg);
        const mapped = permutation.mapping.get(argConst);
        return mapped && mapped.op === TermOp.CONSTANT ? (mapped as ConstantTerm).value : arg;
      });
      newTuples.add(newTuple);
    }
    newInterpretation.set(newPredicate, newTuples);
  }

  // Domain permutation
  const newDomain = model.domain.map(d => {
    const mapped = permutation.mapping.get(d);
    return mapped && mapped.op === TermOp.CONSTANT ? mapped : d;
  });

  return { domain: newDomain, interpretation: newInterpretation };
}

/** Check if two models are symmetric. */
export function areModelsSymmetric(model1: Model, model2: Model, group: SymmetryGroup): boolean {
  for (const perm of group.permutations) {
    const transformed = applyPermutationToModel(model1, perm);
    if (modelsEqual(transformed, model2)) return true;
  }
  return false;
}

/** Check model equality. */
function modelsEqual(m1: Model, m2: Model): boolean {
  if (m1.domain.length !== m2.domain.length) return false;
  if (m1.interpretation.size !== m2.interpretation.size) return false;

  for (const [pred, tuples1] of m1.interpretation) {
    const tuples2 = m2.interpretation.get(pred);
    if (!tuples2) return false;
    if (tuples1.size !== tuples2.size) return false;
    for (const t of tuples1) {
      if (!tuples2.has(t)) return false;
    }
  }

  return true;
}

/** Create symmetry detector. */
export function createSymmetryDetector(config?: Partial<SymmetryConfig>): SymmetryDetector {
  return new SymmetryDetector(config);
}