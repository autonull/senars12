import type {Term} from '../terms';
import {Truth} from '../terms';
import type {Task} from '../types';
import {createBudget, createTask} from '../types';
import {LMResponseParser} from './parser.js';

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
            result.push({term: concept.term, connections: connectionCount});
        }
    }

    return result.sort((a, b) => a.connections - b.connections);
}

export function findUnderconnectedConceptsFromTasks(
    tasks: Task[],
    getConcept: (term: Term) => HasBags | undefined
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

export function parseEnrichmentResponse(response: string, defaultTruth?: Truth): {
    hypotheses: Task[];
    bridges: Task[]
} {
    const lines = response.split('\n').filter(l => l.trim());
    const hypotheses: Task[] = [];
    const bridges: Task[] = [];
    const truth = defaultTruth ?? Truth.TRUE;

    for (const line of lines) {
        const parsed = LMResponseParser.parse(line);
        if (parsed.valid && parsed.term) {
            const taskTruth = parsed.truth ?? truth;
            const task = createTask(parsed.term, 'belief', taskTruth, createBudget(0.4, 0.8));

            if (line.includes('-->') || line.includes('<->')) {
                hypotheses.push(task);
            } else {
                bridges.push(task);
            }
        }
    }

    return {hypotheses, bridges};
}