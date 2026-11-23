/**
 * NAL Interpreter — reference interpreter for NAL formula-AST rules.
 *
 * This interpreter evaluates rule ASTs for verification purposes.
 * The engine compiles rules for fast execution; this interpreter
 * provides an independent execution path for cross-checking.
 */

import { Term, TermOp, termInterner } from '../../kernel/terms/intern';
import { Truth, type TruthValue } from '../../kernel/truth';
import { Stamp } from '../../kernel/stamp';
import type { RuleAST, ConditionAST, ConclusionAST, TermRef, Premise, StepResult, Logic } from '../port';
import type { NALTerm, NALPremise, NALStepResult } from './rules-ast';
import { NAL_RULES_AST } from './rules-ast';
import { SenarsError } from '../../errors/senars-error';

/** Evaluation context for the interpreter. */
interface EvalContext {
  premises: readonly NALPremise[];
  stamp: Stamp;
  ruleId: string;
}

/** Evaluate a condition AST against premises. */
function evalCondition(cond: ConditionAST, ctx: EvalContext): boolean {
  switch (cond.op) {
    case 'true':
      return true;
    case 'false':
      return false;
    case 'and':
      return cond.args.every(arg => evalCondition(arg, ctx));
    case 'or':
      return cond.args.some(arg => evalCondition(arg, ctx));
    case 'not':
      return !evalCondition(cond.arg, ctx);
    case 'eq': {
      const left = evalTermRef(cond.left, ctx);
      const right = evalTermRef(cond.right, ctx);
      return left === right;
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

/** Evaluate a term reference to a concrete term. */
function evalTermRef(ref: TermRef, ctx: EvalContext): Term {
  switch (ref.op) {
    case 'premise': {
      const premise = ctx.premises[ref.index];
      if (!premise) throw new SenarsError(`Premise ${ref.index} not found`, 'OPERATION_ERROR', { premiseIndex: ref.index });
      switch (ref.field) {
        case 'term':
          return premise.term;
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
    case 'constant':
      return termInterner.constant(ref.value);
    case 'variable':
      return termInterner.variable(ref.name);
    case 'inheritance':
      return termInterner.inheritance(evalTermRef(ref.subject, ctx), evalTermRef(ref.predicate, ctx));
    case 'similarity':
      return termInterner.similarity(evalTermRef(ref.subject, ctx), evalTermRef(ref.predicate, ctx));
    case 'product':
      return termInterner.product(...ref.terms.map(t => evalTermRef(t, ctx)));
    case 'negation':
      return termInterner.negation(evalTermRef(ref.term, ctx));
    case 'prediction':
      return termInterner.prediction(evalTermRef(ref.antecedent, ctx), evalTermRef(ref.consequent, ctx));
    case 'sequential':
      return termInterner.sequential(evalTermRef(ref.first, ctx), evalTermRef(ref.second, ctx));
    case 'concurrent':
      return termInterner.concurrent(evalTermRef(ref.first, ctx), evalTermRef(ref.second, ctx));
    case 'parallel':
      return termInterner.parallel(evalTermRef(ref.first, ctx), evalTermRef(ref.second, ctx));
  }
}

/** Compute truth value using the engine's Truth functions. */
function computeTruth(truthFn: string, premises: readonly NALPremise[]): TruthValue | null {
  const getTruth = (i: number) => premises[i]?.truth;
  const t1 = getTruth(0);
  const t2 = getTruth(1);

  switch (truthFn) {
    case 'negation':
      return t1 ? Truth.negation(t1) : null;
    case 'conversion':
      return t1 ? Truth.conversion(t1) : null;
    case 'structuralDeduction':
      return t1 ? Truth.structuralDeduction(t1) : null;
    case 'structuralReduction':
      return t1 ? Truth.structuralReduction(t1) : null;
    case 'reinforce':
      return t1 ? Truth.reinforce(t1) : null;
    case 'contradict':
      return t1 ? Truth.contradict(t1) : null;
    case 'deduction':
      return t1 && t2 ? Truth.deduction(t1, t2) : null;
    case 'induction':
      return t1 && t2 ? Truth.induction(t1, t2) : null;
    case 'abduction':
      return t1 && t2 ? Truth.abduction(t1, t2) : null;
    case 'revision':
      return t1 && t2 ? Truth.revision(t1, t2) : null;
    case 'analogy':
      return t1 && t2 ? Truth.analogy(t1, t2) : null;
    case 'resemblance':
      return t1 && t2 ? Truth.resemblance(t1, t2) : null;
    case 'detachment':
      return t1 && t2 ? Truth.detachment(t1, t2) : null;
    case 'comparison':
      return t1 && t2 ? Truth.analogy(t1, t2) : null;
    default:
      return null;
  }
}

/** Derive stamp from parent stamps. */
function deriveStamp(parents: readonly Stamp[], ruleId: string): Stamp {
  if (parents.length === 0) {
    return { id: '', ts: Date.now(), parents: [], derivation: [ruleId], evidence: 0 };
  }
  const parentIds = parents.map(p => p.id);
  const maxEvidence = Math.max(...parents.map(p => p.evidence));
  const allDerivations = [...new Set([...parents.flatMap(p => p.derivation), ruleId])];
  return {
    id: '',
    ts: Date.now(),
    parents: parentIds,
    derivation: allDerivations,
    evidence: maxEvidence + 1,
  };
}

/** Interpret a single rule application. */
export function interpretRule(
  rule: RuleAST<NALTerm>,
  premises: readonly NALPremise[],
  stamp: Stamp
): NALStepResult | null {
  // Check arity
  if (premises.length !== rule.arity) return null;

  // Check condition
  const ctx: EvalContext = { premises, stamp, ruleId: rule.id };
  if (!evalCondition(rule.condition, ctx)) return null;

  // Build conclusion
  const conclusion = evalTermRef(rule.conclusion, ctx);
  if (!conclusion) return null;

  // Compute truth
  const truth = computeTruth(rule.truthFn, premises);
  if (!truth) return null;

  // Derive stamp
  const parentStamps = premises.map(p => p.stamp);
  const derivedStamp = deriveStamp(parentStamps, rule.id);

  return {
    conclusion,
    truth,
    stamp: derivedStamp,
    ruleId: rule.id,
    ruleCategory: rule.category,
    premises,
    truthFn: rule.truthFn,
  };
}

/** Apply all applicable rules to premises. */
export function interpretAllRules(
  rules: readonly RuleAST<NALTerm>[],
  premises: readonly NALPremise[],
  stamp: Stamp,
  options: { categories?: string[]; limit?: number } = {}
): NALStepResult[] {
  const { categories, limit = 100 } = options;
  const results: NALStepResult[] = [];

  for (const rule of rules) {
    if (categories && !categories.includes(rule.category)) continue;
    if (results.length >= limit) break;

    const result = interpretRule(rule, premises, stamp);
    if (result) results.push(result);
  }

  // Sort by priority
  results.sort((a, b) => {
    const ruleA = rules.find(r => r.id === a.ruleId);
    const ruleB = rules.find(r => r.id === b.ruleId);
    return (ruleB?.priority ?? 0) - (ruleA?.priority ?? 0);
  });

  return results.slice(0, limit);
}

/** Generate all possible steps from a bag (pairwise). */
export function interpretGenerateSteps(
  rules: readonly RuleAST<NALTerm>[],
  bagEntries: readonly { term: NALTerm; truth: TruthValue; stamp: Stamp }[],
  options: { maxPairs?: number; categories?: string[] } = {}
): NALStepResult[] {
  const { maxPairs = 1000, categories } = options;
  const results: NALStepResult[] = [];

  // Convert to premises
  const premises: NALPremise[] = bagEntries.map(e => ({
    term: e.term,
    truth: e.truth,
    stamp: e.stamp,
  }));

  // Try all pairs
  let pairs = 0;
  for (let i = 0; i < premises.length && pairs < maxPairs; i++) {
    for (let j = i + 1; j < premises.length && pairs < maxPairs; j++) {
      pairs++;
      const pairPremises: NALPremise[] = [premises[i]!, premises[j]!];
      const stamp = pairPremises[0]!.stamp;

      for (const rule of rules) {
        if (categories && !categories.includes(rule.category)) continue;
        if (rule.arity !== 2) continue;

        const result = interpretRule(rule, pairPremises, stamp);
        if (result) results.push(result);
      }
    }
  }

  // Sort by priority
  results.sort((a, b) => {
    const ruleA = rules.find(r => r.id === a.ruleId);
    const ruleB = rules.find(r => r.id === b.ruleId);
    return (ruleB?.priority ?? 0) - (ruleA?.priority ?? 0);
  });

  return results;
}

/** NAL interpreter using the formula-AST rules. */
export class NALInterpreter {
  private rules: readonly RuleAST<NALTerm>[];

  constructor(rules: readonly RuleAST<NALTerm>[] = NAL_RULES_AST) {
    this.rules = rules;
  }

  /** Apply a specific rule. */
  applyRule(ruleId: string, premises: readonly NALPremise[], stamp: Stamp): NALStepResult | null {
    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule) return null;
    return interpretRule(rule, premises, stamp);
  }

  /** Apply all applicable rules. */
  applyAllRules(premises: readonly NALPremise[], stamp: Stamp, options?: { categories?: string[]; limit?: number }): NALStepResult[] {
    return interpretAllRules(this.rules, premises, stamp, options);
  }

  /** Generate steps from bag. */
  generateSteps(bagEntries: readonly { term: NALTerm; truth: TruthValue; stamp: Stamp }[], options?: { maxPairs?: number; categories?: string[] }): NALStepResult[] {
    return interpretGenerateSteps(this.rules, bagEntries, options);
  }

  /** Get all rules. */
  getRules(): readonly RuleAST<NALTerm>[] {
    return this.rules;
  }

  /** Get rule by ID. */
  getRule(id: string): RuleAST<NALTerm> | undefined {
    return this.rules.find(r => r.id === id);
  }
}

/** Create a NAL interpreter. */
export function createNALInterpreter(rules?: readonly RuleAST<NALTerm>[]): NALInterpreter {
  return new NALInterpreter(rules);
}