import { ErrorCode, MeTTaError } from '../core/errors.js';
import type { MeTTaAtom } from '../types/ast.js';
import { num, sym, varr } from '../types/ast.js';

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (!c) break;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      tokens.push(c);
      i++;
      continue;
    }
    let word = '';
    while (i < input.length) {
      const ch = input[i];
      if (!ch || /\s/.test(ch) || ch === '(' || ch === ')') break;
      word += ch;
      i++;
    }
    if (word) tokens.push(word);
  }
  return tokens;
}

function parseTokens(tokens: string[], pos: { i: number } = { i: 0 }): MeTTaAtom {
  const token = tokens[pos.i];
  if (!token) throw new MeTTaError(ErrorCode.UNEXPECTED_TOKEN, 'Unexpected end of input');
  if (token === '(') {
    pos.i++;
    const items: MeTTaAtom[] = [];
    while (pos.i < tokens.length && tokens[pos.i] !== ')') {
      items.push(parseTokens(tokens, pos));
    }
    if (tokens[pos.i] !== ')')
      throw new MeTTaError(ErrorCode.UNMATCHED_PAREN, 'Unmatched opening paren');
    pos.i++;
    if (items.length === 0) {
      return sym('Nil');
    }
    const operator = items[0] as MeTTaAtom;
    const args = items.slice(1);
    return { kind: 4, operator, args };
  }
  pos.i++;
  if (token.startsWith('$')) return varr(token);
  const n = Number(token);
  if (!Number.isNaN(n)) return num(n);
  return sym(token);
}

export function parseMeTTa(input: string): MeTTaAtom {
  const tokens = tokenize(input);
  if (tokens.length === 0) throw new MeTTaError(ErrorCode.UNEXPECTED_TOKEN, 'Empty input');
  return parseTokens(tokens);
}
