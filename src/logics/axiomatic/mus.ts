/**
 * MUS (Minimal Unsatisfiable Subset) Extraction.
 *
 * Finds minimal unsatisfiable subsets of clauses for debugging
 * and explanation of inconsistencies.
 */

import { TermOp } from '../../kernel/terms/intern';
import { Clause, CNFFormula, MUS, Literal } from './ast';
import type { Clock } from '../../kernel/env';
import { createDefaultClock } from '../../kernel/env';

/** MUS extraction configuration. */
export interface MUSConfig {
  /** Maximum MUSes to find. */
  maxMUSes: number;
  /** Timeout in milliseconds. */
  timeoutMs: number;
  /** Use heuristic ordering. */
  heuristicOrdering: boolean;
}

/** Default configuration. */
export const defaultMUSConfig: MUSConfig = {
  maxMUSes: 10,
  timeoutMs: 30000,
  heuristicOrdering: true,
};

/** MUS extractor. */
export class MUSExtractor {
  private config: MUSConfig;
  private satChecker: SATChecker;

  constructor(config: Partial<MUSConfig> = {}) {
    this.config = { ...defaultMUSConfig, ...config };
    this.satChecker = new SATChecker();
  }

  /** Extract all MUSes from an unsatisfiable CNF. */
  extractAll(cnf: CNFFormula, clock?: Clock): MUS[] {
    const clockInst = clock ?? createDefaultClock();
    const muses: MUS[] = [];
    const clauses = [...cnf.clauses];
    const startTime = clockInst.now();

    // Quick check: if SAT, no MUS
    if (this.satChecker.isSatisfiable(clauses)) {
      return [];
    }

    // Find first MUS using deletion-based approach
    const firstMUS = this.findOneMUS(clauses, clockInst);
    if (firstMUS) {
      muses.push(firstMUS);

      // Find additional MUSes using hitting set dualization
      // (Simplified - just return first MUS for now)
    }

    return muses;
  }

  /** Find a single MUS using deletion-based algorithm. */
  findOneMUS(clauses: readonly Clause[], clock?: Clock): MUS | null {
    const clockInst = clock ?? createDefaultClock();
    const startTime = clockInst.now();
    let currentClauses = [...clauses];

    // Try to remove each clause
    for (let i = 0; i < currentClauses.length; i++) {
      if (clockInst.now() - startTime > this.config.timeoutMs) break;

      const candidate = currentClauses.slice(0, i).concat(currentClauses.slice(i + 1));
      if (!this.satChecker.isSatisfiable(candidate)) {
        // Clause i is necessary, keep it
        currentClauses = candidate;
        i = -1; // Restart from beginning
      }
    }

    return {
      clauses: currentClauses,
      formula: { clauses: currentClauses },
    };
  }

  /** Find MUS using binary search (faster for large clause sets). */
  findOneMUSBinary(clauses: readonly Clause[]): MUS | null {
    let low = 0;
    let high = clauses.length;
    let musClauses = [...clauses];

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const subset = clauses.slice(0, mid + 1);

      if (!this.satChecker.isSatisfiable(subset)) {
        high = mid;
        musClauses = subset;
      } else {
        low = mid + 1;
      }
    }

    // Now minimize
    return this.minimizeMUS(musClauses);
  }

  /** Minimize a MUS by trying to remove clauses. */
  private minimizeMUS(clauses: readonly Clause[]): MUS {
    let current = [...clauses];

    for (let i = 0; i < current.length; i++) {
      const candidate = current.slice(0, i).concat(current.slice(i + 1));
      if (!this.satChecker.isSatisfiable(candidate)) {
        current = candidate;
        i = -1;
      }
    }

    return { clauses: current, formula: { clauses: current } };
  }

  /** Find all MUSes using MARCO algorithm (simplified). */
  findAllMARCO(cnf: CNFFormula, clock?: Clock): MUS[] {
    const clockInst = clock ?? createDefaultClock();
    const muses: MUS[] = [];
    const clauses = [...cnf.clauses];
    const startTime = clockInst.now();

    // Seed with first MUS
    const firstMUS = this.findOneMUS(clauses, clockInst);
    if (!firstMUS) return [];

    muses.push(firstMUS);

    // Block found MUS and search for more
    // (Simplified - would need proper hitting set enumeration)
    return muses;
  }
}

/** Simple SAT checker for clause sets. */
class SATChecker {
  /** Check if clause set is satisfiable using DPLL. */
  isSatisfiable(clauses: readonly Clause[]): boolean {
    if (clauses.length === 0) return true;

    // Collect variables
    const variables = new Set<string>();
    for (const clause of clauses) {
      for (const lit of clause.literals) {
        variables.add(this.literalKey(lit));
      }
    }

    const assignment = new Map<string, boolean>();
    return this.dpll(clauses, Array.from(variables), assignment);
  }

  /** DPLL algorithm. */
  private dpll(clauses: readonly Clause[], variables: string[], assignment: Map<string, boolean>): boolean {
    // Unit propagation
    let changed = true;
    while (changed) {
      changed = false;
      for (const clause of clauses) {
        let unassignedCount = 0;
        let lastUnassigned: string | null = null;
        let clauseSatisfied = false;

        for (const lit of clause.literals) {
          const key = this.literalKey(lit);
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
          if (unassignedCount === 0) return false;
          if (unassignedCount === 1 && lastUnassigned) {
            const lit = clause.literals.find(l => this.literalKey(l) === lastUnassigned)!;
            assignment.set(lastUnassigned, lit.sign);
            changed = true;
          }
        }
      }
    }

    // Check satisfaction
    let allSatisfied = true;
    for (const clause of clauses) {
      let satisfied = false;
      for (const lit of clause.literals) {
        const key = this.literalKey(lit);
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
      const unassigned = variables.find(v => !assignment.has(v));
      if (!unassigned) return true;
    }

    // Branching
    const branchVar = variables.find(v => !assignment.has(v));
    if (!branchVar) return true;

    assignment.set(branchVar, true);
    if (this.dpll(clauses, variables, assignment)) return true;
    assignment.delete(branchVar);

    assignment.set(branchVar, false);
    if (this.dpll(clauses, variables, assignment)) return true;
    assignment.delete(branchVar);

    return false;
  }

  private literalKey(lit: Literal): string {
    const args = lit.atom.args.map(a => {
      if (a.op === TermOp.VARIABLE) return a.name;
      if (a.op === TermOp.CONSTANT) return a.value;
      return a.op;
    }).join(',');
    return `${lit.atom.predicate}(${args})`;
  }
}

/** Create MUS extractor. */
export function createMUSExtractor(config?: Partial<MUSConfig>): MUSExtractor {
  return new MUSExtractor(config);
}

/** Quick MUS extraction. */
export function extractMUS(cnf: CNFFormula, config?: Partial<MUSConfig>): MUS | null {
  const extractor = createMUSExtractor(config);
  return extractor.findOneMUS(cnf.clauses);
}

/** Check if clause set is unsatisfiable and return MUS if so. */
export function checkUnsatisfiable(cnf: CNFFormula, config?: Partial<MUSConfig>): MUS | null {
  const extractor = createMUSExtractor(config);
  if (extractor['satChecker'].isSatisfiable(cnf.clauses)) {
    return null;
  }
  return extractor.findOneMUS(cnf.clauses);
}