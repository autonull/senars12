import type {State} from './State.js';
import type {Turn} from './Turn.js';

export const commit = (state: State, _turns: readonly Turn[]): State => ({
    ...state,
    version: state.version + 1,
});
