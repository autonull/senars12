/**
 * LogStore-based DerivationLedger — runtime durability for derivation fire ring.
 *
 * Replaces file-based DerivationLedger with LogStore-backed persistence.
 * Uses the unified event log for all derivation events.
 */

import type { LogStore } from './store';
import type { CognitiveEvent } from './events';
import type { DerivationRecorder } from '../rules/impls/recorder';
import type { DerivationStep, DerivationRecord } from '../schemas/index';
import { createLogger } from '../util/index';
import { isDerivationAcceptedEvent, isDerivationRecordEvent } from './events';

export interface DerivationLedgerOptions {
  /** Where a replay reports what it resumed. */
  logger?: ReturnType<typeof createLogger>;
}

/**
 * LogStore-backed derivation ledger.
 * Derivation events are stored as CognitiveEvents with engine='nar' in the unified log.
 */
export class LogStoreDerivationLedger {
  readonly #store: LogStore;
  readonly #seen = new Set<string>(); // Track fires by stepId
  readonly #seenRecords = new Set<string>(); // Track records by derivationId
  readonly #logger: ReturnType<typeof createLogger>;
  readonly #cursor: number;

  constructor(store: LogStore, options: DerivationLedgerOptions = {}) {
    this.#store = store;
    this.#logger = options.logger ?? createLogger({ scope: 'NAR.LogStoreDerivationLedger' });
    this.#cursor = store.getLastSeq();
  }

  /** Get the current cursor position. */
  getCursor(): number {
    return this.#cursor;
  }

  /** Advance the cursor to the current log head. */
  advanceCursor(): void {
    // Cursor is implicitly the last seq
  }

  /**
   * Persist each completed chain as it closes (CORE.19 C3.4).
   * Push, not pull: the completed ring is drain-emptied by consumers.
   */
  observe(_recorder: DerivationRecorder): void {
    // Records are appended as 'derivation.record' events by the recorder
    // This method is kept for interface compatibility
  }

  /** Append every not-yet-written rule fire; returns how many were written. */
  async flush(recorder: DerivationRecorder): Promise<number> {
    let appended = 0;
    for (const fire of recorder.fires()) {
      if (this.#seen.has(fire.stepId)) continue;
      this.#seen.add(fire.stepId);

      // Convert fire to derivation.accepted event and append
      const event: CognitiveEvent = {
        type: 'derivation.accepted',
        engine: 'nar',
        timestamp: fire.timestamp ?? Date.now(),
        correlationId: fire.correlationId ?? crypto.randomUUID(),
        causationId: fire.correlationId,
        payload: {
          derivationId: fire.stepId, // Use stepId as derivationId for fire
          ruleId: fire.ruleId ?? 'unknown',
          ruleCategory: fire.ruleCategory,
          premises: fire.premises ?? [],
          conclusion: fire.conclusion,
          truth: fire.truth,
          premiseTruths: fire.premiseTruths,
          truthFn: fire.truthFn,
          evidenceLineage: fire.evidenceLineage ?? [],
          independenceCheck: fire.independence ?? 'independent',
          cycle: fire.cycle,
        },
      };

      await this.#store.append(event, { ts: event.timestamp });
      appended++;
    }
    return appended;
  }

  /** Append every not-yet-written completed derivation record; returns how many were written. */
  async flushRecords(recorder: DerivationRecorder): Promise<number> {
    let appended = 0;
    for (const record of recorder.records()) {
      // Use derivationId as the unique key for deduplication
      const key = record.derivationId;
      if (this.#seenRecords.has(key)) continue;
      this.#seenRecords.add(key);

      const event: CognitiveEvent = {
        type: 'derivation.record',
        engine: 'nar',
        timestamp: record.timestamp ?? Date.now(),
        correlationId: crypto.randomUUID(),
        causationId: record.derivationId,
        payload: record,
      };

      await this.#store.append(event, { ts: event.timestamp });
      appended++;
    }
    return appended;
  }

  /** Read derivation fires from the log, oldest first (incremental from cursor). */
  async read(limit?: number): Promise<CognitiveEvent[]> {
    const startSeq = this.#cursor + 1;
    const endSeq = this.#store.getLastSeq();

    if (startSeq > endSeq) return [];

    const entries = await this.#store.readRange(startSeq, endSeq);
    const fires = entries
      .map((e) => e.event)
      .filter((e) => e.engine === 'nar' && isDerivationAcceptedEvent(e));

    if (limit && fires.length > limit) {
      return fires.slice(-limit);
    }
    return fires;
  }

  /** Read ALL derivation fires from the log, oldest first (for replay/test). */
  async readAllFires(limit?: number): Promise<CognitiveEvent[]> {
    const startSeq = 1;
    const endSeq = this.#store.getLastSeq();

    if (startSeq > endSeq) return [];

    const entries = await this.#store.readRange(startSeq, endSeq);
    const fires = entries
      .map((e) => e.event)
      .filter((e) => e.engine === 'nar' && isDerivationAcceptedEvent(e));

    if (limit && fires.length > limit) {
      return fires.slice(-limit);
    }
    return fires;
  }

  /** Read completed derivation records from the log. */
  async readRecords(limit?: number): Promise<CognitiveEvent[]> {
    const startSeq = 1;
    const endSeq = this.#store.getLastSeq();

    if (startSeq > endSeq) return [];

    const entries = await this.#store.readRange(startSeq, endSeq);
    const records = entries
      .map((e) => e.event)
      .filter((e) => e.engine === 'nar' && isDerivationRecordEvent(e));

    if (limit && records.length > limit) {
      return records.slice(-limit);
    }
    return records;
  }

  /** Mark fires read back from disk as already-written. */
  adopt(entries: ReadonlyArray<CognitiveEvent>): void {
    for (const entry of entries) {
      if (isDerivationAcceptedEvent(entry) && entry.payload.derivationId) {
        this.#seen.add(entry.payload.derivationId);
      }
    }
  }

  /**
   * Replay the persisted log into the recorder's fire ring (CORE.19 C4.3).
   * Reads ALL fires from the log (not cursor-based) for full replay on restart.
   */
  async replayInto(recorder: DerivationRecorder): Promise<number> {
    const entries = await this.readAllFires();
    if (entries.length === 0) return 0;

    // Convert derivation.accepted payloads to DerivationStep
    const fires: DerivationStep[] = entries
      .filter(isDerivationAcceptedEvent)
      .map((e) => ({
        stepId: e.payload.derivationId ?? crypto.randomUUID(),
        ruleId: e.payload.ruleId ?? 'unknown',
        ruleCategory: e.payload.ruleCategory ?? 'logic',
        premises: e.payload.premises ?? [],
        conclusion: e.payload.conclusion,
        truth: e.payload.truth,
        truthFn: e.payload.truthFn,
        substitution: undefined,
        premiseTruths: e.payload.premiseTruths,
        evidenceLineage: e.payload.evidenceLineage ?? [],
        independence: e.payload.independenceCheck ?? 'independent',
        cycle: e.payload.cycle,
        correlationId: e.correlationId,
        timestamp: e.timestamp,
      }));

    const restored = recorder.restoreFires(fires);
    this.adopt(entries);

    if (restored > 0) {
      this.#logger.info('Replayed the persisted derivation log', { fires: restored });
    }
    return restored;
  }

  /**
   * Re-seed the completed ring from the persisted chains (CORE.19 C3.4).
   */
  async replayRecordsInto(recorder: DerivationRecorder): Promise<number> {
    const entries = await this.readRecords();
    if (entries.length === 0) return 0;

    // Convert derivation.record payloads to DerivationRecord
    const records: DerivationRecord[] = entries.map((e) => e.payload as DerivationRecord);

    const restored = recorder.restoreRecords(records);
    if (restored > 0) {
      this.#logger.info('Replayed the persisted derivation chains', { chains: restored });
    }
    return restored;
  }

  close(): void {
    // LogStore is managed externally
  }
}

/** Create a LogStoreDerivationLedger. */
export const createLogStoreDerivationLedger = (
  store: LogStore,
  options?: DerivationLedgerOptions
): LogStoreDerivationLedger => {
  return new LogStoreDerivationLedger(store, options);
};