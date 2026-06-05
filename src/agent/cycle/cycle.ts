import type {State, Focus} from './State.js';
import {perceive} from './perceive.js';
import {reason, type Reasoner} from './reason.js';
import {decide} from './decide.js';
import {actAndReflect} from './act-reflect.js';
import {commit} from './commit.js';
import type {Turn} from './Turn.js';
import type {Validator} from './validator.js';

export interface CycleDeps {
    readonly reasoner: Reasoner;
    readonly validator?: Validator;
}

export interface CycleResult {
    readonly state: State;
    readonly turns: readonly Turn[];
}

export const cycle = async (
    input: Focus | null,
    state: State,
    deps: CycleDeps,
): Promise<CycleResult> => {
    const s1 = perceive(input, state);
    if (!input) {
        const note = state.interrupted ? 'interrupted' : 'no-new-input';
        return {state, turns: [{kind: 'internal', note}]};
    }

    const thought = await reason(s1, deps.reasoner);
    const decision = decide(thought);
    const turn = actAndReflect(decision, s1, deps.validator);
    const s2 = commit(s1, [turn]);

    return {state: {...s2, prev: state}, turns: [turn]};
};
