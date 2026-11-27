import { recordApprovalLabel } from './label-sources';
import { ConfidenceRouter } from './policy';
import { seedDesire } from './seed';
/**
 * Teleological transducer (§7.2): converts Teleological judgments into
 * ActionProposals for the existing proposal → negotiate → authorize →
 * dispatch chain. Never produces Truth; authorization stays with KernelActionGate.
 */
export class ActionGateTransducer {
    #approvals;
    #router;
    #dataset;
    constructor(options = {}) {
        this.#approvals = options.approvals;
        this.#router = options.router ?? ConfidenceRouter.fromThreshold(options.threshold ?? 0.5);
        this.#dataset = options.distillationDataset;
    }
    transduce(p) {
        if (p.axis !== 'teleological' || p.kind !== 'classify' || p.abstained)
            return undefined;
        const { top } = p;
        // Risk gate → HITL via existing approvals (headless auto-rejects)
        if (top.option === 'high' || top.option === 'critical') {
            void this.#approvals?.requestApproval({
                action: top.option,
                payload: JSON.stringify({ queryId: p.queryId, top }),
                risk: 'high',
            });
            // R7: Record approval label for distillation
            if (this.#dataset) {
                recordApprovalLabel(this.#dataset, { action: top.option, approved: false });
            }
            return undefined;
        }
        // Band routing: act ⇒ desire-seeded; review ⇒ propose-only (Negotiator arbitrates);
        // block ⇒ no proposal. Authorization stays with KernelActionGate.
        switch (this.#router.route(p)) {
            case 'review':
                return { action: top.option, value: top.p, confidence: top.p, source: 'system-one' };
            case 'block':
                return undefined;
            default: {
                const desire = seedDesire(p);
                return {
                    action: top.option,
                    args: {},
                    value: desire.f,
                    confidence: desire.c,
                    source: 'system-one',
                };
            }
        }
    }
}
