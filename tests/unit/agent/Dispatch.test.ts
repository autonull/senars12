import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
    dispatchCycleMessage,
    StateJournal,
    initialState,
    listSnapshots,
    type DispatchState,
    type State,
} from '../../../src/agent/cycle/index.js';
import type {AIAgent} from '../../../src/agent/AIAgent.js';
import type {Route} from '../../../src/agent/types.js';

const mkTmp = async () => mkdtemp(join(tmpdir(), 'senars-dispatch-'));

const makeAgent = (text: string, toolCalls: Array<{toolName: string; toolCallId: string; args: Record<string, unknown>}> = []): AIAgent => {
    const route: Route = {kind: 'nl', confidence: 0.7, signals: [], intent: '', concepts: [], ambiguity: 0};
    return {
        executeEpisode: jest.fn(async () => ({
            text, toolCalls, artifacts: [], errors: [],
            route, ctxHash: '',
            verdict: {action: 'accept' as const},
            trace: {} as never,
            workingMemory: {} as never,
            metrics: {durationMs: 1, cycleCount: 1, eventCount: 0},
        })),
    } as unknown as AIAgent;
};

const newStore = (stateDir: string, withQueue = false): DispatchState => ({
    states: new Map<string, State>(),
    journals: new Map<string, StateJournal>(),
    stateDir,
    ...(withQueue ? {queues: new Map<string, Promise<unknown>>()} : {}),
});

const captureSend = () => {
    const sent: Array<{target: string; text: string}> = [];
    const send = jest.fn(async (target: string, text: string) => { sent.push({target, text}); });
    return {sent, send};
};

const baseInput = (overrides: Partial<Parameters<typeof dispatchCycleMessage>[0]> = {}) => ({
    origin: 'fake:direct:user',
    connectionId: 'fake',
    connectionType: 'fake',
    sender: 'user',
    text: 'hello',
    timestamp: 1000,
    ...overrides,
});

describe('dispatchCycleMessage — unified cycle wiring', () => {
    let cycleDir: string;
    beforeEach(async () => { cycleDir = await mkTmp(); });
    afterEach(async () => { await rm(cycleDir, {recursive: true, force: true}); });

    it('routes a normal message through cycle() and persists a snapshot', async () => {
        const agent = makeAgent('agent-reply');
        const store = newStore(cycleDir);
        const {sent, send} = captureSend();
        const out = await dispatchCycleMessage(baseInput(), {store, agent, send});
        expect(out.handled).toBe(true);
        expect(out.persisted).toBe(true);
        expect(out.version).toBe(1);
        expect(agent.executeEpisode).toHaveBeenCalledWith('hello', expect.anything());
        expect(sent).toEqual([{target: 'user', text: 'agent-reply'}]);
        const snaps = await listSnapshots(join(cycleDir, encodeURIComponent('fake:direct:user')));
        expect(snaps).toHaveLength(1);
        expect(snaps[0]!.version).toBe(1);
    });

    it('intercepts !-prefixed messages as operator commands (no episode call)', async () => {
        const agent = makeAgent('should-not-run');
        const store = newStore(cycleDir);
        const {sent, send} = captureSend();
        const out = await dispatchCycleMessage(baseInput({text: '!help'}), {store, agent, send});
        expect(out.handled).toBe(true);
        expect(out.persisted).toBe(false);
        expect(agent.executeEpisode).not.toHaveBeenCalled();
        expect(sent.at(0)?.text).toContain('OPERATOR COMMANDS');
    });

    it('does not persist a snapshot for !-prefixed commands', async () => {
        const store = newStore(cycleDir);
        const {send} = captureSend();
        await dispatchCycleMessage(baseInput({text: '!debug'}), {store, agent: makeAgent(''), send});
        expect(await listSnapshots(join(cycleDir, encodeURIComponent('fake:direct:user')))).toEqual([]);
    });

    it('falls back to initialState (v0) when no snapshot exists', async () => {
        const store = newStore(cycleDir);
        const {sent, send} = captureSend();
        await dispatchCycleMessage(baseInput({text: '!debug'}), {store, agent: makeAgent(''), send});
        expect(sent.at(0)?.text).toContain('v0');
    });

    it('!debug after one cycle shows the recorded state', async () => {
        const store = newStore(cycleDir);
        const {sent, send} = captureSend();
        await dispatchCycleMessage(baseInput({text: 'hello'}), {store, agent: makeAgent('hi'), send});
        await dispatchCycleMessage(baseInput({text: '!debug'}), {store, agent: makeAgent(''), send});
        expect(sent.at(-1)?.text).toContain('v1');
    });

    it('!trace after two cycles lists both versions', async () => {
        const store = newStore(cycleDir);
        const {sent, send} = captureSend();
        await dispatchCycleMessage(baseInput({text: 'first'}), {store, agent: makeAgent('a'), send});
        await dispatchCycleMessage(baseInput({text: 'second'}), {store, agent: makeAgent('b'), send});
        await dispatchCycleMessage(baseInput({text: '!trace'}), {store, agent: makeAgent(''), send});
        const trace = sent.at(-1)?.text ?? '';
        expect(trace).toContain('v1');
        expect(trace).toContain('v2');
    });

    it('version increments per cycle on the same origin', async () => {
        const store = newStore(cycleDir);
        const {send} = captureSend();
        const r1 = await dispatchCycleMessage(baseInput({text: 'a'}), {store, agent: makeAgent(''), send});
        const r2 = await dispatchCycleMessage(baseInput({text: 'b'}), {store, agent: makeAgent(''), send});
        const r3 = await dispatchCycleMessage(baseInput({text: 'c'}), {store, agent: makeAgent(''), send});
        expect([r1.version, r2.version, r3.version]).toEqual([1, 2, 3]);
        const snaps = await listSnapshots(join(cycleDir, encodeURIComponent('fake:direct:user')));
        expect(snaps.map(s => s.version)).toEqual([1, 2, 3]);
    });

    it('different origins get separate state directories', async () => {
        const store = newStore(cycleDir);
        const {send} = captureSend();
        await dispatchCycleMessage(baseInput({origin: 'fake:direct:alice', text: 'a'}), {store, agent: makeAgent(''), send});
        await dispatchCycleMessage(baseInput({origin: 'fake:direct:bob', text: 'b'}), {store, agent: makeAgent(''), send});
        const aliceSnaps = await listSnapshots(join(cycleDir, encodeURIComponent('fake:direct:alice')));
        const bobSnaps = await listSnapshots(join(cycleDir, encodeURIComponent('fake:direct:bob')));
        expect(aliceSnaps).toHaveLength(1);
        expect(bobSnaps).toHaveLength(1);
    });

    it('resumes from the latest snapshot on cold start (no in-memory state)', async () => {
        const agent = makeAgent('post-restart');
        const store1 = newStore(cycleDir);
        const {send: send1} = captureSend();
        await dispatchCycleMessage(baseInput({text: 'first'}), {store: store1, agent, send: send1});

        const store2 = newStore(cycleDir);
        const {sent, send} = captureSend();
        await dispatchCycleMessage(baseInput({text: '!debug'}), {store: store2, agent, send});
        expect(sent.at(0)?.text).toContain('v1');
    });

    it('uses resolveTarget to pick the reply target', async () => {
        const store = newStore(cycleDir);
        const {sent, send} = captureSend();
        await dispatchCycleMessage(baseInput(), {
            store, agent: makeAgent('hi'),
            send,
            resolveTarget: () => '#channel',
        });
        expect(sent.at(0)?.target).toBe('#channel');
    });

    it('handles tool_calls turn as a summary line', async () => {
        const store = newStore(cycleDir);
        const {sent, send} = captureSend();
        await dispatchCycleMessage(baseInput(), {
            store,
            agent: makeAgent('', [{toolName: 'nar_believe', toolCallId: '1', args: {term: 'cat'}}]),
            send,
        });
        expect(sent.at(0)?.text).toContain('nar_believe');
    });

    it('sends response text for normal messages', async () => {
        const store = newStore(cycleDir);
        const {sent, send} = captureSend();
        await dispatchCycleMessage(baseInput(), {store, agent: makeAgent('hi'), send});
        expect(sent).toHaveLength(1);
        expect(sent.at(0)?.text).toBe('hi');
    });

    it('two messages from same origin share the journal', async () => {
        const store = newStore(cycleDir);
        const {send} = captureSend();
        await dispatchCycleMessage(baseInput({text: 'one'}), {store, agent: makeAgent(''), send});
        await dispatchCycleMessage(baseInput({text: 'two'}), {store, agent: makeAgent(''), send});
        const j = store.journals.get('fake:direct:user');
        expect(j?.size()).toBe(2);
    });

    it('reconstructs the journal from snapshots on cold start', async () => {
        const agent = makeAgent('any');
        const store1 = newStore(cycleDir);
        const {send: send1} = captureSend();
        await dispatchCycleMessage(baseInput({text: 'first'}), {store: store1, agent, send: send1});
        await dispatchCycleMessage(baseInput({text: 'second'}), {store: store1, agent, send: send1});

        const store2 = newStore(cycleDir);
        const {sent, send} = captureSend();
        await dispatchCycleMessage(baseInput({text: '!trace'}), {store: store2, agent, send});
        const trace = sent.at(0)?.text ?? '';
        expect(trace).toContain('TRACE (last 2 of 2)');
        expect(trace).toContain('v1');
        expect(trace).toContain('v2');
    });

    it('!replay works across restarts (journal rebuilt from snapshots)', async () => {
        const agent = makeAgent('replayed');
        const store1 = newStore(cycleDir);
        const {send: send1} = captureSend();
        await dispatchCycleMessage(baseInput({text: 'a'}), {store: store1, agent, send: send1});

        const store2 = newStore(cycleDir);
        const {sent, send} = captureSend();
        await dispatchCycleMessage(baseInput({text: '!replay turn 1'}), {store: store2, agent, send});
        const replay = sent.at(0)?.text ?? '';
        expect(replay).toContain('REPLAY v1');
        expect(replay).toContain('replay  turns: response(8b, c=0.70)');
    });

    it('serializes rapid-fire messages per origin (no version skip)', async () => {
        const agent = makeAgent('r');
        const store = newStore(cycleDir, true);
        const {send} = captureSend();
        const results = await Promise.all([
            dispatchCycleMessage(baseInput({text: 'a'}), {store, agent, send}),
            dispatchCycleMessage(baseInput({text: 'b'}), {store, agent, send}),
            dispatchCycleMessage(baseInput({text: 'c'}), {store, agent, send}),
        ]);
        expect(results.map(r => r.version)).toEqual([1, 2, 3]);
    });

    it('serializes operator commands after a cycle is persisted (no v0 leak)', async () => {
        const store = newStore(cycleDir, true);
        const {sent, send} = captureSend();
        const promises = [
            dispatchCycleMessage(baseInput({text: 'a'}), {store, agent: makeAgent('hi'), send}),
            dispatchCycleMessage(baseInput({text: '!debug'}), {store, agent: makeAgent(''), send}),
        ];
        await Promise.all(promises);
        const debugText = sent.at(-1)?.text ?? '';
        expect(debugText).toContain('v1');
    });

    it('queues are independent across origins (parallel processing)', async () => {
        const store = newStore(cycleDir, true);
        const {send} = captureSend();
        const [a, b] = await Promise.all([
            dispatchCycleMessage(baseInput({origin: 'a', text: 'x'}), {store, agent: makeAgent(''), send}),
            dispatchCycleMessage(baseInput({origin: 'b', text: 'y'}), {store, agent: makeAgent(''), send}),
        ]);
        expect(a.version).toBe(1);
        expect(b.version).toBe(1);
    });

    it('enforces maxSnapshots per origin after each cycle', async () => {
        const store = newStore(cycleDir);
        const {send} = captureSend();
        for (let i = 0; i < 5; i++) {
            await dispatchCycleMessage(baseInput({text: `m${i}`}), {
                store, agent: makeAgent(''), send, maxSnapshots: 3,
            });
        }
        const snaps = await listSnapshots(join(cycleDir, encodeURIComponent('fake:direct:user')));
        expect(snaps.map(s => s.version)).toEqual([3, 4, 5]);
    });

    it('!rollback restores state from an earlier snapshot in the store', async () => {
        const store = newStore(cycleDir);
        const {sent, send} = captureSend();
        await dispatchCycleMessage(baseInput({text: 'a'}), {store, agent: makeAgent(''), send});
        await dispatchCycleMessage(baseInput({text: 'b'}), {store, agent: makeAgent(''), send});
        expect(store.states.get('fake:direct:user')?.version).toBe(2);
        const r = await dispatchCycleMessage(baseInput({text: '!rollback 1'}), {store, agent: makeAgent(''), send});
        expect(r.handled).toBe(true);
        expect(sent.at(-1)?.text).toContain('rolled back to v1');
        expect(store.states.get('fake:direct:user')?.version).toBe(1);
    });

    it('!versions lists snapshot versions', async () => {
        const store = newStore(cycleDir);
        const {sent, send} = captureSend();
        await dispatchCycleMessage(baseInput({text: 'a'}), {store, agent: makeAgent(''), send});
        await dispatchCycleMessage(baseInput({text: 'b'}), {store, agent: makeAgent(''), send});
        const r = await dispatchCycleMessage(baseInput({text: '!versions'}), {store, agent: makeAgent(''), send});
        const text = sent.at(-1)?.text ?? '';
        expect(text).toContain('v1');
        expect(text).toContain('v2');
    });
});

describe('StateJournal (sanity)', () => {
    it('record/get/last/clear work as a standalone in-memory history', () => {
        const j = new StateJournal();
        j.record({...initialState(), version: 1}, []);
        j.record({...initialState(), version: 2}, []);
        expect(j.get(1)?.version).toBe(1);
        expect(j.last(1)[0]?.version).toBe(2);
        j.clear();
        expect(j.size()).toBe(0);
    });
});
