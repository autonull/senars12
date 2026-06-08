import {
    runOperatorCommand,
    StateJournal,
    initialState,
    type State,
    type Turn,
    type Reasoner,
    type Thought,
} from '../../../src/agent/cycle/index.js';
import type {OperatorContext, OperatorAction} from '../../../src/agent/cycle/index.js';

const focus = (text: string) => ({
    kind: 'message' as const,
    source: 'cli', origin: 'cli:direct:user', sender: 'user', text, receivedAt: 1000,
});

const makeReasoner = (text = 'echo'): Reasoner => ({
    reason: async (): Promise<Thought> => ({text, toolCalls: [], confidence: 0.5}),
});

const makeCtx = (overrides: Partial<OperatorContext> = {}): OperatorContext => {
    const journal = new StateJournal();
    const turns: Turn[] = [{kind: 'response', text: 'hi', confidence: 0.5}];
    const state: State = {...initialState(), version: 1, attention: focus('test')};
    journal.record(state, turns, focus('test'));
    return {
        journal,
        currentState: () => state,
        currentTurns: () => turns,
        reasoner: makeReasoner(),
        ...overrides,
    };
};

const isResponse = (a: OperatorAction): a is Extract<OperatorAction, {kind: 'response'}> =>
    a.kind === 'response';

describe('runOperatorCommand', () => {
    it('returns unhandled for non-! messages', async () => {
        const r = await runOperatorCommand('hello', makeCtx());
        expect(r.kind).toBe('unhandled');
    });

    it('routes !help to help text', async () => {
        const r = await runOperatorCommand('!help', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('OPERATOR COMMANDS');
    });

    it('routes !? to help text', async () => {
        const r = await runOperatorCommand('!?', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('!debug');
    });

    it('routes !debug to state summary', async () => {
        const r = await runOperatorCommand('!debug', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) {
            expect(r.text).toContain('DEBUG');
            expect(r.text).toContain('v1');
        }
    });

    it('routes !trace to journal entries', async () => {
        const r = await runOperatorCommand('!trace', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) {
            expect(r.text).toContain('TRACE');
            expect(r.text).toContain('v1');
        }
    });

    it('routes !trace last 5 to last 5 entries (capped at available)', async () => {
        const r = await runOperatorCommand('!trace last 5', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('last 1 of 1');
    });

    it('rejects invalid !trace args (non-numeric N)', async () => {
        const r = await runOperatorCommand('!trace foo', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('invalid N');
    });

    it('routes !replay to a replay summary', async () => {
        const r = await runOperatorCommand('!replay', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('REPLAY v1');
    });

    it('routes !replay turn N to specific version', async () => {
        const r = await runOperatorCommand('!replay turn 1', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('REPLAY v1');
    });

    it('reports missing version on !replay', async () => {
        const r = await runOperatorCommand('!replay turn 99', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('no entry at version 99');
    });

    it('reports empty journal on !replay when no entries', async () => {
        const ctx = makeCtx({journal: new StateJournal()});
        const r = await runOperatorCommand('!replay', ctx);
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('no turns recorded yet');
    });

    it('rejects invalid !replay args (non-numeric version)', async () => {
        const r = await runOperatorCommand('!replay turn abc', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('invalid version');
    });

    it('rejects invalid !trace N', async () => {
        const r = await runOperatorCommand('!trace -1', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('invalid N');
    });

    it('handles unknown !command', async () => {
        const r = await runOperatorCommand('!foo', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('unknown command: !foo');
    });

    it('handles bare "!" as help', async () => {
        const r = await runOperatorCommand('!', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('OPERATOR COMMANDS');
    });

    it('!help lists !rollback (not !versions)', async () => {
        const r = await runOperatorCommand('!help', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) {
            expect(r.text).toContain('!rollback');
            expect(r.text).not.toContain('!versions');
        }
    });

    it('!versions is removed (rejected as unknown command)', async () => {
        const r = await runOperatorCommand('!versions', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('unknown command: !versions');
    });
});

describe('!rollback command (declarative OperatorAction)', () => {
    it('returns {kind: "rollback", version} for valid args', async () => {
        const r = await runOperatorCommand('!rollback 3', makeCtx());
        expect(r).toEqual({kind: 'rollback', version: 3});
    });

    it('returns a response with usage hint for missing version', async () => {
        const r = await runOperatorCommand('!rollback', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('usage: !rollback <version>');
    });

    it('returns a response with usage hint for non-integer version', async () => {
        const r = await runOperatorCommand('!rollback abc', makeCtx());
        expect(r.kind).toBe('response');
        if (isResponse(r)) expect(r.text).toContain('usage: !rollback <version>');
    });

    it('returns {kind: "rollback", version} regardless of snapshot existence', async () => {
        const r = await runOperatorCommand('!rollback 99', makeCtx());
        expect(r).toEqual({kind: 'rollback', version: 99});
    });
});
