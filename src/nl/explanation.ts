/**
 * CORE.19 C6.4 — the explanatory voice.
 *
 * Given a conclusion, walk the kernel's own rule-fire records (CORE.19 C3) and
 * produce an explanation that cites the *real* steps that derived it. The
 * engine facts are always present and always engine-derived; an LM paraphrase
 * is a separate, labeled field that never replaces them (D17: the paraphrase is
 * a proposal, the facts are the record).
 */

import type { DerivationStep, TruthValue } from '@senars/core/schemas';
import { formatTruth, unique } from '@senars/util';
import type { BeliefInfo, ConflictInfo, GenerationInput, GenerationOutput } from './generation.js';

/** How many links of the derivation chain an explanation walks. */
const DEFAULT_MAX_DEPTH = 16;

export interface Explanation {
  /** The conclusion being explained. */
  conclusion: string;
  /** Engine-derived facts, one per cited fire — no prose, no model. */
  facts: string[];
  /** The step ids the explanation cites; resolvable via `NAR.getRuleFireById`. */
  derivationIds: string[];
  /** The rule ids applied along the chain, deduped. */
  rules: string[];
  /** The chain's base premises — terms no cited step derives. */
  premises: string[];
  /** The conclusion's truth as the engine recorded it, when a fire exists. */
  truth?: TruthValue;
  /** How many fires the chain cites. */
  steps: number;
  /** The deterministic, engine-only narrative (present with or without an LM). */
  narrative: string;
  /** An LM paraphrase of the engine facts — absent without an LM, always extra. */
  paraphrase?: string;
}

/**
 * Two coexisting beliefs whose terms negate each other, shown with the
 * provenance of each side (CORE.19 C6.5). The deterministic `narrative` states
 * what the kernel holds; each `sides` entry is a full {@link Explanation} so the
 * conflict is explained from the same rule-fire records as any derivation.
 */
export interface ConflictExplanation {
  /** The two contradicted terms, in the order requested. */
  terms: [string, string];
  /** Each side's provenance, in the same order as `terms`. */
  sides: Explanation[];
  /** Every cited derivation id across both sides; resolvable via `getRuleFireById`. */
  derivationIds: string[];
  /** The rule ids cited across both sides, deduped. */
  rules: string[];
  /** The fires cited across both sides. */
  steps: number;
  /** The deterministic, engine-only narrative of the conflict. */
  narrative: string;
}

export interface ExplanationSource {
  /** The fires whose conclusion is `term` — the recorder's term-indexed view (C3.1). */
  firesByConclusion: (term: string) => readonly DerivationStep[];
}

export interface ExplanationGeneratorOptions {
  source: ExplanationSource;
  /** Optional LM paraphrase (D10): absent ⇒ deterministic narrative only. */
  paraphrase?: (input: GenerationInput) => Promise<GenerationOutput>;
  maxDepth?: number;
}

export class ExplanationGenerator {
  private readonly source: ExplanationSource;
  private readonly paraphrase?: (input: GenerationInput) => Promise<GenerationOutput>;
  private readonly maxDepth: number;

  constructor({ source, paraphrase, maxDepth = DEFAULT_MAX_DEPTH }: ExplanationGeneratorOptions) {
    this.source = source;
    this.paraphrase = paraphrase;
    this.maxDepth = maxDepth;
  }

  async explain(conclusion: string): Promise<Explanation> {
    const steps = this.collect(conclusion, this.maxDepth, new Set());
    const facts = steps.map((step) => describeStep(step));
    const derivationIds = steps.map((step) => step.stepId);
    const rules = unique(steps.map((step) => step.ruleId));
    const premises = this.basePremises(steps);
    const last = steps[steps.length - 1];
    const narrative = narrate(conclusion, premises, rules, steps.length);

    const explanation: Explanation = {
      conclusion,
      facts,
      derivationIds,
      rules,
      premises,
      ...(last ? { truth: last.truth } : {}),
      steps: steps.length,
      narrative,
    };

    const paraphrase = await this.maybeParaphrase(conclusion, steps);
    return paraphrase ? { ...explanation, paraphrase } : explanation;
  }

  /**
   * Explain a conflict between two contradicted beliefs (CORE.19 C6.5): the
   * provenance of each side, cited from the same rule-fire records, plus a
   * deterministic narrative. Each side is a full explanation, so its own
   * paraphrase (when an LM is configured) stays a labeled extra.
   */
  async explainConflict(a: string, b: string): Promise<ConflictExplanation> {
    const [left, right] = await Promise.all([this.explain(a), this.explain(b)]);
    const sides = [left, right] as const;
    return {
      terms: [a, b],
      sides: [left, right],
      derivationIds: unique(sides.flatMap((side) => side.derivationIds)),
      rules: unique(sides.flatMap((side) => side.rules)),
      steps: left.steps + right.steps,
      narrative: narrateConflict(a, b, sides),
    };
  }

  /**
   * Depth-first, premises first, one fire per conclusion. A fire is cited at
   * most once (its `stepId` is the guard), so a diamond-shaped proof lists its
   * shared steps once rather than expanding the join.
   */
  private collect(term: string, depth: number, visited: Set<string>): DerivationStep[] {
    if (depth <= 0) return [];
    const fires = this.source.firesByConclusion(term);
    const fire = fires[fires.length - 1];
    if (!fire || visited.has(fire.stepId)) return [];
    visited.add(fire.stepId);
    const parents = fire.premises.flatMap((premise) =>
      this.collect(premise, depth - 1, visited)
    );
    return [...parents, fire];
  }

  private basePremises(steps: readonly DerivationStep[]): string[] {
    const derived = new Set(steps.map((step) => step.conclusion));
    return unique(steps.flatMap((step) => step.premises).filter((premise) => !derived.has(premise)));
  }

  private async maybeParaphrase(
    conclusion: string,
    steps: readonly DerivationStep[]
  ): Promise<string | undefined> {
    if (!this.paraphrase || steps.length === 0) return undefined;
    const derived = new Set(steps.map((step) => step.conclusion));
    const newBeliefs: BeliefInfo[] = steps
      .filter((step) => !derived.has(step.conclusion) || step === steps[steps.length - 1])
      .map((step) => ({ term: step.conclusion, truth: step.truth }));
    const beliefs: BeliefInfo[] = unique(steps.flatMap((s) => s.premises)).map((term) => ({
      term,
    }));
    const input: GenerationInput = {
      query: conclusion,
      derivation: { steps: steps.length, beliefs, newBeliefs },
      beliefs,
      conflicts: [] as ConflictInfo[],
    };
    try {
      const output = await this.paraphrase(input);
      return output.response;
    } catch {
      return undefined;
    }
  }
}

const describeStep = (step: DerivationStep): string =>
  `${step.ruleId} (${step.ruleCategory}): ${step.premises.join(' & ')} \u22a2 ${step.conclusion} ${formatTruth(step.truth)}`;

const narrate = (
  conclusion: string,
  premises: readonly string[],
  rules: readonly string[],
  steps: number
): string => {
  if (steps === 0) return `No recorded derivation for ${conclusion}.`;
  const from = premises.length > 0 ? `from ${premises.join(', ')}` : 'from the admitted premises';
  return `${conclusion} follows ${from} via ${rules.join(', ')} in ${steps} step(s).`;
};

const held = (explanation: Explanation): string =>
  explanation.steps > 0
    ? `derived via ${explanation.rules.join(', ') || 'recorded rules'} in ${explanation.steps} step(s)`
    : 'admitted directly, with no recorded derivation';

const narrateConflict = (
  a: string,
  b: string,
  [left, right]: readonly [Explanation, Explanation]
): string =>
  `Conflict: ${a} and ${b} are contradictory and both are held — ${a} was ${held(left)}; ` +
  `${b} was ${held(right)}. The kernel flags the conflict rather than retracting either side.`;
