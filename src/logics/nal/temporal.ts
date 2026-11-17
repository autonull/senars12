/**
 * NAL Temporal Logic — temporal reasoning operators and rules.
 *
 * Extends NAL with temporal operators for reasoning about time,
 * sequences, predictions, and concurrent processes.
 */

import { Term, TermOp, TruthValue } from '../../kernel/terms/intern.js';
import { Truth } from '../../kernel/truth.js';
import { Stamp } from '../../kernel/stamp.js';
import type { Premise } from '../../kernel/step.js';

/** Temporal operators. */
export enum TemporalOp {
  /** Sequential: A ; B (A then B) */
  SEQUENTIAL = ';',
  /** Concurrent: A || B (A and B simultaneously) */
  CONCURRENT = '||',
  /** Prediction: A |> B (A predicts B) */
  PREDICTION = '|>',
  /** Parallel: A |~ B (A and B in parallel, order unknown) */
  PARALLEL = '|~',
  /** Retrospective: A |< B (A retrodicts B) */
  RETROSPECTION = '|<',
}

/** Temporal truth operations. */
export const TemporalTruth = {
  /** Sequential: f = f1*f2, c = c1*c2 */
  sequential: (t1: TruthValue, t2: TruthValue): TruthValue =>
    Truth.deduction(t1, t2),

  /** Concurrent: f = f1*f2, c = min(c1,c2) */
  concurrent: (t1: TruthValue, t2: TruthValue): TruthValue => ({
    f: t1.f * t2.f,
    c: Math.min(t1.c, t2.c),
  }),

  /** Prediction: f = f1*f2, c = c1*c2*f1 */
  prediction: (t1: TruthValue, t2: TruthValue): TruthValue => ({
    f: t1.f * t2.f,
    c: t1.c * t2.c * t1.f,
  }),

  /** Parallel: same as concurrent */
  parallel: (t1: TruthValue, t2: TruthValue): TruthValue => ({
    f: t1.f * t2.f,
    c: Math.min(t1.c, t2.c),
  }),

  /** Retrospection: f = f1*f2, c = c1*c2*f2 */
  retrospection: (t1: TruthValue, t2: TruthValue): TruthValue => ({
    f: t1.f * t2.f,
    c: t1.c * t2.c * t2.f,
  }),
} as const;

/** Temporal rule definitions. */
export const TEMPORAL_RULES = [
  // Sequence introduction: A, B => A ; B
  {
    id: 'sequence_intro',
    name: 'Sequence Introduction',
    category: 'temporal' as const,
    arity: 2 as const,
    premiseRoles: ['first', 'second'],
    truthOp: 'sequential' as const,
    priority: 50,
    condition: (premises: Premise[]) => true,
    buildConclusion: (premises: Premise[]) => {
      return termInterner.sequential(premises[0].term, premises[1].term);
    },
  },

  // Sequence elimination: A ; B => A, B
  {
    id: 'sequence_elim',
    name: 'Sequence Elimination',
    category: 'temporal' as const,
    arity: 1 as const,
    premiseRoles: ['sequence'],
    truthOp: 'deduction' as const,
    priority: 50,
    condition: (premises: Premise[]) => isSequential(premises[0].term),
    buildConclusion: (premises: Premise[]) => {
      const term = premises[0].term;
      // Return first element (could return both as conjunction)
      return term.args[0];
    },
  },

  // Concurrent introduction: A, B => A || B
  {
    id: 'concurrent_intro',
    name: 'Concurrent Introduction',
    category: 'temporal' as const,
    arity: 2 as const,
    premiseRoles: ['first', 'second'],
    truthOp: 'concurrent' as const,
    priority: 45,
    condition: (premises: Premise[]) => true,
    buildConclusion: (premises: Premise[]) => {
      return termInterner.concurrent(premises[0].term, premises[1].term);
    },
  },

  // Concurrent elimination: A || B => A, B
  {
    id: 'concurrent_elim',
    name: 'Concurrent Elimination',
    category: 'temporal' as const,
    arity: 1 as const,
    premiseRoles: ['concurrent'],
    truthOp: 'deduction' as const,
    priority: 45,
    condition: (premises: Premise[]) => isConcurrent(premises[0].term),
    buildConclusion: (premises: Premise[]) => {
      return premises[0].term.args[0];
    },
  },

  // Prediction introduction: A ; B => A |> B
  {
    id: 'prediction_intro',
    name: 'Prediction Introduction',
    category: 'temporal' as const,
    arity: 1 as const,
    premiseRoles: ['sequence'],
    truthOp: 'prediction' as const,
    priority: 55,
    condition: (premises: Premise[]) => isSequential(premises[0].term),
    buildConclusion: (premises: Premise[]) => {
      const term = premises[0].term;
      return termInterner.prediction(term.args[0], term.args[1]);
    },
  },

  // Prediction elimination: A |> B => A ; B
  {
    id: 'prediction_elim',
    name: 'Prediction Elimination',
    category: 'temporal' as const,
    arity: 1 as const,
    premiseRoles: ['prediction'],
    truthOp: 'deduction' as const,
    priority: 55,
    condition: (premises: Premise[]) => isPrediction(premises[0].term),
    buildConclusion: (premises: Premise[]) => {
      const term = premises[0].term;
      return termInterner.sequential(term.args[0], term.args[1]);
    },
  },

  // Temporal deduction: A |> B, A => B
  {
    id: 'temporal_deduction',
    name: 'Temporal Deduction',
    category: 'temporal' as const,
    arity: 2 as const,
    premiseRoles: ['prediction', 'antecedent'],
    truthOp: 'detachment' as const,
    priority: 80,
    condition: (premises: Premise[]) => {
      const [pred, ante] = premises;
      return isPrediction(pred.term) && termsEqual(pred.term.args[0], ante.term);
    },
    buildConclusion: (premises: Premise[]) => {
      const [pred] = premises;
      return pred.term.args[1];
    },
  },

  // Temporal induction: A |> B, B => A
  {
    id: 'temporal_induction',
    name: 'Temporal Induction',
    category: 'temporal' as const,
    arity: 2 as const,
    premiseRoles: ['prediction', 'consequent'],
    truthOp: 'abduction' as const,
    priority: 70,
    condition: (premises: Premise[]) => {
      const [pred, conseq] = premises;
      return isPrediction(pred.term) && termsEqual(pred.term.args[1], conseq.term);
    },
    buildConclusion: (premises: Premise[]) => {
      const [pred] = premises;
      return pred.term.args[0];
    },
  },

  // Temporal revision: A |> B, A |> B (different evidence) => A |> B
  {
    id: 'temporal_revision',
    name: 'Temporal Revision',
    category: 'temporal' as const,
    arity: 2 as const,
    premiseRoles: ['prediction1', 'prediction2'],
    truthOp: 'revision' as const,
    priority: 75,
    condition: (premises: Premise[]) => {
      const [p1, p2] = premises;
      return isPrediction(p1.term) && isPrediction(p2.term) &&
        termsEqual(p1.term.args[0], p2.term.args[0]) &&
        termsEqual(p1.term.args[1], p2.term.args[1]);
    },
    buildConclusion: (premises: Premise[]) => premises[0].term,
  },

  // Parallel introduction: A, B => A |~ B
  {
    id: 'parallel_intro',
    name: 'Parallel Introduction',
    category: 'temporal' as const,
    arity: 2 as const,
    premiseRoles: ['first', 'second'],
    truthOp: 'parallel' as const,
    priority: 40,
    condition: (premises: Premise[]) => true,
    buildConclusion: (premises: Premise[]) => {
      return termInterner.parallel(premises[0].term, premises[1].term);
    },
  },

  // Retrospection: A |< B (B retrodicts A)
  {
    id: 'retrospection',
    name: 'Retrospection',
    category: 'temporal' as const,
    arity: 1 as const,
    premiseRoles: ['sequence'],
    truthOp: 'retrospection' as const,
    priority: 55,
    condition: (premises: Premise[]) => isSequential(premises[0].term),
    buildConclusion: (premises: Premise[]) => {
      const term = premises[0].term;
      return createRetrospection(term.args[1], term.args[0]); // Swapped
    },
  },
];

/** Temporal term constructors. */
export function createTemporalTerm(op: TemporalOp, ...args: Term[]): Term {
  switch (op) {
    case TemporalOp.SEQUENTIAL:
      return termInterner.sequential(...args);
    case TemporalOp.CONCURRENT:
      return termInterner.concurrent(...args);
    case TemporalOp.PREDICTION:
      return termInterner.prediction(args[0], args[1]);
    case TemporalOp.PARALLEL:
      return termInterner.parallel(...args);
    case TemporalOp.RETROSPECTION:
      return createRetrospection(args[0], args[1]);
    default:
      throw new Error(`Unknown temporal operator: ${op}`);
  }
}

function createRetrospection(antecedent: Term, consequent: Term): Term {
  // Using a compound term with custom operator
  return termInterner.compound(TermOp.PREDICTION, antecedent, consequent); // Placeholder
}

/** Temporal term predicates. */
export function isSequential(term: Term): boolean {
  return term.op === TermOp.SEQUENTIAL;
}

export function isConcurrent(term: Term): boolean {
  return term.op === TermOp.CONCURRENT;
}

export function isPrediction(term: Term): boolean {
  return term.op === TermOp.PREDICTION;
}

export function isParallel(term: Term): boolean {
  return term.op === TermOp.PARALLEL;
}

export function isTemporal(term: Term): boolean {
  return [TermOp.SEQUENTIAL, TermOp.CONCURRENT, TermOp.PREDICTION, TermOp.PARALLEL].includes(term.op);
}

/** Get temporal components. */
export function getTemporalComponents(term: Term): Term[] | null {
  if (!isTemporal(term)) return null;
  return [...term.args];
}

/** Temporal logic for reasoning about intervals. */
export interface TemporalInterval {
  start: number;
  end: number;
  term: Term;
  truth: TruthValue;
}

/** Allen's interval relations. */
export enum AllenRelation {
  BEFORE = 'before',
  MEETS = 'meets',
  OVERLAPS = 'overlaps',
  STARTS = 'starts',
  DURING = 'during',
  FINISHES = 'finishes',
  EQUALS = 'equals',
  AFTER = 'after',
  MET_BY = 'met_by',
  OVERLAPPED_BY = 'overlapped_by',
  STARTED_BY = 'started_by',
  CONTAINS = 'contains',
  FINISHED_BY = 'finished_by',
}

/** Compute Allen relation between two intervals. */
export function allenRelation(a: TemporalInterval, b: TemporalInterval): AllenRelation {
  if (a.end < b.start) return AllenRelation.BEFORE;
  if (a.end === b.start) return AllenRelation.MEETS;
  if (a.start < b.start && a.end > b.start && a.end < b.end) return AllenRelation.OVERLAPS;
  if (a.start === b.start && a.end < b.end) return AllenRelation.STARTS;
  if (a.start > b.start && a.end < b.end) return AllenRelation.DURING;
  if (a.start > b.start && a.end === b.end) return AllenRelation.FINISHES;
  if (a.start === b.start && a.end === b.end) return AllenRelation.EQUALS;
  if (a.start > b.end) return AllenRelation.AFTER;
  if (a.start === b.end) return AllenRelation.MET_BY;
  if (a.start < b.end && a.end > b.end && a.start > b.start) return AllenRelation.OVERLAPPED_BY;
  if (a.start === b.start && a.end > b.end) return AllenRelation.STARTED_BY;
  if (a.start < b.start && a.end > b.end) return AllenRelation.CONTAINS;
  if (a.start < b.start && a.end === b.end) return AllenRelation.FINISHED_BY;
  return AllenRelation.EQUALS;
}

/** Temporal constraint satisfaction. */
export interface TemporalConstraint {
  relation: AllenRelation;
  intervals: [string, string];
}

/** Check if a set of temporal constraints is consistent. */
export function checkTemporalConsistency(
  intervals: Map<string, TemporalInterval>,
  constraints: TemporalConstraint[]
): { consistent: boolean; conflicts: TemporalConstraint[] } {
  const conflicts: TemporalConstraint[] = [];

  for (const constraint of constraints) {
    const [idA, idB] = constraint.intervals;
    const intervalA = intervals.get(idA);
    const intervalB = intervals.get(idB);

    if (!intervalA || !intervalB) continue;

    const actual = allenRelation(intervalA, intervalB);
    if (actual !== constraint.relation) {
      conflicts.push(constraint);
    }
  }

  return { consistent: conflicts.length === 0, conflicts };
}

/** Temporal projection: predict future state from current. */
export interface TemporalProjection {
  horizon: number;
  predictions: Array<{ term: Term; truth: TruthValue; timestamp: number }>;
}

/** Project temporal beliefs forward. */
export function projectTemporal(
  beliefs: Array<{ term: Term; truth: TruthValue; timestamp: number }>,
  horizon: number,
  now: number = Date.now()
): TemporalProjection {
  const predictions: TemporalProjection['predictions'] = [];

  for (const belief of beliefs) {
    if (isPrediction(belief.term)) {
      const [antecedent, consequent] = belief.term.args;
      // If antecedent matches a current belief, project consequent
      for (const current of beliefs) {
        if (termsEqual(current.term, antecedent) && current.timestamp <= now) {
          const projectedTruth = Truth.detachment(belief.truth, current.truth);
          predictions.push({
            term: consequent,
            truth: projectedTruth,
            timestamp: now + horizon,
          });
        }
      }
    }
  }

  return { horizon, predictions };
}

/** Temporal pattern mining. */
export interface TemporalPattern {
  pattern: Term[];
  support: number;
  confidence: number;
  interval: number; // Average time between events
}

/** Mine sequential patterns from temporal log. */
export function mineSequentialPatterns(
  events: Array<{ term: Term; timestamp: number }>,
  minSupport: number = 3,
  maxGap: number = 3600000 // 1 hour
): TemporalPattern[] {
  const patterns = new Map<string, { count: number; intervals: number[] }>();

  // Sort by timestamp
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // Find pairs within maxGap
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const gap = sorted[j].timestamp - sorted[i].timestamp;
      if (gap > maxGap) break;

      const key = `${termInterner.format(sorted[i].term)} -> ${termInterner.format(sorted[j].term)}`;
      const existing = patterns.get(key) ?? { count: 0, intervals: [] };
      existing.count++;
      existing.intervals.push(gap);
      patterns.set(key, existing);
    }
  }

  // Filter by support and compute confidence
  const results: TemporalPattern[] = [];
  for (const [key, { count, intervals }] of patterns) {
    if (count >= minSupport) {
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const [firstStr, secondStr] = key.split(' -> ');
      results.push({
        pattern: [
          termInterner.parse(firstStr),
          termInterner.parse(secondStr),
        ],
        support: count,
        confidence: count / sorted.length,
        interval: avgInterval,
      });
    }
  }

  return results.sort((a, b) => b.confidence * b.support - a.confidence * a.support);
}

/** Temporal belief revision: update beliefs based on time. */
export function reviseTemporalBeliefs(
  beliefs: Array<{ term: Term; truth: TruthValue; timestamp: number }>,
  decayRate: number = 0.001, // per millisecond
  now: number = Date.now()
): Array<{ term: Term; truth: TruthValue; timestamp: number }> {
  return beliefs.map(belief => {
    const age = now - belief.timestamp;
    const decay = Math.exp(-decayRate * age);
    return {
      ...belief,
      truth: Truth.damp(belief.truth, decay),
      timestamp: now,
    };
  }).filter(b => b.truth.c > 0.1); // Remove decayed beliefs
}

import { termInterner } from '../../kernel/intern.js';

function termsEqual(a: Term, b: Term): boolean {
  return a === b;
}