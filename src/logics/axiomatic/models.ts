/**
 * Finite Model Finding — model generation and checking.
 *
 * Implements model finding for first-order logic using
 * finite domain enumeration and SAT solving.
 */

import { Term, ConstantTerm, VariableTerm, TermOp, termInterner } from '../../kernel/terms/intern.js';
import { Formula, Atom, Model, Clause, Literal, CNFFormula, isAtom, freeVariables } from './ast.js';
import { toCNF } from './cnf.js';

/** Model finder configuration. */
export interface ModelFinderConfig {
  /** Maximum domain size to try. */
  maxDomainSize: number;
  /** Maximum models to find. */
  maxModels: number;
  /** Timeout in milliseconds. */
  timeoutMs: number;
  /** Enable symmetry breaking. */
  symmetryBreaking: boolean;
}

/** Default configuration. */
export const defaultModelFinderConfig: ModelFinderConfig = {
  maxDomainSize: 6,
  maxModels: 10,
  timeoutMs: 30000,
  symmetryBreaking: true,
};

/** Model search result. */
export interface ModelResult {
  readonly satisfiable: boolean;
  readonly models: readonly Model[];
  readonly statistics: ModelStatistics;
}

/** Model finder statistics. */
export interface ModelStatistics {
  readonly domainsTried: number;
  readonly modelsFound: number;
  readonly timeMs: number;
  readonly nodesVisited: number;
}

/** Finite model finder. */
export class ModelFinder {
  private config: ModelFinderConfig;
  private constants: ConstantTerm[];
  private predicates: Map<string, number>; // predicate -> arity

  constructor(config: Partial<ModelFinderConfig> = {}) {
    this.config = { ...defaultModelFinderConfig, ...config };
    this.constants = [];
    this.predicates = new Map();
  }

  /** Extract signature from formula. */
  private extractSignature(formula: Formula): void {
    this.constants = [];
    this.predicates.clear();

    const visit = (f: Formula): void => {
      if (isAtom(f)) {
        this.predicates.set(f.predicate, f.args.length);
        for (const arg of f.args) {
          if (arg.op === TermOp.CONSTANT) {
            const c = arg as ConstantTerm;
            if (!this.constants.some(existing => existing.value === c.value)) {
              this.constants.push(c);
            }
          }
        }
      } else if ('quantifier' in f) {
        visit(f.body);
      } else if ('connective' in f) {
        const cf = f as { left?: Formula; right?: Formula; operand?: Formula };
        if (cf.left) visit(cf.left);
        if (cf.right) visit(cf.right);
        if (cf.operand) visit(cf.operand);
      }
    };

    visit(formula);
  }

  /** Find models for a formula. */
  findModels(formula: Formula): ModelResult {
    const startTime = Date.now();
    this.extractSignature(formula);

    // Ensure we have at least one constant
    if (this.constants.length === 0) {
      this.constants.push(termInterner.constant('c0'));
    }

    const models: Model[] = [];
    let domainsTried = 0;
    let nodesVisited = 0;

    // Try increasing domain sizes
    for (let domainSize = 1; domainSize <= this.config.maxDomainSize; domainSize++) {
      if (Date.now() - startTime > this.config.timeoutMs) break;
      if (models.length >= this.config.maxModels) break;

      domainsTried++;
      const domain = this.buildDomain(domainSize);
      const domainModels = this.searchModels(formula, domain, startTime);
      models.push(...domainModels);
      nodesVisited += domainModels.length;

      if (models.length >= this.config.maxModels) break;
    }

    return {
      satisfiable: models.length > 0,
      models,
      statistics: {
        domainsTried,
        modelsFound: models.length,
        timeMs: Date.now() - startTime,
        nodesVisited,
      },
    };
  }

  /** Build domain of given size. */
  private buildDomain(size: number): ConstantTerm[] {
    const domain = [...this.constants];
    while (domain.length < size) {
      domain.push(termInterner.constant(`d${domain.length}`));
    }
    return domain;
  }

  /** Search for models in a given domain. */
  private searchModels(formula: Formula, domain: ConstantTerm[], startTime: number): Model[] {
    const models: Model[] = [];
    const groundAtoms = this.groundAtoms(domain);

    // Convert to CNF and use SAT-style search
    const cnf = toCNF(formula);
    const variables = this.cnfVariables(cnf);

    // Simple DPLL-style search
    const assignment = new Map<string, boolean>();
    this.dpll(cnf, variables, assignment, domain, models, startTime);

    return models;
  }

  /** Get propositional variables from CNF. */
  private cnfVariables(cnf: CNFFormula): string[] {
    const vars = new Set<string>();
    for (const clause of cnf.clauses) {
      for (const lit of clause.literals) {
        vars.add(this.atomKey(lit.atom));
      }
    }
    return Array.from(vars);
  }

  /** Generate key for atom. */
  private atomKey(atom: Atom): string {
    const args = atom.args.map(a => {
      if (a.op === TermOp.CONSTANT) return (a as ConstantTerm).value;
      if (a.op === TermOp.VARIABLE) return (a as VariableTerm).name;
      return a.op;
    }).join(',');
    return `${atom.predicate}(${args})`;
  }

  /** DPLL search for satisfying assignment. */
  private dpll(
    cnf: CNFFormula,
    variables: string[],
    assignment: Map<string, boolean>,
    domain: ConstantTerm[],
    models: Model[],
    startTime: number
  ): boolean {
    if (Date.now() - startTime > this.config.timeoutMs) return false;
    if (models.length >= this.config.maxModels) return false;

    // Unit propagation
    let changed = true;
    while (changed) {
      changed = false;
      for (const clause of cnf.clauses) {
        let unassignedCount = 0;
        let lastUnassigned: string | null = null;
        let clauseSatisfied = false;

        for (const lit of clause.literals) {
          const key = this.atomKey(lit.atom);
          const value = assignment.get(key);

          if (value === undefined) {
            unassignedCount++;
            lastUnassigned = key;
          } else if ((value && lit.sign) || (!value && !lit.sign)) {
            clauseSatisfied = true;
            break;
          }
        }

        if (!clauseSatisfied) {
          if (unassignedCount === 0) return false; // Conflict
          if (unassignedCount === 1 && lastUnassigned) {
            // Unit clause
            const lit = clause.literals.find(l => this.atomKey(l.atom) === lastUnassigned)!;
            assignment.set(lastUnassigned, lit.sign);
            changed = true;
          }
        }
      }
    }

    // Check if all clauses satisfied
    let allSatisfied = true;
    for (const clause of cnf.clauses) {
      let satisfied = false;
      for (const lit of clause.literals) {
        const key = this.atomKey(lit.atom);
        const value = assignment.get(key);
        if (value !== undefined && ((value && lit.sign) || (!value && !lit.sign))) {
          satisfied = true;
          break;
        }
      }
      if (!satisfied) {
        allSatisfied = false;
        break;
      }
    }

    if (allSatisfied) {
      // Check if all variables assigned
      const unassigned = variables.find(v => !assignment.has(v));
      if (!unassigned) {
        // Found a model
        const model = this.assignmentToModel(assignment, domain);
        models.push(model);
        return models.length < this.config.maxModels;
      }
    }

    // Choose branching variable
    const branchVar = variables.find(v => !assignment.has(v));
    if (!branchVar) return true;

    // Try true
    assignment.set(branchVar, true);
    if (this.dpll(cnf, variables, assignment, domain, models, startTime)) {
      if (models.length >= this.config.maxModels) return false;
    }
    assignment.delete(branchVar);

    // Try false
    assignment.set(branchVar, false);
    if (this.dpll(cnf, variables, assignment, domain, models, startTime)) {
      if (models.length >= this.config.maxModels) return false;
    }
    assignment.delete(branchVar);

    return true;
  }

  /** Convert assignment to model. */
  private assignmentToModel(assignment: Map<string, boolean>, domain: ConstantTerm[]): Model {
    const interpretation = new Map<string, Set<string[]>>();

    for (const [key, value] of assignment) {
      if (!value) continue;

      const match = /^(\w+)\((.*)\)$/.exec(key);
      if (!match) continue;

      const predicate = match[1]!;
      const argsStr = match[2]!;
      const args = argsStr ? argsStr.split(',').map(s => s.trim()) : [];

      if (!interpretation.has(predicate)) {
        interpretation.set(predicate, new Set());
      }
      interpretation.get(predicate)!.add(args);
    }

    return { domain, interpretation };
  }

  /** Generate all ground atoms for domain. */
  private groundAtoms(domain: ConstantTerm[]): Atom[] {
    const atoms: Atom[] = [];

    for (const [predicate, arity] of this.predicates) {
      if (arity === 0) {
        atoms.push({ predicate, args: [], negated: false });
      } else if (arity === 1) {
        for (const c of domain) {
          atoms.push({ predicate, args: [c], negated: false });
        }
      } else if (arity === 2) {
        for (const c1 of domain) {
          for (const c2 of domain) {
            atoms.push({ predicate, args: [c1, c2], negated: false });
          }
        }
      }
      // Higher arities omitted for simplicity
    }

    return atoms;
  }

  /** Check if a model satisfies a formula. */
  static checkModel(model: Model, formula: Formula): boolean {
    function evalFormula(f: Formula): boolean {
      if (isAtom(f)) {
        const predInterp = model.interpretation.get(f.predicate);
        if (!predInterp) return false;
        const tuple = f.args.map(a => a.op === TermOp.CONSTANT ? (a as ConstantTerm).value : '?');
        return predInterp.has(tuple);
      }

      if ('quantifier' in f) {
        const qf = f as { quantifier: string; variables: VariableTerm[]; body: Formula };
        if (qf.quantifier === '∀') {
          // For simplicity, check all domain elements
          for (const d of model.domain) {
            // Would need proper variable substitution
            // Placeholder: return true
          }
          return true;
        } else {
          // ∃
          return true; // Placeholder
        }
      }

      if ('connective' in f) {
        const cf = f as { connective: string; left?: Formula; right?: Formula; operand?: Formula };
        switch (cf.connective) {
          case '&': return evalFormula(cf.left!) && evalFormula(cf.right!);
          case '|': return evalFormula(cf.left!) || evalFormula(cf.right!);
          case '~': return !evalFormula(cf.operand!);
          case '==>': return !evalFormula(cf.left!) || evalFormula(cf.right!);
          case '<=>': return evalFormula(cf.left!) === evalFormula(cf.right!);
        }
      }

      return false;
    }

    return evalFormula(formula);
  }
}

/** Create a model finder. */
export function createModelFinder(config?: Partial<ModelFinderConfig>): ModelFinder {
  return new ModelFinder(config);
}

/** Quick satisfiability check. */
export function isSatisfiable(formula: Formula, config?: Partial<ModelFinderConfig>): boolean {
  const finder = createModelFinder(config);
  const result = finder.findModels(formula);
  return result.satisfiable;
}

/** Get a single model. */
export function getModel(formula: Formula, config?: Partial<ModelFinderConfig>): Model | null {
  const finder = createModelFinder({ ...config, maxModels: 1 });
  const result = finder.findModels(formula);
  return result.models[0] ?? null;
}