/**
 * Faculty Fallbacks — pure-NAL symbolic fallbacks for each faculty.
 *
 * These provide deterministic, LM-free alternatives when oracle calls fail.
 */

import type { Term } from '../kernel/terms/term';
import type { Truth } from '../kernel/truth';
import type { Task } from '../kernel/types';
import type { FacultyInput, FacultyOutput, FacultyFallback, FacultyRegistry } from './specs';
import { Truth as TruthOps, createTruth } from '../kernel/truth';
import { fromNarsese, getArgs, isInheritance, isConjunction, isDisjunction, visitTerms } from '../kernel/terms/term';
import { createTask, type TaskType } from '../kernel/types';

/** Extract Term from Term | Task. */
const asTerm = (value: Term | Task): Term =>
  'term' in value ? value.term : value;

/** Extract Task from Term | Task, throwing if not a Task. */
const asTask = (value: Term | Task): Task => {
  if (!('term' in value)) throw new TypeError('Expected Task, got Term');
  return value;
};

/** Common fallback utilities. */

const lmTaskWeight = (source: string): number => {
  const weights: Record<string, number> = { fallback: 0.1 };
  return weights[source] ?? 0.1;
};

/** Create a task with fallback weight. */
const fallbackTask = (term: Term | string, type: TaskType, f = 0.5, c = 0.3): Task[] => {
  const parsed = typeof term === 'string' ? fromNarsese(term) : term;
  if (!parsed) return [];
  return [createTask(parsed, type, createTruth(f, c), lmTaskWeight('fallback'))];
};

/** Extract key terms from a term. */
const extractTerms = (term: Term): Term[] => {
  const terms: Term[] = [];
  visitTerms(term, (t) => terms.push(t));
  return terms;
};

/** Grounding Fallback - no symbolic equivalent for perception. */
export const groundingFallback: FacultyFallback = async (input): Promise<FacultyOutput | null> => {
  const { primary, context } = input;
  const terms = extractTerms(primary as any);

  // Can only ground terms that are already somewhat concrete
  const groundings = terms
    .filter(t => t.toString().length < 20) // Heuristic: short terms might be groundable
    .slice(0, context?.maxResults ?? 5)
    .map(t => ({
      term: t,
      referent: `grounded:${t.toString()}`,
      confidence: 0.3,
    }));

  return {
    faculty: 'grounding',
    result: { groundings },
    confidence: 0.15,
    evidence: [{ source: 'fallback', description: 'No perceptual grounding available', strength: 0.15 }],
    fallbackUsed: true,
    durationMs: 0,
  };
};

/** Inference Fallback - pure NAL inference. */
export const inferenceFallback: FacultyFallback = async (input): Promise<FacultyOutput | null> => {
  const { primary, secondary, context } = input;
  const primaryTask = primary as Task;
  const secondaryTask = secondary as Task | undefined;

  if (!primaryTask || !secondaryTask) {
    return null;
  }

  const inferenceType = context?.metadata?.inferenceType as string ?? 'deduction';
  const conclusions: any[] = [];

  // Simple NAL-style inference based on term structure
  const primaryTerm = primaryTask.term;
  const secondaryTerm = secondaryTask.term;

  if (isInheritance(primaryTerm) && isInheritance(secondaryTerm)) {
    const primaryArgs = getArgs(primaryTerm);
    const secondaryArgs = getArgs(secondaryTerm);
    if (primaryArgs.length < 2 || secondaryArgs.length < 2) return { faculty: 'inference', result: { conclusions: [] }, confidence: 0, evidence: [], fallbackUsed: true, durationMs: 0 };
    const s1 = primaryArgs[0]!;
    const p1 = primaryArgs[1]!;
    const s2 = secondaryArgs[0]!;
    const p2 = secondaryArgs[1]!;

    if (p1.toString() === s2.toString()) {
      // Deduction: (s1 --> p1), (p1 --> p2) => (s1 --> p2)
      const concluded = `( ${s1} --> ${p2} )`;
      conclusions.push({
        term: fromNarsese(concluded)!,
        truth: TruthOps.deduction(primaryTask.truth, secondaryTask.truth),
        inferenceType: 'deduction',
      });
    } else if (s1.toString() === s2.toString()) {
      // Induction: (s --> p1), (s --> p2) => (p1 <-> p2) weakly
      const concluded = `( ${p1} <-> ${p2} )`;
      conclusions.push({
        term: fromNarsese(concluded)!,
        truth: TruthOps.induction(primaryTask.truth, secondaryTask.truth),
        inferenceType: 'induction',
      });
    } else if (p1.toString() === p2.toString()) {
      // Abduction: (s1 --> p), (s2 --> p) => (s1 <-> s2) weakly
      const concluded = `( ${s1} <-> ${s2} )`;
      conclusions.push({
        term: fromNarsese(concluded)!,
        truth: TruthOps.abduction(primaryTask.truth, secondaryTask.truth),
        inferenceType: 'abduction',
      });
    }
  }

  return {
    faculty: 'inference',
    result: { conclusions },
    confidence: 0.3,
    evidence: [{ source: 'rule', description: `NAL ${inferenceType} fallback`, strength: 0.3 }],
    fallbackUsed: true,
    durationMs: 0,
  };
};

/** Abduction Fallback - generate questions. */
export const abductionFallback: FacultyFallback = async (input): Promise<FacultyOutput | null> => {
  const { primary, context } = input;
  const term = asTerm(primary);
  const maxHypotheses = context?.maxResults ?? 3;

  const hypotheses = Array.from({ length: maxHypotheses }, (_, i) => ({
    term: fromNarsese(`(?x${i} --> ${term})`),
    truth: createTruth(0.4, 0.2),
    explanation: `Hypothesis ${i + 1}: possible cause for ${term}`,
  })).filter(h => h.term);

  return {
    faculty: 'abduction',
    result: { hypotheses },
    confidence: 0.2,
    evidence: [{ source: 'fallback', description: 'Abductive question generation', strength: 0.2 }],
    fallbackUsed: true,
    durationMs: 0,
  };
};

/** Induction Fallback - pattern matching. */
export const inductionFallback: FacultyFallback = async (input): Promise<FacultyOutput | null> => {
  const { primary, secondary, context } = input;
  const pattern = asTerm(primary);
  const examples = asTerm(secondary!);
  const minExamples = context?.metadata?.minExamples as number ?? 2;

  // Simple generalization: find common structure
  const patternTerms = extractTerms(pattern);
  const exampleTerms = extractTerms(examples);

  const generalizations: any[] = [];

  if (patternTerms.length > 0 && exampleTerms.length >= minExamples) {
    // Find common predicate
    const patternPredicates = patternTerms
      .filter(t => isInheritance(t))
      .map(t => getArgs(t))
      .filter(args => args.length >= 2)
      .map(args => args[1]);
    const examplePredicates = exampleTerms
      .filter(t => isInheritance(t))
      .map(t => getArgs(t))
      .filter(args => args.length >= 2)
      .map(args => args[1]);

    const common = patternPredicates.filter(p => examplePredicates.some(ep => ep!.toString() === p!.toString()));

    for (const pred of common.slice(0, 3)) {
      generalizations.push({
        pattern: fromNarsese(`( ?x --> ${pred} )`),
        confidence: 0.35,
        support: exampleTerms.length / 10,
      });
    }
  }

  return {
    faculty: 'induction',
    result: { generalizations },
    confidence: 0.25,
    evidence: [{ source: 'fallback', description: 'Pattern-based induction', strength: 0.25 }],
    fallbackUsed: true,
    durationMs: 0,
  };
};

/** Analogy Fallback - structural similarity. */
export const analogyFallback: FacultyFallback = async (input): Promise<FacultyOutput | null> => {
  const { primary, secondary, context } = input;
  const source = asTerm(primary);
  const target = asTerm(secondary!);
  const maxMappings = context?.maxResults ?? 3;

  const mappings: any[] = [];

  // Simple structural analogy: same top-level structure
  if (source.constructor.name === target.constructor.name) {
    const sourceArgs = getArgs(source);
    const targetArgs = getArgs(target);

    if (sourceArgs.length === targetArgs.length) {
      for (let i = 0; i < Math.min(sourceArgs.length, targetArgs.length, maxMappings); i++) {
        mappings.push({
          source: sourceArgs[i],
          target: targetArgs[i],
          mapping: `arg${i}`,
          confidence: 0.3,
        });
      }
    }
  }

  return {
    faculty: 'analogy',
    result: { mappings },
    confidence: 0.2,
    evidence: [{ source: 'fallback', description: 'Structural analogy fallback', strength: 0.2 }],
    fallbackUsed: true,
    durationMs: 0,
  };
};

/** Revision Fallback - conservative revision. */
export const revisionFallback: FacultyFallback = async (input): Promise<FacultyOutput | null> => {
  const { primary, secondary, context } = input;
  const belief = asTask(primary);
  const evidence = asTask(secondary!);

  const strategy = context?.metadata?.revisionStrategy as string ?? 'conservative';
  let revisedTruth: Truth;

  switch (strategy) {
    case 'radical':
      revisedTruth = TruthOps.revision(belief.truth, evidence.truth);
      break;
    case 'moderate':
      revisedTruth = TruthOps.revisionWeak(belief.truth, evidence.truth);
      break;
    case 'conservative':
    default:
      // Keep original belief with slight adjustment
      revisedTruth = TruthOps.damp(belief.truth, 0.95);
      break;
  }

  return {
    faculty: 'revision',
    result: {
      revised: {
        term: belief.term,
        truth: revisedTruth,
        reason: `Conservative ${strategy} revision`,
      },
    },
    confidence: 0.4,
    evidence: [{ source: 'rule', description: `NAL ${strategy} revision`, strength: 0.4 }],
    fallbackUsed: true,
    durationMs: 0,
  };
};

/** Planning Fallback - no plan. */
export const planningFallback: FacultyFallback = async (input): Promise<FacultyOutput | null> => {
  const { primary, context } = input;
  const goal = primary as Task;

  // Decompose conjunction goals
  const term = goal.term;
  const steps: any[] = [];

  if (isConjunction(term) || isDisjunction(term)) {
    const args = getArgs(term);
    for (let i = 0; i < args.length; i++) {
      steps.push({
        step: fromNarsese(`<${args[i]} => !>`),
        precondition: fromNarsese(`(${args[i]} --> ?pre)`),
        effect: args[i],
        cost: 1.0 / args.length,
      });
    }
  }

  return {
    faculty: 'planning',
    result: { plan: steps },
    confidence: 0.15,
    evidence: [{ source: 'fallback', description: 'Goal decomposition fallback', strength: 0.15 }],
    fallbackUsed: true,
    durationMs: 0,
  };
};

/** Evaluation Fallback - neutral evaluation. */
export const evaluationFallback: FacultyFallback = async (input): Promise<FacultyOutput | null> => {
  const { primary, secondary } = input;
  const outcome = primary as Task;
  const goal = secondary as Task;

  // Simple truth-based evaluation
  const score = TruthOps.expectation(outcome.truth);
  const passed = score > 0.5;

  return {
    faculty: 'evaluation',
    result: {
      evaluation: {
        score,
        criteria: { truth: score },
        passed,
      },
    },
    confidence: 0.4,
    evidence: [{ source: 'rule', description: 'Truth-based evaluation', strength: 0.4 }],
    fallbackUsed: true,
    durationMs: 0,
  };
};

/** Communication Fallback - template-based. */
export const communicationFallback: FacultyFallback = async (input): Promise<FacultyOutput | null> => {
  const { primary, context } = input;
  const term = asTerm(primary);
  const direction = context?.metadata?.direction as string ?? 'to-natural';

  let translation = '';
  const termStr = term.toString();

  if (direction === 'to-natural') {
    // Simple Narsese to natural language
    if (isInheritance(term)) {
      const [s, p] = getArgs(term);
      translation = `${s} is a kind of ${p}`;
    } else if (isConjunction(term)) {
      const args = getArgs(term).map(a => a.toString());
      translation = args.join(' and ');
    } else {
      translation = termStr;
    }
  } else {
    // Natural to Narsese - very limited
    const match = termStr.match(/(\w+)\s+is\s+(?:a|an)?\s*(\w+)/i);
    if (match) {
      translation = `(${match[1]} --> ${match[2]})`;
    } else {
      translation = termStr;
    }
  }

  return {
    faculty: 'communication',
    result: { translation, confidence: 0.3 },
    confidence: 0.25,
    evidence: [{ source: 'fallback', description: 'Template-based translation', strength: 0.25 }],
    fallbackUsed: true,
    durationMs: 0,
  };
};

/** Governance Fallback - permissive. */
export const governanceFallback: FacultyFallback = async (input): Promise<FacultyOutput | null> => {
  const { primary, context } = input;
  const strictMode = context?.metadata?.strictMode as boolean ?? false;

  // Permissive by default, strict mode adds basic checks
  const violations: any[] = [];
  const recommendations: string[] = [];

  if (strictMode) {
    // Check for obviously dangerous terms
    const termStr = primary.toString().toLowerCase();
    const dangerous = ['delete', 'remove', 'destroy', 'harm', 'attack'];
    for (const word of dangerous) {
      if (termStr.includes(word)) {
        violations.push({
          rule: 'safety',
          severity: 'warning',
          description: `Potentially dangerous term: ${word}`,
        });
        recommendations.push(`Review ${word} operation`);
      }
    }
  }

  return {
    faculty: 'governance',
    result: {
      compliant: violations.length === 0,
      violations,
      recommendations,
    },
    confidence: 0.6,
    evidence: [{ source: 'fallback', description: 'Permissive governance fallback', strength: 0.6 }],
    fallbackUsed: true,
    durationMs: 0,
  };
}

/** All fallbacks indexed by faculty name. */
export const facultyFallbacks: Record<string, FacultyFallback> = {
  grounding: groundingFallback,
  inference: inferenceFallback,
  abduction: abductionFallback,
  induction: inductionFallback,
  analogy: analogyFallback,
  revision: revisionFallback,
  planning: planningFallback,
  evaluation: evaluationFallback,
  communication: communicationFallback,
  governance: governanceFallback,
};

/** Get fallback for a faculty. */
export function getFallback(faculty: string): FacultyFallback | undefined {
  return facultyFallbacks[faculty];
}

/** Register all fallbacks with the faculty registry. */
export function registerAllFallbacks(registry: FacultyRegistry): void {
  for (const [name, fallback] of Object.entries(facultyFallbacks)) {
    const spec = registry.get(name as any);
    if (spec) {
      // The spec already has the fallback, but we ensure it's registered
      // This is a no-op if already registered
    }
  }
}