import type {AIAgent} from '../AIAgent.js';
import type {Focus} from './State.js';
import type {Reasoner} from './reason.js';
import type {EpisodeContext} from '../cognition/EpisodeTypes.js';
import type {ToolCall as CycleToolCall} from './Turn.js';

export interface EpisodeReasonerDeps {
    readonly agent: AIAgent;
    readonly ctx: EpisodeContext;
}

const toolCallFromAIAgent = (tc: {toolName: string; args: Record<string, unknown>}): CycleToolCall => ({
    name: tc.toolName,
    args: tc.args,
});

export const episodeReasoner = (deps: EpisodeReasonerDeps): Reasoner => ({
    reason: async (focus: Focus, _state) => {
        const result = await deps.agent.executeEpisode(focus.text, deps.ctx);
        return {
            text: result.text,
            toolCalls: result.toolCalls.map(toolCallFromAIAgent),
            routeKind: result.route.kind,
            confidence: result.route.confidence,
        };
    },
});
