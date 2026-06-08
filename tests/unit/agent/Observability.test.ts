import {
    StateJournal,
    initialState,
    cycle,
    formatDebug,
    formatTrace,
    formatReplay,
    replayVersion,
    type State,
    type Turn,
    type Focus,
    type Reasoner,
    type Thought,
} from '../../../src/agent/cycle/index.js';

const focus = (text: string): Focus => ({
    kind: 'message', source: 'cli', origin: 'cli:direct:user', sender: 'user', text, receivedAt: 1000,
});

const makeReasoner = (thought: Partial<Thought> = {}): Reasoner => ({
    reason: async (_focus: Focus, _state: State): Promise<Thought> => ({
        text: 'hello', toolCalls: [], confidence: 0.7, ...thought,
    }),
});

const advance = async (j: StateJournal, state: State, text: string, reasoner: Reasoner): Promise<{state: State; entry: ReturnType<StateJournal['record']>}> => {
    const {state: next, turn} = await cycle(focus(text), state, reasoner);
    const entry = j.record(next, [turn], focus(text));
    return {state: next, entry};
};

describe('formatDebug', () => {
    it('includes version, counts, identity, interrupt flag', () => {
        const s = {...initialState(), version: 7, interrupted: true};
        const out = formatDebug(s, [{kind: 'response', text: 'hi', confidence: 0.9}]);
        expect(out).toContain('v7');
        expect(out).toContain('beliefs=0');
        expect(out).toContain('interrupt: true');
        expect(out).toContain('response(2b, c=0.90)');
        expect(out).toContain('identity: v0');
    });

    it('handles no turns gracefully', () => {
        const out = formatDebug(initialState());
        expect(out).toContain('turns(0):');
    });
});

describe('formatTrace', () => {
    it('shows empty message for an empty journal', () => {
        const j = new StateJournal();
        expect(formatTrace(j, 10)).toContain('(empty journal)');
    });

    it('shows last N entries with version, focus, and turns', async () => {
        const j = new StateJournal();
        const r1 = makeReasoner({text: 'a'});
        const r2 = makeReasoner({text: 'b'});
        let s: State = initialState();
        ({state: s} = await advance(j, s, 'hello', r1));
        ({state: s} = await advance(j, s, 'world', r2));
        const out = formatTrace(j, 10);
        expect(out).toContain('TRACE (last 2 of 2)');
        expect(out).toContain('v1');
        expect(out).toContain('v2');
        expect(out).toContain('"hello"');
        expect(out).toContain('"world"');
    });
});

describe('replayVersion + formatReplay (terse)', () => {
    it('returns null when version is missing', async () => {
        const j = new StateJournal();
        const r = await replayVersion(99, j, makeReasoner());
        expect(r).toBeNull();
    });

    it('returns null when the entry has no focus', async () => {
        const j = new StateJournal();
        j.record({...initialState(), version: 1, attention: null}, []);
        const r = await replayVersion(1, j, makeReasoner());
        expect(r).toBeNull();
    });

    it('replays a version and reports terse diff (1 line per concern)', async () => {
        const j = new StateJournal();
        const r1 = makeReasoner({text: 'a'});
        let s: State = initialState();
        ({state: s} = await advance(j, s, 'hi', r1));
        const r = await replayVersion(1, j, r1);
        expect(r).not.toBeNull();
        const out = formatReplay(r!.entry, r!.replayed);
        expect(out).toContain('REPLAY v1');
        expect(out).toMatch(/^state: /m);
        expect(out).toMatch(/^turn\[0\]: \d+b/m);
    });

    it('shows "(matches)" when replayed turn text is identical', async () => {
        const j = new StateJournal();
        const r1 = makeReasoner({text: 'same'});
        let s: State = initialState();
        ({state: s} = await advance(j, s, 'hi', r1));
        const r = await replayVersion(1, j, r1);
        const out = formatReplay(r!.entry, r!.replayed);
        expect(out).toMatch(/turn\[0\]: 4b \(matches\)/);
    });

    it('shows size delta when text differs', async () => {
        const j = new StateJournal();
        const r1 = makeReasoner({text: 'original'});
        let s: State = initialState();
        ({state: s} = await advance(j, s, 'hi', r1));
        const replayReasoner = makeReasoner({text: 'replayed-with-different-text'});
        const r = await replayVersion(1, j, replayReasoner);
        const out = formatReplay(r!.entry, r!.replayed);
        expect(out).toMatch(/turn\[0\]: 8b → 28b/);
    });

    it('reports turn-count mismatch when counts differ', () => {
        const entry = {
            version: 1,
            state: {...initialState(), version: 1, attention: focus('x')},
            turns: [
                {kind: 'response' as const, text: 'one', confidence: 0.5},
                {kind: 'response' as const, text: 'two', confidence: 0.5},
            ],
            focus: focus('x'),
            recordedAt: 1000,
        };
        const replayed = {
            state: entry.state,
            turn: {kind: 'response' as const, text: 'one-and-only', confidence: 0.5},
        };
        const out = formatReplay(entry, replayed);
        expect(out).toContain('turn count: 2 → 1');
    });
});
