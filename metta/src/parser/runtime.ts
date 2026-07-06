import * as v from 'valibot';
import type { MeTTaAtom } from '../types/ast.js';

const BaseAtomSchema = v.union([
  v.object({ type: v.literal('symbol'), value: v.string() }),
  v.object({ type: v.literal('variable'), name: v.string() }),
  v.object({ type: v.literal('number'), value: v.number() }),
]);

const AtomSchema: v.GenericSchema<MeTTaAtom> = v.lazy(() =>
  v.union([
    BaseAtomSchema,
    v.object({ type: v.literal('expression'), items: v.array(AtomSchema) }),
    v.object({ type: v.literal('grounded'), value: v.unknown(), typeHint: v.string() }),
  ]) as v.GenericSchema<MeTTaAtom>
);

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (!c) break;
    if (/\s/.test(c)) { i++; continue; }
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

function parseTokens(tokens: string[], pos = { i: 0 }): MeTTaAtom {
  const token = tokens[pos.i];
  if (!token) throw new Error('Unexpected end of input');
  if (token === '(') {
    pos.i++;
    const items: MeTTaAtom[] = [];
    while (pos.i < tokens.length && tokens[pos.i] !== ')') {
      items.push(parseTokens(tokens, pos));
    }
    if (tokens[pos.i] !== ')') throw new Error('Unmatched opening paren');
    pos.i++;
    return { type: 'expression', items };
  }
  pos.i++;
  if (token.startsWith('$')) return { type: 'variable', name: token };
  const num = Number(token);
  if (!Number.isNaN(num)) return { type: 'number', value: num };
  return { type: 'symbol', value: token };
}

export function parseMeTTa(input: string): MeTTaAtom {
  const tokens = tokenize(input);
  if (tokens.length === 0) throw new Error('Empty input');
  const ast = parseTokens(tokens);
  return v.parse(AtomSchema, ast) as MeTTaAtom;
}
