import type {State, Focus, Budget} from '../../../src/agent/cycle/index.js';
import {
    cycle,
    initialState,
    interrupt,
    perceive,
    decide,
    type Reasoner,
    type Thought,
} from '../../../src/agent/cycle/index.js';

const makeBudget = (steps = 1): Budget => ({
    tokensRemaining: 1000,
    stepsRemaining: steps,
    deadline: Date.now() + 60000,
    maxOutputTokens: 256,
});

const makeFocus = (text: string = 'hi'): Focus => ({
    kind: 'message',
    source: 'cli',
    origin: 'cli:direct:user',
    sender: 'user',
    text,
    receivedAt: Date.now(),
});

const makeReasoner = (thought: Partial<Thought> = {}): Reasoner => ({
    reason: async () => ({
        text: 'hello',
        toolCalls: [],
        confidence: 0.7,
        ...thought,
    }),
});

describe('cycle() — 5-phase ReAct core', () => {
    it('returns internal silence when no input', async () => {
        const state = initialState();
        const {turn} = await cycle(null, state, makeReasoner());
        expect(turn).toMatchObject({kind: 'internal', note: 'no-new-input'});
    });

    it('silences when interrupted with no new input', async () => {
        const state = interrupt(initialState());
        const {turn} = await cycle(null, state, makeReasoner());
        expect(turn).toMatchObject({kind: 'internal', note: 'interrupted'});
    });

    it('clears interrupt when new input arrives', async () => {
        const state = interrupt(initialState());
        const {state: next} = await cycle(makeFocus(), state, makeReasoner());
        expect(next.interrupted).toBe(false);
    });

    it('attaches attention with focus metadata', async () => {
        const state = initialState();
        const {state: next} = await cycle(makeFocus('test input'), state, makeReasoner());
        expect(next.attention).toMatchObject({kind: 'message', text: 'test input', source: 'cli'});
    });

    it('increments version after commit', async () => {
        const state = initialState();
        const {state: next} = await cycle(makeFocus(), state, makeReasoner());
        expect(next.version).toBe(state.version + 1);
    });

    it('preserves input state for rollback', async () => {
        const state = initialState();
        const {state: next} = await cycle(makeFocus(), state, makeReasoner());
        expect(next.prev).toBe(state);
    });

    it('delegates to reasoner on input', async () => {
        const reasoner: Reasoner = {
            reason: async (focus, state) => {
                expect(focus.text).toBe('hello');
                expect(state.attention?.text).toBe('hello');
                return {text: '', toolCalls: [], confidence: 0.5};
            },
        };
        await cycle(makeFocus('hello'), initialState(), reasoner);
    });

    it('emits a response turn when reasoner returns text', async () => {
        const reasoner = makeReasoner({text: 'response text', confidence: 0.9});
        const {turn} = await cycle(makeFocus(), initialState(), reasoner);
        expect(turn).toMatchObject({kind: 'response', text: 'response text', confidence: 0.9});
    });

    it('emits tool_calls turn when reasoner returns tool calls', async () => {
        const reasoner = makeReasoner({text: '', toolCalls: [{name: 'nar_believe', args: {term: 'cat'}}]});
        const {turn} = await cycle(makeFocus(), initialState(), reasoner);
        expect(turn).toMatchObject({kind: 'tool_calls', calls: [{name: 'nar_believe', args: {term: 'cat'}}]});
    });
});

describe('decide()', () => {
    it('returns act when thought has tool calls', () => {
        const decision = decide({text: '', toolCalls: [{name: 'foo', args: {}}], confidence: 0.5});
        expect(decision.kind).toBe('act');
    });

    it('returns respond when thought has no tool calls', () => {
        const decision = decide({text: 'hi', toolCalls: [], confidence: 0.5});
        expect(decision).toEqual({kind: 'respond', text: 'hi', confidence: 0.5});
    });
});

describe('perceive()', () => {
    it('is a no-op when input is null', () => {
        const state = initialState();
        const next = perceive(null, state);
        expect(next).toBe(state);
    });

    it('sets attention and clears interrupted on new input', () => {
        const state = interrupt(initialState());
        const focus = makeFocus('x');
        const next = perceive(focus, state);
        expect(next.attention).toEqual(focus);
        expect(next.interrupted).toBe(false);
    });
});
