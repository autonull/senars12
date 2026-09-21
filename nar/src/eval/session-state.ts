import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * G3 — multi-game session resume. The arcade records its tournament progress
 * so an interrupted run (long LM/replica arms) resumes mid-tournament instead
 * of replaying completed episodes. Episode seeds are derived deterministically
 * (seed + episode index), so skipping completed episodes leaves the remaining
 * trajectories byte-identical.
 */
export interface ArcadeSession {
  version: 1;
  seed: number;
  games: readonly string[];
  arms: readonly string[];
  targetEpisodes: number;
  /** `${arm}/${game}` → completed episode count. */
  completed: Record<string, number>;
  /** FocusBag weights (`FocusBag.serialize`), when the run is scheduler-driven. */
  bagWeights?: Record<string, number>;
}

export const sessionKey = (arm: string, game: string): string => `${arm}/${game}`;

export function loadSession(path: string): ArcadeSession | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as ArcadeSession;
    if (raw?.version !== 1 || typeof raw.seed !== 'number' || !raw.completed) return null;
    return raw;
  } catch {
    return null;
  }
}

export function saveSession(path: string, session: ArcadeSession): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(session, null, 2), 'utf-8');
}

/** A saved session resumes the current run only when the tournament config matches. */
export const isResumable = (
  session: ArcadeSession,
  run: Pick<ArcadeSession, 'seed' | 'games' | 'arms' | 'targetEpisodes'>
): boolean =>
  session.seed === run.seed &&
  session.targetEpisodes === run.targetEpisodes &&
  [...session.games].sort().join() === [...run.games].sort().join() &&
  [...session.arms].sort().join() === [...run.arms].sort().join();
