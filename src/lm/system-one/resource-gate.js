import { SenarsError } from '../../errors/senars-error';
/** Map a proposition's ResourceCost to the budget gate's LM-call accounting. */
export function resourceCostToLmCalls(cost) {
    return Math.max(1, Math.ceil((cost.tokensIn + cost.tokensOut) / 100) + (cost.computeMs > 100 ? 1 : 0));
}
/** Bench 12: every proposition must report a ResourceCost before consuming budget. */
export function assertCostReported(p) {
    if (!p.cost || p.cost.tokensIn < 0 || p.cost.computeMs < 0 || p.cost.memoryMb < 0) {
        throw new SenarsError(`Proposition ${p.queryId} is missing a valid ResourceCost`, 'VALIDATION_ERROR');
    }
}
/**
 * Charge a judgment against the kernel BudgetGate. Denied when the scoped
 * budget cannot afford the LM-call equivalent of the reported cost.
 */
export function chargeJudgment(gate, scopeId, cost) {
    const verdict = gate.check({
        operation: 'systemone-judgment',
        estimatedCost: resourceCostToLmCalls(cost),
        scopeId,
    });
    return { granted: verdict.granted, terminationReason: verdict.terminationReason };
}
