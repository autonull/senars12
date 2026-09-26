import { Ledger, createLedger, BaseLedgerEntrySchema, type LedgerQuery } from '@senars/io';
import { z } from 'zod';

export interface DialogueTextRecord {
  turnId: string;
  sessionId: string;
  at: number;
  utterance?: string;
  response?: string;
  /** Present for `correct` reactions. */
  correction?: string;
}

/**
 * I6 relaxation sidecar (TODO24): raw exchange text for opted-in sessions.
 * Strictly separate from the hash-only episode/label/retrospective stores —
 * labels, frozen eval sets, and retrospectives never touch raw text, whatever
 * the retention mode. Backed by the generic `Ledger<T>` primitive from `@senars/io`.
 */
export class DialogueTextStore {
  readonly #ledger: Ledger<DialogueTextLedgerEntry>;

  constructor(path: string) {
    this.#ledger = createLedger<DialogueTextLedgerEntry>(path, DialogueTextRecordSchema, {
      rollover: { daily: true, maxEntriesPerFile: 10_000, retentionDays: 30 },
    });
  }

  async append(record: DialogueTextRecord): Promise<void> {
    const fullEntry = { ...record, at: record.at ?? Date.now() } as DialogueTextLedgerEntry;
    this.#ledger.append(fullEntry);
  }

  /** Upsert by turnId: appends a record, replacing any prior one for that turn. */
  async upsert(record: DialogueTextRecord): Promise<void> {
    // Append the new record (will be last for this turnId)
    this.#ledger.append({ ...record, at: record.at ?? Date.now() } as DialogueTextLedgerEntry);
    // Compact by turnId: keeps the last entry per turnId (the one we just appended)
    await this.#ledger.compact((e) => e.turnId);
  }

  /** Read all records (oldest first). */
  async read(): Promise<DialogueTextRecord[]> {
    const entries = await this.#ledger.query({});
    return entries.map((e) => ({
      turnId: e.turnId,
      sessionId: e.sessionId,
      at: e.at,
      utterance: e.utterance,
      response: e.response,
      correction: e.correction,
    }));
  }

  async get(turnId: string): Promise<DialogueTextRecord | undefined> {
    const entries = await this.#ledger.query({});
    return entries.find((e) => e.turnId === turnId) as DialogueTextRecord | undefined;
  }

  async purge(): Promise<void> {
    await this.#ledger.clear();
    this.#ledger.close();
  }
}

const DialogueTextRecordSchema = BaseLedgerEntrySchema.extend({
  turnId: z.string(),
  sessionId: z.string(),
  utterance: z.string().optional(),
  response: z.string().optional(),
  correction: z.string().optional(),
});

export type DialogueTextLedgerEntry = z.infer<typeof DialogueTextRecordSchema>;