import { mintCognitiveEvent, } from '@senars/schemas';
import { makeId } from '@senars/util/id';
import { shadowValidator } from './shadow-validation';
export async function admitTasks(memory, tasks, source, gates) {
    // Shadow validation (3.3): LLM-originated tasks must not contradict current beliefs.
    const shadow = source.includes('llm');
    const beliefs = shadow ? memory.listConcepts().flatMap((c) => c.getBeliefs()) : [];
    let admitted = 0;
    for (const task of tasks) {
        const perceptionGate = gates.getPerceptionGate();
        const admitResult = perceptionGate.admitTask(task.term, task.type, task.truth, source);
        if (!admitResult.admitted)
            continue;
        if (shadow) {
            const validation = await shadowValidator.validateWithHead(task, beliefs);
            if (!validation.valid) {
                // Record the shadow validation drop in the decision path (REFACTOR.todo4 Phase D)
                const dropEvent = mintCognitiveEvent('shadow.validation.dropped', {
                    engine: 'nar',
                    correlationId: task.stamp?.id ?? makeId(),
                    payload: {
                        candidateTerm: task.term.toString(),
                        source: source.includes('bridge') ? 'bridge-llm' : 'llm',
                        conflictType: validation.conflictType ?? 'frequency',
                        frequencyDelta: validation.frequencyDelta,
                        semanticScore: validation.semanticScore,
                    },
                });
                perceptionGate.emitShadowValidationDrop(dropEvent);
                continue;
            }
        }
        memory.addTask(task.term, task.type, task.truth, task.budget, task.stamp);
        admitted++;
    }
    return admitted;
}
