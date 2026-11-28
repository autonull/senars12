export declare enum AtomKind {
    Symbol = 0,
    Variable = 1,
    Number = 2,
    String = 3,
    Expression = 4,
    Grounded = 5
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
export type MeTTaAtom = SymbolAtom | VariableAtom | NumberAtom | StringAtom | ExpressionAtom | GroundedAtom;
export declare const sym: (value: string) => SymbolAtom;
export declare const varr: (name: string) => VariableAtom;
export declare const num: (value: number) => NumberAtom;
export declare const str: (value: string) => StringAtom;
export declare const expr: (operator: MeTTaAtom, ...args: MeTTaAtom[]) => ExpressionAtom;
export declare const isSymbol: (a: MeTTaAtom) => a is SymbolAtom;
export declare const isVariable: (a: MeTTaAtom) => a is VariableAtom;
export declare const isNumber: (a: MeTTaAtom) => a is NumberAtom;
export declare const isString: (a: MeTTaAtom) => a is StringAtom;
export declare const isExpression: (a: MeTTaAtom) => a is ExpressionAtom;
export declare const isGrounded: (a: MeTTaAtom) => a is GroundedAtom;
//# sourceMappingURL=ast.d.ts.map