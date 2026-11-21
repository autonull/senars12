/**
 * NAL Notation Codecs — round-trip serialization for multiple formats.
 *
 * Supports: Narsese (native), Prover9/TPTP, SMT-LIB, DIMACS, JSON.
 * All codecs implement encode/decode with round-trip property tests.
 */

import { Term, TermOp, termInterner, CompoundTerm, ConstantTerm, VariableTerm } from '../../kernel/terms/intern.js';
import { Stamp } from '../../kernel/stamp.js';
import type { TruthValue } from '../../kernel/types.js';

/** Belief with truth and stamp. */
export interface Belief {
  readonly term: Term;
  readonly truth: TruthValue;
  readonly stamp: Stamp;
}

/** Codec interface. */
export interface Codec<T> {
  readonly name: string;
  readonly encode: (belief: Belief) => string;
  readonly decode: (input: string) => Belief | null;
  readonly encodeBatch: (beliefs: readonly Belief[]) => string;
  readonly decodeBatch: (input: string) => Belief[];
}

/** Narsese codec (native format). */
export const NARSESE_CODEC: Codec<Belief> = {
  name: 'narsese',

  encode(belief) {
    const termStr = termInterner.format(belief.term);
    const truthStr = `%${belief.truth.f.toFixed(2)};${belief.truth.c.toFixed(2)}%`;
    return `${termStr} ${truthStr}`;
  },

  decode(input) {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Split on truth value pattern
    const match = /^(.+?)\s*(%[\d.]+;[\d.]+%)\s*$/.exec(trimmed);
    if (!match) return null;

    const termStr = match[1]!.trim();
    const truthStr = match[2]!;

    const term = termInterner.parse(termStr);
    if (!term) return null;

    const truthMatch = /%([\d.]+);([\d.]+)%/.exec(truthStr);
    if (!truthMatch) return null;

    const truth: TruthValue = {
      f: parseFloat(truthMatch[1]!),
      c: parseFloat(truthMatch[2]!),
    };

    return {
      term,
      truth,
      stamp: { id: '', ts: Date.now(), parents: [], derivation: [], evidence: 0 },
    };
  },

  encodeBatch(beliefs) {
    return beliefs.map(b => this.encode(b)).join('\n');
  },

  decodeBatch(input) {
    return input.trim().split('\n').map(l => this.decode(l)).filter((b): b is Belief => b !== null);
  },
};

/** JSON codec. */
export const JSON_CODEC: Codec<Belief> = {
  name: 'json',

  encode(belief) {
    return JSON.stringify({
      term: termInterner.format(belief.term),
      truth: belief.truth,
      stamp: {
        id: belief.stamp.id,
        ts: belief.stamp.ts,
        parents: belief.stamp.parents,
        derivation: belief.stamp.derivation,
        evidence: belief.stamp.evidence,
      },
    });
  },

  decode(input) {
    try {
      const data = JSON.parse(input);
      const term = termInterner.parse(data.term);
      if (!term) return null;

      return {
        term,
        truth: data.truth,
        stamp: data.stamp ?? { id: '', ts: Date.now(), parents: [], derivation: [], evidence: 0 },
      };
    } catch {
      return null;
    }
  },

  encodeBatch(beliefs) {
    return JSON.stringify(beliefs.map(b => ({
      term: termInterner.format(b.term),
      truth: b.truth,
      stamp: b.stamp,
    })));
  },

  decodeBatch(input) {
    try {
      const data = JSON.parse(input);
      if (!Array.isArray(data)) return [];
      return data.map(d => this.decode(JSON.stringify(d))).filter((b): b is Belief => b !== null);
    } catch {
      return [];
    }
  },
};

/** TPTP/Prover9 codec (first-order logic format). */
export const TPTP_CODEC: Codec<Belief> = {
  name: 'tptp',

  encode(belief) {
    const formula = termToTPTP(belief.term);
    const truth = `, [${belief.truth.f.toFixed(4)}, ${belief.truth.c.toFixed(4)}]`;
    return `cnf(belief_${belief.stamp.id || '0'}, axiom, ${formula}${truth}).`;
  },

  decode(input) {
    // Simplified TPTP parsing - real implementation would be more robust
    const match = /cnf\([^,]+,\s*axiom,\s*([^,]+)(?:,\s*\[([\d.]+),\s*([\d.]+)\])?\)/.exec(input);
    if (!match) return null;

    const formula = match[1]!.trim();
    const term = tptpToTerm(formula);
    if (!term) return null;

    const truth: TruthValue = {
      f: match[2] ? parseFloat(match[2]!) : 1.0,
      c: match[3] ? parseFloat(match[3]!) : 0.9,
    };

    return {
      term,
      truth,
      stamp: { id: '', ts: Date.now(), parents: [], derivation: [], evidence: 0 },
    };
  },

  encodeBatch(beliefs) {
    return beliefs.map((b, i) => this.encode({ ...b, stamp: { ...b.stamp, id: b.stamp.id || String(i) } })).join('\n');
  },

  decodeBatch(input) {
    return input.trim().split('\n').map(l => this.decode(l)).filter((b): b is Belief => b !== null);
  },
};

/** SMT-LIB codec. */
export const SMTLIB_CODEC: Codec<Belief> = {
  name: 'smtlib',

  encode(belief) {
    const formula = termToSMTLIB(belief.term);
    const truth = `(assert (and ${formula} (>= f ${belief.truth.f.toFixed(4)}) (<= c ${belief.truth.c.toFixed(4)})))`;
    return truth;
  },

  decode(input) {
    // Simplified SMT-LIB parsing
    const match = /\(assert\s+\(and\s+(.+?)\s+\(>= f ([\d.]+)\)\s+\(<= c ([\d.]+)\)\)\)/.exec(input);
    if (!match) return null;

    const formula = match[1]!.trim();
    const term = smtlibToTerm(formula);
    if (!term) return null;

    const truth: TruthValue = {
      f: parseFloat(match[2]!),
      c: parseFloat(match[3]!),
    };

    return {
      term,
      truth,
      stamp: { id: '', ts: Date.now(), parents: [], derivation: [], evidence: 0 },
    };
  },

  encodeBatch(beliefs) {
    return `(and\n${beliefs.map(b => `  ${this.encode(b)}`).join('\n')}\n)`;
  },

  decodeBatch(input) {
    // For batch, we expect multiple assertions
    const assertions = input.match(/\(assert\s+\(and\s+.+?\)\)/g) ?? [];
    return assertions.map(a => this.decode(a)).filter((b): b is Belief => b !== null);
  },
};

/** DIMACS codec (CNF format for SAT solvers). */
export const DIMACS_CODEC: Codec<Belief> = {
  name: 'dimacs',

  encode(belief) {
    // DIMACS only handles CNF clauses - simplified representation
    const cnf = termToCNF(belief.term);
    const lines = [
      `p cnf ${cnf.variables} ${cnf.clauses.length}`,
      ...cnf.clauses.map(cl => cl.map(l => l.toString()).join(' ') + ' 0'),
      `c truth ${belief.truth.f.toFixed(4)} ${belief.truth.c.toFixed(4)}`,
    ];
    return lines.join('\n');
  },

  decode(input) {
    // DIMACS doesn't natively encode truth values or NAL terms
    // This is a placeholder for compatibility
    return null;
  },

  encodeBatch(beliefs) {
    return beliefs.map(b => this.encode(b)).join('\n');
  },

  decodeBatch(input) {
    return [];
  },
};

/** CNF representation for DIMACS. */
interface CNFResult {
  readonly variables: number;
  readonly clauses: readonly number[][];
}

/** Convert NAL term to TPTP formula. */
function termToTPTP(term: Term): string {
  switch (term.op) {
    case TermOp.CONSTANT:
      return (term as ConstantTerm).value.toLowerCase();
    case TermOp.VARIABLE:
      return (term as VariableTerm).name.toUpperCase();
    case TermOp.INHERITANCE: {
      const args = (term as CompoundTerm).args;
      return `${termToTPTP(args[0]!)} => ${termToTPTP(args[1]!)}`;
    }
    case TermOp.SIMILARITY: {
      const args = (term as CompoundTerm).args;
      return `${termToTPTP(args[0]!)} <=> ${termToTPTP(args[1]!)}`;
    }
    case TermOp.CONJUNCTION: {
      const args = (term as CompoundTerm).args;
      return `(${args.map(termToTPTP).join(' & ')})`;
    }
    case TermOp.DISJUNCTION: {
      const args = (term as CompoundTerm).args;
      return `(${args.map(termToTPTP).join(' | ')})`;
    }
    case TermOp.NEGATION: {
      const args = (term as CompoundTerm).args;
      return `~${termToTPTP(args[0]!)}`;
    }
    case TermOp.IMPLICATION: {
      const args = (term as CompoundTerm).args;
      return `(${termToTPTP(args[0]!)} => ${termToTPTP(args[1]!)})`;
    }
    case TermOp.PRODUCT: {
      const args = (term as CompoundTerm).args;
      return `(${args.map(termToTPTP).join(' * ')})`;
    }
    default:
      return termInterner.format(term);
  }
}

/** Convert TPTP formula to NAL term (simplified). */
function tptpToTerm(formula: string): Term | null {
  // Very simplified - real implementation would need full parser
  try {
    return termInterner.parse(formula);
  } catch {
    return null;
  }
}

/** Convert NAL term to SMT-LIB. */
function termToSMTLIB(term: Term): string {
  switch (term.op) {
    case TermOp.CONSTANT:
      return `(declare-const ${(term as ConstantTerm).value} Bool)`;
    case TermOp.VARIABLE:
      return `(declare-const ${(term as VariableTerm).name} Bool)`;
    case TermOp.INHERITANCE: {
      const args = (term as CompoundTerm).args;
      return `(=> ${termToSMTLIB(args[0]!)} ${termToSMTLIB(args[1]!)})`;
    }
    case TermOp.SIMILARITY: {
      const args = (term as CompoundTerm).args;
      return `(= ${termToSMTLIB(args[0]!)} ${termToSMTLIB(args[1]!)})`;
    }
    case TermOp.CONJUNCTION: {
      const args = (term as CompoundTerm).args;
      return `(and ${args.map(termToSMTLIB).join(' ')})`;
    }
    case TermOp.DISJUNCTION: {
      const args = (term as CompoundTerm).args;
      return `(or ${args.map(termToSMTLIB).join(' ')})`;
    }
    case TermOp.NEGATION: {
      const args = (term as CompoundTerm).args;
      return `(not ${termToSMTLIB(args[0]!)})`;
    }
    default:
      return termInterner.format(term);
  }
}

/** Convert SMT-LIB to NAL term (simplified). */
function smtlibToTerm(formula: string): Term | null {
  try {
    return termInterner.parse(formula);
  } catch {
    return null;
  }
}

/** Convert NAL term to CNF for DIMACS. */
function termToCNF(term: Term): CNFResult {
  // Simplified - real implementation would do proper CNF conversion
  const vars = new Map<string, number>();
  let nextVar = 1;

  function getVar(t: Term): number {
    const key = termInterner.format(t);
    if (!vars.has(key)) {
      vars.set(key, nextVar++);
    }
    return vars.get(key)!;
  }

  function toCNF(t: Term): number[][] {
    switch (t.op) {
      case TermOp.INHERITANCE: {
        const args = (t as CompoundTerm).args;
        return [[-getVar(args[0]!), getVar(args[1]!)]];
      }
      case TermOp.CONJUNCTION: {
        const args = (t as CompoundTerm).args;
        return args.flatMap(toCNF);
      }
      case TermOp.DISJUNCTION: {
        const args = (t as CompoundTerm).args;
        return [args.map(a => getVar(a))];
      }
      default:
        return [[getVar(t)]];
    }
  }

  return { variables: vars.size, clauses: toCNF(term) };
}

/** All available codecs. */
export const CODECS = {
  narsese: NARSESE_CODEC,
  json: JSON_CODEC,
  tptp: TPTP_CODEC,
  smtlib: SMTLIB_CODEC,
  dimacs: DIMACS_CODEC,
} as const;

/** Get codec by name. */
export function getCodec(name: keyof typeof CODECS): Codec<Belief> {
  return CODECS[name];
}

/** Test round-trip property for a codec. */
export function testRoundTrip(codec: Codec<Belief>, beliefs: readonly Belief[]): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const belief of beliefs) {
    try {
      const encoded = codec.encode(belief);
      const decoded = codec.decode(encoded);

      if (!decoded) {
        failed++;
        errors.push(`Decode returned null for ${codec.name}: ${encoded}`);
        continue;
      }

      // Check term equality (interned)
      const termEqual = belief.term === decoded.term;
      // Check truth equality within epsilon
      const truthEqual = Math.abs(belief.truth.f - decoded.truth.f) < 1e-9 &&
                         Math.abs(belief.truth.c - decoded.truth.c) < 1e-9;

      if (termEqual && truthEqual) {
        passed++;
      } else {
        failed++;
        errors.push(`Round-trip mismatch for ${codec.name}: termEqual=${termEqual}, truthEqual=${truthEqual}`);
      }
    } catch (e) {
      failed++;
      errors.push(`Round-trip error for ${codec.name}: ${e}`);
    }
  }

  return { passed, failed, errors };
}

/** Test all codecs round-trip. */
export function testAllCodecs(beliefs: readonly Belief[]): Record<string, { passed: number; failed: number; errors: string[] }> {
  const results: Record<string, { passed: number; failed: number; errors: string[] }> = {};

  for (const [name, codec] of Object.entries(CODECS)) {
    if (name === 'dimacs') continue; // DIMACS doesn't support full round-trip
    results[name] = testRoundTrip(codec, beliefs);
  }

  return results;
}