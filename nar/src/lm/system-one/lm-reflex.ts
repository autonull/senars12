import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { Perception } from '../../game/Game.js';
import type { ActionProposal, LearningEvent, Reflex } from '../../reflex/Reflex.js';
import type { Truth } from '../../terms/truth.js';
import { actionGrammar } from './action-grammar.js';
import type { ContrastiveMemory } from './contrastive.js';
import { createDecider, type Decider } from './decide.js';
import type { JudgmentDataset } from './distill.js';
import { recordReflexOutcome } from './reflex-label-source.js';
import type { CognitiveDispatcher, EmbeddingCache, EmbeddingPointer } from './types.js';

export interface LMReflexOptions {
  /** Incumbent reflex served when the LM is cold, failed, or breaker-open (C2). */
  fallback: Reflex<unknown, unknown>;
  dispatcher: CognitiveDispatcher;
  embeddingCache: EmbeddingCache;
  budget: ReasoningBudget;
  dataset?: JudgmentDataset;
  /** Game semantics appended to the decision prompt (e.g. '0=up, 1=right, ...'). */
  actionLegend?: string;
  /** Narrative decision prompt with `{feature}` placeholders interpolated from
   *  the observation. Small models reason reliably over sentences, not
   *  `key=value` digests; the digest is the fallback. */
  promptTemplate?: string;
  /** Max GBNF-constrained candidates the LM may propose per decision (C1). */
  maxCandidates?: number;
  /** CLM contrastive verification: proposals near stored hard negatives are demoted. */
  contrastive?: ContrastiveMemory;
}

/**
 * Real-LM per-tick decision reflex (TODO17 C1): at the prefetch (attend) stage
 * the LM proposes ranked candidates under a generated GBNF grammar enumerating
 * the legal-action set; the manifold judges them (reflex_value / feasibility /
 * risk). The synchronous propose contract reads the warm table; cold/failure
 * ⇒ fallback reflex. The LM arm feeds the distillation flywheel (C3).
 */
export class LMReflex implements Reflex<Perception, string> {
  readonly id = 'lm-reflex';

  #fallback: Reflex<unknown, unknown>;
  #dispatcher: CognitiveDispatcher;
  readonly embeddingCache: EmbeddingCache;
  readonly budget: ReasoningBudget;
  #dataset?: JudgmentDataset;
  #actionLegend?: string;
  #promptTemplate?: string;
  #maxCandidates: number;
  #contrastive?: ContrastiveMemory;
  /** TODO23 Phase 4: candidate verification routed through the unified choose() API. */
  #decider: Decider;
  #warm = new Map<string, { action: string; confidence: number }>();
  /** stateId → embedding pointer, for recording distillation rows whose vectors
   *  match what the manifold reads at runtime (bounded; evicts-all at cap). */
  #statePointers = new Map<string, EmbeddingPointer>();
  #statePointersCap = 2000;
  failures = 0;
  /** Distillation rows recorded WITH an embedding (vector-joinable at training). */
  embeddedRows = 0;
  decisions = 0;
  /** Warm decisions actually served at propose (diagnoses cold/missed hand-offs). */
  served = 0;
  /** Proposals rejected or demoted by contrastive verification (CLM telemetry). */
  contrastiveVetoes = 0;
  /** TODO24 Phase-B readout: legal actions vs the action this reflex last served. */
  #lastDecision?: { proposed: readonly string[]; selected: string };

  get lastDecision(): { proposed: readonly string[]; selected: string } | undefined {
    return this.#lastDecision;
  }

  constructor(options: LMReflexOptions) {
    this.#fallback = options.fallback;
    this.#dispatcher = options.dispatcher;
    this.embeddingCache = options.embeddingCache;
    this.budget = options.budget;
    this.#dataset = options.dataset;
    this.#actionLegend = options.actionLegend;
    this.#promptTemplate = options.promptTemplate;
    this.#maxCandidates = options.maxCandidates ?? 3;
    this.#contrastive = options.contrastive;
    this.#decider = createDecider({
      judge: (pointer, queries, budget) => options.dispatcher.judge(pointer, queries, budget),
      embeddingCache: options.embeddingCache,
      contrastive: options.contrastive,
    });
  }

  /** Attend-stage: LM proposes + manifold judges (the only await, C2). */
  async prefetch(
    stateId: string,
    context: EmbeddingPointer,
    legalActions: readonly string[],
    _manifold?: unknown,
    _budget?: ReasoningBudget,
    observation?: Perception
  ): Promise<void> {
    if (legalActions.length === 0) return;
    try {
      const stateDigest = Object.entries(observation?.features ?? {})
        .slice(0, 24)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      const cognitiveContext = {
        tickId: stateId,
        topBeliefs: [...legalActions],
        topGoals: ['choose the best legal action'],
        workingMemory: [],
      };
      const judgmentQueries = legalActions.slice(0, this.#maxCandidates).map((action) => ({
        kind: 'evaluate' as const,
        instruction: `Evaluate action ${action}`,
        rubric: 'reflex_value' as const,
        axis: 'teleological' as const,
      }));
      const result = await this.#dispatcher.proposeAndJudge(
        cognitiveContext,
        {
          kind: 'synthesize',
          instruction: 'Choose the single best next action.',
          grammar: actionGrammar(legalActions),
          maxCandidates: this.#maxCandidates,
          promptOverride: this.#promptTemplate
            ? this.#promptTemplate.replace(/\{(\w+)\}/g, (_, key) =>
                String(
                  (observation?.features as Record<string, number> | undefined)?.[key] ?? `{${key}}`
                )
              )
            : [
                `Legal actions: ${legalActions.join(', ')}`,
                ...(this.#actionLegend ? [this.#actionLegend] : []),
                ...(stateDigest ? [`State observations: ${stateDigest}`] : []),
                'Which action maximizes expected reward? Answer with only the action.',
              ].join('\n'),
        },
        judgmentQueries,
        this.budget
      );
      void context;
      // Highest-ranked *legal* candidate: stub/illegal candidates (LM produced
      // fewer than maxCandidates) must never shadow a real decision.
      let ranked = result.ranked.filter((r) => legalActions.includes(r.candidate));
      // CLM contrastive verification: score legal candidates against stored
      // hard negatives; the top proposal must clear the verification floor or
      // the next-best verified candidate serves instead.
      if (this.#contrastive && !this.#contrastive.isEmpty() && ranked.length > 0) {
        ranked = await this.#verifiedRanking(ranked);
        if (ranked[0]!.candidate !== result.ranked.find((r) => legalActions.includes(r.candidate))!.candidate) {
          this.contrastiveVetoes++;
        }
      }

      const top = ranked[0];
      if (top) {
        this.#warm.set(stateId, { action: top.candidate, confidence: top.truth.f });
        this.decisions++;
      }
      if (context) {
        if (this.#statePointers.size >= this.#statePointersCap) this.#statePointers.clear();
        this.#statePointers.set(stateId, context);
      }
    } catch {
      this.failures++; // cold — fallback serves at propose
    }
  }

  /** Synchronous contract: warm LM decision, else fallback. */
  propose(state: Perception, legalActions: string[]): ActionProposal[] {
    const warm = this.#warm.get(state.stateId);
    this.#warm.delete(state.stateId);
    const legal = legalActions.map(String);
    if (warm && legal.includes(warm.action)) {
      this.served++;
      this.#lastDecision = { proposed: legal, selected: warm.action };
      return [
        {
          action: warm.action,
          value: 0.5 + warm.confidence / 2,
          confidence: Math.max(0.1, warm.confidence),
          source: this.id,
        },
      ];
    }
    return this.#fallback.propose(state, legalActions) as ActionProposal[];
  }

  /**
   * CLM contrastive verification (Phase 4): re-rank candidates through the
   * unified `choose()` API — pre-scored so no extra head invocation; the
   * contrastive penalty reorders (positive−negative similarity), stable on
   * ties so verification only demotes clear losers.
   */
  async #verifiedRanking(
    ranked: readonly { candidate: string; truth: Truth }[]
  ): Promise<{ candidate: string; truth: Truth }[]> {
    const result = await this.#decider.choose({
      context: ranked.map((r) => r.candidate).join(', '),
      candidates: ranked.map((r) => r.candidate),
      budget: this.budget,
      // Uniform weights + no floor: ordering must come from the contrastive
      // penalty alone (penalty = 1 − cross-rubric score), rank-stable on ties.
      preScored: ranked.map((r) => ({ option: r.candidate, p: 1 })),
    });
    const verification = (candidate: string): number =>
      1 - (result.contrastive.penalties[candidate] ?? 0);
    return ranked
      .map((entry, index) => ({ entry, index, verification: verification(entry.candidate) }))
      .sort((a, b) => b.verification - a.verification || a.index - b.index)
      .map((s) => s.entry);
  }

  learn(event: LearningEvent): void {
    if (this.#dataset && (event.actionProposed || event.actionExecuted)) {
      // Attribute the outcome to the state the action was DECIDED in (previous
      // perception) — its embedding was prefetched this tick; the next state's
      // is not, and reward belongs to the decision state anyway.
      const decisionState = event.previousPerception ?? event.perception;
      const stateId = decisionState?.stateId ?? 'unknown-state';
      const pointer = this.#statePointers.get(stateId);
      recordReflexOutcome(this.#dataset, {
        stateDigest: stateId,
        action: event.actionExecuted ?? event.actionProposed,
        reward: event.reward,
        source: this.id,
        embedding: pointer ? this.embeddingCache.read(pointer) : undefined,
      });
      if (pointer && this.embeddingCache.read(pointer)) this.embeddedRows++;
    }
    this.#fallback.learn(event);
  }
}
