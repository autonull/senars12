/**
 * Phase D (REFACTOR.todo2): Self-Improvement Proposals as an AIKR process —
 * proposals accumulate in a capacity-bounded bag (priority = expected impact ×
 * risk-inverse × drive-alignment); under pressure the highest-leverage
 * proposals drain into the governance router. Superseded proposals (same
 * kind + scope) decay out. Inert until wired: default processing stays
 * arrival-order.
 */
import type { SelfImprovementProposal } from '@senars/core/schemas/governance';
import { selectByPriority } from '@senars/util';
import {
  AIKRProcessor,
  type AikrBagOptions,
  AikrShell,
  type ProcessOptions,
  createAikrBag,
} from '../learning/aikr-processor.js';
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
  'schema-evolution': 0.7,
  'metta-rule-adoption': 0.7,
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

export interface ProposalBagOptions extends AikrBagOptions {
  /** Optional drive-alignment multiplier (default neutral 1). */
  alignmentOf?: (proposal: SelfImprovementProposal) => number;
}

/**
 * Governance routing is a per-call concern rather than a constructor-wired
 * sink, so this one composes the shell instead of inheriting it.
 */
export class ProposalBag {
  readonly #shell: AikrShell<ProposalCandidate, SelfImprovementProposal, SelfImprovementProposal>;
  readonly #alignmentOf: (proposal: SelfImprovementProposal) => number;

  constructor(options: ProposalBagOptions = {}) {
    const bag = createAikrBag<ProposalCandidate>({
      capacity: options.capacity ?? 64,
      forgetRate: options.forgetRate,
      rng: options.rng,
      implementation: options.implementation,
    });
    this.#shell = new AikrShell<
      ProposalCandidate,
      SelfImprovementProposal,
      SelfImprovementProposal
    >({
      bag,
      budget: options.budget ?? 4,
      view: (candidate) => candidate.proposal,
      processor: new AIKRProcessor<ProposalCandidate, SelfImprovementProposal>({
        bag,
        pressureThreshold: options.pressureThreshold ?? 0.4,
        rng: options.rng,
        samplingStrategy: {
          name: 'greedy-priority',
          select: (items, budget) => selectByPriority(items, budget),
        },
        process: (picked) => picked.map((c) => c.proposal),
      }),
    });
    this.#alignmentOf = options.alignmentOf ?? (() => 1);
  }

  /** Admit a proposal; same-scope elders halve in priority (superseded ⇒ decay out). */
  admit(proposal: SelfImprovementProposal): boolean {
    const scope = proposalScope(proposal);
    for (const candidate of this.#shell.bag.all()) {
      if (candidate.scope === scope) candidate.priority *= 0.5;
    }
    return this.#shell.admit({
      id: proposal.proposalId,
      priority:
        KIND_IMPACT[proposal.kind] * RISK_INVERSE[proposal.riskTier] * this.#alignmentOf(proposal),
      proposal,
      scope,
    });
  }

  /** Drain under pressure into the governance router (caller supplies routing). */
  async drainIfPressured(
    route: (proposal: SelfImprovementProposal) => void,
    options: ProcessOptions = {}
  ): Promise<SelfImprovementProposal[]> {
    const drained = await this.#shell.drainIfPressured(options);
    for (const proposal of drained) route(proposal);
    return drained;
  }

  /** Explicit drain — ignores the pressure gate (CLI/.proposals paths). */
  async drain(
    route: (proposal: SelfImprovementProposal) => void,
    options: ProcessOptions = {}
  ): Promise<SelfImprovementProposal[]> {
    const drained = await this.#shell.drain(options);
    for (const proposal of drained) route(proposal);
    return drained;
  }

  /** Stage 6 — decay (superseded/stale proposals evaporate). */
  decay(rate?: number): void {
    this.#shell.decay(rate);
  }

  get pressure(): number {
    return this.#shell.pressure;
  }

  get size(): number {
    return this.#shell.size;
  }

  peek(): SelfImprovementProposal[] {
    return this.#shell.peek();
  }
}
