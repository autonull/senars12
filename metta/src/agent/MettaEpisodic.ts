import type { Space } from '../core/space.js';
import type { MeTTaAtom, StringAtom, SymbolAtom } from '../types/ast.js';
import { expr, str, sym } from '../types/ast.js';

export interface EpisodicEntry {
  readonly timestamp: string;
  readonly humanMessage: string;
  readonly response: string;
  readonly sexpr?: string;
  readonly errorFeedback?: string;
}

export class MettaEpisodicMemory {
  #space: Space;

  constructor(space: Space) {
    this.#space = space;
  }

  append(entry: EpisodicEntry): void {
    const ts = entry.timestamp;
    this.#space.add(expr(sym('episode'), str(ts), sym('human'), str(entry.humanMessage)));
    this.#space.add(expr(sym('episode'), str(ts), sym('response'), str(entry.response)));
    if (entry.sexpr) {
      this.#space.add(expr(sym('episode'), str(ts), sym('sexpr'), str(entry.sexpr)));
    }
    if (entry.errorFeedback) {
      this.#space.add(expr(sym('episode'), str(ts), sym('error'), str(entry.errorFeedback)));
    }
  }

  getEpisodes(aroundTime?: string, lines = 20): EpisodicEntry[] {
    const all = this.#getAllEntries();
    if (all.length === 0 || !aroundTime) {
      return all.slice(-lines);
    }

    const target = new Date(aroundTime).getTime();
    let closestIdx = 0;
    let closestDiff = Number.POSITIVE_INFINITY;
    for (let i = 0; i < all.length; i++) {
      const entry = all[i];
      if (!entry) continue;
      const diff = Math.abs(new Date(entry.timestamp).getTime() - target);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIdx = i;
      }
    }

    const half = Math.floor(lines / 2);
    const start = Math.max(0, closestIdx - half);
    return all.slice(start, start + lines);
  }

  getEpisodesByTime(timeStr: string, contextLines = 20): string {
    const episodes = this.getEpisodes(timeStr, contextLines);
    return episodes
      .map(
        (e) =>
          `${e.timestamp}\nHUMAN_MESSAGE: ${e.humanMessage}\n${e.response}${e.errorFeedback ? `\nERROR_FEEDBACK: ${e.errorFeedback}` : ''}`
      )
      .join('\n\n');
  }

  #getAllEntries(): EpisodicEntry[] {
    const entries: EpisodicEntry[] = [];
    for (const atom of this.#space.atoms) {
      const entry = this.#atomToEntry(atom);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  #getStringValue(atom: MeTTaAtom): string {
    if (atom.kind === 3) return (atom as StringAtom).value;
    if (atom.kind === 0) return (atom as SymbolAtom).value;
    return '';
  }

  #atomToEntry(atom: MeTTaAtom): EpisodicEntry | null {
    if (atom.kind !== 4) return null;
    const exprAtom = atom as { operator: MeTTaAtom; args: readonly MeTTaAtom[] };
    const op = exprAtom.operator;
    if (op.kind !== 0) return null;
    const opName = (op as SymbolAtom).value;
    if (opName !== 'episode') return null;

    const args = exprAtom.args;
    const arg0 = args.at(0);
    const arg1 = args.at(1);
    const arg2 = args.at(2);
    if (!arg0 || !arg1 || !arg2) return null;

    const ts = this.#getStringValue(arg0);
    const keyName = this.#getStringValue(arg1);
    const val = this.#getStringValue(arg2);
    if (!ts || !keyName) return null;

    if (keyName === 'sexpr') {
      return { timestamp: ts, humanMessage: '', response: '', sexpr: val };
    }
    if (keyName === 'error') {
      return { timestamp: ts, humanMessage: '', response: '', errorFeedback: val };
    }
    return {
      timestamp: ts,
      humanMessage: keyName === 'human' ? val : '',
      response: keyName === 'response' ? val : '',
    };
  }
}
