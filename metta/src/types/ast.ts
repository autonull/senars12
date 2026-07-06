export type Symbol = string;
export type Variable = string;

export type MeTTaAtom =
  | { type: 'symbol'; value: Symbol }
  | { type: 'variable'; name: Variable }
  | { type: 'number'; value: number }
  | { type: 'expression'; items: readonly MeTTaAtom[] }
  | { type: 'grounded'; value: unknown; typeHint: string };

export const isExpression = (atom: MeTTaAtom): atom is Extract<MeTTaAtom, { type: 'expression' }> =>
  atom.type === 'expression';

export const isVariable = (atom: MeTTaAtom): atom is Extract<MeTTaAtom, { type: 'variable' }> =>
  atom.type === 'variable';

export const isGround = (atom: MeTTaAtom): atom is Extract<MeTTaAtom, { type: 'grounded' }> =>
  atom.type === 'grounded';

export const isSymbolType = (atom: MeTTaAtom): atom is Extract<MeTTaAtom, { type: 'symbol' }> =>
  atom.type === 'symbol';

export const isNumberType = (atom: MeTTaAtom): atom is Extract<MeTTaAtom, { type: 'number' }> =>
  atom.type === 'number';
