import type {Term} from '../terms';
import {getPredicate, getSubject, termsEqual, TermBuilder} from '../terms';
import type {RuleFn} from './types.js';

export interface SyllogismConfig {
  leftKind: Term['kind'];
  rightKind: Term['kind'];
  link: (left: Term, right: Term) => boolean;
  build: (left: Term, right: Term) => Term | undefined;
}

export const syllogize = (cfg: SyllogismConfig): RuleFn => {
  return ([left, right]) => {
    if (left.kind !== cfg.leftKind || right.kind !== cfg.rightKind) return undefined;
    return cfg.link(left, right) ? cfg.build(left, right) : undefined;
  };
};

export const transform = (kind: Term['kind'], fn: (term: Term) => Term | undefined): RuleFn =>
  ([term]) => term.kind === kind ? fn(term) : undefined;

export const foldKind = <T extends Term>(kind: T['kind'], fn: (left: T, right: T) => Term | undefined): RuleFn =>
  ([left, right]) => left.kind === kind && right.kind === kind ? fn(left as T, right as T) : undefined;

export const deductionLink = (left: Term, right: Term): boolean => {
  const pred = getPredicate(left);
  const subj = getSubject(right);
  return !!(pred && subj && termsEqual(pred, subj));
};

export const inductionLink = (left: Term, right: Term): boolean => {
  const pred = getPredicate(left);
  const subj = getSubject(right);
  return !!(pred && subj && termsEqual(pred, subj));
};

export const abductionLink = (left: Term, right: Term): boolean => {
  const subj1 = getSubject(left);
  const subj2 = getSubject(right);
  return !!(subj1 && subj2 && termsEqual(subj1, subj2));
};

export const buildDeduction = (left: Term, right: Term): Term | undefined => {
  const s = getSubject(left), p = getPredicate(right);
  return s && p ? TermBuilder.inheritance(s, p) : undefined;
};

export const buildInduction = buildDeduction;

export const buildAbduction = (left: Term, right: Term): Term | undefined => {
  const p = getPredicate(left);
  const s = getSubject(right);
  return p && s ? TermBuilder.inheritance(s, p) : undefined;
};
