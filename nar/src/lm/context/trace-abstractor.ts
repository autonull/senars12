import type { DerivationRecord } from '@senars/kernel/schemas';
import { atom, fromNarsese, type Term } from '../../terms/index.js';

export interface CriticalPathStep {
  readonly ruleId: string;
  readonly premises: readonly string[];
  readonly conclusion: string;
}

export interface CriticalPath {
  readonly derivationId: string;
  readonly goalTerm: string;
  readonly steps: readonly CriticalPathStep[];
}

const VARIABLE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Extracts the minimal structural skeleton from a NAL derivation:
 * the critical premise→conclusion path and variable-abstracted term shapes.
 * The Kernel owns all structure here; the LLM only fills semantic gaps.
 */
export class TraceAbstractor {
  /** The exact premises and rule for each step of the derivation. */
  extractCriticalPath(record: DerivationRecord): CriticalPath {
    return {
      derivationId: record.derivationId,
      goalTerm: record.goalTerm,
      steps: record.steps.map((s) => ({
        ruleId: s.ruleId,
        premises: s.premises,
        conclusion: s.conclusion,
      })),
    };
  }

  /**
   * Replaces atoms with positional variables: (cat --> animal) → (?A --> ?B).
   * Compound structure and copulas are preserved so unification can match.
   * Unparseable strings are returned as-is (caller decides fallback).
   */
  extractStructuralSkeleton(term: Term | string): string {
    const parsed = typeof term === 'string' ? fromNarsese(term) : term;
    if (!parsed) return typeof term === 'string' ? term : term.toString();
    return this.#abstract(parsed, new Map()).toString();
  }

  #abstract(term: Term, atomIndex: Map<string, string>): Term {
    if (term.kind === 'atom') {
      if (term.isVariable) return term;
      let v = atomIndex.get(term.symbol);
      if (!v) {
        v = `?${VARIABLE_ALPHABET[atomIndex.size % VARIABLE_ALPHABET.length]}`;
        atomIndex.set(term.symbol, v);
      }
      return atom(v);
    }
    return {
      ...term,
      args: term.args.map((a) => this.#abstract(a, atomIndex)),
      _serialized: undefined,
    } as Term;
  }
}

export const traceAbstractor = new TraceAbstractor();
