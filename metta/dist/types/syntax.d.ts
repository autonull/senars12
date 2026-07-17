export type VariableName = `$${string}`;
export type OperationName = `&${string}`;
export type TypeName = `%${string}`;
export type Keyword = 'True' | 'False' | 'Nil' | 'superpose' | 'match' | 'let';
export type ValidateAtomType<S extends string> = S extends VariableName ? 'variable' : S extends OperationName ? 'operation' : S extends TypeName ? 'type' : S extends Keyword ? 'keyword' : 'symbol';
export type ValidAtomName<S extends string> = ValidateAtomType<S>;
export type VariablePattern = `${string}$${string}`;
export type MatchPattern<S extends string> = S extends `(match ${infer Pattern} ${infer Target})` ? {
    pattern: Pattern;
    target: Target;
} : never;
//# sourceMappingURL=syntax.d.ts.map