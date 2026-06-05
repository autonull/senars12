import {
    runOperatorCommand,
    StateJournal,
    initialState,
    type State,
    type Turn,
    type Reasoner,
    type Thought,
} from '../../../src/agent/cycle/index.js';
import type {OperatorContext} from '../../../src/agent/cycle/index.js';

const focus = (text: string) => ({
    kind: 'message' as const,
    source: 'cli', origin: 'cli:direct:user', sender: 'user', text, receivedAt: 1000,
});

const makeReasoner = (text = 'echo'): Reasoner => ({
    reason: jest.fn(async (): Promise<Thought> => ({text, toolCalls: [], confidence: 0.5})),
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
        deps: {reasoner: makeReasoner()},
        ...overrides,
    };
};

describe('runOperatorCommand', () => {
    it('returns handled:false for non-! messages', async () => {
        const r = await runOperatorCommand('hello', makeCtx());
        expect(r.handled).toBe(false);
    });

    it('routes !help to help text', async () => {
        const r = await runOperatorCommand('!help', makeCtx());
        expect(r.handled).toBe(true);
        expect((r as {text: string}).text).toContain('OPERATOR COMMANDS');
    });

    it('routes !? to help text', async () => {
        const r = await runOperatorCommand('!?', makeCtx());
        expect(r.handled).toBe(true);
        expect((r as {text: string}).text).toContain('!debug');
    });

    it('routes !debug to state summary', async () => {
        const r = await runOperatorCommand('!debug', makeCtx());
        expect(r.handled).toBe(true);
        expect((r as {text: string}).text).toContain('DEBUG');
        expect((r as {text: string}).text).toContain('v1');
    });

    it('routes !trace to journal entries', async () => {
        const r = await runOperatorCommand('!trace', makeCtx());
        expect((r as {text: string}).text).toContain('TRACE');
        expect((r as {text: string}).text).toContain('v1');
    });

    it('routes !trace last 5 to last 5 entries (capped at available)', async () => {
        const r = await runOperatorCommand('!trace last 5', makeCtx());
        expect((r as {text: string}).text).toContain('last 1 of 1');
    });

    it('rejects invalid !trace args (non-numeric N)', async () => {
        const r = await runOperatorCommand('!trace foo', makeCtx());
        expect(r.handled).toBe(true);
        expect((r as {text: string}).text).toContain('invalid N');
    });

    it('routes !replay to a replay summary', async () => {
        const r = await runOperatorCommand('!replay', makeCtx());
        expect(r.handled).toBe(true);
        expect((r as {text: string}).text).toContain('REPLAY v1');
    });

    it('routes !replay turn N to specific version', async () => {
        const r = await runOperatorCommand('!replay turn 1', makeCtx());
        expect((r as {text: string}).text).toContain('REPLAY v1');
    });

    it('reports missing version on !replay', async () => {
        const r = await runOperatorCommand('!replay turn 99', makeCtx());
        expect((r as {text: string}).text).toContain('no entry at version 99');
    });

    it('reports empty journal on !replay when no entries', async () => {
        const ctx = makeCtx({journal: new StateJournal()});
        const r = await runOperatorCommand('!replay', ctx);
        expect((r as {text: string}).text).toContain('no turns recorded yet');
    });

    it('rejects invalid !replay args (non-numeric version)', async () => {
        const r = await runOperatorCommand('!replay turn abc', makeCtx());
        expect(r.handled).toBe(true);
        expect((r as {text: string}).text).toContain('invalid version');
    });

    it('rejects invalid !trace N', async () => {
        const r = await runOperatorCommand('!trace -1', makeCtx());
        expect((r as {text: string}).text).toContain('invalid N');
    });

    it('handles unknown !command', async () => {
        const r = await runOperatorCommand('!foo', makeCtx());
        expect(r.handled).toBe(true);
        expect((r as {text: string}).text).toContain('unknown command: !foo');
    });

    it('handles bare "!" as help', async () => {
        const r = await runOperatorCommand('!', makeCtx());
        expect((r as {text: string}).text).toContain('OPERATOR COMMANDS');
    });

    it('!help lists !versions and !rollback', async () => {
        const r = await runOperatorCommand('!help', makeCtx());
        expect((r as {text: string}).text).toContain('!versions');
        expect((r as {text: string}).text).toContain('!rollback');
    });
});

describe('!versions command', () => {
    it('lists all versions in the journal', async () => {
        const ctx = makeCtx();
        ctx.journal.record({...initialState(), version: 5}, []);
        ctx.journal.record({...initialState(), version: 7}, []);
        const r = await runOperatorCommand('!versions', ctx);
        const text = (r as {text: string}).text;
        expect(text).toContain('VERSIONS');
        expect(text).toContain('v1'); // from makeCtx
        expect(text).toContain('v5');
        expect(text).toContain('v7');
    });

    it('reports empty when journal is empty', async () => {
        const ctx = makeCtx({journal: new StateJournal()});
        const r = await runOperatorCommand('!versions', ctx);
        expect((r as {text: string}).text).toContain('no versions in journal');
    });
});

describe('!rollback command', () => {
    it('restores state from snapshot via setState callback', async () => {
        const {mkdtemp, rm} = await import('node:fs/promises');
        const {tmpdir} = await import('node:os');
        const {join} = await import('node:path');
        const dir = await mkdtemp(join(tmpdir(), 'senars-rb-'));
        try {
            const ctx = makeCtx();
            const target = {...initialState(), version: 3, attention: {kind: 'message' as const, source: 'x', origin: 'x', sender: 'x', text: 'old', receivedAt: 1}};
            await (await import('../../../src/agent/cycle/index.js')).snapshotState(target, [], join(dir, encodeURIComponent('fake-origin')));
            const setState = jest.fn();
            const r = await runOperatorCommand('!rollback 3', {...ctx, stateDir: dir, origin: 'fake-origin', setState});
            expect((r as {text: string}).text).toContain('rolled back to v3');
            expect(setState).toHaveBeenCalledWith(expect.objectContaining({version: 3, attention: expect.objectContaining({text: 'old'})}));
        } finally {
            await rm(dir, {recursive: true, force: true});
        }
    });

    it('rejects missing version argument', async () => {
        const r = await runOperatorCommand('!rollback', makeCtx());
        expect((r as {text: string}).text).toContain('usage: !rollback <version>');
    });

    it('rejects non-integer version', async () => {
        const r = await runOperatorCommand('!rollback abc', makeCtx());
        expect((r as {text: string}).text).toContain('usage: !rollback <version>');
    });

    it('reports missing snapshot', async () => {
        const ctx = {...makeCtx(), stateDir: '/tmp/senars-rb-none-' + Date.now(), origin: 'missing'};
        const r = await runOperatorCommand('!rollback 99', ctx);
        expect((r as {text: string}).text).toContain('no snapshot at version 99');
    });

    it('refuses to run without stateDir/origin context', async () => {
        const r = await runOperatorCommand('!rollback 1', makeCtx());
        expect((r as {text: string}).text).toContain('not available in this context');
    });
});
