/**
 * Derivation verification — the trusted boundary's proof checker.
 *
 * Two questions, two owners. *Shape* belongs to `DerivationRecordSchema`: id
 * formats, rule categories, truth bounds, engine identity. *Proof* belongs here:
 * does each step's declared truth follow from its premise truths under the NAL
 * algebra, is its lineage well formed, and does the record's conclusion match
 * its last step.
 *
 * The truth table below is written out rather than imported from `@senars/nar`
 * on purpose — a verifier that shares the engine's arithmetic can only confirm
 * the engine agrees with itself. This package has no engine dependency, so that
 * independence is enforced by the dependency graph rather than by convention.
 */

import { formatIssues } from '@senars/util';
import { DerivationRecordSchema } from './derivation-schemas.js';
import type { DerivationRecord, DerivationStep, TruthValue } from './derivation-schemas.js';

/** One defect, tagged with the check that caught it. */
export interface VerificationFinding {
  readonly stepId?: string;
  readonly check: string;
  readonly detail: string;
}

/** Per-step verdict. `computedTruth` is absent when no truth function applies. */
export interface StepVerificationResult {
  readonly stepId: string;
  readonly ok: boolean;
  /** {@link VerificationFinding}s for this step, as messages. */
  readonly errors: string[];
  readonly findings: readonly VerificationFinding[];
  readonly declaredTruth: TruthValue;
  readonly computedTruth?: TruthValue;
}

export interface VerificationResult {
  readonly derivationId: string;
  readonly ok: boolean;
  /** {@link VerificationFinding}s as messages — the form a boot check logs. */
  readonly errors: string[];
  readonly findings: readonly VerificationFinding[];
  readonly stepResults: readonly StepVerificationResult[];
  /** Steps whose declared truth was reproduced by the table below. */
  readonly truthVerified: number;
  /** Steps the table could not judge: unknown rule, or premise truths absent. */
  readonly truthSkipped: number;
  readonly verifiedAt: number;
}

export interface VerifyOptions {
  /** Fail on a step whose rule has no truth function in the table below. */
  readonly strict?: boolean;
  /** Tolerance on every truth comparison. */
  readonly epsilon?: number;
  /** Verify at most the first N steps. */
  readonly maxSteps?: number;
}

const DEFAULT_EPSILON = 1e-6;

const c2w = (c: number): number => (c === 1 ? 1e10 : c / (1 - c));
const w2c = (w: number): number => w / (w + 1);
const div = (n: number, d: number): number => (d === 0 ? 0 : n / d);

type BinaryTruthFn = (f1: number, f2: number, c1: number, c2: number) => [number, number];
type UnaryTruthFn = (f: number, c: number) => [number, number];

/**
 * NAL truth functions, transcribed from the algebra in NAL_IR.md §Truth Value
 * Algebra. Revision caps confidence at the engine's `MAX_CONFIDENCE` so a
 * saturating revision compares equal to the clamped value the engine stores.
 */
const BINARY_TRUTH: Record<string, BinaryTruthFn> = {
  deduction: (f1, f2, c1, c2) => [f1 * f2, c1 * c2],
  induction: (f1, f2, c1, c2) => {
    const w = f2 * c1 * c2;
    return [f2, w / (w + 1)];
  },
  abduction: (f1, f2, c1, c2) => {
    const w = f1 * c1 * c2;
    return [f1, w / (w + 1)];
  },
  exemplification: (f1, f2, c1, c2) => [f1 * f2, (c1 / (c1 + 1)) * c1 * c2 * f1 * f2],
  comparison: (f1, f2, c1, c2) => {
    const p = f1 * f2;
    return [div(p, p + (1 - f1) * (1 - f2)), c1 * c2];
  },
  analogy: (f1, f2, c1, c2) => [f1 * f2, c1 * c2 * f2],
  resemblance: (f1, f2, c1, c2) => [(f1 + f2) / 2, c1 * c2],
  intersection: (f1, f2, c1, c2) => [f1 * f2, c1 * c2],
  union: (f1, f2, c1, c2) => [1 - (1 - f1) * (1 - f2), c1 * c2],
  revision: (f1, f2, c1, c2) => {
    const w = c2w(c1) + c2w(c2);
    return [(f1 * c2w(c1) + f2 * c2w(c2)) / w, Math.min(w2c(w), 0.999)];
  },
  detachment: (f1, f2, c1, c2) => [f2, f1 * c1 * c2],
};

const UNARY_TRUTH: Record<string, UnaryTruthFn> = {
  'negation-intro': (f, c) => [1 - f, c],
  'negation-elim': (f, c) => [1 - f, c],
  negation: (f, c) => [1 - f, c],
  conversion: (f, c) => [f, f * c],
};

/**
 * The transcribed table, exported so the drift test can compare it against the
 * engine's own arithmetic. Exporting it for that test does not weaken the
 * independence the header claims: nothing in the engine imports it, so the
 * verifier's proofs are still computed without the engine's arithmetic.
 */
export const VERIFIER_TRUTH_TABLE = { BINARY_TRUTH, UNARY_TRUTH };

/**
 * Map a rule id onto its truth function. Rule ids are namespaced
 * (`nal.deduction`, `structural.conversion`, …), so an exact hit is tried
 * before a substring match. An unmatched id is a skip, never a proof.
 */
const resolveTruthFn = (
  ruleId: string
): { arity: 1 | 2; fn: (f: number[], c: number[]) => [number, number] } | null => {
  const key = ruleId.toLowerCase().replace(/_/g, '-');
  const binary = BINARY_TRUTH[key];
  if (binary) return { arity: 2, fn: (f, c) => binary(f[0]!, f[1]!, c[0]!, c[1]!) };
  const unary = UNARY_TRUTH[key];
  if (unary) return { arity: 1, fn: (f, c) => unary(f[0]!, c[0]!) };
  const binaryName = Object.keys(BINARY_TRUTH).find((name) => key.includes(name));
  if (binaryName !== undefined) {
    const fn = BINARY_TRUTH[binaryName]!;
    return { arity: 2, fn: (f, c) => fn(f[0]!, f[1]!, c[0]!, c[1]!) };
  }
  const unaryName = Object.keys(UNARY_TRUTH).find((name) => key.includes(name));
  if (unaryName !== undefined) {
    const fn = UNARY_TRUTH[unaryName]!;
    return { arity: 1, fn: (f, c) => fn(f[0]!, c[0]!) };
  }
  return null;
};

const close = (a: number, b: number, epsilon: number): boolean => Math.abs(a - b) <= epsilon;

export const formatFinding = (finding: VerificationFinding): string =>
  `[${finding.check}]${finding.stepId ? ` step ${finding.stepId}` : ''}: ${finding.detail}`;

type ProofState = { verified: number; skipped: number };

/** Verify one derivation step: shape, lineage, substitution grounding, truth. */
const verifyStep = (
  step: DerivationStep,
  priorStepIds: ReadonlySet<string>,
  taskId: string,
  options: { epsilon: number; strict: boolean },
  state: ProofState
): StepVerificationResult => {
  const findings: VerificationFinding[] = [];
  const fail = (check: string, detail: string): void => {
    findings.push({ stepId: step.stepId, check, detail });
  };

  if (!step.ruleId.trim()) fail('rule-shape', 'Missing ruleId');
  if (step.premises.length === 0) fail('premise-shape', 'No premises provided');
  if (step.premises.some((p) => !p.trim())) fail('premise-shape', 'Empty premise term string');
  if (!step.conclusion.trim()) fail('conclusion-shape', 'Empty conclusion term string');

  for (const [variable, value] of Object.entries(step.substitution ?? {})) {
    if (!value.trim()) fail('substitution-value', `Variable ${variable} binds empty value`);
    else if (!step.premises.some((p) => p.includes(variable)))
      fail('substitution-premise', `Variable ${variable} appears in no premise`);
    else if (!step.conclusion.includes(variable) && !step.conclusion.includes(value))
      fail('substitution-conclusion', `Neither ${variable} nor its value appears in conclusion`);
  }

  for (const parent of step.evidenceLineage) {
    if (!priorStepIds.has(parent) && parent !== taskId)
      fail('lineage-dag', `Lineage ${parent} is neither a prior step nor the taskId`);
  }

  if (step.independence === 'unknown' && step.ruleId.toLowerCase().includes('revision'))
    fail(
      'evidence-independence',
      'Revision with unknown independence must be conservatively rejected by the engine'
    );

  let computedTruth: TruthValue | undefined;
  const resolved = resolveTruthFn(step.ruleId);
  if (!resolved) {
    state.skipped++;
    if (options.strict) fail('unknown-rule', `No truth function for ruleId '${step.ruleId}'`);
  } else if (step.premiseTruths?.length !== resolved.arity) {
    state.skipped++;
  } else {
    const [f, c] = resolved.fn(
      step.premiseTruths.map((t) => t.frequency),
      step.premiseTruths.map((t) => t.confidence)
    );
    computedTruth = { frequency: f, confidence: c };
    if (close(f, step.truth.frequency, options.epsilon) && close(c, step.truth.confidence, options.epsilon))
      state.verified++;
    else
      fail(
        'truth-algebra',
        `Expected f=${f.toFixed(6)} c=${c.toFixed(6)}, got f=${step.truth.frequency} c=${step.truth.confidence} via ${step.ruleId}`
      );
  }

  return {
    stepId: step.stepId,
    ok: findings.length === 0,
    errors: findings.map(formatFinding),
    findings,
    declaredTruth: step.truth,
    ...(computedTruth ? { computedTruth } : {}),
  };
};

/**
 * Verify a derivation record end to end. Shape is checked against the schema
 * first, so every field read below is guaranteed well formed.
 */
export function verifyRecord(record: DerivationRecord, options: VerifyOptions = {}): VerificationResult {
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const findings: VerificationFinding[] = [];
  const stepResults: StepVerificationResult[] = [];
  const state: ProofState = { verified: 0, skipped: 0 };
  const fail = (check: string, detail: string, stepId?: string): void => {
    findings.push({ stepId, check, detail });
  };

  const parsed = DerivationRecordSchema.safeParse(record);
  if (!parsed.success) {
    fail('record-shape', formatIssues(parsed.error.issues));
  } else {
    const { steps, finalTruth, taskId, totalCycles } = parsed.data;
    const toVerify = options.maxSteps ? steps.slice(0, options.maxSteps) : steps;
    const seen = new Set<string>();

    for (const step of toVerify) {
      if (seen.has(step.stepId)) fail('unique-step-id', `Duplicate stepId ${step.stepId}`, step.stepId);
      stepResults.push(verifyStep(step, new Set(seen), taskId, { epsilon, strict: options.strict ?? false }, state));
      seen.add(step.stepId);
    }
    for (const result of stepResults) findings.push(...result.findings);

    const last = toVerify[toVerify.length - 1];
    if (last) {
      if (!close(last.truth.frequency, finalTruth.frequency, epsilon)
        || !close(last.truth.confidence, finalTruth.confidence, epsilon))
        fail('final-truth', 'finalTruth does not match last step truth');
    } else if (totalCycles > 0) {
      fail('empty-derivation', 'Record claims cycles but has no steps');
    }
  }

  return {
    derivationId: record?.derivationId ?? '',
    ok: findings.length === 0,
    errors: findings.map(formatFinding),
    findings,
    stepResults,
    truthVerified: state.verified,
    truthSkipped: state.skipped,
    verifiedAt: Date.now(),
  };
}
