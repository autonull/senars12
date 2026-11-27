/**
 * Derivation Repair — repairs for derivation anomalies.
 */
/** Generate derivation repair actions. */
export function generateDerivationRepairs(context, anomaly) {
    const actions = [];
    // Verify premises
    actions.push({
        type: 'verify_premises',
        description: 'Verify all premises in the failed derivation chain',
        params: { derivationId: anomaly.context.iteration },
        confidence: 0.8,
        cost: 10,
    });
    // Retry with reduced scope
    actions.push({
        type: 'reduce_scope',
        description: 'Retry derivation with fewer inference steps',
        params: { maxSteps: 3 },
        confidence: 0.7,
        cost: 5,
    });
    // Retrieve more context
    actions.push({
        type: 'retrieve_context',
        description: 'Retrieve additional relevant beliefs for derivation',
        params: { query: anomaly.description },
        confidence: 0.6,
        cost: 15,
    });
    return actions;
}
/** Derivation repair policy. */
export const derivationRepairPolicy = {
    name: 'derivation',
    appliesTo: ['contradiction', 'stall'],
    minSeverity: 'medium',
    generateActions: generateDerivationRepairs,
    priority: 80,
};
/** Contradiction repair policy. */
export const contradictionRepairPolicy = {
    name: 'contradiction',
    appliesTo: ['contradiction'],
    minSeverity: 'high',
    generateActions: (context, anomaly) => [
        {
            type: 'verify_premises',
            description: 'Verify premises of conflicting beliefs',
            params: { conflictId: anomaly.id },
            confidence: 0.85,
            cost: 10,
        },
        {
            type: 'replan',
            description: 'Replan derivation avoiding contradictory paths',
            params: { avoidTerms: anomaly.description },
            confidence: 0.7,
            cost: 20,
        },
    ],
    priority: 90,
};
