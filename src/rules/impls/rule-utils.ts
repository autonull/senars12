import type { StampType, Term } from '../../terms';
import {
  getArgs,
  getPredicate,
  getSubject,
  isOperation,
  isTautology,
  Stamp as StampFactory,
} from '../../terms';
import { Truth, type Truth as TruthType } from '../../terms/impls/Truth.js';
import type { RuleInput, RuleResult } from '../types.js';
import type { TruthFn } from '../types.js';

export const deriveStamp = (p1: RuleInput, p2: RuleInput): StampType => {
  const stamps = [p1.stamp, p2.stamp].filter((s): s is NonNullable<typeof s> => s != null);
  return (StampFactory.derive(stamps) ?? StampFactory.createInput()) as unknown as StampType;
};

export const NEUTRAL_FN = (): TruthType => Truth.NEUTRAL;

export const validateRuleOutput = (term: Term): boolean => {
  if (isTautology(term)) return false;
  const args = getArgs(term);
  if (args.length > 0) {
    const argCount = args.length;
    if (
      (term.kind === 'inheritance' ||
        term.kind === 'similarity' ||
        term.kind === 'implication' ||
        term.kind === 'equivalence') &&
      argCount !== 2
    )
      return false;
    if (
      (term.kind === 'negation' || term.kind === 'setExt' || term.kind === 'setInt') &&
      argCount !== 1
    )
      return false;
  }
  if (term.kind === 'inheritance' || term.kind === 'similarity') {
    const s = getSubject(term),
      p = getPredicate(term);
    if (s && isOperation(s)) return false;
    if (p && isOperation(p)) return false;
  }
  return true;
};

export const buildResult = (
  term: Term,
  truthFn: TruthFn,
  p1: RuleInput,
  p2: RuleInput,
  priority: number
): RuleResult => {
  const truth = truthFn(p1.truth, p2.truth) ?? Truth.NEUTRAL;
  return { term, truth, stamp: deriveStamp(p1, p2), priority };
};
