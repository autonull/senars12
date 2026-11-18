/**
 * LogStore-based Derivation Ledger — replaces file-based DerivationLedger.
 *
 * This ledger persists derivation rule fires and completed chains to the
 * unified LogStore instead of separate JSONL files.
 */

import type { LogStore } from '../../../../src/log/store.js';
import type { CognitiveEvent } from '../../../../src/log/events.js';
import type { DerivationRecorder } from '../../../../nar/src/rules/impls/recorder.js';
import { createLogger } from '@senars/utils';

export interface DerivationLedgerOptions {
  /** Where a replay reports what it resumed. */
  logger?: ReturnType<typeof createLogger>;
}

interface StoredDerivationFire {
  fire: CognitiveEvent;
  seq: number;
}

interface StoredDerivationRecord {
  record: CognitiveEvent;
  seq: number;
}

export class LogStoreDerivationLedger {
  readonly #store: LogStore;
  readonly #seen = new WeakSet<CognitiveEvent>();
  readonly #logger: ReturnType<typeof createLogger>;
  #unsubscribeRecords: (() => void) | null = null;

  constructor(store: LogStore, options: DerivationLedgerOptions = {}) {
    this.#store = store;
    this.#logger = options.logger ?? createLogger({ scope: 'NAR.LogStoreDerivationLedger' });
  }

  /**
   * Persist each completed chain as it closes. Push, not pull:
   * the completed ring is drain-emptied by consumers, so a periodic flush could
   * miss a record a drain took first.
   */
  observe(recorder: DerivationRecorder): void {
    this.#unsubscribeRecords ??= recorder.onRecord.on((record: any) => {
      // Append derivation record as a cognitive event
      const event: CognitiveEvent = {
        type: 'derivation.record',
        timestamp: Date.now(),
        correlationId: record.derivationId,
        causationId: undefined,
        id: crypto.randomUUID(),
        engine: 'nar',
        payload: record,
      } as unknown as CognitiveEvent;
      this.#store.append(event, { ts: event.timestamp });
    });
  }

  /** Append every not-yet-written rule fire; returns how many were written. */
  flush(recorder: DerivationRecorder): number {
    let appended = 0;

    for (const fire of recorder.fires()) {
      if (this.#seen.has(fire)) continue;
      this.#seen.add(fire);

      // Append durable fire (without wall-clock timestamp)
      const durableFire = this.#durableFire(fire);
      const event: CognitiveEvent = {
        type: 'derivation.accepted',
        timestamp: Date.now(),
        correlationId: (fire as any).correlationId,
        causationId: undefined,
        id: crypto.randomUUID(),
        engine: 'nar',
        payload: durableFire,
      } as unknown as CognitiveEvent;
      this.#store.append(event, { ts: event.timestamp });
      appended++;
    }

    return appended;
  }

  #durableFire(fire: any): any {
    const { timestamp, ...rest } = fire;
    return timestamp === undefined ? fire : rest;
  }

  /** The durable fire entries, oldest first — the C4.3 replay input. */
  async readEntries(limit?: number): Promise<StoredDerivationFire[]> {
    const results: StoredDerivationFire[] = [];

    for (let seq = this.#store.getFirstSeq(); seq <= this.#store.getLastSeq() && (!limit || results.length < limit); seq++) {
      const entry = await this.#store.read(seq);
      if (!entry) continue;

      if (entry.event.type === 'derivation.accepted') {
        results.push({
          fire: entry.event,
          seq,
        });
      }
    }

    return results;
  }

  /** The fires written so far, oldest first (optionally the most recent `limit`). */
  async read(limit?: number): Promise<CognitiveEvent[]> {
    return (await this.readEntries(limit)).map((entry) => entry.fire);
  }

  /**
   * Mark fires read back from disk as already-written, so a restore that
   * re-seeds the ring does not have the next flush append them a second time.
   */
  adopt(entries: ReadonlyArray<StoredDerivationFire>): void {
    for (const entry of entries) this.#seen.add(entry.fire);
  }

  /**
   * Replay the persisted log into the recorder's fire ring: re-seed
   * it with what a prior run derived, then adopt it so the next flush appends
   * only what the restart produced.
   */
  async replayInto(recorder: DerivationRecorder): Promise<number> {
    const entries = await this.readEntries();
    const fires = entries.map((entry) => entry.fire);
    const restored = recorder.restoreFires(fires);
    this.adopt(entries);
    if (restored > 0) this.#logger.info('Replayed the persisted derivation log', { fires: restored });
    return restored;
  }

  /** The completed chains written so far, oldest first (optionally the most recent `limit`). */
  async readRecords(limit?: number): Promise<StoredDerivationRecord[]> {
    const results: StoredDerivationRecord[] = [];

    for (let seq = this.#store.getFirstSeq(); seq <= this.#store.getLastSeq() && (!limit || results.length < limit); seq++) {
      const entry = await this.#store.read(seq);
      if (!entry) continue;

      if (entry.event.type === 'derivation.record') {
        results.push({
          record: entry.event,
          seq,
        });
      }
    }

    return results;
  }

  /**
   * Re-seed the completed ring from the persisted chains, so a
   * restart resumes the records a consumer's `records()`/`drain()` reads.
   */
  async replayRecordsInto(recorder: DerivationRecorder): Promise<number> {
    const entries = await this.readRecords();
    const records = entries.map((entry) => entry.record);
    const restored = recorder.restoreRecords(records);
    if (restored > 0) this.#logger.info('Replayed the persisted derivation chains', { chains: restored });
    return restored;
  }

  getBasePath(): string {
    return 'logstore';
  }

  close(): void {
    this.#unsubscribeRecords?.();
    this.#unsubscribeRecords = null;
  }
}

/**
 * Create a LogStoreDerivationLedger.
 */
export function createLogStoreDerivationLedger(
  store: LogStore,
  options?: DerivationLedgerOptions
): LogStoreDerivationLedger {
  return new LogStoreDerivationLedger(store, options);
}