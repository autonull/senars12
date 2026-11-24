/**
 * Term Factory — creates and interns terms.
 */

import { TermOp } from '../term-ops';
import type { Term, VariableTerm, ConstantTerm, CompoundTerm } from './types';
import { SenarsError } from '../../../errors/senars-error';

/** Term factory with interning. */
export class TermFactory {
  private static instance: TermFactory;
  private internTable = new Map<string, Map<string, Term>>();
  private variableCounter = 0;
  private hashSeed = 0x9e3779b9;

  private constructor() {
    // Initialize intern tables for each op
    for (const op of Object.values(TermOp)) {
      this.internTable.set(op, new Map());
    }
  }

  /** Get the singleton factory. */
  static getInstance(): TermFactory {
    if (!TermFactory.instance) {
      TermFactory.instance = new TermFactory();
    }
    return TermFactory.instance;
  }

  /** Reset the factory (for testing). */
  static reset(): void {
    TermFactory.instance = new TermFactory();
  }

  /** Hash a string to a 32-bit integer. */
  private hashString(str: string): number {
    let hash = this.hashSeed;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(hash ^ str.charCodeAt(i), 0x85ebca6b);
      hash ^= hash >>> 13;
      hash = Math.imul(hash, 0xc2b2ae35);
      hash ^= hash >>> 16;
    }
    return hash >>> 0;
  }

  /** Create a variable term. */
  variable(name: string): VariableTerm {
    const key = `var:${name}`;
    const table = this.internTable.get(TermOp.VARIABLE)!;
    let term = table.get(key);
    if (term) return term as VariableTerm;

    term = Object.freeze({
      op: TermOp.VARIABLE,
      name,
      index: this.variableCounter++,
      hash: this.hashString(key),
      complexity: 1,
    });
    table.set(key, term);
    return term as VariableTerm;
  }

  /** Create a constant term. */
  constant(value: string): ConstantTerm {
    const key = `const:${value}`;
    const table = this.internTable.get(TermOp.CONSTANT)!;
    let term = table.get(key);
    if (term) return term as ConstantTerm;

    term = Object.freeze({
      op: TermOp.CONSTANT,
      value,
      hash: this.hashString(key),
      complexity: 1,
    });
    table.set(key, term);
    return term as ConstantTerm;
  }

  /** Convenience: create inheritance (S --> P). */
  inheritance(subject: Term, predicate: Term): CompoundTerm {
    return this.compound(TermOp.INHERITANCE, [subject, predicate]);
  }

  /** Convenience: create similarity (S <-> P). */
  similarity(subject: Term, predicate: Term): CompoundTerm {
    return this.compound(TermOp.SIMILARITY, [subject, predicate]);
  }

  /** Convenience: create implication (S ==> P). */
  implication(antecedent: Term, consequent: Term): CompoundTerm {
    return this.compound(TermOp.IMPLICATION, [antecedent, consequent]);
  }

  /** Convenience: create predictive implication (S =/> P). */
  predictiveImplication(antecedent: Term, consequent: Term): CompoundTerm {
    return this.compound(TermOp.PREDICTIVE_IMPLICATION, [antecedent, consequent]);
  }

  /** Convenience: create equivalence (S <=> P). */
  equivalence(subject: Term, predicate: Term): CompoundTerm {
    return this.compound(TermOp.EQUIVALENCE, [subject, predicate]);
  }

  /** Convenience: create conjunction (S & P). */
  conjunction(...terms: Term[]): CompoundTerm {
    return this.compound(TermOp.CONJUNCTION, terms);
  }

  /** Convenience: create disjunction (S | P). */
  disjunction(...terms: Term[]): CompoundTerm {
    return this.compound(TermOp.DISJUNCTION, terms);
  }

  /** Convenience: create negation (~S). */
  negation(term: Term): CompoundTerm {
    return this.compound(TermOp.NEGATION, [term]);
  }

  /** Convenience: create product (* S P ...). */
  product(...terms: Term[]): CompoundTerm {
    return this.compound(TermOp.PRODUCT, terms);
  }

  /** Convenience: create prediction (S |=> P). */
  prediction(antecedent: Term, consequent: Term): CompoundTerm {
    return this.compound(TermOp.PREDICTION, [antecedent, consequent]);
  }

  /** Convenience: create sequential (S ; P). */
  sequential(first: Term, second: Term): CompoundTerm {
    return this.compound(TermOp.SEQUENTIAL, [first, second]);
  }

  /** Convenience: create extensional image (@ S). */
  extensionalImage(term: Term): CompoundTerm {
    return this.compound(TermOp.EXTENSIONAL_IMAGE, [term]);
  }

  /** Convenience: create intensional image (# S). */
  intensionalImage(term: Term): CompoundTerm {
    return this.compound(TermOp.INTENSIONAL_IMAGE, [term]);
  }

  /** Create a compound term. */
  compound(op: TermOp, args: readonly Term[]): CompoundTerm {
    if (op === TermOp.VARIABLE || op === TermOp.CONSTANT) {
      throw new SenarsError('Invalid op for compound term', 'VALIDATION_ERROR');
    }

    const argKeys = args.map((a) => a.hash.toString(16)).join(',');
    const key = `comp:${op}:${argKeys}`;
    const table = this.internTable.get(op)!;
    let term = table.get(key);
    if (term) return term as CompoundTerm;

    const complexity = 1 + args.reduce((sum, a) => sum + a.complexity, 0);
    term = Object.freeze({
      op,
      args,
      arity: args.length,
      hash: this.hashString(key),
      complexity,
    });
    table.set(key, term);
    return term as CompoundTerm;
  }

  /** Get interned term or create new. */
  getOrCreate(op: TermOp, args?: readonly Term[] | string, nameOrValue?: string): Term {
    switch (op) {
      case TermOp.VARIABLE:
        return this.variable(args as string);
      case TermOp.CONSTANT:
        return this.constant(args as string);
      default:
        return this.compound(op, args as readonly Term[]);
    }
  }

  /** Get intern table size (for debugging). */
  getInternStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [op, table] of this.internTable) {
      stats[op] = table.size;
    }
    return stats;
  }
}

/** Global term factory instance (getter to always return current singleton). */
export const termFactory = {
  get instance(): TermFactory {
    return TermFactory.getInstance();
  },
  // Proxy all methods to the current instance
  variable(name: string) { return TermFactory.getInstance().variable(name); },
  constant(value: string) { return TermFactory.getInstance().constant(value); },
  compound(op: TermOp, args: readonly Term[]) { return TermFactory.getInstance().compound(op, args); },
  // Add other methods as needed
  inheritance(subject: Term, predicate: Term) { return TermFactory.getInstance().inheritance(subject, predicate); },
  similarity(subject: Term, predicate: Term) { return TermFactory.getInstance().similarity(subject, predicate); },
  implication(antecedent: Term, consequent: Term) { return TermFactory.getInstance().implication(antecedent, consequent); },
  equivalence(subject: Term, predicate: Term) { return TermFactory.getInstance().equivalence(subject, predicate); },
  conjunction(...terms: Term[]) { return TermFactory.getInstance().conjunction(...terms); },
  disjunction(...terms: Term[]) { return TermFactory.getInstance().disjunction(...terms); },
  negation(term: Term) { return TermFactory.getInstance().negation(term); },
  product(...terms: Term[]) { return TermFactory.getInstance().product(...terms); },
  prediction(antecedent: Term, consequent: Term) { return TermFactory.getInstance().prediction(antecedent, consequent); },
  sequential(first: Term, second: Term) { return TermFactory.getInstance().sequential(first, second); },
  extensionalImage(term: Term) { return TermFactory.getInstance().extensionalImage(term); },
  intensionalImage(term: Term) { return TermFactory.getInstance().intensionalImage(term); },
  getOrCreate(op: TermOp, args?: readonly Term[] | string, nameOrValue?: string) { return TermFactory.getInstance().getOrCreate(op, args, nameOrValue); },
  getStats() { return TermFactory.getInstance().getStats(); },
} as TermFactory;