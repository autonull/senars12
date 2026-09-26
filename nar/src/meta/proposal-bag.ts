/**
 * Phase D (REFACTOR.todo2): Self-Improvement Proposals as an AIKR process —
 * proposals accumulate in a capacity-bounded bag (priority = expected impact ×
 * risk-inverse × drive-alignment); under pressure the highest-leverage
 * proposals drain into the governance router. Superseded proposals (same
 * kind + scope) decay out. Inert until wired: default processing stays
 * arrival-order.
 */
import type { SelfImprovementProposal } from '@senars/kernel/schemas';
import { PriorityBag } from '../bag/Bag.js';
import { AIKRProcessor, type ProcessOptions, type AikrBagOptions } from '../learning/aikr-processor.js';
import type { RandomSource } from '../types/primitives.js';

export interface ProposalCandidate {
  id: string;
  priority: number;
  proposal: SelfImprovementProposal;
  /** Supersede scope: same kind + payload target ⇒ newer supersedes older. */
  scope: string;
}

const KIND_IMPACT: Record<SelfImprovementProposal['kind'], number> = {
  'strategy-switch': 0.9,
  'schema-promotion': 0.8,
  'patch-apply': 0.8,
  'knob-tune': 0.6,
  'focus-weight': 0.5,
  'test-generate': 0.4,
};

const RISK_INVERSE: Record<SelfImprovementProposal['riskTier'], number> = {
  low: 1,
  medium: 0.6,
  high: 0.2,
};

export const proposalScope = (proposal: SelfImprovementProposal): string => {
  const payload = proposal.payload as { knob?: unknown; focusId?: unknown; strategy?: unknown };
  const target =
    typeof payload.knob === 'string'
      ? payload.knob
      : typeof payload.focusId === 'string'
        ? payload.focusId
        : typeof payload.strategy === 'string'
          ? payload.strategy
          : '';
  return `${proposal.kind}:${target}`;
};

/** Highest-leverage first, id-tiebroken — deterministic (no RNG in selection). */
const greedySelection = <T extends { priority: number; id: string }>(
  items: T[],
  budget: number
): T[] =>
  [...items]
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, Math.max(budget, 0));

export interface ProposalBagOptions extends AikrBagOptions {
  /** Optional drive-alignment multiplier (default neutral 1). */
  alignmentOf?: (proposal: SelfImprovementProposal) => number;
}

export class ProposalBag {
  readonly #bag: PriorityBag<ProposalCandidate>;
  readonly #processor: AIKRProcessor<ProposalCandidate, SelfImprovementProposal>;
  readonly #budget: number;
  readonly #alignmentOf: (proposal: SelfImprovementProposal) => number;

  constructor(options: ProposalBagOptions = {}) {
    this.#budget = options.budget ?? 4;
    this.#alignmentOf = options.alignmentOf ?? (() => 1);
    this.#bag = new PriorityBag<ProposalCandidate>({
      capacity: options.capacity ?? 64,
      forgetRate: options.forgetRate,
      rng: options.rng,
    });
    this.#processor = new AIKRProcessor<ProposalCandidate, SelfImprovementProposal>({
      bag: this.#bag,
      pressureThreshold: options.pressureThreshold ?? 0.4,
      rng: options.rng,
      samplingStrategy: {
        name: 'greedy-priority',
        select: (items, budget) => greedySelection(items, budget),
      },
      process: (picked) => picked.map((c) => c.proposal),
    });
  }

  /** Admit a proposal; same-scope elders halve in priority (superseded ⇒ decay out). */
  admit(proposal: SelfImprovementProposal): boolean {
    const scope = proposalScope(proposal);
    for (const candidate of this.#bag.all()) {
      if (candidate.scope === scope) candidate.priority *= 0.5;
    }
    return this.#bag.add({
      id: proposal.proposalId,
      priority: KIND_IMPACT[proposal.kind] * RISK_INVERSE[proposal.riskTier] * this.#alignmentOf(proposal),
      proposal,
      scope,
    });
  }

  /** Drain under pressure into the governance router (caller supplies routing). */
  async drainIfPressured(
    route: (proposal: SelfImprovementProposal) => void,
    options: ProcessOptions = {}
  ): Promise<SelfImprovementProposal[]> {
    const drained = await this.#processor.processIfPressured({
      ...options,
      budget: options.budget ?? this.#budget,
    });
    for (const proposal of drained) route(proposal);
    return drained;
  }

  /** Explicit drain — ignores the pressure gate (CLI/.proposals paths). */
  async drain(
    route: (proposal: SelfImprovementProposal) => void,
    options: ProcessOptions = {}
  ): Promise<SelfImprovementProposal[]> {
    const drained = await this.#processor.process({
      ...options,
      budget: options.budget ?? this.#budget,
    });
    for (const proposal of drained) route(proposal);
    return drained;
  }

  /** Stage 6 — decay (superseded/stale proposals evaporate). */
  decay(rate?: number): void {
    this.#processor.decay(rate);
  }

  get pressure(): number {
    return this.#processor.pressure();
  }

  get size(): number {
    return this.#bag.size();
  }

  peek(): SelfImprovementProposal[] {
    return [...this.#bag.all()].map((c) => c.proposal);
  }
}
