import {cycle, initialState, episodeReasoner, type Reasoner} from '../../../src/agent/cycle/index.js';
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
        executeEpisode: jest.fn(async () => ({
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
        })),
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

describe('episodeReasoner() — adapter to AIAgent.executeEpisode', () => {
    it('produces a Thought from EpisodeResult', async () => {
        const agent = makeAgent({text: 'agent response'});
        const reasoner: Reasoner = episodeReasoner({agent, ctx: {} as EpisodeContext});
        const thought = await reasoner.reason(makeFocus('hi'), initialState());
        expect(thought.text).toBe('agent response');
        expect(thought.routeKind).toBe('nl');
        expect(thought.confidence).toBe(0.7);
        expect(thought.toolCalls).toEqual([]);
    });

    it('maps tool calls to cycle ToolCall format', async () => {
        const agent = makeAgent({
            toolCalls: [{toolName: 'nar_believe', toolCallId: '1', args: {term: 'cat'}}],
        });
        const r = episodeReasoner({agent, ctx: {} as EpisodeContext}); const reasoner = r;
        const thought = await reasoner.reason(makeFocus(), initialState());
        expect(thought.toolCalls).toEqual([{name: 'nar_believe', args: {term: 'cat'}}]);
    });

    it('plugs into cycle() end-to-end', async () => {
        const agent = makeAgent({text: 'agent response', route: {kind: 'nl', confidence: 0.8, signals: [], intent: '', concepts: [], ambiguity: 0}});
        const r = episodeReasoner({agent, ctx: {} as EpisodeContext}); const reasoner = r;
        const {turns} = await cycle(makeFocus("hello"), initialState(), {reasoner});
        expect(agent.executeEpisode).toHaveBeenCalledWith('hello', expect.anything());
        expect(turns[0]).toMatchObject({kind: 'response', text: 'agent response'});
    });

    it('routes tool calls to a tool_calls turn', async () => {
        const agent = makeAgent({
            text: '',
            toolCalls: [{toolName: 'nar_query', toolCallId: '1', args: {q: 'cat'}}],
        });
        const r = episodeReasoner({agent, ctx: {} as EpisodeContext}); const reasoner = r;
        const {turns} = await cycle(makeFocus(), initialState(), {reasoner});
        expect(turns[0]).toMatchObject({kind: 'tool_calls'});
    });
});
