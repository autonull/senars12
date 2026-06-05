import type {Thought} from './reason.js';
import type {Turn, ToolCall} from './Turn.js';

export type Decision =
    | { kind: 'respond'; text: string; confidence: number }
    | { kind: 'act'; calls: readonly ToolCall[] };

export const decide = (thought: Thought): Decision => {
    if (thought.toolCalls.length > 0) {
        return {kind: 'act', calls: thought.toolCalls};
    }
    return {kind: 'respond', text: thought.text, confidence: thought.confidence};
};

export const decisionToTurn = (decision: Decision): Turn => {
    if (decision.kind === 'respond') {
        return {kind: 'response', text: decision.text, confidence: decision.confidence};
    }
    return {kind: 'tool_calls', calls: decision.calls};
};
