import { withSpan } from '../otel/index';
import { TermBuilder } from '../terms';
import { NalVetoArbitration } from './weighted-quorum';
export class Negotiator {
    reflexThreshold;
    proposers;
    arbitration;
    eventBus;
    constructor(options = {}) {
        this.reflexThreshold = options.reflexThreshold ?? 0.3;
        this.proposers = options.proposers ?? [];
        this.eventBus = options.eventBus;
        this.arbitration =
            options.arbitration ??
                new NalVetoArbitration({
                    nalVetoThreshold: options.nalVetoThreshold,
                    reflexThreshold: options.reflexThreshold,
                });
    }
    /** Registered proposers (empty by default — zero behavior change). */
    get registeredProposers() {
        return this.proposers;
    }
    /** Fan a learning event out to all proposers (no-op with none registered). */
    learn(event) {
        for (const p of this.proposers)
            p.learn(event);
    }
    /** P3 (TODO20): veto-memo hit-rate surface (size only; 0 with custom arbitration). */
    memoStats() {
        return {
            size: this.arbitration instanceof NalVetoArbitration ? this.arbitration.memoSize() : 0,
        };
    }
    resolve(reflexProposals, nalDerivations) {
        return withSpan('negotiator.resolve', {
            'negotiator.proposals': reflexProposals.length,
            'negotiator.derivations': nalDerivations.length,
        }, (span) => {
            const input = { reflexProposals, nalDerivations };
            const mergedReflex = [...reflexProposals];
            const mergedNal = [...nalDerivations];
            for (const proposer of this.proposers) {
                const c = proposer.propose(input);
                if (c.reflex)
                    mergedReflex.push(...c.reflex);
                if (c.nal)
                    mergedNal.push(...c.nal);
            }
            const decision = this.arbitration.decide(mergedReflex, mergedNal);
            this.#emitContradictions(mergedReflex, mergedNal);
            span.setAttributes({
                'negotiator.source': decision.source,
                'negotiator.vetoed': decision.vetoedBy !== null,
                ...(decision.vetoedBy ? { 'negotiator.veto_reason': decision.vetoedBy } : {}),
            });
            return decision;
        });
    }
    /**
     * Phase C (REFACTOR.todo3 §10a M5): MeTTa/NAL disagreement on the same
     * action → typed `contradiction` event (MeTTa votes yes, NAL lacks a
     * supporting derivation). Inert without an eventBus (C10: wired consumers only).
     */
    #emitContradictions(reflexProposals, nalDerivations) {
        if (!this.eventBus)
            return;
        const at = Date.now();
        for (const p of reflexProposals) {
            if (p.source !== 'metta')
                continue;
            let supporting = false;
            let opposing = false;
            for (const d of nalDerivations) {
                if (d.action !== p.action)
                    continue;
                if (d.truth.f >= 0.5)
                    supporting = true;
                else
                    opposing = true;
                if (supporting && opposing)
                    break;
            }
            if (supporting || !opposing)
                continue;
            const event = {
                source: 'metta',
                term: TermBuilder.atom(p.action),
                mettaVote: true,
                nalVote: false,
                at,
            };
            this.eventBus.emit('contradiction', event);
        }
    }
    createLearningEvent(focus, decision, outcome) {
        return {
            perception: outcome.perception,
            previousPerception: outcome.previousPerception ?? null,
            actionProposed: decision.action ?? '',
            actionExecuted: decision.actionExecuted,
            reward: outcome.reward,
            terminal: outcome.terminal,
            overriddenBy: decision.vetoedBy,
        };
    }
}
