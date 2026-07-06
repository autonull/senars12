export const enum AtomKind {
  Symbol = 0,
  Variable = 1,
  Number = 2,
  String = 3,
  Expression = 4,
  Grounded = 5,
}

export interface SymbolAtom {
  readonly kind: AtomKind.Symbol;
  readonly value: string;
  readonly interned?: boolean;
}

export interface VariableAtom {
  readonly kind: AtomKind.Variable;
  readonly name: string;
}

export interface NumberAtom {
  readonly kind: AtomKind.Number;
  readonly value: number;
}

export interface StringAtom {
  readonly kind: AtomKind.String;
  readonly value: string;
}

export interface ExpressionAtom {
  readonly kind: AtomKind.Expression;
  readonly operator: MeTTaAtom;
  readonly args: readonly MeTTaAtom[];
}

export interface GroundedAtom {
  readonly kind: AtomKind.Grounded;
  readonly op: string;
  readonly args: readonly MeTTaAtom[];
}

export type MeTTaAtom =
  | SymbolAtom
  | VariableAtom
  | NumberAtom
  | StringAtom
  | ExpressionAtom
  | GroundedAtom;

export const sym = (value: string): SymbolAtom => ({
  kind: AtomKind.Symbol,
  value,
});

export const varr = (name: string): VariableAtom => ({
  kind: AtomKind.Variable,
  name,
});

export const num = (value: number): NumberAtom => ({
  kind: AtomKind.Number,
  value,
});

export const str = (value: string): StringAtom => ({
  kind: AtomKind.String,
  value,
});

export const expr = (operator: MeTTaAtom, ...args: MeTTaAtom[]): ExpressionAtom => ({
  kind: AtomKind.Expression,
  operator,
  args,
});

export const isSymbol = (a: MeTTaAtom): a is SymbolAtom => a.kind === AtomKind.Symbol;
export const isVariable = (a: MeTTaAtom): a is VariableAtom => a.kind === AtomKind.Variable;
export const isNumber = (a: MeTTaAtom): a is NumberAtom => a.kind === AtomKind.Number;
export const isString = (a: MeTTaAtom): a is StringAtom => a.kind === AtomKind.String;
export const isExpression = (a: MeTTaAtom): a is ExpressionAtom => a.kind === AtomKind.Expression;
export const isGrounded = (a: MeTTaAtom): a is GroundedAtom => a.kind === AtomKind.Grounded;