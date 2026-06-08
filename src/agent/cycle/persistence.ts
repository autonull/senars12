import {mkdir, readFile, readdir, rm, writeFile, appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Belief, Episode, Goal, Identity, State, Focus} from './State.js';
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
    await enforceRetention(dir);
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

export const MAX_SNAPSHOTS = 100;

const enforceRetention = async (dir: string): Promise<void> => {
    const snaps = await listSnapshots(dir);
    if (snaps.length <= MAX_SNAPSHOTS) return;
    const toRemove = snaps.slice(0, snaps.length - MAX_SNAPSHOTS);
    await Promise.all(toRemove.map(s => rm(snapshotPath(dir, s.version))));
};

export interface JournalLine {
    readonly version: number;
    readonly state: State;
    readonly turns: readonly Turn[];
    readonly focus: Focus | null;
    readonly recordedAt: number;
}

const JOURNAL_FILENAME = 'journal.jsonl';
const journalPath = (dir: string): string => join(dir, JOURNAL_FILENAME);

const isJournalLine = (v: unknown): v is JournalLine => {
    if (typeof v !== 'object' || v === null) return false;
    const o = v as Record<string, unknown>;
    return typeof o.version === 'number'
        && typeof o.state === 'object' && o.state !== null
        && Array.isArray(o.turns)
        && typeof o.recordedAt === 'number'
        && (o.focus === null || typeof o.focus === 'object');
};

export const appendJournal = async (
    dir: string,
    line: JournalLine,
): Promise<void> => {
    await ensureDir(dir);
    await appendFile(journalPath(dir), JSON.stringify(line) + '\n', 'utf-8');
};

export const loadJournal = async (dir: string): Promise<readonly JournalLine[]> => {
    let raw: string;
    try {
        raw = await readFile(journalPath(dir), 'utf-8');
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw err;
    }
    const out: JournalLine[] = [];
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            const parsed: unknown = JSON.parse(trimmed);
            if (isJournalLine(parsed)) out.push(parsed);
        } catch {
            // skip malformed lines
        }
    }
    return out;
};

export const clearJournal = async (dir: string): Promise<void> => {
    try {
        await rm(journalPath(dir));
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw err;
    }
};

export interface StateDiff {
    readonly fromVersion: number;
    readonly toVersion: number;
    readonly beliefsAdded: readonly Belief[];
    readonly beliefsRemoved: readonly Belief[];
    readonly episodesAdded: readonly Episode[];
    readonly episodesRemoved: readonly Episode[];
    readonly goalsAdded: readonly Goal[];
    readonly goalsRemoved: readonly Goal[];
    readonly identityChanged: boolean;
    readonly attentionChanged: boolean;
    readonly budgetChanged: boolean;
}

const beliefKey = (b: Belief): string => b.term;
const episodeKey = (e: Episode): string => e.id;
const goalKey = (g: Goal): string => g.id;
const setDiff = <T>(a: readonly T[], b: readonly T[], key: (t: T) => string): {
    added: readonly T[];
    removed: readonly T[];
} => {
    const aKeys = new Set(a.map(key));
    const bKeys = new Set(b.map(key));
    return {
        added: b.filter(x => !aKeys.has(key(x))),
        removed: a.filter(x => !bKeys.has(key(x))),
    };
};

const identityEqual = (a: Identity, b: Identity): boolean =>
    a.version === b.version
    && a.beliefs.length === b.beliefs.length
    && a.skills.length === b.skills.length
    && a.goals.length === b.goals.length
    && a.beliefs.every((x, i) => x.term === b.beliefs[i]?.term)
    && a.skills.every((x, i) => x === b.skills[i])
    && a.goals.every((x, i) => x === b.goals[i]);

const attentionEqual = (a: State, b: State): boolean => {
    const x = a.attention;
    const y = b.attention;
    if (x === null && y === null) return true;
    if (x === null || y === null) return false;
    return x.text === y.text && x.sender === y.sender && x.source === y.source;
};

const budgetEqual = (a: State, b: State): boolean => {
    const x = a.budget;
    const y = b.budget;
    return x.tokensRemaining === y.tokensRemaining
        && x.stepsRemaining === y.stepsRemaining
        && x.deadline === y.deadline
        && x.maxOutputTokens === y.maxOutputTokens;
};

export const diffStates = (a: State, b: State): StateDiff => {
    const beliefs = setDiff(a.beliefs, b.beliefs, beliefKey);
    const episodes = setDiff(a.episodes, b.episodes, episodeKey);
    const goals = setDiff(a.goals, b.goals, goalKey);
    return {
        fromVersion: a.version,
        toVersion: b.version,
        beliefsAdded: beliefs.added,
        beliefsRemoved: beliefs.removed,
        episodesAdded: episodes.added,
        episodesRemoved: episodes.removed,
        goalsAdded: goals.added,
        goalsRemoved: goals.removed,
        identityChanged: !identityEqual(a.identity, b.identity),
        attentionChanged: !attentionEqual(a, b),
        budgetChanged: !budgetEqual(a, b),
    };
};

export const isEmptyDiff = (d: StateDiff): boolean =>
    d.beliefsAdded.length === 0
    && d.beliefsRemoved.length === 0
    && d.episodesAdded.length === 0
    && d.episodesRemoved.length === 0
    && d.goalsAdded.length === 0
    && d.goalsRemoved.length === 0
    && !d.identityChanged
    && !d.attentionChanged
    && !d.budgetChanged;
