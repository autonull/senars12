import type {State, Focus} from './State.js';
import type {ToolCall} from './Turn.js';

export interface Thought {
    readonly text: string;
    readonly toolCalls: readonly ToolCall[];
    readonly routeKind?: string;
    readonly confidence: number;
}

export interface Reasoner {
    readonly reason: (focus: Focus, state: State) => Promise<Thought>;
}

export const reason = async (state: State, deps: Reasoner): Promise<Thought> => {
    if (!state.attention) {
        throw new Error('reason() requires state.attention to be set');
    }
    return deps.reason(state.attention, state);
};
