/**
 * NAL Logic — Non-Axiomatic Logic implementation of the Logic port.
 *
 * Implements the Logic<Term> interface for NAL terms with temporal extension.
 */

import { Term, TermOp, termInterner } from '../../kernel/terms/intern';
import { Truth, type TruthValue } from '../../kernel/truth';
import { createRootStamp, createDerivedStamp, type Stamp } from '../../kernel/stamp';
import type { Logic, Codec, RuleAST, ConditionAST, ConclusionAST, TermRef, Premise, StepResult } from '../port';
import { NAL_RULES_AST, type NALTerm, type NALPremise, type NALStepResult } from './rules-ast';
import { NALInterpreter } from './interpreter';
import { SenarsError } from '../../errors/senars-error';

/** NAL term codec. */
const NAL_CODEC: Codec<Term> = {
  encode: (t: Term) => t.toString(),
  decode: (s: string) => {
    try {
      return termInterner.parse(s);
    } catch {
      return null;
    }
  },
};

/** NAL truth codec. */
const NAL_TRUTH_CODEC: Codec<TruthValue> = {
  encode: (t: TruthValue) => `${t.f},${t.c}`,
  decode: (s: string) => {
    const parts = s.split(',');
    if (parts.length !== 2) return null;
    const f = parseFloat(parts[0]!);
    const c = parseFloat(parts[1]!);
    if (isNaN(f) || isNaN(c)) return null;
    return { f, c };
  },
};

/** Create NAL premise from term and truth. */
function createPremise(term: NALTerm, truth: TruthValue, stamp: Stamp, role?: string): NALPremise {
  return { term, truth, stamp, role };
}

/** Evaluate NAL expectation (frequency). */
function nalExpect(term: NALTerm): number {
  // Expectation is the frequency component of truth
  // This is a simplified version; real implementation would use term structure
  return 0.5;
}

/** Evaluate NAL confidence. */
function nalConf(term: NALTerm): number {
  // Confidence based on term type and complexity
  if (term.op === TermOp.CONSTANT) return 0.5;
  if (term.op === TermOp.VARIABLE) return 0.3;
  return 0.7;
}

/** Check if two NAL terms contradict. */
function nalContradicts(a: NALTerm, b: NALTerm): boolean {
  // Contradiction if one is negation of the other
  if (a.op === TermOp.NEGATION && a.args[0] === b) return true;
  if (b.op === TermOp.NEGATION && b.args[0] === a) return true;
  return false;
}

/** NAL Logic implementation. */
export const NAL_LOGIC: Logic<Term> = {
  id: 'nal',
  version: '1.0.0',
  codec: NAL_CODEC,
  expect: nalExpect,
  conf: nalConf,
  contradicts: nalContradicts,
  policy: 'coexist',
  rules: NAL_RULES_AST,
} as const;

/** Extended NAL logic with full inference capability. */
export interface NALLogicExtended extends Logic<Term> {
  /** Apply a single inference step. */
  step(premises: NALPremise[], ruleId: string): NALStepResult | null;

  /** Run forward inference from premises. */
  forwardChain(premises: NALPremise[], maxSteps: number): NALStepResult[];

  /** Check if a term is derivable from premises. */
  isDerivable(premises: NALPremise[], goal: NALTerm, maxDepth: number): boolean;
}

/** Create extended NAL logic with interpreter. */
export function createExtendedNALLogic(): NALLogicExtended {
  const interpreter = new NALInterpreter();

  return {
    ...NAL_LOGIC,
    step(premises: NALPremise[], ruleId: string): NALStepResult | null {
      const rule = NAL_RULES_AST.find(r => r.id === ruleId);
      if (!rule) return null;

      // Check condition
      const ctx = {
        premises,
        stamp: createRootStamp({ ruleId }),
        ruleId,
      };

      if (!evalCondition(rule.condition, ctx)) {
        return null;
      }

      // Build conclusion term
      const conclusion = evalConclusion(rule.conclusion, ctx);
      if (!conclusion) return null;

      // Compute truth using truth function
      const truth = computeTruth(rule.truthFn, premises);

      // Create stamp
      const newStamp = createDerivedStamp(premises.map(p => p.stamp), ruleId);

      return {
        conclusion,
        truth,
        stamp: newStamp,
        ruleId,
        ruleCategory: rule.category,
        premises,
        truthFn: rule.truthFn,
      };
    },

    forwardChain(premises: NALPremise[], maxSteps: number): NALStepResult[] {
      const results: NALStepResult[] = [];
      const currentPremises = [...premises];
      let steps = 0;

      while (steps < maxSteps) {
        let newResult: NALStepResult | null = null;

        for (const rule of NAL_RULES_AST) {
          if (rule.arity === 1) {
            for (const p of currentPremises) {
              newResult = this.step([p], rule.id);
              if (newResult) break;
            }
          } else if (rule.arity === 2) {
            for (let i = 0; i < currentPremises.length; i++) {
              for (let j = i + 1; j < currentPremises.length; j++) {
                const r = this.step([currentPremises[i]!, currentPremises[j]!], rule.id);
                if (r) {
                  newResult = r;
                  break;
                }
              }
              if (newResult) break;
            }
          }
          if (newResult) break;
        }

        if (!newResult) break;

        results.push(newResult);
        currentPremises.push(createPremise(newResult.conclusion, newResult.truth, newResult.stamp));
        steps++;
      }

      return results;
    },

    isDerivable(premises: NALPremise[], goal: NALTerm, maxDepth: number): boolean {
      // Simplified: check if goal matches any premise or can be derived in one step
      for (const p of premises) {
        if (p.term.toString() === goal.toString()) return true;
      }
      if (maxDepth <= 0) return false;

      for (const rule of NAL_RULES_AST) {
        if (rule.arity === 1) {
          for (const p of premises) {
            const result = this.step([p], rule.id);
            if (result && result.conclusion.toString() === goal.toString()) return true;
            if (result && this.isDerivable([createPremise(result.conclusion, result.truth, result.stamp)], goal, maxDepth - 1)) {
              return true;
            }
          }
        }
      }
      return false;
    },
  };
}

/** Evaluate condition AST. */
function evalCondition(cond: ConditionAST, ctx: { premises: NALPremise[]; stamp: Stamp; ruleId: string }): boolean {
  switch (cond.op) {
    case 'true': return true;
    case 'false': return false;
    case 'and': return cond.args.every(arg => evalCondition(arg, ctx));
    case 'or': return cond.args.some(arg => evalCondition(arg, ctx));
    case 'not': return !evalCondition(cond.arg, ctx);
    case 'eq': {
      const left = evalTermRef(cond.left, ctx);
      const right = evalTermRef(cond.right, ctx);
      return left.toString() === right.toString();
    }
    case 'is_inheritance': {
      const term = evalTermRef(cond.term, ctx);
      return term.op === TermOp.INHERITANCE;
    }
    case 'is_similarity': {
      const term = evalTermRef(cond.term, ctx);
      return term.op === TermOp.SIMILARITY;
    }
    case 'is_prediction': {
      const term = evalTermRef(cond.term, ctx);
      return term.op === TermOp.PREDICTION;
    }
    case 'is_sequential': {
      const term = evalTermRef(cond.term, ctx);
      return term.op === TermOp.SEQUENTIAL;
    }
    case 'is_concurrent': {
      const term = evalTermRef(cond.term, ctx);
      return term.op === TermOp.CONCURRENT;
    }
    case 'is_variable': {
      const term = evalTermRef(cond.term, ctx);
      return term.op === TermOp.VARIABLE;
    }
  }
}

/** Evaluate term reference to concrete term. */
function evalTermRef(ref: TermRef, ctx: { premises: NALPremise[]; stamp: Stamp; ruleId: string }): NALTerm {
  switch (ref.op) {
    case 'premise': {
      const premise = ctx.premises[ref.index];
      if (!premise) throw new SenarsError(`Premise ${ref.index} not found`, 'OPERATION_ERROR', { premiseIndex: ref.index });
      switch (ref.field) {
        case 'term': return premise.term;
        case 'subject': {
          if (premise.term.op !== TermOp.INHERITANCE && premise.term.op !== TermOp.SIMILARITY) {
            throw new SenarsError('Expected inheritance or similarity term', 'VALIDATION_ERROR', { term: premise.term.toString(), actualOp: premise.term.op });
          }
          return premise.term.args[0]!;
        }
        case 'predicate': {
          if (premise.term.op !== TermOp.INHERITANCE && premise.term.op !== TermOp.SIMILARITY) {
            throw new SenarsError('Expected inheritance or similarity term', 'VALIDATION_ERROR', { term: premise.term.toString(), actualOp: premise.term.op });
          }
          return premise.term.args[1]!;
        }
      }
      break;
    }
    case 'constant': return termInterner.constant(ref.value);
    case 'variable': return termInterner.variable(ref.name);
    case 'inheritance': return termInterner.inheritance(evalTermRef(ref.subject, ctx), evalTermRef(ref.predicate, ctx));
    case 'similarity': return termInterner.similarity(evalTermRef(ref.subject, ctx), evalTermRef(ref.predicate, ctx));
    case 'product': return termInterner.compound(TermOp.PRODUCT, ...ref.terms.map(t => evalTermRef(t, ctx)));
    case 'negation': return termInterner.compound(TermOp.NEGATION, evalTermRef(ref.term, ctx));
    case 'prediction': return termInterner.compound(TermOp.PREDICTION, evalTermRef(ref.antecedent, ctx), evalTermRef(ref.consequent, ctx));
    case 'sequential': return termInterner.compound(TermOp.SEQUENTIAL, evalTermRef(ref.first, ctx), evalTermRef(ref.second, ctx));
    case 'concurrent': return termInterner.compound(TermOp.CONCURRENT, evalTermRef(ref.first, ctx), evalTermRef(ref.second, ctx));
    case 'parallel': return termInterner.compound(TermOp.PARALLEL, evalTermRef(ref.first, ctx), evalTermRef(ref.second, ctx));
  }
}

/** Evaluate conclusion AST. */
function evalConclusion(conclusion: ConclusionAST<Term>, ctx: { premises: NALPremise[]; stamp: Stamp; ruleId: string }): NALTerm {
  return evalTermRef(conclusion, ctx);
}

/** Compute truth value using NAL truth functions. */
function computeTruth(truthFn: string, premises: NALPremise[]): TruthValue {
  switch (truthFn) {
    case 'deduction':
      if (premises.length >= 2) {
        return Truth.deduction(premises[0]!.truth, premises[1]!.truth);
      }
      return Truth.NEUTRAL;
    case 'induction':
      if (premises.length >= 2) {
        return Truth.induction(premises[0]!.truth, premises[1]!.truth);
      }
      return Truth.NEUTRAL;
    case 'abduction':
      if (premises.length >= 2) {
        return Truth.abduction(premises[0]!.truth, premises[1]!.truth);
      }
      return Truth.NEUTRAL;
    case 'revision':
      if (premises.length >= 2) {
        return Truth.revision(premises[0]!.truth, premises[1]!.truth);
      }
      return Truth.NEUTRAL;
    case 'analogy':
      if (premises.length >= 2) {
        return Truth.analogy(premises[0]!.truth, premises[1]!.truth);
      }
      return Truth.NEUTRAL;
    case 'resemblance':
      if (premises.length >= 2) {
        return Truth.resemblance(premises[0]!.truth, premises[1]!.truth);
      }
      return Truth.NEUTRAL;
    case 'negation':
      if (premises.length >= 1) {
        return Truth.negation(premises[0]!.truth);
      }
      return Truth.NEUTRAL;
    case 'conversion':
      if (premises.length >= 1) {
        return Truth.conversion(premises[0]!.truth);
      }
      return Truth.NEUTRAL;
    case 'structuralDeduction':
      if (premises.length >= 1) {
        return Truth.structuralDeduction(premises[0]!.truth);
      }
      return Truth.NEUTRAL;
    default:
      return Truth.NEUTRAL;
  }
}