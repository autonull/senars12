import {cycle, initialState, patternValidator, type CycleDeps} from '../../../src/agent/cycle/index.js';
import type {Reasoner, Thought} from '../../../src/agent/cycle/index.js';

const makeFocus = (text = 'hi') => ({
    kind: 'message' as const,
    source: 'cli',
    origin: 'cli:direct:user',
    sender: 'user',
    text,
    receivedAt: Date.now(),
});

const makeReasoner = (thought: Partial<Thought> = {}): Reasoner => ({
    reason: jest.fn(async () => ({
        text: '',
        toolCalls: [],
        confidence: 0.5,
        ...thought,
    })),
});

describe('cycle() with validator', () => {
    it('routes accepted tool calls to a tool_calls turn', async () => {
        const deps: CycleDeps = {
            reasoner: makeReasoner({toolCalls: [{name: 'nar_believe', args: {term: 'cat'}}]}),
        };
        const {turns} = await cycle(makeFocus(), initialState(), deps);
        expect(turns[0]).toMatchObject({kind: 'tool_calls'});
    });

    it('blocks rejected identity updates via validator', async () => {
        const deps: CycleDeps = {
            reasoner: makeReasoner({
                toolCalls: [{name: 'self_propose', args: {term: 'evil_bot', reason: 'r'}}],
            }),
            validator: patternValidator(),
        };
        const {turns} = await cycle(makeFocus(), initialState(), deps);
        expect(turns[0]).toMatchObject({kind: 'internal'});
        expect((turns[0] as {note: string}).note).toContain('validator-rejected');
    });

    it('allows identity updates that pass the validator', async () => {
        const deps: CycleDeps = {
            reasoner: makeReasoner({
                toolCalls: [{name: 'self_propose', args: {term: 'senars_bot', reason: 'identity seed'}}],
            }),
            validator: patternValidator(),
        };
        const {turns} = await cycle(makeFocus(), initialState(), deps);
        expect(turns[0]).toMatchObject({kind: 'tool_calls'});
    });

    it('passes responses through without invoking validator', async () => {
        const review = jest.fn();
        const deps: CycleDeps = {
            reasoner: makeReasoner({text: 'hello', toolCalls: []}),
            validator: {review},
        };
        const {turns} = await cycle(makeFocus(), initialState(), deps);
        expect(turns[0]).toMatchObject({kind: 'response', text: 'hello'});
        expect(review).not.toHaveBeenCalled();
    });
});
