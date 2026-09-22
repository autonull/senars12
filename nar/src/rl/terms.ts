import type { DriveManager } from '../drives/manager.js';
import { SeededRNG } from '../game/SeededRNG.js';
import { type AtomicTerm, type Term, TermBuilder, Truth } from '../index.js';
import type { NAR } from '../nar.js';

/** Safe term builder that asserts non-null for valid RL term constructions */
export function inh(subj: Term, pred: Term): Term {
  const result = TermBuilder.inheritance(subj, pred);
  if (!result) throw new Error(`Invalid inheritance: ${subj} --> ${pred}`);
  return result;
}

export function prod(...terms: Term[]): Term {
  const first = terms[0];
  if (!first) throw new Error('Invalid product: no terms');
  if (terms.length === 1) return first;
  const result = TermBuilder.product(...terms);
  if (!result) throw new Error(`Invalid product: ${terms.map((t) => t.toString()).join(' * ')}`);
  return result;
}

export function atm(symbol: string): AtomicTerm {
  return TermBuilder.atom(symbol);
}

/**
 * Converts RL environment observations to NAR belief tasks
 */
