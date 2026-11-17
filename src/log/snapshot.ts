/**
 * Log Snapshot & Restore — point-in-time state capture and recovery.
 *
 * Snapshots capture the complete derived state at a sequence point,
 * enabling fast restore without full replay from genesis.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import type { LogEntry, CognitiveEvent } from './events.js';
import type { LogStore } from './store.js';
import { isTaskAdmittedEvent, isDerivationAcceptedEvent, isSnapshotEvent } from './events.js';
import type { ReplayOptions, Reducer } from './replay.js';
import { replay } from './replay.js';

const SNAPSHOT_DIR = 'snapshots';
const SNAPSHOT_EXT = '.snap';

/** Snapshot metadata. */
export interface SnapshotMetadata {
  /** Sequence number at snapshot. */
  seq: number;
  /** Wall-clock timestamp. */
  ts: number;
  /** Hash of the serialized state. */
  stateHash: string;
  /** Schema version for compatibility. */
  schemaVersion: number;
  /** Custom metadata. */
  custom?: Record<string, unknown>;
}

/** Snapshot file format. */
export interface SnapshotFile<S> {
  metadata: SnapshotMetadata;
  state: S;
}

/** Snapshot configuration. */
export interface SnapshotConfig {
  /** Directory for snapshots. */
  dir: string;
  /** Snapshot interval (sequence numbers). */
  interval: number;
  /** Maximum snapshots to retain. */
  maxSnapshots: number;
  /** Compress snapshots. */
  compress: boolean;
}

/** Default snapshot configuration. */
export const defaultSnapshotConfig: SnapshotConfig = {
  dir: join(process.cwd(), 'data', 'snapshots'),
  interval: 10000,
  maxSnapshots: 10,
  compress: false,
};

/** Snapshot manager. */
export class SnapshotManager<S> {
  private config: SnapshotConfig;
  private reducer: Reducer<S>;
  private initialState: S;

  constructor(
    reducer: Reducer<S>,
    initialState: S,
    config: Partial<SnapshotConfig> = {}
  ) {
    this.config = { ...defaultSnapshotConfig, ...config };
    this.reducer = reducer;
    this.initialState = initialState;
  }

  /** Ensure snapshot directory exists. */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.config.dir, { recursive: true });
  }

  /** Generate snapshot file path. */
  private getSnapshotPath(seq: number): string {
    return join(this.config.dir, `snapshot-${seq.toString().padStart(10, '0')}${SNAPSHOT_EXT}`);
  }

  /** Compute state hash. */
  private hashState(state: S): string {
    const json = JSON.stringify(state, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    return createHash('sha256').update(json).digest('hex').substring(0, 16);
  }

  /** Create a snapshot at the given sequence. */
  async create(store: LogStore, seq: number, customMeta?: Record<string, unknown>): Promise<SnapshotMetadata> {
    await this.ensureDir();

    // Replay from last snapshot or genesis
    const lastSnapshot = await this.findLatest();
    const fromSeq = lastSnapshot ? lastSnapshot.metadata.seq + 1 : store.getFirstSeq();

    const result = await replay(store, {
      initialState: lastSnapshot?.state ?? this.initialState,
      reducer: this.reducer,
      fromSeq,
      toSeq: seq,
    });

    const stateHash = this.hashState(result.state);

    const metadata: SnapshotMetadata = {
      seq,
      ts: Date.now(),
      stateHash,
      schemaVersion: 1,
      custom: customMeta,
    };

    const snapshotFile: SnapshotFile<S> = { metadata, state: result.state };
    const path = this.getSnapshotPath(seq);
    await fs.writeFile(path, JSON.stringify(snapshotFile), 'utf-8');

    // Prune old snapshots
    await this.prune();

    return metadata;
  }

  /** Create a snapshot at the current log head. */
  async createAtHead(store: LogStore, customMeta?: Record<string, unknown>): Promise<SnapshotMetadata> {
    return this.create(store, store.getLastSeq(), customMeta);
  }

  /** Find the latest snapshot. */
  async findLatest(): Promise<SnapshotFile<S> | null> {
    try {
      const files = await fs.readdir(this.config.dir);
      const snapshots = files
        .filter(f => f.endsWith(SNAPSHOT_EXT))
        .map(f => parseInt(f.split('-')[1]!.split('.')[0]!, 10))
        .filter((n): n is number => !isNaN(n))
        .sort((a, b) => b - a);

      if (snapshots.length === 0) return null;

      const latest = snapshots[0];
      if (latest === undefined) return null;
      const path = this.getSnapshotPath(latest);
      const content = await fs.readFile(path, 'utf-8');
      return JSON.parse(content) as SnapshotFile<S>;
    } catch {
      return null;
    }
  }

  /** Find snapshot at or before a sequence. */
  async findAtOrBefore(seq: number): Promise<SnapshotFile<S> | null> {
    try {
      const files = await fs.readdir(this.config.dir);
      const snapshots = files
        .filter(f => f.endsWith(SNAPSHOT_EXT))
        .map(f => parseInt(f.split('-')[1]!.split('.')[0]!, 10))
        .filter((n): n is number => !isNaN(n) && n <= seq)
        .sort((a, b) => b - a);

      if (snapshots.length === 0) return null;

      const target = snapshots[0];
      if (target === undefined) return null;
      const path = this.getSnapshotPath(target);
      const content = await fs.readFile(path, 'utf-8');
      return JSON.parse(content) as SnapshotFile<S>;
    } catch {
      return null;
    }
  }

  /** Load a specific snapshot. */
  async load(seq: number): Promise<SnapshotFile<S> | null> {
    try {
      const path = this.getSnapshotPath(seq);
      const content = await fs.readFile(path, 'utf-8');
      return JSON.parse(content) as SnapshotFile<S>;
    } catch {
      return null;
    }
  }

  /** Restore state from the latest snapshot (or initial state if none). */
  async restoreLatest(): Promise<{ state: S; seq: number } | null> {
    const snapshot = await this.findLatest();
    if (!snapshot) return null;
    return { state: snapshot.state, seq: snapshot.metadata.seq };
  }

  /** Restore state from a specific snapshot. */
  async restore(seq: number): Promise<{ state: S; seq: number } | null> {
    const snapshot = await this.load(seq);
    if (!snapshot) return null;
    return { state: snapshot.state, seq: snapshot.metadata.seq };
  }

  /** Prune old snapshots beyond maxSnapshots. */
  private async prune(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.dir);
      const snapshots = files
        .filter(f => f.endsWith(SNAPSHOT_EXT))
        .map(f => ({
          seq: parseInt(f.split('-')[1]!.split('.')[0]!, 10),
          name: f,
        }))
        .filter(s => !isNaN(s.seq))
        .sort((a, b) => b.seq - a.seq);

      if (snapshots.length > this.config.maxSnapshots) {
        for (const snap of snapshots.slice(this.config.maxSnapshots)) {
          await fs.unlink(join(this.config.dir, snap.name)).catch(() => {});
        }
      }
    } catch {
      // Ignore prune errors
    }
  }

  /** List all snapshots. */
  async list(): Promise<SnapshotMetadata[]> {
    try {
      const files = await fs.readdir(this.config.dir);
      const snapshots = files
        .filter(f => f.endsWith(SNAPSHOT_EXT))
        .map(async f => {
          const path = join(this.config.dir, f);
          const content = await fs.readFile(path, 'utf-8');
          return JSON.parse(content).metadata as SnapshotMetadata;
        });
      return Promise.all(snapshots);
    } catch {
      return [];
    }
  }

  /** Verify snapshot integrity. */
  async verify(seq: number): Promise<boolean> {
    const snapshot = await this.load(seq);
    if (!snapshot) return false;
    const computedHash = this.hashState(snapshot.state);
    return computedHash === snapshot.metadata.stateHash;
  }
}

/**
 * Create a snapshot manager with a reducer and initial state.
 */
export function createSnapshotManager<S>(
  reducer: Reducer<S>,
  initialState: S,
  config?: Partial<SnapshotConfig>
): SnapshotManager<S> {
  return new SnapshotManager(reducer, initialState, config);
}

/**
 * Restore and replay from the best available snapshot.
 * Returns the restored state and the sequence to continue replay from.
 */
export async function restoreAndReplay<S>(
  store: LogStore,
  snapshotManager: SnapshotManager<S>,
  options: Partial<ReplayOptions<S>> = {}
): Promise<{ state: S; fromSeq: number }> {
  const snapshot = await snapshotManager.findLatest();

  if (!snapshot) {
    // No snapshot, replay from genesis
    const result = await replay(store, {
      initialState: snapshotManager['initialState'],
      reducer: snapshotManager['reducer'],
      ...options,
    });
    return { state: result.state, fromSeq: store.getFirstSeq() };
  }

  // Replay from snapshot
  const fromSeq = snapshot.metadata.seq + 1;
  if (fromSeq > store.getLastSeq()) {
    return { state: snapshot.state, fromSeq };
  }

  const result = await replay(store, {
    initialState: snapshot.state,
    reducer: snapshotManager['reducer'],
    fromSeq,
    ...options,
  });

  return { state: result.state, fromSeq };
}

/**
 * Auto-snapshot policy: create snapshots at regular intervals during replay.
 */
export interface AutoSnapshotPolicy {
  interval: number;
  maxSnapshots: number;
  onSnapshot?: (metadata: SnapshotMetadata) => void;
}

export async function replayWithAutoSnapshot<S>(
  store: LogStore,
  snapshotManager: SnapshotManager<S>,
  policy: AutoSnapshotPolicy,
  options: Partial<ReplayOptions<S>> = {}
): Promise<{ state: S; snapshotsCreated: number }> {
  const { interval, maxSnapshots, onSnapshot } = policy;
  let snapshotsCreated = 0;

  const lastSnapshot = await snapshotManager.findLatest();
  const fromSeq = lastSnapshot ? lastSnapshot.metadata.seq + 1 : store.getFirstSeq();
  const toSeq = store.getLastSeq();

  let currentSeq = fromSeq;
  while (currentSeq <= toSeq) {
    const chunkEnd = Math.min(currentSeq + interval - 1, toSeq);
    const result = await replay(store, {
      initialState: lastSnapshot?.state ?? snapshotManager['initialState'],
      reducer: snapshotManager['reducer'],
      fromSeq: currentSeq,
      toSeq: chunkEnd,
    });

    const metadata = await snapshotManager.create(store, chunkEnd);
    snapshotsCreated++;
    onSnapshot?.(metadata);

    if (snapshotsCreated >= maxSnapshots) break;
    currentSeq = chunkEnd + 1;
  }

  const finalSnapshot = await snapshotManager.findLatest();
  return { state: finalSnapshot?.state ?? snapshotManager['initialState'], snapshotsCreated };
}