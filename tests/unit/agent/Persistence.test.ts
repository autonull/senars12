import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState, type State, type Turn} from '../../../src/agent/cycle/index.js';
import {
    snapshotState,
    restoreState,
    listSnapshots,
    latestSnapshot,
    clearSnapshots,
    MAX_SNAPSHOTS,
} from '../../../src/agent/cycle/index.js';

const mkTmp = async (): Promise<string> => mkdtemp(join(tmpdir(), 'senars-cycle-'));
const cleanup = (dir: string) => rm(dir, {recursive: true, force: true});

const focus = (text: string) => ({
    kind: 'message' as const,
    source: 'cli',
    origin: 'cli:direct:user',
    sender: 'user',
    text,
    receivedAt: 1000,
});

describe('snapshot/restore round-trip', () => {
    let dir: string;
    beforeEach(async () => { dir = await mkTmp(); });
    afterEach(async () => { await cleanup(dir); });

    it('writes state-{version}.json under the given dir', async () => {
        const state: State = {...initialState(), version: 5};
        const turns: Turn[] = [{kind: 'response', text: 'hi', confidence: 0.9}];
        const path = await snapshotState(state, turns, dir, 12345);
        expect(path).toBe(join(dir, 'state-5.json'));
        const restored = await restoreState(5, dir);
        expect(restored).not.toBeNull();
        expect(restored!.version).toBe(5);
        expect(restored!.timestamp).toBe(12345);
        expect(restored!.state.version).toBe(5);
        expect(restored!.turns).toEqual(turns);
    });

    it('strips prev on disk (no in-memory chain in JSON)', async () => {
        const inner: State = {...initialState({attention: focus('inner')}), version: 2};
        const outer: State = {...initialState({attention: focus('outer')}), version: 3, prev: inner};
        await snapshotState(outer, [], dir);
        const restored = await restoreState(3, dir);
        expect(restored!.state.prev).toBeNull();
    });

    it('returns null for missing version', async () => {
        expect(await restoreState(42, dir)).toBeNull();
    });

    it('returns null for malformed JSON', async () => {
        const {writeFile} = await import('node:fs/promises');
        await writeFile(join(dir, 'state-1.json'), '{"bogus":', 'utf-8');
        await expect(restoreState(1, dir)).rejects.toThrow();
    });

    it('returns null when file is not a StateSnapshot', async () => {
        const {writeFile} = await import('node:fs/promises');
        await writeFile(join(dir, 'state-1.json'), '{"foo":"bar"}', 'utf-8');
        expect(await restoreState(1, dir)).toBeNull();
    });
});

describe('listSnapshots / latestSnapshot', () => {
    let dir: string;
    beforeEach(async () => { dir = await mkTmp(); });
    afterEach(async () => { await cleanup(dir); });

    it('returns [] for missing dir', async () => {
        expect(await listSnapshots(join(dir, 'nope'))).toEqual([]);
        expect(await latestSnapshot(join(dir, 'nope'))).toBeNull();
    });

    it('returns snapshots sorted by version', async () => {
        await snapshotState({...initialState(), version: 7}, [], dir);
        await snapshotState({...initialState(), version: 2}, [], dir);
        await snapshotState({...initialState(), version: 5}, [], dir);
        const snaps = await listSnapshots(dir);
        expect(snaps.map(s => s.version)).toEqual([2, 5, 7]);
        const latest = await latestSnapshot(dir);
        expect(latest!.version).toBe(7);
    });

    it('ignores non-snapshot files in dir', async () => {
        const {writeFile} = await import('node:fs/promises');
        await writeFile(join(dir, 'README.md'), 'hi', 'utf-8');
        await writeFile(join(dir, 'state-3.json.bak'), '{}', 'utf-8');
        await snapshotState({...initialState(), version: 3}, [], dir);
        const snaps = await listSnapshots(dir);
        expect(snaps).toHaveLength(1);
        expect(snaps[0]!.version).toBe(3);
    });
});

describe('clearSnapshots', () => {
    it('removes all snapshots and returns the count', async () => {
        const dir = await mkTmp();
        try {
            await snapshotState({...initialState(), version: 1}, [], dir);
            await snapshotState({...initialState(), version: 2}, [], dir);
            const removed = await clearSnapshots(dir);
            expect(removed).toBe(2);
            expect(await listSnapshots(dir)).toEqual([]);
        } finally {
            await cleanup(dir);
        }
    });

    it('returns 0 for missing dir', async () => {
        const dir = await mkTmp();
        try {
            expect(await clearSnapshots(join(dir, 'nope'))).toBe(0);
        } finally {
            await cleanup(dir);
        }
    });
});

describe('hard-cap retention via MAX_SNAPSHOTS', () => {
    it('keeps all when under cap', async () => {
        const dir = await mkTmp();
        try {
            await snapshotState({...initialState(), version: 1}, [], dir);
            await snapshotState({...initialState(), version: 2}, [], dir);
            expect((await listSnapshots(dir)).map(s => s.version)).toEqual([1, 2]);
        } finally { await cleanup(dir); }
    });

    it('removes oldest FIFO when over cap', async () => {
        const dir = await mkTmp();
        try {
            for (let v = 1; v <= MAX_SNAPSHOTS + 5; v++) {
                await snapshotState({...initialState(), version: v}, [], dir);
            }
            const versions = (await listSnapshots(dir)).map(s => s.version);
            expect(versions).toHaveLength(MAX_SNAPSHOTS);
            expect(versions.at(0)).toBe(6);
            expect(versions.at(-1)).toBe(MAX_SNAPSHOTS + 5);
        } finally { await cleanup(dir); }
    }, 30000);
});
