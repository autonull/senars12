import type {Term} from '../terms';
import type {Task} from '../types/index.js';

export interface ConceptConnections {
    term: Term;
    connections: number;
}

interface HasBags {
    term: Term;
    beliefBag: { size: number };
    questionBag: { size: number };
    goalBag: { size: number };
}

export function findUnderconnectedConcepts(
    concepts: Iterable<HasBags>,
    minConnections: number
): ConceptConnections[] {
    const result: ConceptConnections[] = [];

    for (const concept of concepts) {
        const connectionCount =
            concept.beliefBag.size +
            concept.questionBag.size +
            concept.goalBag.size;

        if (connectionCount < minConnections) {
            result.push({ term: concept.term, connections: connectionCount });
        }
    }

    return result.sort((a, b) => a.connections - b.connections);
}

export function findUnderconnectedConceptsFromTasks(
    tasks: Task[],
    getConcept: (term: Term) => { beliefBag: { size: number }; questionBag: { size: number }; goalBag: { size: number } } | undefined
): ConceptConnections[] {
    const conceptConnections = new Map<string, ConceptConnections>();

    for (const task of tasks) {
        const concept = getConcept(task.term);
        if (concept) {
            const connectionCount = concept.beliefBag.size + concept.questionBag.size + concept.goalBag.size;
            conceptConnections.set(task.term.toString(), {
                term: task.term,
                connections: connectionCount
            });
        }
    }

    return Array.from(conceptConnections.values())
        .sort((a, b) => a.connections - b.connections);
}