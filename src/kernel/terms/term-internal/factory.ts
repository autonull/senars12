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

  /** Create a compound term. */
  compound(op: TermOp, args: readonly Term[]): CompoundTerm {
    if (op === TermOp.VARIABLE || op === TermOp.CONSTANT) {
      throw new SenarsError('Invalid op for compound term', 'INVALID_TERM_OP');
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

/** Global term factory instance. */
export const termFactory = TermFactory.getInstance();