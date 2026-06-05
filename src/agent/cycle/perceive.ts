import type {State, Focus} from './State.js';
import {withAttention} from './State.js';

export const perceive = (input: Focus | null, state: State): State => {
    if (!input) return state;
    return withAttention(state, input);
};
