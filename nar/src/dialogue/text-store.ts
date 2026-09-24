import { promises as fs } from 'node:fs';
import { join } from 'node:path';

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
 * the retention mode. Append-only JSONL keyed by turnId; delete the directory
 * to purge.
 */
export class DialogueTextStore {
  readonly #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  async append(record: DialogueTextRecord): Promise<void> {
    await fs.mkdir(this.#path, { recursive: true });
    await fs.appendFile(this.#file(), JSON.stringify(record) + '\n');
  }

  /** Upsert by turnId: appends a record, replacing any prior one for that turn. */
  async upsert(record: DialogueTextRecord): Promise<void> {
    const all = (await this.read()).filter((r) => r.turnId !== record.turnId);
    all.push(record);
    await fs.mkdir(this.#path, { recursive: true });
    await fs.writeFile(this.#file(), all.map((r) => JSON.stringify(r)).join('\n') + '\n');
  }

  /** Read all records (oldest first). */
  async read(): Promise<DialogueTextRecord[]> {
    let content: string;
    try {
      content = await fs.readFile(this.#file(), 'utf-8');
    } catch {
      return [];
    }
    return content
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as DialogueTextRecord);
  }

  async get(turnId: string): Promise<DialogueTextRecord | undefined> {
    return (await this.read()).find((r) => r.turnId === turnId);
  }

  async purge(): Promise<void> {
    await fs.rm(this.#path, { recursive: true, force: true }).catch(() => {});
  }

  #file(): string {
    return join(this.#path, 'dialogue-text.jsonl');
  }
}