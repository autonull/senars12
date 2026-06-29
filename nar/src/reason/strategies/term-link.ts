import type {Memory} from '../../memory';
import type {LinkEntry} from '../../memory/links';
import {getPredicate, getSubject} from '../../terms';
import type {Task} from '../../types';
import {createSecondaryTask} from '../../types';
import type {Strategy} from '../strategy.js';

interface TermLinkStrategyConfig {
    minLinkPriority?: number;
    maxLinks?: number;
}

export class TermLinkStrategy implements Strategy {
    readonly name = 'term-link';
    private readonly minLinkPriority: number;
    private readonly maxLinks: number;

    constructor(config?: TermLinkStrategyConfig) {
        this.minLinkPriority = config?.minLinkPriority ?? 0.1;
        this.maxLinks = config?.maxLinks ?? 20;
    }

    selectSecondary(task: Task, memory: Memory): Task[] {
        const linkManager = memory.getLinkManager();
        const termLinks = linkManager.getLayer('term');
        if (!termLinks) return [];

        const term = task.term;
        const links = termLinks.getLinksByTerm(term);

        const subject = getSubject(term);
        const predicate = getPredicate(term);

        if (subject) {
            const subLinks = termLinks.getLinksByTerm(subject);
            links.push(...subLinks);
        }

        if (predicate) {
            const predLinks = termLinks.getLinksByTerm(predicate);
            links.push(...predLinks);
        }

        return this.candidatesToTasks(links, memory, task);
    }

    private candidatesToTasks(candidates: LinkEntry[], memory: Memory, _task: Task): Task[] {
        const results: Task[] = [];
        const seen = new Set<string>();

        for (const candidate of candidates) {
            const targetTerm = candidate.targetTerm;
            const targetKey =
                targetTerm.kind === 'atom' ? targetTerm.symbol : `${targetTerm.kind}-${Date.now()}`;

            if (seen.has(targetKey)) continue;
            seen.add(targetKey);

            const concept = memory.getConcept(targetTerm);
            if (!concept) continue;

            const belief = concept.beliefBag.peek();
            if (!belief) continue;

            const secondaryTask = createSecondaryTask(
                concept.term,
                candidate.priority,
                belief.truth ? {f: belief.truth.f, c: belief.truth.c} : undefined,
                'belief'
            );

            if (secondaryTask.budget.priority >= 0.3) {
                results.push(secondaryTask);
            }
        }

        return results;
    }
}

export const createTermLinkStrategy = (config?: TermLinkStrategyConfig): Strategy => {
    return new TermLinkStrategy(config);
};
