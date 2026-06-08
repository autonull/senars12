import {cycle, initialState, type Reasoner, type Thought} from '../../../src/agent/cycle/index.js';

const makeFocus = (text = 'hi') => ({
    kind: 'message' as const,
    source: 'cli',
    origin: 'cli:direct:user',
    sender: 'user',
    text,
    receivedAt: Date.now(),
});

const makeReasoner = (thought: Partial<Thought> = {}): Reasoner => ({
    reason: async () => ({
        text: '',
        toolCalls: [],
        confidence: 0.5,
        ...thought,
    }),
});

describe('cycle() with validator', () => {
    it('routes accepted tool calls to a tool_calls turn', async () => {
        const reasoner = makeReasoner({toolCalls: [{name: 'nar_believe', args: {term: 'cat'}}]});
        const {turn} = await cycle(makeFocus(), initialState(), reasoner);
        expect(turn).toMatchObject({kind: 'tool_calls'});
    });

    it('blocks rejected identity updates via validator', async () => {
        const reasoner = makeReasoner({
            toolCalls: [{name: 'self_propose', args: {term: 'evil_bot', reason: 'r'}}],
        });
        const {turn} = await cycle(makeFocus(), initialState(), reasoner);
        expect(turn).toMatchObject({kind: 'internal'});
        expect((turn as {note: string}).note).toContain('validator-rejected');
    });

    it('allows identity updates that pass the validator', async () => {
        const reasoner = makeReasoner({
            toolCalls: [{name: 'self_propose', args: {term: 'senars_bot', reason: 'identity seed'}}],
        });
        const {turn} = await cycle(makeFocus(), initialState(), reasoner);
        expect(turn).toMatchObject({kind: 'tool_calls'});
    });

    it('passes responses through (validator only runs for tool calls)', async () => {
        const reasoner = makeReasoner({text: 'hello', toolCalls: []});
        const {turn} = await cycle(makeFocus(), initialState(), reasoner);
        expect(turn).toMatchObject({kind: 'response', text: 'hello'});
    });
});
