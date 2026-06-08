import {cycle, initialState, type Reasoner, type Thought} from '../../../src/agent/cycle/index.js';
import type {AIAgent} from '../../../src/agent/AIAgent.js';
import type {EpisodeContext, EpisodeResult} from '../../../src/agent/cognition/EpisodeTypes.js';
import type {Route} from '../../../src/agent/types.js';

const makeAgent = (result: Partial<EpisodeResult> = {}): AIAgent => {
    const route: Route = {
        kind: 'nl',
        confidence: 0.7,
        signals: [],
        intent: '',
        concepts: [],
        ambiguity: 0,
    };
    return {
        executeEpisode: async () => ({
            text: 'response text',
            toolCalls: [],
            artifacts: [],
            errors: [],
            route,
            ctxHash: '',
            verdict: {action: 'accept' as const},
            trace: {} as EpisodeResult['trace'],
            workingMemory: {} as EpisodeResult['workingMemory'],
            metrics: {durationMs: 1, cycleCount: 1, eventCount: 0},
            ...result,
        }),
    } as unknown as AIAgent;
};

const makeFocus = (text = 'hi') => ({
    kind: 'message' as const,
    source: 'cli',
    origin: 'cli:direct:user',
    sender: 'user',
    text,
    receivedAt: Date.now(),
});

const inlineReasoner = (agent: AIAgent, ctx: EpisodeContext): Reasoner => ({
    reason: async (focus) => {
        const result = await agent.executeEpisode(focus.text, ctx);
        return {
            text: result.text,
            toolCalls: result.toolCalls.map(tc => ({name: tc.toolName, args: tc.args})),
            routeKind: result.route.kind,
            confidence: result.route.confidence,
        };
    },
});

describe('inline reasoner builder (replaces episodeReasoner adapter)', () => {
    it('produces a Thought from EpisodeResult', async () => {
        const agent = makeAgent({text: 'agent response'});
        const reasoner = inlineReasoner(agent, {} as EpisodeContext);
        const thought = await reasoner.reason(makeFocus('hi'), initialState());
        expect(thought.text).toBe('agent response');
        expect(thought.routeKind).toBe('nl');
        expect(thought.confidence).toBe(0.7);
        expect(thought.toolCalls).toEqual([]);
    });

    it('plugs into cycle() end-to-end', async () => {
        const agent = makeAgent({text: 'agent response'});
        const reasoner = inlineReasoner(agent, {} as EpisodeContext);
        const {turn} = await cycle(makeFocus('hello'), initialState(), reasoner);
        expect(turn).toMatchObject({kind: 'response', text: 'agent response'});
    });

    it('routes tool calls to a tool_calls turn', async () => {
        const agent = makeAgent({
            text: '',
            toolCalls: [{toolName: 'nar_query', toolCallId: '1', args: {q: 'cat'}}],
        });
        const reasoner = inlineReasoner(agent, {} as EpisodeContext);
        const {turn} = await cycle(makeFocus(), initialState(), reasoner);
        expect(turn).toMatchObject({kind: 'tool_calls'});
    });
});
