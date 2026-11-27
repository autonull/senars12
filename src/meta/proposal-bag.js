import { retain } from '@senars/util/numeric';
import { selectByPriority } from '@senars/util/collections';
import { AikrShell } from '../learning/aikr-processor';
const KIND_IMPACT = {
    'strategy-switch': 0.9,
    'schema-promotion': 0.8,
    'patch-apply': 0.8,
    'knob-tune': 0.6,
    'focus-weight': 0.5,
    'test-generate': 0.4,
    'schema-evolution': 0.7,
    'metta-rule-adoption': 0.7,
};
const RISK_INVERSE = {
    low: 1,
    medium: 0.6,
    high: 0.2,
};
export const proposalScope = (proposal) => {
    const payload = proposal.payload;
    const target = typeof payload.knob === 'string'
        ? payload.knob
        : typeof payload.focusId === 'string'
            ? payload.focusId
            : typeof payload.strategy === 'string'
                ? payload.strategy
                : '';
    return `${proposal.kind}:${target}`;
};
/**
 * Proposals drain below the shared AIKR default: governance review is cheap,
 * and a backlog of unexamined proposals is its own cost.
 */
const PROPOSAL_PRESSURE_THRESHOLD = 0.4;
/**
 * Governance routing is a per-call concern rather than a constructor-wired
 * sink, so this one composes the shell instead of inheriting it.
 */
export class ProposalBag {
    #shell;
    #alignmentOf;
    constructor(options = {}) {
        this.#shell = new AikrShell({
            capacity: options.capacity ?? 64,
            forgetRate: options.forgetRate,
            rng: options.rng,
            clock: options.clock,
            pressureThreshold: options.pressureThreshold ?? PROPOSAL_PRESSURE_THRESHOLD,
            budget: options.budget,
            view: (candidate) => candidate.proposal,
            samplingStrategy: 'greedy-priority',
            select: (items, budget) => selectByPriority(items, budget),
            process: (picked) => picked.map((c) => c.proposal),
        });
        this.#alignmentOf = options.alignmentOf ?? (() => 1);
    }
    /** Admit a proposal; same-scope elders halve in priority (superseded ⇒ decay out). */
    admit(proposal) {
        const scope = proposalScope(proposal);
        for (const candidate of this.#shell.bag.all()) {
            if (candidate.scope === scope)
                candidate.priority = retain(candidate.priority, 0.5);
        }
        return this.#shell.admit({
            id: proposal.proposalId,
            priority: KIND_IMPACT[proposal.kind] * RISK_INVERSE[proposal.riskTier] * this.#alignmentOf(proposal),
            proposal,
            scope,
        });
    }
    /** Drain under pressure into the governance router (caller supplies routing). */
    async drainIfPressured(route, options = {}) {
        const drained = await this.#shell.drainIfPressured(options);
        for (const proposal of drained)
            route(proposal);
        return drained;
    }
    /** Explicit drain — ignores the pressure gate (CLI/.proposals paths). */
    async drain(route, options = {}) {
        const drained = await this.#shell.drain(options);
        for (const proposal of drained)
            route(proposal);
        return drained;
    }
    /** Stage 6 — decay (superseded/stale proposals evaporate). */
    decay(rate) {
        this.#shell.decay(rate);
    }
    get pressure() {
        return this.#shell.pressure;
    }
    get size() {
        return this.#shell.size;
    }
    peek() {
        return this.#shell.peek();
    }
}
