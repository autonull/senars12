import { DerivationRecord, DerivationStepRecord } from '../record';
import { Term, TermOp } from '../../kernel/terms/intern';
import { Truth } from '../../kernel/truth';
import type { LawResult } from './types';

function getArgs(term: Term): readonly Term[] {
  if (term.op !== TermOp.VARIABLE && term.op !== TermOp.CONSTANT) {
    return term.args;
  }
  return [];
}

function isInheritance(term: Term): boolean {
  return term.op === TermOp.INHERITANCE;
}

function isSimilarity(term: Term): boolean {
  return term.op === TermOp.SIMILARITY;
}

function getSubject(term: Term): Term {
  const args = getArgs(term);
  if (!args || args.length < 1) throw new Error('Expected compound term with at least 1 arg');
  return args[0]!;
}

function getPredicate(term: Term): Term {
  const args = getArgs(term);
  if (!args || args.length < 2) throw new Error('Expected compound term with at least 2 args');
  return args[1]!;
}

/** Law 8: Conversion Symmetry */
export function verifyConversionSymmetry(records: DerivationRecord[]): LawResult {
  let holds = true;
  let counterexample: unknown = undefined;

  for (const record of records) {
    for (const step of record.steps) {
      if (step.ruleId !== 'conversion_inheritance' && step.ruleId !== 'conversion_similarity') continue;

      const premise = step.premises[0];
      if (!premise) {
        holds = false;
        counterexample = { step: step.id, error: 'No premise' };
        break;
      }

      const conclusion = step.conclusion;

      if (step.ruleId === 'conversion_inheritance') {
        if (!isInheritance(premise.term) || !isInheritance(conclusion)) {
          holds = false;
          counterexample = { step: step.id, premise: premise.term, conclusion };
          break;
        }
        if (getSubject(conclusion) !== getPredicate(premise.term) || getPredicate(conclusion) !== getSubject(premise.term)) {
          holds = false;
          counterexample = { step: step.id, premise: premise.term, conclusion };
          break;
        }
      } else if (step.ruleId === 'conversion_similarity') {
        if (!isSimilarity(premise.term) || !isSimilarity(conclusion)) {
          holds = false;
          counterexample = { step: step.id, premise: premise.term, conclusion };
          break;
        }
        if (getSubject(conclusion) !== getPredicate(premise.term) || getPredicate(conclusion) !== getSubject(premise.term)) {
          holds = false;
          counterexample = { step: step.id, premise: premise.term, conclusion };
          break;
        }
      }

      // Truth should be preserved (conversion is truth-preserving)
      if (!Truth.equals(premise.truth, step.truth)) {
        holds = false;
        counterexample = { step: step.id, premiseTruth: premise.truth, conclusionTruth: step.truth };
        break;
      }
    }
    if (!holds) break;
  }

  return {
    law: 'conversion_symmetry',
    holds,
    counterexample,
    description: 'Conversion should swap subject/predicate and preserve truth',
    severity: 'critical',
  };
}