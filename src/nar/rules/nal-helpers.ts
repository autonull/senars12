import type {Term} from '../terms';
import {getPredicate, getSubject, TermBuilder, termsEqual} from '../terms';
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

type LinkExtractor = (left: Term, right: Term) => { leftTerm: Term | undefined; rightTerm: Term | undefined };
const linkFn = (extractor: LinkExtractor) =>
    (left: Term, right: Term): boolean => {
        const {leftTerm, rightTerm} = extractor(left, right);
        return !!(leftTerm && rightTerm && termsEqual(leftTerm, rightTerm));
    };

const dedExtractor = (left: Term, right: Term) => ({
    leftTerm: getPredicate(left),
    rightTerm: getSubject(right)
});
const indExtractor = (left: Term, right: Term) => ({
    leftTerm: getSubject(left),
    rightTerm: getSubject(right)
});
const abdExtractor = (left: Term, right: Term) => ({
    leftTerm: getPredicate(left),
    rightTerm: getPredicate(right)
});

export const deductionLink = linkFn(dedExtractor);
export const inductionLink = linkFn(indExtractor);
export const abductionLink = linkFn(abdExtractor);

export const buildDeduction = (left: Term, right: Term): Term | undefined => {
    const s = getSubject(left), p = getPredicate(right);
    return s && p ? TermBuilder.inheritance(s, p) : undefined;
};

export const buildInduction = (left: Term, right: Term): Term | undefined => {
    const p1 = getPredicate(left), p2 = getPredicate(right);
    return p1 && p2 ? TermBuilder.inheritance(p1, p2) : undefined;
};

export const buildAbduction = (left: Term, right: Term): Term | undefined => {
    const s1 = getSubject(left), s2 = getSubject(right);
    return s1 && s2 ? TermBuilder.inheritance(s1, s2) : undefined;
};

export const buildHigherOrderRule = (
    linkValidator: (a1: Term, c1: Term, a2: Term, c2: Term) => boolean,
    resultBuilder: (a1: Term, c1: Term, a2: Term, c2: Term) => Term | undefined
): RuleFn => ([imp1, imp2]) => {
    if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
    const [a1, c1] = imp1.args, [a2, c2] = imp2.args;
    if (!a1 || !c1 || !a2 || !c2) return undefined;
    return linkValidator(a1, c1, a2, c2) ? resultBuilder(a1, c1, a2, c2) : undefined;
};
