import type { MeTTaAtom } from '../types/ast.js';

export interface EpisodicEntry {
  readonly timestamp: string;
  readonly humanMessage: string;
  readonly response: string;
  readonly sexpr?: string;
  readonly errorFeedback?: string;
}

export class MettaHistory {
  #entries: EpisodicEntry[] = [];
  #lastErrorFeedback: string | null = null;

  append(entry: EpisodicEntry): void {
    this.#entries.push(entry);
    this.#lastErrorFeedback = null;
  }

  getRecent(count: number): EpisodicEntry[] {
    return this.#entries.slice(-count);
  }

  getLastMessage(): string | null {
    if (this.#entries.length === 0) return null;
    return this.#entries[this.#entries.length - 1]?.humanMessage ?? null;
  }

  getLastResponse(): string | null {
    if (this.#entries.length === 0) return null;
    return this.#entries[this.#entries.length - 1]?.response ?? null;
  }

  setErrorFeedback(error: string): void {
    this.#lastErrorFeedback = error;
  }

  getErrorFeedback(): string | null {
    return this.#lastErrorFeedback;
  }

  clearErrorFeedback(): void {
    this.#lastErrorFeedback = null;
  }

  toPromptLines(count: number): string {
    return this.#entries
      .slice(-count)
      .map((e) => {
        let line = `${e.timestamp}\nHUMAN: ${e.humanMessage}\nRESPONSE: ${e.response}`;
        if (e.errorFeedback) line += `\nERROR_FEEDBACK: ${e.errorFeedback}`;
        return line;
      })
      .join('\n\n');
  }

  getAll(): readonly EpisodicEntry[] {
    return this.#entries;
  }

  clear(): void {
    this.#entries = [];
    this.#lastErrorFeedback = null;
  }
}
