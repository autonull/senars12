import { parseMeTTa } from '../parser/runtime.js';
import type { MeTTaAtom } from '../types/ast.js';
import { MeTTaError, ErrorCode } from '../core/errors.js';

export class MettaInputProcessor {
  async process(input: string): Promise<MeTTaAtom> {
    const trimmed = input.trim();
    if (!trimmed) throw new MeTTaError(ErrorCode.UNEXPECTED_TOKEN, 'Empty input');

    if (this.#looksLikeMeTTa(trimmed)) {
      try {
        return parseMeTTa(trimmed);
      } catch {
        return this.#translateToMeTTa(trimmed);
      }
    }

    return this.#translateToMeTTa(trimmed);
  }

  #looksLikeMeTTa(input: string): boolean {
    return input.startsWith('(') || input.startsWith('$') || /^[\w\-\+\*\/\<\>\=\?]+$/.test(input);
  }

  async #translateToMeTTa(input: string): Promise<MeTTaAtom> {
    return parseMeTTa(`(chat-input "${input.replace(/"/g, '\\"')}")`);
  }
}
