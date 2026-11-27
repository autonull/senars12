import { makeId } from '@senars/util/id';
import { termParser } from '../terms/index';
import { focusTask } from './task';
/** Inject a Narsese rule belief into the focus's task bag (E7 Self-Concept-Vocabulary pattern). */
export function seedBelief(focus, belief) {
    const term = termParser.parse(belief.narsese);
    if (!term || term.kind === 'atom')
        return null;
    const task = focusTask({
        id: `seeded-${makeId()}`,
        term,
        type: 'belief',
        priority: belief.priority ?? belief.truth.c,
        f: belief.truth.f,
        c: belief.truth.c,
        stamp: 'belief-seeding',
    });
    focus.tasks.add(task);
    return task;
}
/** Seed a per-action rule of the form `(<action> ==> <consequence>)`. */
export const actionRuleBelief = (action, consequence, truth, priority) => ({ narsese: `(${action} ==> ${consequence})`, truth, priority });
