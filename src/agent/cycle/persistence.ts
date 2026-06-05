import {mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {State} from './State.js';
import type {Turn} from './Turn.js';

export interface StateSnapshot {
    readonly version: number;
    readonly timestamp: number;
    readonly state: State;
    readonly turns: readonly Turn[];
}

const VERSION_PREFIX = 'state-';
const VERSION_SUFFIX = '.json';

const snapshotPath = (dir: string, version: number): string =>
    join(dir, `${VERSION_PREFIX}${version}${VERSION_SUFFIX}`);

const stripPrev = (state: State): State => {
    if (state.prev === null) return state;
    return {...state, prev: null};
};

const isStateSnapshot = (v: unknown): v is StateSnapshot => {
    if (typeof v !== 'object' || v === null) return false;
    const o = v as Record<string, unknown>;
    return typeof o.version === 'number'
        && typeof o.timestamp === 'number'
        && typeof o.state === 'object' && o.state !== null
        && Array.isArray(o.turns);
};

const ensureDir = async (dir: string): Promise<void> => {
    await mkdir(dir, {recursive: true});
};

const parseVersion = (filename: string): number | null => {
    if (!filename.startsWith(VERSION_PREFIX) || !filename.endsWith(VERSION_SUFFIX)) return null;
    const v = Number(filename.slice(VERSION_PREFIX.length, -VERSION_SUFFIX.length));
    return Number.isInteger(v) && v >= 0 ? v : null;
};

export const snapshotState = async (
    state: State,
    turns: readonly Turn[],
    dir: string,
    timestamp: number = Date.now(),
): Promise<string> => {
    await ensureDir(dir);
    const snap: StateSnapshot = {
        version: state.version,
        timestamp,
        state: stripPrev(state),
        turns,
    };
    const path = snapshotPath(dir, state.version);
    await writeFile(path, JSON.stringify(snap, null, 2), 'utf-8');
    return path;
};

export const restoreState = async (
    version: number,
    dir: string,
): Promise<StateSnapshot | null> => {
    try {
        const raw = await readFile(snapshotPath(dir, version), 'utf-8');
        const parsed: unknown = JSON.parse(raw);
        return isStateSnapshot(parsed) ? parsed : null;
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
    }
};

export const listSnapshots = async (dir: string): Promise<readonly StateSnapshot[]> => {
    let entries: string[];
    try {
        entries = await readdir(dir);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw err;
    }
    const versions = entries
        .map(parseVersion)
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b);
    const snaps = await Promise.all(versions.map(v => restoreState(v, dir)));
    return snaps.filter((s): s is StateSnapshot => s !== null);
};

export const latestSnapshot = async (dir: string): Promise<StateSnapshot | null> => {
    const snaps = await listSnapshots(dir);
    return snaps.at(-1) ?? null;
};

export const clearSnapshots = async (dir: string): Promise<number> => {
    let entries: string[];
    try {
        entries = await readdir(dir);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 0;
        throw err;
    }
    const targets = entries.filter(e => parseVersion(e) !== null).map(e => join(dir, e));
    await Promise.all(targets.map(p => rm(p)));
    return targets.length;
};

export interface RetentionResult {
    readonly kept: readonly number[];
    readonly removed: readonly number[];
}

export const enforceRetention = async (
    dir: string,
    maxSnapshots: number,
): Promise<RetentionResult> => {
    if (maxSnapshots <= 0) return {kept: [], removed: []};
    const snaps = await listSnapshots(dir);
    if (snaps.length <= maxSnapshots) {
        return {kept: snaps.map(s => s.version), removed: []};
    }
    const toRemove = snaps.slice(0, snaps.length - maxSnapshots);
    await Promise.all(toRemove.map(s => rm(snapshotPath(dir, s.version))));
    return {kept: snaps.slice(-maxSnapshots).map(s => s.version), removed: toRemove.map(s => s.version)};
};
