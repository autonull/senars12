/**
 * Integration test for the simplified cycle pipeline (post-TODO5).
 *
 * Verifies the end-to-end flow that the ConnectionManager wires together:
 *   1. cycle() runs perceive → reason → decide → act+reflect → commit
 *   2. snapshot + journal persist
 *   3. cold start rehydrates from journal
 *   4. operator commands return declarative OperatorAction values
 *   5. !rollback returns a typed action that the manager applies
 *
 * Uses a fake agent and a temporary state dir; no mocks (per AGENTS.md
 * "test objects directly" rule, these are real implementations of
 * `Reasoner` and real disk-backed `persistence` helpers).
 */

import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
    cycle,
    initialState,
    runOperatorCommand,
    snapshotState,
    loadJournal,
    appendJournal,
    restoreState,
    type State,
    type Focus,
    type Reasoner,
    type Thought,
    type StateJournal,
} from '../../src/agent/cycle/index.js';

const focus = (text: string, origin = 'cli:direct:user'): Focus => ({
    kind: 'message', source: 'cli', sender: 'user', text, origin, receivedAt: 1000,
});

const textReasoner = (text: string, conf = 0.7): Reasoner => ({
    reason: async () => ({text, toolCalls: [], confidence: conf} as Thought),
});

const mkTmp = async () => mkdtemp(join(tmpdir(), 'senars-todo5-'));
const cleanup = (dir: string) => rm(dir, {recursive: true, force: true});

describe('TODO5 — simplified cycle pipeline', () => {
    it('cycle() takes a Reasoner directly (no CycleDeps)', async () => {
        const {state, turn} = await cycle(focus('hi'), initialState(), textReasoner('ok'));
        expect(state.version).toBe(1);
        expect(turn).toMatchObject({kind: 'response', text: 'ok'});
    });

    it('persists snapshot + journal for each cycle', async () => {
        const dir = await mkTmp();
        try {
            const r1 = textReasoner('a');
            const r2 = textReasoner('b');
            const {state: s1, turn: t1} = await cycle(focus('1'), initialState(), r1);
            await snapshotState(s1, [t1], dir);
            await appendJournal(dir, {version: s1.version, state: s1, turns: [t1], focus: focus('1'), recordedAt: 1000});

            const {state: s2, turn: t2} = await cycle(focus('2'), s1, r2);
            await snapshotState(s2, [t2], dir);
            await appendJournal(dir, {version: s2.version, state: s2, turns: [t2], focus: focus('2'), recordedAt: 2000});

            const journal = await loadJournal(dir);
            expect(journal).toHaveLength(2);
            expect(journal.map(j => j.version)).toEqual([1, 2]);

            const snap1 = await restoreState(1, dir);
            const snap2 = await restoreState(2, dir);
            expect(snap1).not.toBeNull();
            expect(snap2).not.toBeNull();
            expect(snap2!.state.version).toBe(2);
        } finally { await cleanup(dir); }
    });

    it('cold start rehydrates the latest state from journal', async () => {
        const dir = await mkTmp();
        try {
            let state = initialState();
            for (let v = 1; v <= 3; v++) {
                const r = textReasoner(`r${v}`);
                const result = await cycle(focus(`${v}`), state, r);
                state = result.state;
                await snapshotState(state, [result.turn], dir);
                await appendJournal(dir, {version: state.version, state, turns: [result.turn], focus: focus(`${v}`), recordedAt: v * 1000});
            }
            const lines = await loadJournal(dir);
            const latest = lines.at(-1);
            expect(latest?.version).toBe(3);
            expect(latest?.focus?.text).toBe('3');
        } finally { await cleanup(dir); }
    });

    it('journal.jsonl is a single file per origin (not N snapshots)', async () => {
        const dir = await mkTmp();
        try {
            let state = initialState();
            for (let v = 1; v <= 5; v++) {
                const r = textReasoner(`r${v}`);
                const result = await cycle(focus(`${v}`), state, r);
                state = result.state;
                await snapshotState(state, [result.turn], dir);
                await appendJournal(dir, {version: state.version, state, turns: [result.turn], focus: focus(`${v}`), recordedAt: v * 1000});
            }
            const journalRaw = await readFile(join(dir, 'journal.jsonl'), 'utf-8');
            const lines = journalRaw.split('\n').filter(l => l.trim());
            expect(lines).toHaveLength(5);
        } finally { await cleanup(dir); }
    });

    it('!rollback returns a declarative OperatorAction (no setState callback)', async () => {
        const r = await runOperatorCommand('!rollback 3', {
            journal: {} as StateJournal,
            currentState: () => initialState(),
            currentTurns: () => [],
            reasoner: textReasoner('x'),
        });
        expect(r).toEqual({kind: 'rollback', version: 3});
    });

    it('!rollback is independent of context (manager owns state mutation)', async () => {
        const r = await runOperatorCommand('!rollback 99', {
            journal: {} as StateJournal,
            currentState: () => initialState(),
            currentTurns: () => [],
            reasoner: textReasoner('x'),
        });
        expect(r).toEqual({kind: 'rollback', version: 99});
    });

    it('!versions is rejected (no longer in the command set)', async () => {
        const r = await runOperatorCommand('!versions', {
            journal: {size: () => 0} as unknown as StateJournal,
            currentState: () => initialState(),
            currentTurns: () => [],
            reasoner: textReasoner('x'),
        });
        expect(r.kind).toBe('response');
        if (r.kind === 'response') expect(r.text).toContain('unknown command: !versions');
    });

    it('non-! messages return unhandled action (manager falls through to cycle)', async () => {
        const r = await runOperatorCommand('hello world', {
            journal: {} as StateJournal,
            currentState: () => initialState(),
            currentTurns: () => [],
            reasoner: textReasoner('x'),
        });
        expect(r).toEqual({kind: 'unhandled'});
    });
});

describe('TODO5 — hard-cap retention (MAX_SNAPSHOTS = 100)', () => {
    it('keeps newest when cap is exceeded', async () => {
        const dir = await mkTmp();
        try {
            for (let v = 1; v <= 105; v++) {
                const state: State = {...initialState(), version: v};
                const turn = {kind: 'response' as const, text: `r${v}`, confidence: 0.5};
                await snapshotState(state, [turn], dir);
            }
            const snap1 = await restoreState(1, dir);
            const snap6 = await restoreState(6, dir);
            const snap100 = await restoreState(100, dir);
            const snap105 = await restoreState(105, dir);
            expect(snap1).toBeNull();
            expect(snap6).not.toBeNull();
            expect(snap100).not.toBeNull();
            expect(snap105).not.toBeNull();
        } finally { await cleanup(dir); }
    }, 30000);
});
