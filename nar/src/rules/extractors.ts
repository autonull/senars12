/**
 * Term extraction helpers shared across NAL rule definitions.
 */
import type { Term } from '../terms';
import { getPredicate, getSubject, termsEqual } from '../terms';

export const ID = <T>(t: T): T => t;

export const extractInh = (t: Term) => {
  const s = getSubject(t),
    p = getPredicate(t);
  return { s, p };
};

export const extractInhPair = (inh1: Term, inh2: Term) => {
  const s1 = getSubject(inh1),
    p1 = getPredicate(inh1);
  const s2 = getSubject(inh2),
    p2 = getPredicate(inh2);
  if (!s1 || !p1 || !s2 || !p2) return null;
  return { s1, p1, s2, p2 };
};

export const matchInhPair =
  <T>(fn: (s1: Term, p1: Term, s2: Term, p2: Term) => T | undefined) =>
  ([inh1, inh2]: [Term, Term]): T | undefined => {
    const extracted = extractInhPair(inh1, inh2);
    if (!extracted) return undefined;
    const { s1, p1, s2, p2 } = extracted;
    if (!s1 || !p1 || !s2 || !p2) return undefined;
    return fn(s1, p1, s2, p2);
  };

export const linkFn =
  (
    extractor: (
      left: Term,
      right: Term
    ) => { leftTerm: Term | undefined; rightTerm: Term | undefined }
  ) =>
  (left: Term, right: Term): boolean => {
    const { leftTerm, rightTerm } = extractor(left, right);
    return !!(leftTerm && rightTerm && termsEqual(leftTerm, rightTerm));
  };

export const dedExtractor = (left: Term, right: Term) => ({
  leftTerm: getPredicate(left),
  rightTerm: getSubject(right),
});
export const indExtractor = (left: Term, right: Term) => ({
  leftTerm: getSubject(left),
  rightTerm: getSubject(right),
});
export const abdExtractor = (left: Term, right: Term) => ({
  leftTerm: getPredicate(left),
  rightTerm: getPredicate(right),
});

export const _deductionLink = linkFn(dedExtractor);
export const _inductionLink = linkFn(indExtractor);
export const _abductionLink = linkFn(abdExtractor);

export const sameSubject = (inh1: Term, inh2: Term): boolean => {
  const s1 = getSubject(inh1),
    s2 = getSubject(inh2);
  return !!(s1 && s2 && termsEqual(s1, s2));
};

export const sameInhPair = (inh1: Term, inh2: Term) => {
  const extracted = extractInhPair(inh1, inh2);
  if (!extracted) return false;
  const { s1, p1, s2, p2 } = extracted;
  return termsEqual(s1, s2) && termsEqual(p1, p2);
};
