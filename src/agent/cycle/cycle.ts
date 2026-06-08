import type {State, Focus} from './State.js';
import {perceive} from './perceive.js';
import {reason, type Reasoner} from './reason.js';
import {decide} from './decide.js';
import {actAndReflect} from './act-reflect.js';
import {commit} from './commit.js';
import type {Turn} from './Turn.js';
import {patternValidator} from './validator.js';

export interface CycleResult {
    readonly state: State;
    readonly turn: Turn;
}

const validator = patternValidator();

export const cycle = async (
    input: Focus | null,
    state: State,
    reasoner: Reasoner,
): Promise<CycleResult> => {
    if (!input) {
        const note = state.interrupted ? 'interrupted' : 'no-new-input';
        return {state, turn: {kind: 'internal', note}};
    }

    const s1 = perceive(input, state);
    const thought = await reason(s1, reasoner);
    const decision = decide(thought);
    const turn = actAndReflect(decision, s1, validator);
    const s2 = commit(s1, [turn]);

    return {state: {...s2, prev: state}, turn};
};
