import { readJsonFileSync, writeJsonFileSync } from '@senars/util/fs';
export const sessionKey = (arm, game) => `${arm}/${game}`;
export function loadSession(path) {
    const raw = readJsonFileSync(path, null);
    if (!raw || raw.version !== 1 || typeof raw.seed !== 'number' || !raw.completed)
        return null;
    return raw;
}
export function saveSession(path, session) {
    writeJsonFileSync(path, session);
}
/** A saved session resumes the current run only when the tournament config matches. */
export const isResumable = (session, run) => session.seed === run.seed &&
    session.targetEpisodes === run.targetEpisodes &&
    [...session.games].sort().join() === [...run.games].sort().join() &&
    [...session.arms].sort().join() === [...run.arms].sort().join();
